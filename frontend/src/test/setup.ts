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
