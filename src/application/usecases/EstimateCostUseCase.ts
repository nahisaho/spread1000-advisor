import type { ILLMProvider, ChatMessage } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { ICostService } from '@/domain/interfaces/ICostService';
import type { CostEstimate, CostLineItem, PriceVerificationStatus } from '@/domain/models/CostEstimate';
import { validateBudget } from '@/domain/models/CostEstimate';
import { appendDisclaimer } from '@/lib/disclaimer';

interface ExtractedResource {
  readonly resourceName: string;
  readonly sku: string;
  readonly region: string;
  readonly quantity: number;
  readonly unit: string;
  readonly estimatedUnitPrice: number;
}

const EXTRACTION_PROMPT: ChatMessage[] = [
  {
    role: 'system',
    content: [
      'あなたは Azure アーキテクチャ文書からリソース一覧を抽出する専門家です。',
      '以下のJSON配列形式で出力してください。余計なテキストは不要です。',
      '```json',
      '[',
      '  {',
      '    "resourceName": "Azure OpenAI Service",',
      '    "sku": "S0",',
      '    "region": "japaneast",',
      '    "quantity": 1,',
      '    "unit": "月",',
      '    "estimatedUnitPrice": 50000',
      '  }',
      ']',
      '```',
      '- resourceName: Azure サービス名（"Azure" を含めること）',
      '- sku: SKU名（不明な場合は "Standard"）',
      '- region: リージョン（不明な場合は "japaneast"）',
      '- quantity: 数量',
      '- unit: 単位（"月", "時間", "GB" 等）',
      '- estimatedUnitPrice: 推定月額単価（JPY）',
    ].join('\n'),
  },
];

function parseResources(rawJson: string): ExtractedResource[] {
  const jsonMatch = rawJson.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  const parsed: unknown = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((r: Record<string, unknown>) => ({
    resourceName: String(r.resourceName ?? ''),
    sku: String(r.sku ?? 'Standard'),
    region: String(r.region ?? 'japaneast'),
    quantity: Number(r.quantity ?? 1),
    unit: String(r.unit ?? '月'),
    estimatedUnitPrice: Number(r.estimatedUnitPrice ?? 0),
  }));
}

function formatCostMarkdown(estimate: CostEstimate): string {
  const budget = validateBudget(estimate);
  const lines: string[] = [
    '# コスト見積もり（Phase 2）',
    '',
    '| リソース名 | SKU | リージョン | 数量 | 単位 | 単価(JPY) | 月額(JPY) | 検証状態 |',
    '|------------|-----|-----------|------|------|-----------|-----------|----------|',
  ];

  for (const item of estimate.items) {
    lines.push(
      `| ${item.resourceName} | ${item.sku} | ${item.region} | ${item.quantity} | ${item.unit} | ${item.unitPrice.toLocaleString()} | ${item.monthlyTotal.toLocaleString()} | ${item.verificationStatus} |`,
    );
  }

  lines.push(
    '',
    `**直接経費合計**: ¥${estimate.directCostTotal.toLocaleString()}`,
    `**間接経費（30%）**: ¥${estimate.indirectCostTotal.toLocaleString()}`,
    `**総合計**: ¥${estimate.grandTotal.toLocaleString()}`,
    '',
    `予算上限内: ${budget.withinLimit ? '✅' : '❌'}`,
    `全価格API検証済: ${budget.allPricesVerified ? '✅' : '⚠️ 未検証あり'}`,
  );

  return lines.join('\n');
}

export class EstimateCostUseCase {
  constructor(
    private readonly llmProvider: ILLMProvider,
    private readonly projectRepo: IProjectRepository,
    private readonly costService: ICostService,
  ) {}

  async execute(projectId: string): Promise<CostEstimate> {
    const architecture = await this.projectRepo.loadDeliverable(projectId, 'phase1-azure-architecture.md');
    if (!architecture) {
      throw new Error('Azure architecture not found');
    }

    const messages: ChatMessage[] = [
      ...EXTRACTION_PROMPT,
      { role: 'user', content: architecture },
    ];
    const rawJson = await this.llmProvider.chatCompletion(messages);
    const resources = parseResources(rawJson);

    const items: CostLineItem[] = [];
    for (const resource of resources) {
      let unitPrice = resource.estimatedUnitPrice;
      let verificationStatus: PriceVerificationStatus = 'estimated';
      let retailPriceId: string | undefined;

      try {
        const result = await this.costService.lookupPrice(
          resource.resourceName,
          resource.sku,
          resource.region,
        );
        unitPrice = result.unitPriceJpy;
        verificationStatus = result.source === 'api' ? 'api_verified' : 'estimated';
        retailPriceId = result.retailPriceId;
      } catch {
        // Keep LLM-estimated price when API lookup fails
      }

      items.push({
        resourceName: resource.resourceName,
        sku: resource.sku,
        region: resource.region,
        quantity: resource.quantity,
        unit: resource.unit,
        unitPrice,
        monthlyTotal: unitPrice * resource.quantity,
        verificationStatus,
        retailPriceId,
      });
    }

    const directCostTotal = items.reduce((sum, i) => sum + i.monthlyTotal, 0);
    const indirectCostTotal = Math.round(directCostTotal * 0.3);

    const estimate: CostEstimate = {
      items,
      directCostTotal,
      indirectCostRate: 0.3,
      indirectCostTotal,
      grandTotal: directCostTotal + indirectCostTotal,
      currency: 'JPY',
      retrievedAt: new Date().toISOString(),
    };

    validateBudget(estimate);

    const markdown = formatCostMarkdown(estimate);
    await this.projectRepo.saveDeliverable(
      projectId,
      'phase2-cost-estimate.md',
      appendDisclaimer(markdown),
    );

    return estimate;
  }
}
