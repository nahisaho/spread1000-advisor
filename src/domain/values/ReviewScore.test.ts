import { describe, it, expect } from 'vitest';
import {
  GRADE_POINTS,
  calculateJudgment,
  type ScoreGrade,
} from './ReviewScore';

describe('ReviewScore', () => {
  describe('GRADE_POINTS', () => {
    it('maps grades to correct point values', () => {
      expect(GRADE_POINTS['◎']).toBe(3);
      expect(GRADE_POINTS['○']).toBe(2);
      expect(GRADE_POINTS['△']).toBe(1);
      expect(GRADE_POINTS['×']).toBe(0);
    });

    it('has exactly 4 grades', () => {
      expect(Object.keys(GRADE_POINTS)).toHaveLength(4);
    });
  });

  describe('calculateJudgment', () => {
    it('returns 🔴 when there are mandatory failures regardless of score', () => {
      expect(calculateJudgment(18, true, 1)).toBe('🔴');
      expect(calculateJudgment(15, true, 3)).toBe('🔴');
    });

    it('returns 🟡 when prices are not verified regardless of score', () => {
      expect(calculateJudgment(18, false, 0)).toBe('🟡');
      expect(calculateJudgment(15, false, 0)).toBe('🟡');
    });

    it('returns 🟢 for high score with verified prices and no failures', () => {
      expect(calculateJudgment(15, true, 0)).toBe('🟢');
      expect(calculateJudgment(18, true, 0)).toBe('🟢');
    });

    it('returns 🟡 for medium score with verified prices and no failures', () => {
      expect(calculateJudgment(10, true, 0)).toBe('🟡');
      expect(calculateJudgment(14, true, 0)).toBe('🟡');
    });

    it('returns 🔴 for low score with verified prices and no failures', () => {
      expect(calculateJudgment(9, true, 0)).toBe('🔴');
      expect(calculateJudgment(0, true, 0)).toBe('🔴');
    });

    it('prioritizes mandatory failures over unverified prices', () => {
      expect(calculateJudgment(18, false, 1)).toBe('🔴');
    });

    it('handles boundary score of exactly 15', () => {
      expect(calculateJudgment(15, true, 0)).toBe('🟢');
    });

    it('handles boundary score of exactly 10', () => {
      expect(calculateJudgment(10, true, 0)).toBe('🟡');
    });
  });
});
