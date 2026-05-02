import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharacterCounter } from './CharacterCounter';

describe('CharacterCounter', () => {
  it('shows green when in range', () => {
    render(<CharacterCounter current={100} min={80} max={400} />);
    const counter = screen.getByTestId('char-counter');
    expect(counter.textContent).toBe('100 / 80-400');
    expect(counter.dataset.status).toBe('ok');
  });

  it('shows yellow when under min', () => {
    render(<CharacterCounter current={30} min={80} max={400} />);
    const counter = screen.getByTestId('char-counter');
    expect(counter.dataset.status).toBe('under');
  });

  it('shows red when over max', () => {
    render(<CharacterCounter current={500} min={80} max={400} />);
    const counter = screen.getByTestId('char-counter');
    expect(counter.dataset.status).toBe('over');
  });
});
