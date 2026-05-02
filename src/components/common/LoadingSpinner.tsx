type SpinnerSize = "sm" | "md" | "lg";

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  label?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-3",
  lg: "h-12 w-12 border-4",
};

export function LoadingSpinner({ size = "md", label }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-2" role="status">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-blue-600 border-t-transparent`}
      />
      {label && (
        <span className="text-sm text-gray-600">{label}</span>
      )}
      {!label && <span className="sr-only">Loading...</span>}
    </div>
  );
}
