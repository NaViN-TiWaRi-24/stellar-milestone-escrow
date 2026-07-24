import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { captureOperationalError } from "../lib/telemetry";

vi.mock("../lib/telemetry", () => ({
  captureOperationalError: vi.fn(),
}));

function BrokenView(): never {
  throw new Error("sensitive render details");
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    vi.mocked(captureOperationalError).mockReset();
  });

  it("renders an accessible fallback and offers retry and reload controls", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "The escrow dashboard could not be displayed.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(captureOperationalError).toHaveBeenCalledWith(
      "react_render",
      expect.any(Error),
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("alert")).toBeVisible();
    consoleError.mockRestore();
  });
});
