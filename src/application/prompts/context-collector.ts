import type { MetaPromptKey, MetaPrompt } from '@/domain/models/MetaPrompt';
import type { PromptMessage } from './types';

export const KEY_LABELS: Record<MetaPromptKey, string> = {
  PURPOSE: '研究目的（PURPOSE）',
  TARGET: '対象・ターゲット（TARGET）',
  SCOPE: '研究範囲（SCOPE）',
  TIMELINE: 'スケジュール（TIMELINE）',
  CONSTRAINTS: '制約条件（CONSTRAINTS）',
  DELIVERABLES: '成果物・アウトプット（DELIVERABLES）',
};

export class ContextCollectorPrompt {
  /**
   * Build prompt to analyze user's initial free-text input and extract
   * known elements as JSON. Used for auto-filling.
   */
  buildAnalysis(userInput: string): PromptMessage[] {
    return [
      {
        role: 'system',
        content: [
          'あなたは SPReAD-1000（AI for Science 萌芽的挑戦研究創出事業）の申請書作成を支援するAIです。',
          '',
          '## タスク',
          'ユーザーの入力テキストから、以下の6要素を抽出してください。',
          '抽出できない要素は value を null にしてください。',
          '',
          '## 6要素',
          '- PURPOSE: 研究目的（AIを使って何を達成したいか）',
          '- TARGET: 研究対象・分野（どの学術分野・物質・現象か）',
          '- SCOPE: 研究範囲（データ規模・対象期間・地理的範囲）',
          '- TIMELINE: スケジュール（約180日間の研究期間での計画）',
          '- CONSTRAINTS: 制約条件（予算上限は直接経費500万円、設備・人員の制約）',
          '- DELIVERABLES: 期待成果物（論文・ソフトウェア・モデル等）',
          '',
          '## 出力形式',
          '必ず以下のJSON形式のみを出力してください。説明文は不要です。',
          '```json',
          '{',
          '  "PURPOSE": { "value": "抽出した内容" or null, "confidence": "high" or "medium" or "low" },',
          '  "TARGET": { "value": "..." or null, "confidence": "..." },',
          '  "SCOPE": { "value": "..." or null, "confidence": "..." },',
          '  "TIMELINE": { "value": "..." or null, "confidence": "..." },',
          '  "CONSTRAINTS": { "value": "..." or null, "confidence": "..." },',
          '  "DELIVERABLES": { "value": "..." or null, "confidence": "..." }',
          '}',
          '```',
        ].join('\n'),
      },
      {
        role: 'user',
        content: userInput,
      },
    ];
  }

  /**
   * Build prompt for asking one specific question about a missing element.
   * Adapts to previously collected context.
   */
  buildQuestion(
    currentKey: MetaPromptKey,
    previousAnswers: Partial<MetaPrompt>,
    questionIndex: number,
    totalQuestions: number,
  ): PromptMessage[] {
    let contextBlock = '';
    if (previousAnswers.elements) {
      const filled = Object.values(previousAnswers.elements).filter(
        (e) => e.value !== null
      );
      if (filled.length > 0) {
        contextBlock =
          '\n\n## これまでの回答\n' +
          filled
            .map((e) => `- **${KEY_LABELS[e.key]}**: ${e.value}`)
            .join('\n');
      }
    }

    return [
      {
        role: 'system',
        content: [
          'あなたは SPReAD-1000（AI for Science 萌芽的挑戦研究創出事業）の申請を支援する研究助成アドバイザーです。',
          '研究者から情報を収集し、申請書作成に必要なコンテキストを整理します。',
          '',
          '## ルール',
          '- 必ず日本語で会話してください',
          '- 1回の応答で **1つの質問だけ** を聞いてください（複数質問は禁止）',
          '- 研究者の専門分野に合わせた具体的な質問をしてください',
          '- 回答が曖昧な場合は、具体例を挙げて明確化を促してください',
          '- 質問の冒頭に「❓ 質問 N/M [カテゴリ]」ラベルを付けてください',
          '',
          `## 現在のタスク`,
          `研究者の「${KEY_LABELS[currentKey]}」について質問してください。`,
          `質問番号: ${questionIndex}/${totalQuestions}`,
          `カテゴリ: ${currentKey}`,
          contextBlock,
        ].join('\n'),
      },
      {
        role: 'user',
        content: `「${KEY_LABELS[currentKey]}」について教えてください。`,
      },
    ];
  }

  /**
   * Build prompt to propose an estimated value when user says "わからない".
   */
  buildEstimate(
    key: MetaPromptKey,
    previousAnswers: Partial<MetaPrompt>,
  ): PromptMessage[] {
    let contextBlock = '';
    if (previousAnswers.elements) {
      const filled = Object.values(previousAnswers.elements).filter(
        (e) => e.value !== null
      );
      if (filled.length > 0) {
        contextBlock =
          '\n\nこれまでの回答:\n' +
          filled
            .map((e) => `- ${KEY_LABELS[e.key]}: ${e.value}`)
            .join('\n');
      }
    }

    return [
      {
        role: 'system',
        content: [
          'あなたは SPReAD-1000 の申請支援AIです。',
          '',
          '## タスク',
          `ユーザーが「${KEY_LABELS[key]}」について「わからない」と回答しました。`,
          'これまでの回答内容と研究分野から、妥当な推定値を提案してください。',
          '',
          '## ルール',
          '- 日本語で回答',
          '- 推定値を提案し、「この内容でよろしいですか？」と確認を求める',
          '- SPReAD の予算上限は直接経費500万円（間接経費含め最大650万円）',
          '- 研究期間は約180日間',
          contextBlock,
        ].join('\n'),
      },
      {
        role: 'user',
        content: `「${KEY_LABELS[key]}」についてわかりません。推定値を提案してください。`,
      },
    ];
  }

  /** @deprecated Use buildQuestion() instead */
  build(
    currentKey: MetaPromptKey,
    previousAnswers: Partial<MetaPrompt>
  ): PromptMessage[] {
    return this.buildQuestion(currentKey, previousAnswers, 1, 1);
  }
}
