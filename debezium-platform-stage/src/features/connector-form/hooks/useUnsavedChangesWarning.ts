import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Blocks navigation (React Router + browser beforeunload) when the form has unsaved changes.
 * Must be rendered inside a data router context.
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const proceed = useCallback(() => {
    if (blocker.state === 'blocked') blocker.proceed();
  }, [blocker]);

  const cancel = useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  return {
    isBlocked: blocker.state === 'blocked',
    proceed,
    cancel,
  };
}
