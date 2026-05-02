import { WizardLayout } from '@/components/wizard/WizardLayout';

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  return <WizardLayout projectId={projectId} />;
}
