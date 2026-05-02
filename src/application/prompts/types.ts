export interface PromptMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}
