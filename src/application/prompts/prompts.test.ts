import { describe, it, expect } from 'vitest';
import { createEmptyMetaPrompt, type MetaPrompt, type MetaPromptKey } from '@/domain/models/MetaPrompt';
import { ContextCollectorPrompt } from './context-collector';
import { ResearchPlannerPrompt } from './research-planner';
import { AzureArchitectPrompt } from './azure-architect';
import { ProposalWriterPrompt } from './proposal-writer';
import { ProposalReviewerPrompt } from './proposal-reviewer';

function createFilledMetaPrompt(): MetaPrompt {
  return {
    elements: {
      PURPOSE: { key: 'PURPOSE', value: '深層学習を用いた創薬プロセスの加速', source: 'user', confirmed: true },
      TARGET: { key: 'TARGET', value: 'タンパク質構造予測', source: 'user', confirmed: true },
      SCOPE: { key: 'SCOPE', value: '低分子化合物のバインディング予測', source: 'user', confirmed: true },
      TIMELINE: { key: 'TIMELINE', value: '180日間', source: 'user', confirmed: true },
      CONSTRAINTS: { key: 'CONSTRAINTS', value: '予算500万円以内、GPU計算資源が必要', source: 'user', confirmed: true },
      DELIVERABLES: { key: 'DELIVERABLES', value: '予測モデル、論文1本、公開データセット', source: 'user', confirmed: true },
    },
    approved: true,
  };
}

describe('ContextCollectorPrompt', () => {
  const prompt = new ContextCollectorPrompt();

  it('can be instantiated', () => {
    expect(prompt).toBeInstanceOf(ContextCollectorPrompt);
  });

  it('build() returns messages with a system message', () => {
    const messages = prompt.build('PURPOSE', {});
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].role).toBe('system');
  });

  it('system message contains SPReAD-1000 and Japanese domain terms', () => {
    const messages = prompt.build('PURPOSE', {});
    const systemContent = messages[0].content;
    expect(systemContent).toContain('SPReAD-1000');
    expect(systemContent).toContain('研究');
    expect(systemContent).toContain('日本語');
  });

  it('includes previous answers as context', () => {
    const partial = createFilledMetaPrompt();
    const messages = prompt.build('SCOPE', partial);
    const systemContent = messages[0].content;
    expect(systemContent).toContain('深層学習を用いた創薬プロセスの加速');
  });

  it('includes the current key label in the prompt', () => {
    const messages = prompt.build('TARGET', {});
    const systemContent = messages[0].content;
    expect(systemContent).toContain('対象・ターゲット');
  });
});

describe('ResearchPlannerPrompt', () => {
  const prompt = new ResearchPlannerPrompt();

  it('can be instantiated', () => {
    expect(prompt).toBeInstanceOf(ResearchPlannerPrompt);
  });

  it('build() returns messages with a system message', () => {
    const messages = prompt.build(createFilledMetaPrompt());
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].role).toBe('system');
  });

  it('system message contains research planning keywords', () => {
    const messages = prompt.build(createFilledMetaPrompt());
    const systemContent = messages[0].content;
    expect(systemContent).toContain('SPReAD-1000');
    expect(systemContent).toContain('180日');
    expect(systemContent).toContain('AI for Science');
    expect(systemContent).toContain('研究計画');
  });

  it('user message includes meta prompt elements', () => {
    const messages = prompt.build(createFilledMetaPrompt());
    const userMsg = messages.find((m) => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg!.content).toContain('深層学習を用いた創薬プロセスの加速');
  });
});

describe('AzureArchitectPrompt', () => {
  const prompt = new AzureArchitectPrompt();

  it('can be instantiated', () => {
    expect(prompt).toBeInstanceOf(AzureArchitectPrompt);
  });

  it('build() returns messages with a system message', () => {
    const messages = prompt.build(createFilledMetaPrompt(), '研究計画テキスト');
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].role).toBe('system');
  });

  it('system message contains Azure and budget keywords', () => {
    const messages = prompt.build(createFilledMetaPrompt(), '研究計画テキスト');
    const systemContent = messages[0].content;
    expect(systemContent).toContain('Azure');
    expect(systemContent).toContain('GPU');
    expect(systemContent).toContain('5,000,000');
    expect(systemContent).toContain('SKU');
  });

  it('user message includes research plan', () => {
    const messages = prompt.build(createFilledMetaPrompt(), '計算化学のためのGPUクラスタ');
    const userMsg = messages.find((m) => m.role === 'user');
    expect(userMsg!.content).toContain('計算化学のためのGPUクラスタ');
  });
});

describe('ProposalWriterPrompt', () => {
  const prompt = new ProposalWriterPrompt();

  it('can be instantiated', () => {
    expect(prompt).toBeInstanceOf(ProposalWriterPrompt);
  });

  it('build() returns messages with a system message', () => {
    const messages = prompt.build(
      'research_purpose',
      createFilledMetaPrompt(),
      '研究計画',
      'Azure構成',
      { min: 80, max: 400 }
    );
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].role).toBe('system');
  });

  it('system message contains character limits', () => {
    const messages = prompt.build(
      'research_purpose',
      createFilledMetaPrompt(),
      '研究計画',
      'Azure構成',
      { min: 80, max: 400 }
    );
    const systemContent = messages[0].content;
    expect(systemContent).toContain('80');
    expect(systemContent).toContain('400');
    expect(systemContent).toContain('文字');
  });

  it('system message contains review criteria keywords', () => {
    const messages = prompt.build(
      'ai_validity',
      createFilledMetaPrompt(),
      '研究計画',
      'Azure構成',
      { min: 160, max: 800 }
    );
    const systemContent = messages[0].content;
    expect(systemContent).toContain('審査');
    expect(systemContent).toContain('AI活用の妥当性');
  });

  it('includes section-specific guidance', () => {
    const messages = prompt.build(
      'expense_plan',
      createFilledMetaPrompt(),
      '研究計画',
      'Azure構成',
      { min: 0, max: 2000 }
    );
    const systemContent = messages[0].content;
    expect(systemContent).toContain('経費計画');
    expect(systemContent).toContain('500万円');
  });
});

describe('ProposalReviewerPrompt', () => {
  const prompt = new ProposalReviewerPrompt();

  it('can be instantiated', () => {
    expect(prompt).toBeInstanceOf(ProposalReviewerPrompt);
  });

  it('build() returns messages with a system message', () => {
    const proposal = { research_purpose: '本研究では...' };
    const messages = prompt.build(proposal, createFilledMetaPrompt());
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].role).toBe('system');
  });

  it('system message contains all 6 review criteria', () => {
    const proposal = { research_purpose: '本研究では...' };
    const messages = prompt.build(proposal, createFilledMetaPrompt());
    const systemContent = messages[0].content;
    expect(systemContent).toContain('研究の社会的意義');
    expect(systemContent).toContain('AI活用の妥当性');
    expect(systemContent).toContain('研究手法の具体性');
    expect(systemContent).toContain('Azure活用度');
    expect(systemContent).toContain('研究遂行能力');
    expect(systemContent).toContain('コスト計画の妥当性');
  });

  it('system message contains scoring symbols', () => {
    const proposal = { research_purpose: '本研究では...' };
    const messages = prompt.build(proposal, createFilledMetaPrompt());
    const systemContent = messages[0].content;
    expect(systemContent).toContain('◎');
    expect(systemContent).toContain('○');
    expect(systemContent).toContain('△');
    expect(systemContent).toContain('×');
  });

  it('user message includes proposal content', () => {
    const proposal = {
      research_purpose: '深層学習による創薬',
      research_method: 'GNNを用いた分子特性予測',
    };
    const messages = prompt.build(proposal, createFilledMetaPrompt());
    const userMsg = messages.find((m) => m.role === 'user');
    expect(userMsg!.content).toContain('深層学習による創薬');
    expect(userMsg!.content).toContain('GNNを用いた分子特性予測');
  });
});
