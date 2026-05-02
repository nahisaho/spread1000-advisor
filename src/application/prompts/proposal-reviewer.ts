import type { MetaPrompt } from '@/domain/models/MetaPrompt';
import { REVIEW_CRITERION_LABELS, type ReviewCriterionId } from '@/domain/values/ReviewScore';
import type { PromptMessage } from './types';

/** Detailed descriptions for each review criterion, keyed by canonical ID */
const CRITERION_DETAILS: Record<ReviewCriterionId, string[]> = {
  social_impact: [
    '- 研究成果が社会や学術にもたらすインパクトは十分か',
    '- 研究テーマの新規性・独自性はあるか',
  ],
  ai_validity: [
    '- AI技術の選定は適切か',
    '- 従来手法と比較した優位性が示されているか',
    '- AI for Science の趣旨に合致しているか',
  ],
  methodology_specificity: [
    '- 研究計画は具体的かつ実現可能か',
    '- データ収集・分析・評価の手順が明確か',
    '- 180日間のスケジュールは妥当か',
  ],
  azure_utilization: [
    '- Azure リソースが効果的に活用されているか',
    '- 適切な SKU・サービスが選定されているか',
    '- クラウド活用の必然性が示されているか',
  ],
  research_capability: [
    '- 申請者の研究実績は十分か',
    '- 本研究を遂行するための技術的基盤があるか',
  ],
  cost_plan_validity: [
    '- 予算配分は合理的か',
    '- 総額が500万円以下に収まっているか',
    '- 各費目の金額は妥当か',
  ],
};

export class ProposalReviewerPrompt {
  build(
    proposal: Record<string, string>,
    metaPrompt: MetaPrompt
  ): PromptMessage[] {
    const elementsText = Object.values(metaPrompt.elements)
      .map((e) => `- **${e.key}**: ${e.value ?? '（未回答）'}`)
      .join('\n');

    const proposalText = Object.entries(proposal)
      .map(([section, content]) => `### ${section}\n${content}`)
      .join('\n\n');

    const criteriaIds = Object.keys(REVIEW_CRITERION_LABELS) as ReviewCriterionId[];
    const criteriaSection = criteriaIds
      .map((id, i) => {
        const label = REVIEW_CRITERION_LABELS[id];
        const details = CRITERION_DETAILS[id].join('\n');
        return `### ${i + 1}. ${label}\n${details}`;
      })
      .join('\n\n');

    const tableRows = criteriaIds
      .map((id) => `| ${REVIEW_CRITERION_LABELS[id]} | ◎/○/△/× | ... |`)
      .join('\n');

    return [
      {
        role: 'system',
        content: [
          'あなたは SPReAD-1000（AI for Science 萌芽的挑戦研究創出事業）の審査委員として、申請書をレビューする専門家です。',
          '',
          '## 審査基準（6項目）',
          '',
          '以下の6つの審査基準それぞれについて評価してください:',
          '',
          criteriaSection,
          '',
          '## 評価記号',
          '各基準を以下の4段階で評価してください:',
          '- **◎（優秀）**: 特に優れている',
          '- **○（良好）**: 基準を満たしている',
          '- **△（要改善）**: 改善が必要',
          '- **×（不十分）**: 大幅な改善が必要',
          '',
          '## 出力フォーマット',
          '```',
          '| 審査基準 | 評価 | コメント |',
          '|----------|------|----------|',
          tableRows,
          '```',
          '',
          '評価テーブルの後に、以下を記述してください:',
          '- **総合評価**: 全体的な所見',
          '- **改善提案**: 具体的な改善点（優先度順）',
          '',
          '## ルール',
          '- 必ず日本語で記述してください',
          '- 建設的なフィードバックを心がけてください',
          '- 具体的な改善案を提示してください',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          '以下の SPReAD-1000 申請書をレビューしてください。',
          '',
          '## メタプロンプト情報',
          elementsText,
          '',
          '## 申請書内容',
          proposalText,
        ].join('\n'),
      },
    ];
  }
}
