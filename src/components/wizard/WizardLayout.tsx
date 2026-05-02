'use client';

import { ChatLayout } from '@/components/chat/ChatLayout';

interface WizardLayoutProps {
  projectId: string;
}

export function WizardLayout({ projectId }: WizardLayoutProps) {
  return <ChatLayout projectId={projectId} />;
}
