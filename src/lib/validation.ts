export const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/;

export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

export function validateProjectName(name: string): ValidationResult {
  if (!name) return { valid: false, error: 'プロジェクト名は必須です' };
  if (name.includes('/') || name.includes('\\') || name.includes('..'))
    return { valid: false, error: 'パス区切り文字は使用できません' };
  if (!PROJECT_NAME_PATTERN.test(name))
    return { valid: false, error: '英数字・ハイフン・アンダースコアのみ使用可能です（先頭は英数字）' };
  return { valid: true };
}

export function validateBudgetInput(value: number): ValidationResult {
  if (isNaN(value) || value < 0) return { valid: false, error: '正の数値を入力してください' };
  if (value < 100_000) return { valid: false, error: '最低研究経費は10万円です' };
  if (value > 5_000_000) return { valid: false, error: '直接経費の上限は500万円です' };
  return { valid: true };
}
