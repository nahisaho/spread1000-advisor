import type { MetaPrompt } from '@/domain/models/MetaPrompt';
import type { PromptMessage } from './types';

export class AzureArchitectPrompt {
  build(metaPrompt: MetaPrompt, researchPlan: string): PromptMessage[] {
    const elementsText = Object.values(metaPrompt.elements)
      .map((e) => `- **${e.key}**: ${e.value ?? '（未回答）'}`)
      .join('\n');

    return [
      {
        role: 'system',
        content: [
          'あなたは Azure クラウドアーキテクトであり、学術研究向けの計算基盤設計を専門としています。',
          'SPReAD-1000（AI for Science）の研究計画に基づき、Azure 上の研究基盤アーキテクチャを設計してください。',
          '',
          '## 設計で考慮すべきリソースカテゴリ',
          '',
          '### コンピューティング',
          '- GPU VM（NC/ND シリーズ）: 深層学習・大規模計算',
          '- AKS（Azure Kubernetes Service）: 分散学習・パイプライン管理',
          '- Azure Machine Learning: 実験管理・MLOps',
          '',
          '### ストレージ',
          '- Azure Blob Storage: データセット・モデルの保存',
          '- Azure Data Lake: 大規模データ分析',
          '',
          '### AI サービス',
          '- Azure OpenAI Service: LLM 活用',
          '- Azure AI Search: 文献検索・ナレッジベース',
          '- Azure AI Document Intelligence: 文献のデジタル化',
          '',
          '### ネットワーク・セキュリティ',
          '- VNet: ネットワーク分離',
          '- NSG: アクセス制御',
          '- Azure Key Vault: シークレット管理',
          '',
          '## 予算制約',
          '- 総予算: ¥5,000,000（500万円）以下 — 直接経費',
          '- 研究期間: 約180日間',
          '- 必ず具体的な Azure SKU を提案し、月額概算コストを記載してください',
          '',
          '## 出力フォーマット',
          '以下の構造で Markdown 形式のアーキテクチャ設計書を生成してください:',
          '',
          '### 1. 構成概要',
          '### 2. リソース一覧（SKU・スペック・月額概算）',
          '### 3. ネットワーク設計',
          '### 4. セキュリティ設計',
          '### 5. コスト概算（180日間の総額）',
          '### 6. スケーリング方針',
          '',
          '## ルール',
          '- 必ず日本語で記述してください',
          '- 予算内に収まるよう最適化してください',
          '- リージョンは Japan East を優先し、GPU 可用性に応じて East US 等を代替候補としてください',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          '以下の研究情報に基づいて Azure アーキテクチャを設計してください。',
          '',
          '## メタプロンプト情報',
          elementsText,
          '',
          '## 研究計画',
          researchPlan,
        ].join('\n'),
      },
    ];
  }
}
