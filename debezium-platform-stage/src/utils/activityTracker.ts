import { POLLING } from "./pollingConfig";

type Listener = () => void;

/**
 * User activity to adapt polling frequency.
 */
let lastActivityAt = Date.now();
let isIdle = false;
let isVisible = typeof document !== "undefined" ? !document.hidden : true;
let subscriberCount = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<Listener>();

type PollingSnapshot = {
  isVisible: boolean;
  isIdle: boolean;
  lastActivityAt: number;
};

let snapshot: PollingSnapshot = {
  isVisible,
  isIdle,
  lastActivityAt,
};

function updateSnapshot() {
  snapshot = {
    isVisible,
    isIdle,
    lastActivityAt,
  };
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "focus"] as const;

function notifyListeners() {
  updateSnapshot();
  listeners.forEach((listener) => listener());
}

function resetIdleTimer() {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
  }

  idleTimer = setTimeout(() => {
    if (!isIdle) {
      isIdle = true;
      notifyListeners();
    }
  }, POLLING.idleThresholdMs);
}

function recordActivity() {
  const wasIdle = isIdle;
  lastActivityAt = Date.now();
  isIdle = false;
  resetIdleTimer();

  if (wasIdle) {
    notifyListeners();
  }
}

function handleVisibilityChange() {
  const nextVisible = !document.hidden;
  if (nextVisible === isVisible) {
    return;
  }

  isVisible = nextVisible;

  if (isVisible) {
    recordActivity();
  }

  notifyListeners();
}

function attachGlobalListeners() {
  ACTIVITY_EVENTS.forEach((event) => {
    document.addEventListener(event, recordActivity, { passive: true });
  });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  resetIdleTimer();
}

function detachGlobalListeners() {
  ACTIVITY_EVENTS.forEach((event) => {
    document.removeEventListener(event, recordActivity);
  });
  document.removeEventListener("visibilitychange", handleVisibilityChange);

  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

export function subscribePollingState(listener: Listener): () => void {
  listeners.add(listener);

  if (subscriberCount === 0) {
    attachGlobalListeners();
  }
  subscriberCount += 1;

  return () => {
    listeners.delete(listener);
    subscriberCount -= 1;

    if (subscriberCount === 0) {
      detachGlobalListeners();
    }
  };
}

export function getPollingState(): PollingSnapshot {
  return snapshot;
}

/** @internal Test helper */
export function resetActivityTrackerForTests() {
  detachGlobalListeners();
  listeners.clear();
  subscriberCount = 0;
  lastActivityAt = Date.now();
  isIdle = false;
  isVisible = true;
  idleTimer = null;
  updateSnapshot();
}

/** @internal Test helper */
export function setPollingStateForTests(state: {
  isVisible?: boolean;
  isIdle?: boolean;
}) {
  if (state.isVisible !== undefined) {
    isVisible = state.isVisible;
  }
  if (state.isIdle !== undefined) {
    isIdle = state.isIdle;
  }
  updateSnapshot();
}
