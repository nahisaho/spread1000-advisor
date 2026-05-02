interface CharacterCounterProps {
  current: number;
  min: number;
  max: number;
}

export function CharacterCounter({ current, min, max }: CharacterCounterProps) {
  const status = current > max ? 'over' : current < min ? 'under' : 'ok';
  const colorClass =
    status === 'over'
      ? 'text-red-600'
      : status === 'under'
        ? 'text-yellow-600'
        : 'text-green-600';

  return (
    <span className={`text-sm font-medium ${colorClass}`} data-testid="char-counter" data-status={status}>
      {current} / {min}-{max}
    </span>
  );
}
