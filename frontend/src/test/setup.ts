import "@testing-library/jest-dom";

// Polyfill window.fetch if needed
if (!global.fetch) {
  // @ts-expect-error simple polyfill for tests
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "healthy",
          app_name: "KOSHA — Predictive Cash-Flow Engine",
          version: "0.1.0",
          environment: "test",
          timestamp: new Date().toISOString(),
        }),
    })
  );
}

// Polyfill ResizeObserver for Recharts in JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill EventSource for SSE in JSDOM tests
if (!global.EventSource) {
  // @ts-expect-error simple polyfill for tests
  global.EventSource = class MockEventSource {
    url: string;
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: (() => void) | null = null;
    constructor(url: string) {
      this.url = url;
    }
    addEventListener() {}
    removeEventListener() {}
    close() {}
  };
}
