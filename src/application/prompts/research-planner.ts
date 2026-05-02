import type { MetaPrompt } from '@/domain/models/MetaPrompt';
import type { PromptMessage } from './types';

const KEY_LABELS: Record<string, string> = {
  PURPOSE: '研究目的',
  TARGET: '対象・ターゲット',
  SCOPE: '研究範囲',
  TIMELINE: 'スケジュール',
  CONSTRAINTS: '制約条件',
  DELIVERABLES: '成果物',
};

export class ResearchPlannerPrompt {
  build(metaPrompt: MetaPrompt): PromptMessage[] {
    const elementsText = Object.values(metaPrompt.elements)
      .map((e) => `- **${KEY_LABELS[e.key] ?? e.key}**: ${e.value ?? '（未回答）'}`)
      .join('\n');

    return [
      {
        role: 'system',
        content: [
          'あなたは AI for Science 分野に精通した研究計画策定の専門家です。',
          'SPReAD-1000（AI for Science 萌芽的挑戦研究創出事業）の申請に向けた研究計画を策定します。',
          '',
          '## SPReAD-1000 の要件',
          '- 研究期間: 約180日間',
          '- 補助上限額: 1課題あたり500万円以下（直接経費）',
          '- テーマ: AI for Science — あらゆる科学分野におけるAI活用による研究の高度化・加速化',
          '- 萌芽的・探索的研究を対象とする',
          '',
          '## 出力フォーマット',
          '以下の構造で Markdown 形式の研究計画を生成してください:',
          '',
          '### 1. 研究概要',
          '研究の背景・目的・独自性を簡潔に記述',
          '',
          '### 2. AI活用方針',
          '- 活用するAI技術（機械学習、大規模言語モデル、AIシミュレーション等）',
          '- 従来手法と比較したAI活用の優位性',
          '',
          '### 3. 研究手法',
          '- 具体的なデータ収集・前処理・モデル構築・評価の手順',
          '- 使用するフレームワーク・ツール',
          '',
          '### 4. 180日間のマイルストーン',
          '- Phase 1（1-60日）: 環境構築・データ準備',
          '- Phase 2（61-120日）: モデル開発・実験',
          '- Phase 3（121-180日）: 評価・論文執筆・成果公開',
          '',
          '### 5. Azure リソース活用方針',
          '- 必要な計算資源（GPU、ストレージ等）の概要',
          '- Azure AI サービスの活用候補',
          '',
          '### 6. 期待される成果',
          '- 学術的成果（論文、学会発表）',
          '- 社会的インパクト',
          '',
          '## ルール',
          '- 必ず日本語で記述してください',
          '- 研究分野の専門用語を適切に使用してください',
          '- 具体的かつ実現可能な計画を提案してください',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          '以下のメタプロンプト情報に基づいて、SPReAD-1000 申請に向けた研究計画を策定してください。',
          '',
          '## 研究者からの入力情報',
          elementsText,
        ].join('\n'),
      },
    ];
  }
}
