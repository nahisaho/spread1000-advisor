import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns correct initial state', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave(saveFn, 'initial'));

    expect(result.current.saveStatus).toBe('idle');
    expect(result.current.lastSavedAt).toBeNull();
    expect(typeof result.current.saveNow).toBe('function');
  });

  it('does not save on initial render', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoSave(saveFn, 'initial'));

    vi.advanceTimersByTime(3000);
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('debounces save on data change', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave(saveFn, data, 2000),
      { initialProps: { data: 'v1' } },
    );

    // Change data to trigger save
    rerender({ data: 'v2' });

    // Should not have saved yet
    expect(saveFn).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe('idle');

    // Advance past debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(saveFn).toHaveBeenCalledOnce();
    expect(result.current.saveStatus).toBe('saved');
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it('resets debounce timer on rapid data changes', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ data }) => useAutoSave(saveFn, data, 2000),
      { initialProps: { data: 'v1' } },
    );

    rerender({ data: 'v2' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    rerender({ data: 'v3' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    // Should not have saved yet (timer reset)
    expect(saveFn).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(saveFn).toHaveBeenCalledOnce();
  });

  it('saveNow triggers immediate save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      ({ data }) => useAutoSave(saveFn, data, 2000),
      { initialProps: { data: 'v1' } },
    );

    await act(async () => {
      await result.current.saveNow();
    });

    expect(saveFn).toHaveBeenCalledOnce();
    expect(result.current.saveStatus).toBe('saved');
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it('saveNow cancels pending debounced save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave(saveFn, data, 2000),
      { initialProps: { data: 'v1' } },
    );

    // Trigger debounced save
    rerender({ data: 'v2' });

    // Immediately save
    await act(async () => {
      await result.current.saveNow();
    });

    expect(saveFn).toHaveBeenCalledOnce();

    // Advance past original debounce - should not trigger another save
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(saveFn).toHaveBeenCalledOnce();
  });

  it('sets error status when save fails', async () => {
    const saveFn = vi.fn().mockRejectedValue(new Error('Save failed'));
    const { result } = renderHook(
      ({ data }) => useAutoSave(saveFn, data, 2000),
      { initialProps: { data: 'v1' } },
    );

    await act(async () => {
      await result.current.saveNow();
    });

    expect(result.current.saveStatus).toBe('error');
    expect(result.current.lastSavedAt).toBeNull();
  });

  it('transitions through saving status', async () => {
    let resolveSave: () => void;
    const saveFn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const { result } = renderHook(
      ({ data }) => useAutoSave(saveFn, data, 2000),
      { initialProps: { data: 'v1' } },
    );

    expect(result.current.saveStatus).toBe('idle');

    // Start saving but don't resolve yet
    act(() => {
      void result.current.saveNow();
    });

    expect(result.current.saveStatus).toBe('saving');

    // Now resolve the save
    await act(async () => {
      resolveSave!();
    });

    expect(result.current.saveStatus).toBe('saved');
  });

  it('uses custom debounce interval', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ data }) => useAutoSave(saveFn, data, 500),
      { initialProps: { data: 'v1' } },
    );

    rerender({ data: 'v2' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(saveFn).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(saveFn).toHaveBeenCalledOnce();
  });
});
