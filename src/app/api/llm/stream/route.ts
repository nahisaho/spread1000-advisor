import { getProjectRepo, getLLMProvider, getCostService } from '@/app/api/_lib/dependencies';
import { classifyError } from '@/lib/errors';
import { CollectContextUseCase } from '@/application/usecases/CollectContextUseCase';
import { GenerateResearchPlanUseCase } from '@/application/usecases/GenerateResearchPlanUseCase';
import { DesignAzureArchitectureUseCase } from '@/application/usecases/DesignAzureArchitectureUseCase';
import { EstimateCostUseCase } from '@/application/usecases/EstimateCostUseCase';
import { GenerateProposalUseCase } from '@/application/usecases/GenerateProposalUseCase';
import { ReviewProposalUseCase } from '@/application/usecases/ReviewProposalUseCase';
import {
  ContextCollectorPrompt,
  ResearchPlannerPrompt,
  AzureArchitectPrompt,
  ProposalWriterPrompt,
  ProposalReviewerPrompt,
} from '@/application/prompts';
import type { ILLMProvider, LLMStreamChunk } from '@/domain/interfaces/ILLMProvider';
import type { IProjectRepository } from '@/domain/interfaces/IProjectRepository';

type StreamAction =
  | 'collect-context'
  | 'generate-research-plan'
  | 'design-azure'
  | 'estimate-cost'
  | 'generate-proposal'
  | 'review-proposal';

const VALID_ACTIONS: ReadonlySet<string> = new Set<StreamAction>([
  'collect-context',
  'generate-research-plan',
  'design-azure',
  'estimate-cost',
  'generate-proposal',
  'review-proposal',
]);

function createStreamGenerator(
  action: StreamAction,
  provider: ILLMProvider,
  projectRepo: IProjectRepository,
  projectId: string,
  params: Record<string, unknown>,
): AsyncIterable<LLMStreamChunk> | null {
  switch (action) {
    case 'collect-context': {
      const uc = new CollectContextUseCase(provider, projectRepo, new ContextCollectorPrompt());
      return uc.askNextQuestion(projectId, params.metaPrompt as never);
    }
    case 'generate-research-plan': {
      const uc = new GenerateResearchPlanUseCase(provider, projectRepo, new ResearchPlannerPrompt());
      return uc.execute(projectId, params.metaPrompt as never);
    }
    case 'design-azure': {
      const uc = new DesignAzureArchitectureUseCase(provider, projectRepo, new AzureArchitectPrompt());
      return uc.execute(projectId, params.metaPrompt as never);
    }
    case 'estimate-cost': {
      // EstimateCostUseCase returns Promise, not stream — wrap as single-chunk
      return null;
    }
    case 'generate-proposal': {
      const uc = new GenerateProposalUseCase(provider, projectRepo, new ProposalWriterPrompt());
      return uc.generateSection(
        projectId,
        (params.sectionId as string) ?? 'research_purpose',
        params.metaPrompt as never,
      );
    }
    case 'review-proposal': {
      const uc = new ReviewProposalUseCase(provider, projectRepo, new ProposalReviewerPrompt());
      return uc.execute(projectId, params.proposal as never, params.metaPrompt as never);
    }
  }
}

const encoder = new TextEncoder();

function encodeSSE(data: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      projectId?: string;
      action?: string;
      params?: Record<string, unknown>;
    };

    const { projectId, action, params = {} } = body;

    if (!projectId || typeof projectId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'projectId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!action || !VALID_ACTIONS.has(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action: ${action}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const provider = await getLLMProvider();
    const projectRepo = getProjectRepo();

    // Handle estimate-cost as non-streaming action
    if (action === 'estimate-cost') {
      const costService = getCostService();
      const uc = new EstimateCostUseCase(provider, projectRepo, costService);

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const result = await uc.execute(projectId);
            controller.enqueue(encodeSSE({ content: JSON.stringify(result), done: false }));
            controller.enqueue(encodeSSE({ content: '', done: true }));
            controller.close();
          } catch (error) {
            controller.enqueue(encodeSSE({ error: classifyError(error) }));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Streaming actions
    const generator = createStreamGenerator(
      action as StreamAction,
      provider,
      projectRepo,
      projectId,
      params,
    );

    if (!generator) {
      return new Response(
        JSON.stringify({ error: 'Failed to create stream for action' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const abortSignal = req.signal;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            if (abortSignal?.aborted) {
              controller.close();
              return;
            }
            controller.enqueue(encodeSSE({ content: chunk.content, done: chunk.done }));
          }
          controller.enqueue(encodeSSE({ content: '', done: true }));
          controller.close();
        } catch (error) {
          controller.enqueue(encodeSSE({ error: classifyError(error) }));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const errResponse = classifyError(error);
    return new Response(
      JSON.stringify(errResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
