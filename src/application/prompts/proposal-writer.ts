import type { MetaPrompt } from '@/domain/models/MetaPrompt';
import type { PromptMessage } from './types';

const SECTION_GUIDANCE: Record<string, string> = {
  research_purpose: [
    '## セクション固有ガイダンス: 研究目的',
    '- 研究の社会的意義・学術的重要性を明確に述べる',
    '- 研究の独自性・新規性を強調する',
    '- AI for Science の文脈での位置づけを示す',
  ].join('\n'),
  research_method: [
    '## セクション固有ガイダンス: 研究手法',
    '- 具体的なデータ収集・分析手法を記述する',
    '- AI/ML の具体的なアルゴリズム・モデルを明記する',
    '- 実験計画と評価指標を示す',
    '- 180日間のスケジュールとの整合性を保つ',
  ].join('\n'),
  ai_validity: [
    '## セクション固有ガイダンス: AI活用の妥当性',
    '- 従来手法と比較したAI活用の優位性を具体的に示す',
    '- AI技術の選定理由を述べる',
    '- 想定されるリスクと対策を記述する',
  ].join('\n'),
  achievement_goals: [
    '## セクション固有ガイダンス: 達成目標',
    '- 定量的な目標指標を設定する',
    '- 180日間で達成可能な現実的な目標を記述する',
    '- 中間マイルストーンを含める',
  ].join('\n'),
  knowhow_sharing: [
    '## セクション固有ガイダンス: ノウハウ共有',
    '- 研究成果の公開方法（論文、コード、データセット）を記述する',
    '- コミュニティへの還元計画を示す',
    '- 再現性の確保方法を述べる',
  ].join('\n'),
  research_achievements: [
    '## セクション固有ガイダンス: 研究業績',
    '- 関連する研究業績を時系列で記述する',
    '- 本研究との関連性を示す',
    '- 研究遂行能力の根拠を明示する',
  ].join('\n'),
  expense_plan: [
    '## セクション固有ガイダンス: 経費計画',
    '- Azure リソースの具体的な費目と金額を記載する',
    '- 予算配分の妥当性を示す',
    '- 総額が500万円以下であることを確認する',
    '- 費目: 設備備品費、消耗品費、旅費、人件費・謝金、その他',
  ].join('\n'),
};

export class ProposalWriterPrompt {
  build(
    sectionName: string,
    metaPrompt: MetaPrompt,
    researchPlan: string,
    azureArchitecture: string,
    charLimit: { min: number; max: number }
  ): PromptMessage[] {
    const elementsText = Object.values(metaPrompt.elements)
      .map((e) => `- **${e.key}**: ${e.value ?? '（未回答）'}`)
      .join('\n');

    const guidance =
      SECTION_GUIDANCE[sectionName] ?? '## セクション固有ガイダンス\n特記事項なし';

    return [
      {
        role: 'system',
        content: [
          'あなたは SPReAD-1000（AI for Science 萌芽的挑戦研究創出事業）の申請書執筆を支援する専門家です。',
          '',
          '## 審査観点',
          'SPReAD-1000 の申請書は以下の6つの審査基準で評価されます:',
          '1. **研究の社会的意義**: 研究成果が社会に与えるインパクト',
          '2. **AI活用の妥当性**: AI技術の選定と活用方法の適切さ',
          '3. **研究手法の具体性**: 研究計画の実現可能性と具体性',
          '4. **Azure活用度**: Azure リソースの効果的な活用',
          '5. **研究遂行能力**: 研究者の実績と遂行能力',
          '6. **コスト計画の妥当性**: 予算配分の合理性',
          '',
          `## 文字数制約`,
          `- 最小文字数: ${charLimit.min}文字`,
          `- 最大文字数: ${charLimit.max}文字`,
          `- **この範囲内に必ず収めてください**`,
          `- 推奨: 最大文字数の80-95%を目安に記述してください`,
          '',
          guidance,
          '',
          '## ルール',
          '- 必ず日本語で記述してください',
          '- 学術的な文体を使用してください',
          '- 具体的なデータや数値を含めてください',
          '- セクションの内容のみを出力してください（見出しは不要）',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `SPReAD-1000 申請書の「${sectionName}」セクションを執筆してください。`,
          '',
          '## メタプロンプト情報',
          elementsText,
          '',
          '## 研究計画',
          researchPlan,
          '',
          '## Azure アーキテクチャ',
          azureArchitecture,
        ].join('\n'),
      },
    ];
  }
}
