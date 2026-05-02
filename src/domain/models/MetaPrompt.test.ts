import { describe, it, expect } from 'vitest';
import {
  META_PROMPT_KEYS,
  isSufficient,
  getNextQuestion,
  createEmptyMetaPrompt,
  type MetaPrompt,
  type MetaPromptElement,
  type MetaPromptKey,
} from './MetaPrompt';

describe('MetaPrompt', () => {
  describe('createEmptyMetaPrompt', () => {
    it('creates a prompt with all keys having null values', () => {
      const prompt = createEmptyMetaPrompt();
      expect(prompt.approved).toBe(false);
      for (const key of META_PROMPT_KEYS) {
        expect(prompt.elements[key].value).toBeNull();
        expect(prompt.elements[key].confirmed).toBe(false);
        expect(prompt.elements[key].source).toBe('user');
      }
    });

    it('contains all 6 meta prompt keys', () => {
      expect(META_PROMPT_KEYS).toHaveLength(6);
    });
  });

  function makePrompt(overrides: Partial<Record<MetaPromptKey, Partial<MetaPromptElement>>> = {}): MetaPrompt {
    const elements = {} as Record<MetaPromptKey, MetaPromptElement>;
    for (const key of META_PROMPT_KEYS) {
      elements[key] = {
        key,
        value: 'filled',
        source: 'user',
        confirmed: true,
        ...overrides[key],
      };
    }
    return { elements, approved: false };
  }

  describe('isSufficient', () => {
    it('returns true when all elements have values and are confirmed', () => {
      const prompt = makePrompt();
      expect(isSufficient(prompt)).toBe(true);
    });

    it('returns false when any element has null value', () => {
      const prompt = makePrompt({ PURPOSE: { value: null } });
      expect(isSufficient(prompt)).toBe(false);
    });

    it('returns false when any element is not confirmed', () => {
      const prompt = makePrompt({ SCOPE: { confirmed: false } });
      expect(isSufficient(prompt)).toBe(false);
    });

    it('returns false for empty meta prompt', () => {
      expect(isSufficient(createEmptyMetaPrompt())).toBe(false);
    });
  });

  describe('getNextQuestion', () => {
    it('returns null when all elements are filled and confirmed', () => {
      const prompt = makePrompt();
      expect(getNextQuestion(prompt)).toBeNull();
    });

    it('returns first key with null value', () => {
      const prompt = makePrompt({ PURPOSE: { value: null } });
      expect(getNextQuestion(prompt)).toBe('PURPOSE');
    });

    it('returns first unconfirmed key', () => {
      const prompt = makePrompt({ TARGET: { confirmed: false } });
      expect(getNextQuestion(prompt)).toBe('TARGET');
    });

    it('returns PURPOSE for empty meta prompt', () => {
      expect(getNextQuestion(createEmptyMetaPrompt())).toBe('PURPOSE');
    });

    it('skips confirmed keys and finds the next unconfirmed', () => {
      const prompt = makePrompt({
        TIMELINE: { confirmed: false },
      });
      expect(getNextQuestion(prompt)).toBe('TIMELINE');
    });
  });
});
