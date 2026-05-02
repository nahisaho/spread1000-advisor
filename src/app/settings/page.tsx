import { LLMSettingsForm } from '@/components/settings';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Settings
      </h1>
      <LLMSettingsForm />
    </div>
  );
}
