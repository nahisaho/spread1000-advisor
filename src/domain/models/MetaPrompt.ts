export type MetaPromptKey = 'PURPOSE' | 'TARGET' | 'SCOPE' | 'TIMELINE' | 'CONSTRAINTS' | 'DELIVERABLES';

export interface MetaPromptElement {
  readonly key: MetaPromptKey;
  readonly value: string | null;
  readonly source: 'user' | 'estimated';
  readonly confirmed: boolean;
}

export interface MetaPrompt {
  readonly elements: Record<MetaPromptKey, MetaPromptElement>;
  readonly approved: boolean;
}

export const META_PROMPT_KEYS: readonly MetaPromptKey[] = [
  'PURPOSE', 'TARGET', 'SCOPE', 'TIMELINE', 'CONSTRAINTS', 'DELIVERABLES',
] as const;

export function isSufficient(prompt: MetaPrompt): boolean {
  return Object.values(prompt.elements).every((e) => e.value !== null && e.confirmed);
}

export function getNextQuestion(prompt: MetaPrompt): MetaPromptKey | null {
  return META_PROMPT_KEYS.find((key) => {
    const elem = prompt.elements[key];
    return !elem || elem.value === null || !elem.confirmed;
  }) ?? null;
}

export function createEmptyMetaPrompt(): MetaPrompt {
  const elements = {} as Record<MetaPromptKey, MetaPromptElement>;
  for (const key of META_PROMPT_KEYS) {
    elements[key] = { key, value: null, source: 'user', confirmed: false };
  }
  return { elements, approved: false };
}
