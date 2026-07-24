import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Milestone, Project } from "milestone-escrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDetailsModal } from "./ProjectDetailsModal";
import {
  acceptProject,
  fundProject,
} from "../lib/escrow";

vi.mock("../lib/escrow", () => ({
  acceptProject: vi.fn(),
  approveMilestone: vi.fn(),
  approveRefund: vi.fn(),
  cancelProject: vi.fn(),
  fundProject: vi.fn(),
  releaseMilestonePayment: vi.fn(),
  requestRefund: vi.fn(),
  submitMilestone: vi.fn(),
}));

const client = "GCLIENTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const freelancer =
  "GFREELANCERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const asset = import.meta.env.VITE_XLM_SAC_ID ?? "CXLMASSET";

function milestone(
  id: number,
  status: Milestone["status"]["tag"],
): Milestone {
  return {
    id,
    title: `Milestone ${id}`,
    amount: 10_000_000n,
    deadline: 2_000_000_000n,
    status: { tag: status, values: undefined },
    work_reference: status === "Pending" ? "" : `ipfs://work-${id}`,
  };
}

function project(
  status: Project["status"]["tag"],
  milestones: Milestone[] = [milestone(0, "Pending")],
): Project {
  return {
    id: 1n,
    title: "Real escrow project",
    client,
    freelancer,
    asset,
    total_amount: 40_000_000n,
    escrowed_amount: status === "Created" || status === "Accepted" ? 0n : 40_000_000n,
    released_amount: milestones
      .filter((item) => item.status.tag === "Paid")
      .reduce((total, item) => total + item.amount, 0n),
    status: { tag: status, values: undefined },
    milestones,
  };
}

function renderDetails(value: Project, walletAddress: string) {
  return render(
    <ProjectDetailsModal
      project={value}
      walletAddress={walletAddress}
      onClose={vi.fn()}
      onProjectUpdated={vi.fn()}
    />,
  );
}

describe("ProjectDetailsModal", () => {
  beforeEach(() => {
    vi.mocked(acceptProject).mockReset();
    vi.mocked(fundProject).mockReset();
  });

  it.each([
    "Created",
    "Accepted",
    "Funded",
    "Active",
    "Cancelled",
    "RefundRequested",
    "Refunded",
  ] as const)("renders the %s project status", (status) => {
    renderDetails(project(status), client);
    expect(screen.getByText(status, { selector: ".details-status" })).toBeVisible();
  });

  it("renders project and every milestone status from on-chain data", () => {
    renderDetails(
      project("Active", [
        milestone(0, "Pending"),
        milestone(1, "Submitted"),
        milestone(2, "Approved"),
        milestone(3, "Paid"),
      ]),
      client,
    );

    expect(screen.getByRole("heading", { name: "Real escrow project" })).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    for (const status of ["Pending", "Submitted", "Approved", "Paid"]) {
      expect(screen.getByText(status)).toBeVisible();
    }
    expect(screen.getByText("1/4 · 25%")).toBeVisible();
  });

  it("shows only client actions allowed by project and milestone state", () => {
    renderDetails(
      project("Active", [
        milestone(0, "Submitted"),
        milestone(1, "Approved"),
      ]),
      client,
    );

    expect(screen.getByRole("button", { name: "Approve milestone" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Release payment" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Request refund" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Submit work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept project" })).not.toBeInTheDocument();
  });

  it("shows freelancer actions and hides client-only actions", () => {
    renderDetails(project("Funded"), freelancer);

    expect(screen.getByRole("button", { name: "Submit work" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request refund" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fund escrow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel project" })).not.toBeInTheDocument();
  });

  it("derives Completed from fully paid milestones and offers no actions", () => {
    renderDetails(
      project("Active", [milestone(0, "Paid"), milestone(1, "Paid")]),
      client,
    );

    expect(screen.getByText("Completed")).toBeVisible();
    expect(screen.getByText("2/2 · 100%")).toBeVisible();
    expect(screen.queryByText("Available project actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refund|approve|release|fund|cancel/i }))
      .not.toBeInTheDocument();
  });

  it("shows a friendly RPC error without exposing the raw failure", async () => {
    const user = userEvent.setup();
    vi.mocked(fundProject).mockRejectedValue(
      new Error("RPC simulation failed: raw diagnostic"),
    );
    renderDetails(project("Accepted"), client);

    await user.click(screen.getByRole("button", { name: "Fund escrow" }));
    await user.click(screen.getByRole("button", { name: "Confirm and fund" }));

    expect(
      await screen.findByText(/Stellar Testnet could not prepare this transaction/),
    ).toBeVisible();
    expect(screen.queryByText(/raw diagnostic/i)).not.toBeInTheDocument();
  });

  it("shows a friendly wallet rejection and performs no live transaction", async () => {
    const user = userEvent.setup();
    vi.mocked(acceptProject).mockRejectedValue(
      new Error("User rejected wallet request"),
    );
    renderDetails(project("Created"), freelancer);

    await user.click(screen.getByRole("button", { name: "Accept project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "wallet signature was rejected",
    );
    expect(acceptProject).toHaveBeenCalledTimes(1);
  });
});
