export type ProposalSectionId =
  | 'research_purpose'
  | 'research_method'
  | 'ai_validity'
  | 'achievement_goals'
  | 'knowhow_sharing'
  | 'research_achievements'
  | 'expense_plan';

export interface ProposalSection {
  readonly id: ProposalSectionId;
  readonly title: string;
  readonly content: string;
  readonly charLimit: { min: number; max: number };
}

export const SECTION_CHAR_LIMITS: Record<ProposalSectionId, { min: number; max: number }> = {
  research_purpose:      { min: 80, max: 400 },
  research_method:       { min: 160, max: 800 },
  ai_validity:           { min: 160, max: 800 },
  achievement_goals:     { min: 100, max: 500 },
  knowhow_sharing:       { min: 60, max: 300 },
  research_achievements: { min: 0, max: 1000 },
  expense_plan:          { min: 0, max: 2000 },
};

export interface Proposal {
  readonly projectId: string;
  readonly sections: readonly ProposalSection[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CharacterCountValidation {
  valid: boolean;
  current: number;
  utilization: number;
}

export function validateCharacterCount(section: ProposalSection): CharacterCountValidation {
  const current = section.content.length;
  const { min, max } = section.charLimit;
  return {
    valid: current >= min && current <= max,
    current,
    utilization: max > 0 ? current / max : 0,
  };
}
