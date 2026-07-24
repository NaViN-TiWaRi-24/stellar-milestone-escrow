import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Project } from "milestone-escrow";
import {
  acceptProject,
  approveMilestone,
  approveRefund,
  cancelProject,
  fundProject,
  releaseMilestonePayment,
  requestRefund,
  submitMilestone,
  type ProjectWriteReceipt,
  type WriteTransactionStatus,
} from "../lib/escrow";
import { shortenAddress } from "../lib/wallet";
import { formatTokenAmount } from "../lib/amounts";
import "./ProjectDetailsModal.css";

type Props = {
  project: Project | null;
  walletAddress: string | null;
  onClose: () => void;
  onProjectUpdated: (project: Project) => void;
};

type ActionStatus =
  | "idle"
  | WriteTransactionStatus
  | "success"
  | "rejected"
  | "failed";

const xlmSacId = import.meta.env.VITE_XLM_SAC_ID as string | undefined;
const explorerBaseUrl =
  import.meta.env.VITE_STELLAR_EXPLORER_URL ??
  "https://stellar.expert/explorer/testnet";

function formatDeadline(timestamp: bigint): string {
  const milliseconds = timestamp * 1000n;
  if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) {
    return `Unix ${timestamp.toString()}`;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Number(milliseconds)));
}

function actionError(error: unknown): {
  status: "rejected" | "failed";
  message: string;
} {
  const raw = error instanceof Error ? error.message : String(error);
  const value = raw.toLowerCase();
  if (
    value.includes("reject") ||
    value.includes("declin") ||
    value.includes("cancelled by user") ||
    value.includes("denied")
  ) {
    return {
      status: "rejected",
      message:
        "The wallet signature was rejected. No on-chain change was made.",
    };
  }
  if (value.includes("insufficient") || value.includes("balance")) {
    return {
      status: "failed",
      message:
        "The wallet does not have enough Testnet XLM for this action and its network fee.",
    };
  }
  if (value.includes("unauthorized")) {
    return {
      status: "failed",
      message: "The connected wallet is not authorized for this action.",
    };
  }
  if (
    value.includes("invalidprojectstate") ||
    value.includes("invalidmilestonestate")
  ) {
    return {
      status: "failed",
      message:
        "The project changed on-chain and this action is no longer available. Refresh and try again.",
    };
  }
  if (value.includes("emptyworkreference")) {
    return { status: "failed", message: "Enter a work reference to continue." };
  }
  if (
    value.includes("simulation") ||
    value.includes("rpc") ||
    value.includes("network") ||
    value.includes("fetch")
  ) {
    return {
      status: "failed",
      message:
        "Stellar Testnet could not prepare this transaction. Check Freighter’s network and your connection, then try again.",
    };
  }
  return {
    status: "failed",
    message:
      "The contract could not complete this action on Stellar Testnet. The project may have changed; please refresh and try again.",
  };
}

export function ProjectDetailsModal({
  project,
  walletAddress,
  onClose,
  onProjectUpdated,
}: Props) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(project);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [fundConfirmation, setFundConfirmation] = useState(false);
  const [workReferences, setWorkReferences] = useState<Record<number, string>>(
    {},
  );
  const [workErrors, setWorkErrors] = useState<Record<number, string>>({});

  const isPending = [
    "preparing",
    "waiting-for-signature",
    "submitting",
  ].includes(status);
  pendingRef.current = isPending;

  useEffect(() => {
    setCurrentProject(project);
    setStatus("idle");
    setStatusMessage("");
    setTransactionHash(null);
    setFundConfirmation(false);
    setWorkReferences({});
    setWorkErrors({});
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.classList.add("modal-open");
    window.setTimeout(() => dialogRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pendingRef.current) onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [project, onClose]);

  const paidMilestones = useMemo(
    () =>
      currentProject?.milestones.filter(
        (milestone) => milestone.status.tag === "Paid",
      ).length ?? 0,
    [currentProject],
  );

  if (!project || !currentProject) return null;

  const isClient = walletAddress === currentProject.client;
  const isFreelancer = walletAddress === currentProject.freelancer;
  const projectStatus =
    currentProject.milestones.length > 0 &&
    paidMilestones === currentProject.milestones.length
      ? "Completed"
      : currentProject.status.tag;
  const role = isClient ? "Client" : isFreelancer ? "Freelancer" : "Viewer";
  const isNativeXlm =
    Boolean(xlmSacId) &&
    currentProject.asset.toUpperCase() === xlmSacId!.toUpperCase();
  const remainingEscrow =
    currentProject.escrowed_amount - currentProject.released_amount;
  const progress = Math.round(
    (paidMilestones * 100) / Math.max(currentProject.milestones.length, 1),
  );

  function trackStatus(nextStatus: WriteTransactionStatus) {
    setStatus(nextStatus);
    setStatusMessage(
      nextStatus === "preparing"
        ? "Preparing and simulating the transaction on Stellar Testnet…"
        : nextStatus === "waiting-for-signature"
          ? "Confirm this transaction in Freighter…"
          : "Submitting the signed transaction to Stellar Testnet…",
    );
  }

  async function performAction(
    action: () => Promise<ProjectWriteReceipt>,
    successMessage: string,
  ) {
    if (pendingRef.current) return;
    setTransactionHash(null);
    try {
      const receipt = await action();
      setCurrentProject(receipt.project);
      onProjectUpdated(receipt.project);
      setTransactionHash(receipt.transactionHash);
      setStatus("success");
      setStatusMessage(successMessage);
      setFundConfirmation(false);
    } catch (error) {
      const friendly = actionError(error);
      setStatus(friendly.status);
      setStatusMessage(friendly.message);
    }
  }

  function submitWork(milestoneId: number) {
    const activeProject = currentProject;
    if (!activeProject) return;
    const workReference = workReferences[milestoneId]?.trim() ?? "";
    if (!workReference) {
      setWorkErrors((current) => ({
        ...current,
        [milestoneId]: "Enter a URL, CID, or short work reference.",
      }));
      return;
    }
    setWorkErrors((current) => ({ ...current, [milestoneId]: "" }));
    void performAction(
      () =>
        submitMilestone(
          activeProject.id,
          milestoneId,
          activeProject.freelancer,
          workReference,
          trackStatus,
        ),
      "Work reference submitted successfully.",
    );
  }

  return (
    <div
      className="project-details-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
    >
      <div
        className="project-details-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <header className="details-header">
          <div>
            <p className="eyebrow">Project #{currentProject.id.toString()}</p>
            <h2 id={headingId}>{currentProject.title}</h2>
            <div className="details-badges">
              <span className={`details-status ${projectStatus.toLowerCase()}`}>
                {projectStatus}
              </span>
              <span className="details-role">{role}</span>
            </div>
          </div>
          <button
            className="details-close"
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close project details"
          >
            ×
          </button>
        </header>

        <section className="details-section" aria-labelledby={`${headingId}-summary`}>
          <h3 id={`${headingId}-summary`}>Project summary</h3>
          <dl className="project-facts">
            <div>
              <dt>Client</dt>
              <dd title={currentProject.client}>
                {shortenAddress(currentProject.client)}
              </dd>
            </div>
            <div>
              <dt>Freelancer</dt>
              <dd title={currentProject.freelancer}>
                {shortenAddress(currentProject.freelancer)}
              </dd>
            </div>
            <div className="asset-fact">
              <dt>Asset</dt>
              <dd>
                {isNativeXlm ? "Native XLM · Testnet" : "Soroban token"}
                <small>{currentProject.asset}</small>
              </dd>
            </div>
            <div>
              <dt>Total amount</dt>
              <dd>{formatTokenAmount(currentProject.total_amount, isNativeXlm)}</dd>
            </div>
            <div>
              <dt>Escrowed</dt>
              <dd>
                {formatTokenAmount(currentProject.escrowed_amount, isNativeXlm)}
              </dd>
            </div>
            <div>
              <dt>Released</dt>
              <dd>
                {formatTokenAmount(currentProject.released_amount, isNativeXlm)}
              </dd>
            </div>
            <div>
              <dt>Remaining escrow</dt>
              <dd>{formatTokenAmount(remainingEscrow, isNativeXlm)}</dd>
            </div>
          </dl>

          <div className="details-progress-copy">
            <span>Paid milestone progress</span>
            <strong>
              {paidMilestones}/{currentProject.milestones.length} · {progress}%
            </strong>
          </div>
          <div
            className="details-progress"
            role="progressbar"
            aria-label="Paid milestone progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </section>

        {(isClient || isFreelancer) && projectStatus !== "Completed" && (
          <section className="details-section project-actions">
            <h3>Available project actions</h3>
            <div className="project-action-buttons">
              {isFreelancer && currentProject.status.tag === "Created" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    void performAction(
                      () =>
                        acceptProject(
                          currentProject.id,
                          currentProject.freelancer,
                          trackStatus,
                        ),
                      "Project accepted successfully.",
                    )
                  }
                >
                  Accept project
                </button>
              )}
              {isFreelancer &&
                currentProject.status.tag === "RefundRequested" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      void performAction(
                        () =>
                          approveRefund(
                            currentProject.id,
                            currentProject.freelancer,
                            trackStatus,
                          ),
                        "Refund approved successfully.",
                      )
                    }
                  >
                    Approve refund
                  </button>
                )}
              {isClient &&
                ["Created", "Accepted"].includes(currentProject.status.tag) && (
                  <button
                    className="danger-action"
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      void performAction(
                        () =>
                          cancelProject(
                            currentProject.id,
                            currentProject.client,
                            trackStatus,
                          ),
                        "Project cancelled successfully.",
                      )
                    }
                  >
                    Cancel project
                  </button>
                )}
              {isClient && currentProject.status.tag === "Accepted" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setFundConfirmation(true)}
                >
                  Fund escrow
                </button>
              )}
              {isClient &&
                ["Funded", "Active"].includes(currentProject.status.tag) &&
                remainingEscrow > 0n && (
                  <button
                    className="secondary-detail-action"
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      void performAction(
                        () =>
                          requestRefund(
                            currentProject.id,
                            currentProject.client,
                            trackStatus,
                          ),
                        "Refund requested successfully.",
                      )
                    }
                  >
                    Request refund
                  </button>
                )}
            </div>

            {fundConfirmation && (
              <div className="fund-confirmation" role="alert">
                <strong>Confirm Testnet escrow funding</strong>
                <p>
                  Freighter will transfer exactly{" "}
                  <b>{formatTokenAmount(currentProject.total_amount, isNativeXlm)}</b>{" "}
                  into this contract on Stellar Testnet.
                </p>
                <div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setFundConfirmation(false)}
                  >
                    Go back
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      void performAction(
                        () =>
                          fundProject(
                            currentProject.id,
                            currentProject.client,
                            trackStatus,
                          ),
                        "Escrow funded successfully.",
                      )
                    }
                  >
                    Confirm and fund
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="details-section">
          <h3>Milestones</h3>
          <div className="details-milestone-list">
            {currentProject.milestones.map((milestone) => {
              const canSubmit =
                isFreelancer &&
                ["Funded", "Active"].includes(currentProject.status.tag) &&
                milestone.status.tag === "Pending";
              const canApprove =
                isClient &&
                currentProject.status.tag === "Active" &&
                milestone.status.tag === "Submitted";
              const canRelease =
                isClient &&
                currentProject.status.tag === "Active" &&
                milestone.status.tag === "Approved";

              return (
                <article className="details-milestone" key={milestone.id}>
                  <div className="details-milestone-heading">
                    <div>
                      <span>Milestone #{milestone.id}</span>
                      <h4>{milestone.title}</h4>
                    </div>
                    <span
                      className={`milestone-status ${milestone.status.tag.toLowerCase()}`}
                    >
                      {milestone.status.tag}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Amount</dt>
                      <dd>{formatTokenAmount(milestone.amount, isNativeXlm)}</dd>
                    </div>
                    <div>
                      <dt>Deadline</dt>
                      <dd>{formatDeadline(milestone.deadline)}</dd>
                    </div>
                  </dl>
                  {milestone.work_reference && (
                    <div className="work-reference">
                      <strong>Work reference</strong>
                      <span>{milestone.work_reference}</span>
                    </div>
                  )}
                  {canSubmit && (
                    <div className="submit-work">
                      <label htmlFor={`${headingId}-work-${milestone.id}`}>
                        Work reference
                      </label>
                      <input
                        id={`${headingId}-work-${milestone.id}`}
                        value={workReferences[milestone.id] ?? ""}
                        onChange={(event) =>
                          setWorkReferences((current) => ({
                            ...current,
                            [milestone.id]: event.target.value,
                          }))
                        }
                        placeholder="URL, CID, or short reference"
                        disabled={isPending}
                        aria-invalid={Boolean(workErrors[milestone.id])}
                      />
                      {workErrors[milestone.id] && (
                        <span className="detail-field-error">
                          {workErrors[milestone.id]}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => submitWork(milestone.id)}
                      >
                        Submit work
                      </button>
                    </div>
                  )}
                  {canApprove && (
                    <button
                      className="milestone-action"
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        void performAction(
                          () =>
                            approveMilestone(
                              currentProject.id,
                              milestone.id,
                              currentProject.client,
                              trackStatus,
                            ),
                          "Milestone approved successfully.",
                        )
                      }
                    >
                      Approve milestone
                    </button>
                  )}
                  {canRelease && (
                    <button
                      className="milestone-action"
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        void performAction(
                          () =>
                            releaseMilestonePayment(
                              currentProject.id,
                              milestone.id,
                              currentProject.client,
                              trackStatus,
                            ),
                          "Milestone payment released successfully.",
                        )
                      }
                    >
                      Release payment
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {status !== "idle" && (
          <div
            className={`detail-transaction-status ${status}`}
            role={status === "failed" || status === "rejected" ? "alert" : "status"}
            aria-live="polite"
          >
            {isPending && <span className="detail-spinner" aria-hidden="true" />}
            <div>
              <strong>
                {status === "waiting-for-signature"
                  ? "Waiting for wallet"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </strong>
              <p>{statusMessage}</p>
              {transactionHash && (
                <div className="detail-receipt">
                  <span>Transaction: {transactionHash}</span>
                  <a
                    href={`${explorerBaseUrl}/tx/${transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Stellar Expert ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
