'use client';

interface StepConfirmationProps {
  title: string;
  summary: string;
  onConfirm: () => void;
  onRevise: () => void;
  confirmLabel?: string;
  reviseLabel?: string;
}

export function StepConfirmation({
  title,
  summary,
  onConfirm,
  onRevise,
  confirmLabel = '確認して次へ進む',
  reviseLabel = 'やり直す',
}: StepConfirmationProps) {
  return (
    <div
      className="rounded-lg border-2 border-blue-200 bg-blue-50 p-6 space-y-4"
      data-testid="step-confirmation"
    >
      <h3 className="text-lg font-bold text-blue-900">{title}</h3>

      <div className="rounded-md bg-white p-4 text-sm text-gray-700 whitespace-pre-wrap border border-blue-100">
        {summary}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          data-testid="step-confirm-btn"
        >
          ✓ {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onRevise}
          className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          data-testid="step-revise-btn"
        >
          ↻ {reviseLabel}
        </button>
      </div>
    </div>
  );
}
