export const DISCLAIMER_TEXT = `
---
⚠️ 免責事項: 本文書は AI が生成した参考資料です。内容の正確性・完全性は保証されません。
申請書の最終版は、必ずご自身で内容を確認・修正してからご提出ください。
`.trim();

export function appendDisclaimer(content: string): string {
  if (content.includes(DISCLAIMER_TEXT)) return content;
  return `${content}\n\n${DISCLAIMER_TEXT}\n`;
}
