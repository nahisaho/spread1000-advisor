# SPReAD-1000 Advisor

SPReAD-1000（AI for Science 萌芽的挑戦研究創出事業）申請書作成支援システム

## 概要

研究者が SPReAD-1000 の申請書を効率的に作成するための Web アプリケーション。
LLM を活用した対話型ウィザードで、研究計画の策定から申請書の完成までを支援します。

## 機能

- 🧙 **7ステップウィザード**: コンテキスト収集 → 研究計画 → Azure構成 → コスト見積もり → 申請書生成 → レビュー → 最終判定
- 🤖 **4つのLLMプロバイダー**: OpenAI / Azure OpenAI / Claude / Ollama (ローカル)
- 📊 **自動レビュー**: 6審査基準 (◎/○/△/×) + 10項目必須チェック
- 💰 **コスト見積もり**: Azure Retail Prices API による単価検証
- 📥 **エクスポート**: Markdown / Excel (様式1) / ZIP
- 🌐 **多言語対応**: 日本語 / English
- 🐳 **Docker対応**: ワンコマンドで起動

## クイックスタート

### Docker (推奨)

```bash
# Ollama (ローカルLLM) を使用する場合
docker compose up -d

# OpenAI を使用する場合
LLM_PROVIDER=openai LLM_API_KEY=sk-xxx LLM_MODEL=gpt-4o docker compose up -d
```

ブラウザで http://localhost:3000 にアクセス。

### 開発環境

```bash
npm install
cp .env.example .env  # 環境変数を設定
npm run dev
```

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| LLM_PROVIDER | LLMプロバイダー (openai/azure-openai/claude/ollama) | ollama |
| LLM_MODEL | モデル名 | llama3 |
| LLM_API_KEY | APIキー | - |
| LLM_ENDPOINT | エンドポイントURL | http://localhost:11434 |
| LLM_DEPLOYMENT_NAME | Azure OpenAI デプロイメント名 | - |

## 技術スタック

- Next.js 16 (App Router, Standalone)
- React 19, TypeScript 5
- Tailwind CSS 4
- Vitest (テスト)
- ExcelJS (Excel出力)
- next-intl (i18n)

## テスト

```bash
npm test          # テスト実行
npm run test:ci   # CI用 (カバレッジ付き)
```

## ライセンス

MIT

## 免責事項

本ツールは申請書作成の支援を目的としており、生成された内容の正確性を保証するものではありません。
最終的な申請書の内容は申請者の責任で確認してください。
