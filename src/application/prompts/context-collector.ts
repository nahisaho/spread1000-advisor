import type { MetaPromptKey, MetaPrompt } from '@/domain/models/MetaPrompt';
import type { PromptMessage } from './types';

const KEY_LABELS: Record<MetaPromptKey, string> = {
  PURPOSE: '研究目的（PURPOSE）',
  TARGET: '対象・ターゲット（TARGET）',
  SCOPE: '研究範囲（SCOPE）',
  TIMELINE: 'スケジュール（TIMELINE）',
  CONSTRAINTS: '制約条件（CONSTRAINTS）',
  DELIVERABLES: '成果物・アウトプット（DELIVERABLES）',
};

export class ContextCollectorPrompt {
  build(
    currentKey: MetaPromptKey,
    previousAnswers: Partial<MetaPrompt>
  ): PromptMessage[] {
    const messages: PromptMessage[] = [];

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

    messages.push({
      role: 'system',
      content: [
        'あなたは SPReAD-1000（AI for Science 萌芽的挑戦研究創出事業）の申請を支援する研究助成アドバイザーです。',
        '研究者から情報を収集し、申請書作成に必要なコンテキストを整理します。',
        '',
        '## ルール',
        '- 必ず日本語で会話してください',
        '- 1回の応答で1つの質問だけを聞いてください',
        '- 研究者の専門分野に合わせた具体的な質問をしてください',
        '- 回答が曖昧な場合は、具体例を挙げて明確化を促してください',
        '',
        `## 現在のタスク`,
        `研究者の「${KEY_LABELS[currentKey]}」について質問してください。`,
        contextBlock,
      ].join('\n'),
    });

    messages.push({
      role: 'user',
      content: `「${KEY_LABELS[currentKey]}」について教えてください。`,
    });

    return messages;
  }
}
