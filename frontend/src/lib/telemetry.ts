import * as Sentry from "@sentry/react";
import { track } from "@vercel/analytics";

export type ProductEvent =
  | "wallet_connect_success"
  | "wallet_connect_failed"
  | "project_create_success"
  | "project_create_failed"
  | "project_opened"
  | "project_accept_success"
  | "project_fund_success"
  | "milestone_submit_success"
  | "milestone_approve_success"
  | "milestone_release_success"
  | "refund_request_success"
  | "refund_approve_success";

export type MonitoredAction =
  | "wallet_connect"
  | "load_projects"
  | "project_create"
  | "project_accept"
  | "project_fund"
  | "project_cancel"
  | "milestone_submit"
  | "milestone_approve"
  | "milestone_release"
  | "refund_request"
  | "refund_approve"
  | "react_render";

export type ErrorCategory =
  | "wallet_rejected"
  | "wallet_unavailable"
  | "rpc"
  | "contract"
  | "configuration"
  | "insufficient_balance"
  | "authorization"
  | "runtime"
  | "unknown";

type MonitoringConfiguration = {
  dsn?: string;
  isProduction: boolean;
  enableInDevelopment: boolean;
};

let monitoringEnabled = false;

export function trackProductEvent(event: ProductEvent): void {
  track(event);
}

export function categorizeError(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message : String(error);
  const value = message.toLowerCase();

  if (
    value.includes("reject") ||
    value.includes("declin") ||
    value.includes("denied") ||
    value.includes("cancelled by user")
  ) {
    return "wallet_rejected";
  }
  if (
    value.includes("freighter") ||
    value.includes("wallet extension") ||
    value.includes("wallet was not found")
  ) {
    return "wallet_unavailable";
  }
  if (value.includes("insufficient") || value.includes("balance")) {
    return "insufficient_balance";
  }
  if (value.includes("unauthorized") || value.includes("not authorized")) {
    return "authorization";
  }
  if (value.includes("missing frontend configuration")) {
    return "configuration";
  }
  if (
    value.includes("rpc") ||
    value.includes("network") ||
    value.includes("fetch") ||
    value.includes("simulation")
  ) {
    return "rpc";
  }
  if (
    value.includes("contract") ||
    value.includes("invalidproject") ||
    value.includes("invalidmilestone") ||
    value.includes("escrow")
  ) {
    return "contract";
  }
  if (error instanceof Error && error.name !== "Error") {
    return "runtime";
  }
  return "unknown";
}

export function initializeMonitoring(
  configuration: MonitoringConfiguration = {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    isProduction: import.meta.env.PROD,
    enableInDevelopment:
      import.meta.env.VITE_SENTRY_ENABLE_DEV === "true",
  },
): boolean {
  const dsn = configuration.dsn?.trim();
  monitoringEnabled = Boolean(
    dsn &&
      (configuration.isProduction || configuration.enableInDevelopment),
  );

  if (!monitoringEnabled || !dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: configuration.isProduction ? "production" : "development",
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user;
      delete event.request;
      delete event.breadcrumbs;
      delete event.contexts;
      delete event.transaction;
      event.extra = undefined;
      if (event.message) {
        event.message = "Frontend runtime error";
      }
      for (const exception of event.exception?.values ?? []) {
        exception.value = "Frontend runtime error";
      }
      return event;
    },
  });
  return true;
}

export function isMonitoringEnabled(): boolean {
  return monitoringEnabled;
}

export function captureOperationalError(
  action: MonitoredAction,
  error: unknown,
): void {
  if (!monitoringEnabled) {
    return;
  }

  Sentry.captureMessage("Handled frontend operation failed", {
    level: "error",
    tags: {
      action,
      network: "testnet",
      category: categorizeError(error),
    },
  });
}
