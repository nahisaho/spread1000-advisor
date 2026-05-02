'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseAutoSaveReturn {
  saveStatus: SaveStatus;
  saveNow: () => Promise<void>;
  lastSavedAt: Date | null;
}

export function useAutoSave(
  saveFn: () => Promise<void>,
  data: unknown,
  debounceMs: number = 2000,
): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveFnRef = useRef(saveFn);
  const isFirstRender = useRef(true);

  saveFnRef.current = saveFn;

  const executeSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await saveFnRef.current();
      setSaveStatus('saved');
      setLastSavedAt(new Date());
    } catch {
      setSaveStatus('error');
    }
  }, []);

  const saveNow = useCallback(async () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await executeSave();
  }, [executeSave]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void executeSave();
    }, debounceMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [data, debounceMs, executeSave]);

  return { saveStatus, saveNow, lastSavedAt };
}
