import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/analytics", () => ({
  track: vi.fn(),
}));

vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureMessage: vi.fn(),
}));

describe("privacy-safe telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("sends analytics event names without sensitive payloads", async () => {
    const { trackProductEvent } = await import("./telemetry");
    const { track } = await import("@vercel/analytics");

    trackProductEvent("project_opened");
    trackProductEvent("milestone_submit_success");

    expect(track).toHaveBeenNthCalledWith(1, "project_opened");
    expect(track).toHaveBeenNthCalledWith(2, "milestone_submit_success");
    for (const call of vi.mocked(track).mock.calls) {
      expect(call).toHaveLength(1);
      expect(typeof call[0]).toBe("string");
    }
  });

  it("keeps monitoring disabled without a DSN", async () => {
    const {
      captureOperationalError,
      initializeMonitoring,
      isMonitoringEnabled,
    } = await import("./telemetry");
    const Sentry = await import("@sentry/react");

    expect(
      initializeMonitoring({
        dsn: "",
        isProduction: true,
        enableInDevelopment: false,
      }),
    ).toBe(false);
    captureOperationalError("wallet_connect", new Error("RPC failed"));

    expect(isMonitoringEnabled()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("captures only safe tags and a broad category when configured", async () => {
    const { captureOperationalError, initializeMonitoring } =
      await import("./telemetry");
    const Sentry = await import("@sentry/react");
    const sensitiveError = new Error(
      "RPC failed for GSECRETWALLET with transaction deadbeef and payload",
    );

    expect(
      initializeMonitoring({
        dsn: "https://public@example.invalid/1",
        isProduction: true,
        enableInDevelopment: false,
      }),
    ).toBe(true);
    captureOperationalError("project_fund", sensitiveError);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Handled frontend operation failed",
      {
        level: "error",
        tags: {
          action: "project_fund",
          network: "testnet",
          category: "rpc",
        },
      },
    );
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toMatch(
      /GSECRETWALLET|deadbeef|payload/,
    );
  });

  it("allows an explicit development override but strips request and user data", async () => {
    const { initializeMonitoring } = await import("./telemetry");
    const Sentry = await import("@sentry/react");

    expect(
      initializeMonitoring({
        dsn: "https://public@example.invalid/1",
        isProduction: false,
        enableInDevelopment: true,
      }),
    ).toBe(true);

    const options = vi.mocked(Sentry.init).mock.calls[0][0];
    expect(options.sendDefaultPii).toBe(false);
    const event = {
      user: { id: "wallet" },
      request: { data: "payload" },
      extra: { project: "secret" },
      breadcrumbs: [{ message: "work reference" }],
      contexts: { project: { title: "secret" } },
      transaction: "/project/secret",
    };
    const filtered = options.beforeSend?.(event as never, {} as never);
    expect(filtered).toEqual({});
  });
});
