import { describe, it, expect } from 'vitest';
import {
  SECTION_CHAR_LIMITS,
  validateCharacterCount,
  type ProposalSection,
} from './Proposal';

function makeSection(content: string, min = 80, max = 400): ProposalSection {
  return {
    id: 'research_purpose',
    title: 'Research Purpose',
    content,
    charLimit: { min, max },
  };
}

describe('Proposal', () => {
  describe('SECTION_CHAR_LIMITS', () => {
    it('defines limits for all 7 sections', () => {
      expect(Object.keys(SECTION_CHAR_LIMITS)).toHaveLength(7);
    });

    it('has correct limits for research_purpose', () => {
      expect(SECTION_CHAR_LIMITS.research_purpose).toEqual({ min: 80, max: 400 });
    });

    it('allows zero minimum for optional sections', () => {
      expect(SECTION_CHAR_LIMITS.research_achievements.min).toBe(0);
      expect(SECTION_CHAR_LIMITS.expense_plan.min).toBe(0);
    });
  });

  describe('validateCharacterCount', () => {
    it('validates content within limits', () => {
      const section = makeSection('a'.repeat(200));
      const result = validateCharacterCount(section);
      expect(result.valid).toBe(true);
      expect(result.current).toBe(200);
      expect(result.utilization).toBe(0.5);
    });

    it('rejects content under minimum', () => {
      const section = makeSection('short', 80, 400);
      const result = validateCharacterCount(section);
      expect(result.valid).toBe(false);
      expect(result.current).toBe(5);
    });

    it('rejects content over maximum', () => {
      const section = makeSection('a'.repeat(500), 80, 400);
      const result = validateCharacterCount(section);
      expect(result.valid).toBe(false);
      expect(result.current).toBe(500);
    });

    it('accepts content at exact minimum', () => {
      const section = makeSection('a'.repeat(80), 80, 400);
      expect(validateCharacterCount(section).valid).toBe(true);
    });

    it('accepts content at exact maximum', () => {
      const section = makeSection('a'.repeat(400), 80, 400);
      const result = validateCharacterCount(section);
      expect(result.valid).toBe(true);
      expect(result.utilization).toBe(1);
    });

    it('calculates utilization correctly', () => {
      const section = makeSection('a'.repeat(100), 0, 200);
      expect(validateCharacterCount(section).utilization).toBeCloseTo(0.5);
    });

    it('returns 0 utilization when max is 0', () => {
      const section = makeSection('', 0, 0);
      expect(validateCharacterCount(section).utilization).toBe(0);
    });

    it('validates empty content with min=0', () => {
      const section = makeSection('', 0, 1000);
      const result = validateCharacterCount(section);
      expect(result.valid).toBe(true);
      expect(result.current).toBe(0);
    });
  });
});
