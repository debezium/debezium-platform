// Global setup file for vitest - runs before all tests (before `src/__test__/unit/setup.ts`).
// Install before MSW so interceptors see a WebSocket with addEventListener in jsdom.
class WebSocketMock {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = WebSocketMock.OPEN;
  url: string;
  private readonly listeners = new Map<string, Set<EventListener>>();

  constructor(url: string | URL) {
    this.url = String(url);
  }

  addEventListener(type: string, listener: EventListener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(): void {}

  close(): void {
    this.readyState = WebSocketMock.CLOSED;
  }

  dispatchEvent(): boolean {
    return true;
  }
}

Object.defineProperty(globalThis, "WebSocket", {
  value: WebSocketMock,
  writable: true,
  configurable: true,
});

Object.defineProperty(global, "WebSocket", {
  value: WebSocketMock,
  writable: true,
  configurable: true,
});

// Mock localStorage for MSW
class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

// Setup localStorage in globalThis before any tests run
Object.defineProperty(globalThis, 'localStorage', {
  value: new LocalStorageMock(),
  writable: true,
  configurable: true,
});

// Setup for workers/forks
Object.defineProperty(global, 'localStorage', {
  value: new LocalStorageMock(),
  writable: true,
  configurable: true,
});

