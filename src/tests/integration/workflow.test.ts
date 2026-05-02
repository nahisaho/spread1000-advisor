// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { FileProjectRepository } from '@/infrastructure/persistence/FileProjectRepository';
import { CollectContextUseCase } from '@/application/usecases/CollectContextUseCase';
import { GenerateResearchPlanUseCase } from '@/application/usecases/GenerateResearchPlanUseCase';
import { DesignAzureArchitectureUseCase } from '@/application/usecases/DesignAzureArchitectureUseCase';
import { EstimateCostUseCase } from '@/application/usecases/EstimateCostUseCase';
import { GenerateProposalUseCase } from '@/application/usecases/GenerateProposalUseCase';
import { ReviewProposalUseCase } from '@/application/usecases/ReviewProposalUseCase';
import { FinalReviewUseCase } from '@/application/usecases/FinalReviewUseCase';
import { ExportDeliverableUseCase } from '@/application/usecases/ExportDeliverableUseCase';
import { ContextCollectorPrompt } from '@/application/prompts/context-collector';
import { ResearchPlannerPrompt } from '@/application/prompts/research-planner';
import { AzureArchitectPrompt } from '@/application/prompts/azure-architect';
import { ProposalWriterPrompt } from '@/application/prompts/proposal-writer';
import { ProposalReviewerPrompt } from '@/application/prompts/proposal-reviewer';
import { WizardService } from '@/application/services/WizardService';
import { createEmptyMetaPrompt, META_PROMPT_KEYS } from '@/domain/models/MetaPrompt';
import type { MetaPrompt } from '@/domain/models/MetaPrompt';
import type { Proposal } from '@/domain/models/Proposal';
import { SECTION_CHAR_LIMITS } from '@/domain/models/Proposal';
import type { CostEstimate } from '@/domain/models/CostEstimate';
import { DISCLAIMER_TEXT } from '@/lib/disclaimer';
import { reconcileWizardState } from '@/domain/models/Project';
import { StepId, StepStatus, createInitialWizardState } from '@/domain/models/WizardStep';
import type { ILLMProvider, LLMStreamChunk, ChatMessage, ChatCompletionOptions } from '@/domain/interfaces/ILLMProvider';
import type { ICostService } from '@/domain/interfaces/ICostService';
import { exportProposalToMarkdown } from '@/infrastructure/export/MarkdownExporter';
import { exportProposalToExcel } from '@/infrastructure/export/ExcelExporter';
import { exportAllToZip } from '@/infrastructure/export/ZipExporter';

const TEST_DATA_DIR = join(process.cwd(), 'test-data-workflow-integration');

function createMockLLMProvider(responses: Record<string, string> = {}): ILLMProvider {
  const defaultResponse = 'これはモックLLMの応答です。180日間の研究計画。';
  return {
    providerId: 'mock',
    displayName: 'Mock Provider',
    async chatCompletion(messages: ChatMessage[]): Promise<string> {
      const userMsg = messages.find((m) => m.role === 'user')?.content ?? '';
      for (const [key, response] of Object.entries(responses)) {
        if (userMsg.includes(key)) return response;
      }
      return defaultResponse;
    },
    async *chatCompletionStream(messages: ChatMessage[]): AsyncIterable<LLMStreamChunk> {
      const userMsg = messages.find((m) => m.role === 'user')?.content ?? '';
      let text = defaultResponse;
      for (const [key, response] of Object.entries(responses)) {
        if (userMsg.includes(key)) {
          text = response;
          break;
        }
      }
      const words = text.split(' ');
      for (let i = 0; i < words.length; i++) {
        yield { content: (i > 0 ? ' ' : '') + words[i], done: i === words.length - 1 };
      }
    },
    async testConnection() {
      return { ok: true };
    },
  };
}

function createMockCostService(): ICostService {
  return {
    async lookupPrice(serviceName: string) {
      return {
        unitPriceJpy: 50000,
        originalCurrency: 'JPY',
        originalUnitPrice: 50000,
        source: 'api' as const,
        retailPriceId: 'mock-price-id',
        retrievedAt: new Date().toISOString(),
      };
    },
    async isAvailable() {
      return true;
    },
  };
}

function buildFilledMetaPrompt(): MetaPrompt {
  const mp = createEmptyMetaPrompt();
  const answers: Record<string, string> = {
    PURPOSE: 'AIを用いた新薬候補物質の探索を高速化する研究',
    TARGET: '製薬企業の創薬研究者',
    SCOPE: '低分子化合物のバーチャルスクリーニング',
    TIMELINE: '180日間',
    CONSTRAINTS: '直接経費500万円以内',
    DELIVERABLES: '論文1本、予測モデル、公開データセット',
  };
  const elements = { ...mp.elements };
  for (const key of META_PROMPT_KEYS) {
    elements[key] = { key, value: answers[key], source: 'user', confirmed: true };
  }
  return { elements, approved: true };
}

function buildCompleteProposal(projectId: string): Proposal {
  return {
    projectId,
    sections: [
      {
        id: 'research_purpose',
        title: '研究目的',
        content: 'AIを活用した創薬研究の加速化を目的とし、分子動力学シミュレーションとディープラーニングを統合する。180日間で研究を遂行する。'.repeat(2),
        charLimit: SECTION_CHAR_LIMITS.research_purpose,
      },
      {
        id: 'research_method',
        title: '研究手法',
        content: '大規模言語モデルを活用し、化合物の活性予測モデルを構築する。データ収集、前処理、モデル訓練、検証の4段階で180日間の研究期間で実施する。'.repeat(3),
        charLimit: SECTION_CHAR_LIMITS.research_method,
      },
      {
        id: 'ai_validity',
        title: 'AI活用の妥当性',
        content: '従来のHTS手法と比較し、AIベースのバーチャルスクリーニングは探索空間を1000倍に拡大でき、計算コストを10分の1に削減可能。GNNとTransformerを組み合わせる。'.repeat(3),
        charLimit: SECTION_CHAR_LIMITS.ai_validity,
      },
      {
        id: 'achievement_goals',
        title: '達成目標',
        content: '予測精度AUC0.9以上の活性予測モデルを構築。10万化合物のスクリーニングを1日以内に完了可能なパイプラインを開発。中間マイルストーンとして60日目にベースライン構築。'.repeat(1),
        charLimit: SECTION_CHAR_LIMITS.achievement_goals,
      },
      {
        id: 'knowhow_sharing',
        title: 'ノウハウ共有',
        content: '研究成果をGitHubで公開し、論文をarXivに投稿する。学会発表で知見を共有する。再現性を確保するためDockerコンテナを提供。'.repeat(1),
        charLimit: SECTION_CHAR_LIMITS.knowhow_sharing,
      },
      {
        id: 'research_achievements',
        title: '研究実績',
        content: '関連する論文を5本発表済み。国際会議での招待講演2件。創薬AI分野で3年の実績を有する。'.repeat(2),
        charLimit: SECTION_CHAR_LIMITS.research_achievements,
      },
      {
        id: 'expense_plan',
        title: '経費計画',
        content: 'Azure OpenAI Service: ¥500,000、Azure VM (NC series): ¥2,000,000、Azure Blob Storage: ¥100,000、Azure ML: ¥400,000。合計: ¥3,000,000。総合計（間接経費込み）: ¥3,900,000。',
        charLimit: SECTION_CHAR_LIMITS.expense_plan,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildCostEstimate(directTotal: number = 3_000_000): CostEstimate {
  const indirectTotal = Math.round(directTotal * 0.3);
  return {
    items: [
      {
        resourceName: 'Azure OpenAI Service',
        sku: 'S0',
        region: 'japaneast',
        quantity: 1,
        unit: '月',
        unitPrice: 500_000,
        monthlyTotal: 500_000,
        verificationStatus: 'api_verified',
      },
      {
        resourceName: 'Azure Virtual Machines NC series',
        sku: 'NC6s_v3',
        region: 'japaneast',
        quantity: 6,
        unit: '月',
        unitPrice: 250_000,
        monthlyTotal: 1_500_000,
        verificationStatus: 'api_verified',
      },
      {
        resourceName: 'Azure Blob Storage',
        sku: 'Standard_LRS',
        region: 'japaneast',
        quantity: 6,
        unit: '月',
        unitPrice: 10_000,
        monthlyTotal: 60_000,
        verificationStatus: 'api_verified',
      },
      {
        resourceName: 'Azure Machine Learning',
        sku: 'Enterprise',
        region: 'japaneast',
        quantity: 6,
        unit: '月',
        unitPrice: 156_667,
        monthlyTotal: 940_000,
        verificationStatus: 'api_verified',
      },
    ],
    directCostTotal: directTotal,
    indirectCostRate: 0.3,
    indirectCostTotal: indirectTotal,
    grandTotal: directTotal + indirectTotal,
    currency: 'JPY',
    retrievedAt: new Date().toISOString(),
  };
}

describe('Full Wizard Workflow', () => {
  let repo: FileProjectRepository;
  let projectId: string;

  beforeEach(async () => {
    repo = new FileProjectRepository(TEST_DATA_DIR);
  });

  afterEach(async () => {
    if (existsSync(TEST_DATA_DIR)) {
      await rm(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  it('creates a new project', async () => {
    const meta = await repo.create('test-project-001');
    projectId = meta.id;

    expect(meta.name).toBe('test-project-001');
    expect(meta.llmProvider).toBe('openai');
    expect(meta.wizardState.currentStep).toBe(StepId.CONTEXT_COLLECTION);

    const projectJsonPath = join(TEST_DATA_DIR, projectId, 'project.json');
    expect(existsSync(projectJsonPath)).toBe(true);

    const savedMeta = await repo.get(projectId);
    expect(savedMeta).not.toBeNull();
    expect(savedMeta!.id).toBe(projectId);
  });

  it('collects context via CollectContextUseCase', async () => {
    const meta = await repo.create('context-test');
    projectId = meta.id;

    const mockLLM = createMockLLMProvider({
      PURPOSE: '研究目的について教えてください。',
    });
    const prompt = new ContextCollectorPrompt();
    const useCase = new CollectContextUseCase(mockLLM, repo, prompt);

    let mp = createEmptyMetaPrompt();

    const answers: Record<string, string> = {
      PURPOSE: 'AI創薬の高速化',
      TARGET: '製薬企業研究者',
      SCOPE: 'バーチャルスクリーニング',
      TIMELINE: '180日間',
      CONSTRAINTS: '500万円以内',
      DELIVERABLES: '論文・モデル・データセット',
    };

    for (const key of META_PROMPT_KEYS) {
      mp = await useCase.saveAnswer(projectId, mp, key, answers[key]);
    }

    expect(useCase.isComplete(mp)).toBe(true);

    const savedContent = await repo.loadDeliverable(projectId, 'meta-prompt.md');
    expect(savedContent).not.toBeNull();
    expect(savedContent).toContain('PURPOSE');
    expect(savedContent).toContain('AI創薬の高速化');
    expect(savedContent).toContain('✅');
  });

  it('generates research plan', async () => {
    const meta = await repo.create('research-plan-test');
    projectId = meta.id;
    const metaPrompt = buildFilledMetaPrompt();

    const mockLLM = createMockLLMProvider();
    const prompt = new ResearchPlannerPrompt();
    const useCase = new GenerateResearchPlanUseCase(mockLLM, repo, prompt);

    const chunks: string[] = [];
    for await (const chunk of useCase.execute(projectId, metaPrompt)) {
      chunks.push(chunk.content);
    }

    expect(chunks.length).toBeGreaterThan(0);

    const savedContent = await repo.loadDeliverable(projectId, 'phase0-research-plan.md');
    expect(savedContent).not.toBeNull();
    expect(savedContent).toContain(DISCLAIMER_TEXT);
  });

  it('generates Azure architecture', async () => {
    const meta = await repo.create('azure-arch-test');
    projectId = meta.id;
    const metaPrompt = buildFilledMetaPrompt();

    // Save research plan first (prerequisite)
    await repo.saveDeliverable(projectId, 'phase0-research-plan.md', '# 研究計画\nテスト研究計画内容');

    const mockLLM = createMockLLMProvider();
    const prompt = new AzureArchitectPrompt();
    const useCase = new DesignAzureArchitectureUseCase(mockLLM, repo, prompt);

    const chunks: string[] = [];
    for await (const chunk of useCase.execute(projectId, metaPrompt)) {
      chunks.push(chunk.content);
    }

    expect(chunks.length).toBeGreaterThan(0);

    const savedContent = await repo.loadDeliverable(projectId, 'phase1-azure-architecture.md');
    expect(savedContent).not.toBeNull();
    expect(savedContent).toContain(DISCLAIMER_TEXT);
  });

  it('estimates costs', async () => {
    const meta = await repo.create('cost-estimate-test');
    projectId = meta.id;

    // Save azure architecture (prerequisite)
    const archContent = [
      '# Azure アーキテクチャ',
      '## リソース一覧',
      '| リソース | SKU | リージョン | 月額 |',
      '| Azure OpenAI Service | S0 | japaneast | ¥500,000 |',
      '| Azure VM NC6s_v3 | NC6s_v3 | japaneast | ¥250,000 |',
    ].join('\n');
    await repo.saveDeliverable(projectId, 'phase1-azure-architecture.md', archContent);

    const extractionResponse = JSON.stringify([
      { resourceName: 'Azure OpenAI Service', sku: 'S0', region: 'japaneast', quantity: 1, unit: '月', estimatedUnitPrice: 500000 },
      { resourceName: 'Azure VM NC6s_v3', sku: 'NC6s_v3', region: 'japaneast', quantity: 1, unit: '月', estimatedUnitPrice: 250000 },
    ]);

    const mockLLM = createMockLLMProvider();
    // Override chatCompletion for extraction
    mockLLM.chatCompletion = async () => extractionResponse;

    const mockCost = createMockCostService();
    const useCase = new EstimateCostUseCase(mockLLM, repo, mockCost);

    const estimate = await useCase.execute(projectId);

    expect(estimate.items.length).toBe(2);
    expect(estimate.currency).toBe('JPY');
    expect(estimate.directCostTotal).toBeGreaterThan(0);
    expect(estimate.indirectCostTotal).toBe(Math.round(estimate.directCostTotal * 0.3));

    const savedContent = await repo.loadDeliverable(projectId, 'phase2-cost-estimate.md');
    expect(savedContent).not.toBeNull();
    expect(savedContent).toContain(DISCLAIMER_TEXT);
    expect(savedContent).toContain('コスト見積もり');
  });

  it('generates proposal sections', async () => {
    const meta = await repo.create('proposal-test');
    projectId = meta.id;
    const metaPrompt = buildFilledMetaPrompt();

    await repo.saveDeliverable(projectId, 'phase0-research-plan.md', '# 研究計画');
    await repo.saveDeliverable(projectId, 'phase1-azure-architecture.md', '# Azure アーキテクチャ');

    const mockLLM = createMockLLMProvider();
    const prompt = new ProposalWriterPrompt();
    const useCase = new GenerateProposalUseCase(mockLLM, repo, prompt);

    // Generate a single section
    const chunks: string[] = [];
    for await (const chunk of useCase.generateSection(projectId, 'research_purpose', metaPrompt)) {
      chunks.push(chunk.content);
    }
    expect(chunks.length).toBeGreaterThan(0);

    // Save full proposal
    const proposal = buildCompleteProposal(projectId);
    await useCase.saveProposal(projectId, proposal);

    const savedContent = await repo.loadDeliverable(projectId, 'phase3-proposal.md');
    expect(savedContent).not.toBeNull();
    expect(savedContent).toContain('SPReAD-1000 申請書');
    expect(savedContent).toContain(DISCLAIMER_TEXT);
  });

  it('reviews proposal', async () => {
    const meta = await repo.create('review-test');
    projectId = meta.id;
    const metaPrompt = buildFilledMetaPrompt();
    const proposal = buildCompleteProposal(projectId);

    const mockLLM = createMockLLMProvider();
    const prompt = new ProposalReviewerPrompt();
    const useCase = new ReviewProposalUseCase(mockLLM, repo, prompt);

    const chunks: string[] = [];
    for await (const chunk of useCase.execute(projectId, proposal, metaPrompt)) {
      chunks.push(chunk.content);
    }

    expect(chunks.length).toBeGreaterThan(0);

    const savedContent = await repo.loadDeliverable(projectId, 'review-report.md');
    expect(savedContent).not.toBeNull();
    expect(savedContent).toContain(DISCLAIMER_TEXT);
  });

  it('runs final review with mandatory checks', async () => {
    const meta = await repo.create('final-review-test');
    projectId = meta.id;

    const proposal = buildCompleteProposal(projectId);
    const costEstimate = buildCostEstimate();
    const useCase = new FinalReviewUseCase(repo);

    const result = await useCase.execute(projectId, proposal, costEstimate);

    // Verify all 10 mandatory checks ran
    expect(result.mandatoryChecks.length).toBe(10);

    const checkIds = result.mandatoryChecks.map((c) => c.id);
    expect(checkIds).toContain('purpose-present');
    expect(checkIds).toContain('ai-utilization');
    expect(checkIds).toContain('period-within-180');
    expect(checkIds).toContain('direct-cost-limit');
    expect(checkIds).toContain('indirect-cost-ratio');
    expect(checkIds).toContain('char-limits');
    expect(checkIds).toContain('azure-resources');
    expect(checkIds).toContain('cost-detail');
    expect(checkIds).toContain('achievements-present');
    expect(checkIds).toContain('knowledge-sharing');

    // Cross-phase checks
    expect(result.crossPhaseChecks.length).toBeGreaterThan(0);

    // Judgment is calculated
    expect(['🟢', '🟡', '🔴']).toContain(result.judgment);

    // Saved to file
    const savedContent = await repo.loadDeliverable(projectId, 'final-review-report.md');
    expect(savedContent).not.toBeNull();
    expect(savedContent).toContain(DISCLAIMER_TEXT);
    expect(savedContent).toContain('必須チェック');
  });

  it('exports deliverables as markdown', async () => {
    const meta = await repo.create('export-md-test');
    projectId = meta.id;
    const proposal = buildCompleteProposal(projectId);

    const useCase = new ExportDeliverableUseCase(
      repo,
      exportProposalToExcel,
      exportProposalToMarkdown,
      exportAllToZip,
    );

    // Save a deliverable first
    await repo.saveDeliverable(projectId, 'phase3-proposal.md', '# テスト提案書\n内容');

    const result = await useCase.exportSingle(projectId, 'phase3-proposal.md', 'markdown');

    expect(result.mimeType).toBe('text/markdown; charset=utf-8');
    expect(result.data.length).toBeGreaterThan(0);
    const content = result.data.toString('utf-8');
    expect(content).toContain(DISCLAIMER_TEXT);
  });

  it('exports deliverables as Excel', async () => {
    const meta = await repo.create('export-xlsx-test');
    projectId = meta.id;

    await repo.saveDeliverable(projectId, 'phase3-proposal.md', '# テスト提案書\n内容テスト');

    const useCase = new ExportDeliverableUseCase(
      repo,
      exportProposalToExcel,
      exportProposalToMarkdown,
      exportAllToZip,
    );

    const result = await useCase.exportSingle(projectId, 'phase3-proposal.md', 'xlsx');

    expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.filename).toContain('.xlsx');
  });

  it('reconciles wizard state from deliverables', async () => {
    const meta = await repo.create('reconcile-test');
    projectId = meta.id;

    // Save some deliverables
    await repo.saveDeliverable(projectId, 'meta-prompt.md', '# メタプロンプト');
    await repo.saveDeliverable(projectId, 'phase0-research-plan.md', '# 研究計画');
    await repo.saveDeliverable(projectId, 'phase1-azure-architecture.md', '# Azure アーキテクチャ');

    const initialState = createInitialWizardState(projectId);
    const deliverables = await repo.listDeliverables(projectId);

    const reconciledState = reconcileWizardState(initialState, deliverables);

    expect(reconciledState.steps[StepId.CONTEXT_COLLECTION]).toBe(StepStatus.COMPLETED);
    expect(reconciledState.steps[StepId.RESEARCH_PLAN]).toBe(StepStatus.COMPLETED);
    expect(reconciledState.steps[StepId.AZURE_ARCHITECTURE]).toBe(StepStatus.COMPLETED);
    expect(reconciledState.steps[StepId.COST_ESTIMATE]).toBe(StepStatus.NOT_STARTED);
    expect(reconciledState.steps[StepId.PROPOSAL]).toBe(StepStatus.NOT_STARTED);
  });
});
