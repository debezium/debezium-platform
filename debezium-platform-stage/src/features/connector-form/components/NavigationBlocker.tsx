import { Component, type ReactNode } from 'react';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import { UnsavedChangesModal } from './UnsavedChangesModal';

interface NavigationBlockerProps {
  isDirty: boolean;
}

function BlockerInner({ isDirty }: NavigationBlockerProps) {
  const { isBlocked, proceed, cancel } = useUnsavedChangesWarning(isDirty);

  return (
    <UnsavedChangesModal
      isOpen={isBlocked}
      onConfirm={proceed}
      onCancel={cancel}
    />
  );
}

/**
 * Error boundary that silently swallows errors from useBlocker
 * when no data router is present (e.g. in tests).
 */
class BlockerBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/**
 * Renders a navigation blocker + confirmation modal.
 * Gracefully degrades to a no-op when no data router is present.
 */
export function NavigationBlocker({ isDirty }: NavigationBlockerProps) {
  return (
    <BlockerBoundary>
      <BlockerInner isDirty={isDirty} />
    </BlockerBoundary>
  );
}
