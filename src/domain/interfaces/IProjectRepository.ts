import type { WizardState } from '../models/WizardStep';

export type ProviderType = 'openai' | 'azure-openai' | 'claude' | 'ollama';

export interface ProjectMeta {
  readonly id: string;
  readonly name: string;
  readonly wizardState: WizardState;
  readonly llmProvider: ProviderType;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type DeliverableName =
  | 'project.json'
  | 'meta-prompt.md'
  | 'phase0-research-plan.md'
  | 'phase1-azure-architecture.md'
  | 'phase2-cost-estimate.md'
  | 'phase3-proposal.md'
  | 'review-report.md'
  | 'final-review-report.md';

export interface IProjectRepository {
  list(): Promise<ProjectMeta[]>;
  get(projectId: string): Promise<ProjectMeta | null>;
  create(name: string): Promise<ProjectMeta>;
  updateWizardState(projectId: string, state: Partial<WizardState>): Promise<void>;

  saveDeliverable(projectId: string, filename: DeliverableName, content: string): Promise<void>;
  loadDeliverable(projectId: string, filename: DeliverableName): Promise<string | null>;
  listDeliverables(projectId: string): Promise<DeliverableName[]>;
}
