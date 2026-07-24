import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { StrKey } from "@stellar/stellar-sdk";
import {
  createProject,
  type CreateProjectReceipt,
} from "../lib/escrow";
import { xlmToStroops } from "../lib/amounts";
import "./CreateProjectModal.css";

type TransactionStatus =
  | "idle"
  | "validating"
  | "preparing"
  | "waiting-for-signature"
  | "submitting"
  | "success"
  | "rejected"
  | "failed";

type MilestoneDraft = {
  key: number;
  title: string;
  amount: string;
  deadline: string;
};

type FieldErrors = {
  projectTitle?: string;
  freelancer?: string;
  asset?: string;
  milestones?: Array<{
    title?: string;
    amount?: string;
    deadline?: string;
  }>;
};

type Props = {
  isOpen: boolean;
  walletAddress: string | null;
  onClose: () => void;
  onConnectWallet: () => void;
  onCreated: () => Promise<void> | void;
};

const STROOPS_PER_XLM = 10_000_000n;
const explorerBaseUrl =
  import.meta.env.VITE_STELLAR_EXPLORER_URL ??
  "https://stellar.expert/explorer/testnet";
const xlmSacId = import.meta.env.VITE_XLM_SAC_ID as string | undefined;

function newMilestone(key: number): MilestoneDraft {
  return { key, title: "", amount: "", deadline: "" };
}

function friendlyTransactionError(error: unknown): {
  status: "rejected" | "failed";
  message: string;
} {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw.toLowerCase();

  if (
    normalized.includes("reject") ||
    normalized.includes("declin") ||
    normalized.includes("cancel") ||
    normalized.includes("denied")
  ) {
    return {
      status: "rejected",
      message:
        "The transaction was not signed. Your form is unchanged, so you can review it and try again.",
    };
  }
  if (normalized.includes("invalidparticipant")) {
    return {
      status: "failed",
      message: "The contract rejected one of the participant addresses.",
    };
  }
  if (normalized.includes("invaliddeadline")) {
    return {
      status: "failed",
      message: "The contract rejected a milestone deadline. Choose a later time.",
    };
  }
  if (normalized.includes("missing frontend configuration")) {
    return {
      status: "failed",
      message:
        "The app is missing required Stellar configuration. Ask the app administrator to check the environment settings.",
    };
  }
  if (
    normalized.includes("rpc") ||
    normalized.includes("network") ||
    normalized.includes("fetch")
  ) {
    return {
      status: "failed",
      message:
        "Stellar Testnet could not be reached. Check your connection and Freighter network, then try again.",
    };
  }
  return {
    status: "failed",
    message:
      "The project could not be created on Stellar Testnet. No private wallet information was shared; please try again.",
  };
}

export function CreateProjectModal({
  isOpen,
  walletAddress,
  onClose,
  onConnectWallet,
  onCreated,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);
  const isSubmittingRef = useRef(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [freelancer, setFreelancer] = useState("");
  const [milestones, setMilestones] = useState(() => [newMilestone(0)]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<TransactionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [receipt, setReceipt] = useState<CreateProjectReceipt | null>(null);

  const isSubmitting = [
    "validating",
    "preparing",
    "waiting-for-signature",
    "submitting",
  ].includes(status);
  isSubmittingRef.current = isSubmitting;

  const totalStroops = useMemo(
    () =>
      milestones.reduce<bigint | null>((total, milestone) => {
        const amount = xlmToStroops(milestone.amount);
        return total === null || amount === null ? null : total + amount;
      }, 0n),
    [milestones],
  );

  const totalXlm = useMemo(() => {
    if (totalStroops === null) return "—";
    const whole = totalStroops / STROOPS_PER_XLM;
    const fraction = (totalStroops % STROOPS_PER_XLM)
      .toString()
      .padStart(7, "0")
      .replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
  }, [totalStroops]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.classList.add("modal-open");
    window.setTimeout(() => {
      (walletAddress ? firstInputRef.current : dialogRef.current)?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmittingRef.current) {
        onClose();
      }
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
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose, walletAddress]);

  if (!isOpen) return null;

  function resetForm() {
    setProjectTitle("");
    setFreelancer("");
    setMilestones([newMilestone(nextKey.current++)]);
    setErrors({});
    setStatus("idle");
    setStatusMessage("");
    setReceipt(null);
  }

  function updateMilestone(
    key: number,
    field: "title" | "amount" | "deadline",
    value: string,
  ) {
    setMilestones((current) =>
      current.map((milestone) =>
        milestone.key === key ? { ...milestone, [field]: value } : milestone,
      ),
    );
  }

  function validate(): {
    totalAmount: bigint;
    parsedMilestones: Array<{
      title: string;
      amount: bigint;
      deadline: bigint;
    }>;
  } | null {
    const nextErrors: FieldErrors = { milestones: [] };
    if (!projectTitle.trim()) {
      nextErrors.projectTitle = "Enter a project title.";
    }
    const trimmedFreelancer = freelancer.trim();
    if (!StrKey.isValidEd25519PublicKey(trimmedFreelancer)) {
      nextErrors.freelancer = "Enter a valid Stellar G-address.";
    } else if (
      walletAddress &&
      trimmedFreelancer.toUpperCase() === walletAddress.toUpperCase()
    ) {
      nextErrors.freelancer =
        "The freelancer must be different from the connected client wallet.";
    }
    if (!xlmSacId) {
      nextErrors.asset = "Native Testnet XLM is not configured.";
    }

    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const parsedMilestones = milestones.map((milestone, index) => {
      const milestoneErrors: NonNullable<FieldErrors["milestones"]>[number] =
        {};
      const amount = xlmToStroops(milestone.amount);
      const deadlineMilliseconds = new Date(milestone.deadline).getTime();
      const deadline = Number.isFinite(deadlineMilliseconds)
        ? BigInt(Math.floor(deadlineMilliseconds / 1000))
        : 0n;
      if (!milestone.title.trim()) {
        milestoneErrors.title = "Enter a milestone title.";
      }
      if (amount === null) {
        milestoneErrors.amount =
          "Use a valid XLM amount with no more than 7 decimal places.";
      } else if (amount <= 0n) {
        milestoneErrors.amount = "Amount must be greater than zero.";
      }
      if (!milestone.deadline) {
        milestoneErrors.deadline = "Choose a deadline.";
      } else if (deadline <= nowSeconds) {
        milestoneErrors.deadline = "Deadline must be in the future.";
      }
      nextErrors.milestones![index] = milestoneErrors;
      return {
        title: milestone.title.trim(),
        amount: amount ?? 0n,
        deadline,
      };
    });

    const hasErrors =
      Boolean(nextErrors.projectTitle || nextErrors.freelancer || nextErrors.asset) ||
      nextErrors.milestones!.some((entry) => Object.keys(entry).length > 0);
    setErrors(nextErrors);
    if (hasErrors || totalStroops === null || totalStroops <= 0n) return null;
    return { totalAmount: totalStroops, parsedMilestones };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || !walletAddress) return;
    setReceipt(null);
    setStatus("validating");
    setStatusMessage("Checking project details…");
    const validated = validate();
    if (!validated) {
      setStatus("idle");
      setStatusMessage("");
      return;
    }

    try {
      const result = await createProject({
        client: walletAddress,
        freelancer: freelancer.trim(),
        asset: xlmSacId!,
        title: projectTitle.trim(),
        totalAmount: validated.totalAmount,
        milestones: validated.parsedMilestones,
        onStatusChange: (nextStatus) => {
          setStatus(nextStatus);
          setStatusMessage(
            nextStatus === "preparing"
              ? "Preparing and simulating the transaction…"
              : nextStatus === "waiting-for-signature"
                ? "Confirm this transaction in Freighter…"
                : "Submitting the signed transaction to Stellar Testnet…",
          );
        },
      });
      setReceipt(result);
      setStatus("success");
      setStatusMessage("Your project was created on Stellar Testnet.");
      await onCreated();
    } catch (error) {
      const friendlyError = friendlyTransactionError(error);
      setStatus(friendlyError.status);
      setStatusMessage(friendlyError.message);
    }
  }

  return (
    <div
      className="create-project-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="create-project-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Stellar Testnet</p>
            <h2 id={titleId}>Create project</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close create project form"
          >
            ×
          </button>
        </div>

        {!walletAddress ? (
          <div className="connect-required" role="status">
            <strong>Connect Freighter to continue</strong>
            <p>
              A connected Stellar Testnet wallet is required to sign the
              create-project transaction. Never enter a private key or seed
              phrase here.
            </p>
            <button type="button" onClick={onConnectWallet}>
              Connect wallet
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <fieldset disabled={isSubmitting}>
              <div className="form-field">
                <label htmlFor={`${titleId}-project-title`}>Project title</label>
                <input
                  ref={firstInputRef}
                  id={`${titleId}-project-title`}
                  value={projectTitle}
                  onChange={(event) => setProjectTitle(event.target.value)}
                  aria-invalid={Boolean(errors.projectTitle)}
                  aria-describedby={
                    errors.projectTitle ? `${titleId}-project-title-error` : undefined
                  }
                  autoComplete="off"
                />
                {errors.projectTitle && (
                  <span id={`${titleId}-project-title-error`} className="field-error">
                    {errors.projectTitle}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor={`${titleId}-freelancer`}>
                  Freelancer Stellar public address
                </label>
                <input
                  id={`${titleId}-freelancer`}
                  value={freelancer}
                  onChange={(event) => setFreelancer(event.target.value)}
                  placeholder="G…"
                  spellCheck={false}
                  autoCapitalize="characters"
                  aria-invalid={Boolean(errors.freelancer)}
                />
                {errors.freelancer && (
                  <span className="field-error">{errors.freelancer}</span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor={`${titleId}-asset`}>Asset</label>
                <input
                  id={`${titleId}-asset`}
                  value="Native XLM · Stellar Testnet"
                  readOnly
                />
                <span className="field-help">
                  {xlmSacId ?? "VITE_XLM_SAC_ID is missing"}
                </span>
                {errors.asset && <span className="field-error">{errors.asset}</span>}
              </div>

              <div className="milestones-heading">
                <div>
                  <h3>Milestones</h3>
                  <p>The total is calculated exactly from these XLM amounts.</p>
                </div>
                <button
                  className="add-milestone"
                  type="button"
                  onClick={() =>
                    setMilestones((current) => [
                      ...current,
                      newMilestone(nextKey.current++),
                    ])
                  }
                >
                  + Add milestone
                </button>
              </div>

              <div className="milestone-list">
                {milestones.map((milestone, index) => {
                  const milestoneErrors = errors.milestones?.[index];
                  return (
                    <section className="milestone-card" key={milestone.key}>
                      <div className="milestone-card-heading">
                        <strong>Milestone {index + 1}</strong>
                        <button
                          type="button"
                          onClick={() =>
                            setMilestones((current) =>
                              current.filter((item) => item.key !== milestone.key),
                            )
                          }
                          disabled={milestones.length === 1 || isSubmitting}
                          aria-label={`Remove milestone ${index + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="milestone-fields">
                        <div className="form-field milestone-title">
                          <label htmlFor={`${titleId}-milestone-${milestone.key}-title`}>
                            Title
                          </label>
                          <input
                            id={`${titleId}-milestone-${milestone.key}-title`}
                            value={milestone.title}
                            onChange={(event) =>
                              updateMilestone(milestone.key, "title", event.target.value)
                            }
                            aria-invalid={Boolean(milestoneErrors?.title)}
                          />
                          {milestoneErrors?.title && (
                            <span className="field-error">{milestoneErrors.title}</span>
                          )}
                        </div>
                        <div className="form-field">
                          <label htmlFor={`${titleId}-milestone-${milestone.key}-amount`}>
                            Amount (XLM)
                          </label>
                          <input
                            id={`${titleId}-milestone-${milestone.key}-amount`}
                            value={milestone.amount}
                            onChange={(event) =>
                              updateMilestone(milestone.key, "amount", event.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0.0000000"
                            aria-invalid={Boolean(milestoneErrors?.amount)}
                          />
                          {milestoneErrors?.amount && (
                            <span className="field-error">{milestoneErrors.amount}</span>
                          )}
                        </div>
                        <div className="form-field">
                          <label htmlFor={`${titleId}-milestone-${milestone.key}-deadline`}>
                            Deadline
                          </label>
                          <input
                            id={`${titleId}-milestone-${milestone.key}-deadline`}
                            type="datetime-local"
                            value={milestone.deadline}
                            onChange={(event) =>
                              updateMilestone(
                                milestone.key,
                                "deadline",
                                event.target.value,
                              )
                            }
                            aria-invalid={Boolean(milestoneErrors?.deadline)}
                          />
                          {milestoneErrors?.deadline && (
                            <span className="field-error">
                              {milestoneErrors.deadline}
                            </span>
                          )}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="project-total">
                <span>Total project amount</span>
                <strong>{totalXlm} XLM</strong>
              </div>
            </fieldset>

            {status !== "idle" && (
              <div
                className={`transaction-status ${status}`}
                role={status === "failed" || status === "rejected" ? "alert" : "status"}
                aria-live="polite"
              >
                {isSubmitting && <span className="loading-spinner" aria-hidden="true" />}
                <div>
                  <strong>
                    {status === "waiting-for-signature"
                      ? "Waiting for wallet signature"
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                  </strong>
                  <p>{statusMessage}</p>
                  {receipt && (
                    <div className="transaction-receipt">
                      <span>Project ID: {receipt.projectId.toString()}</span>
                      <span>Transaction: {receipt.transactionHash}</span>
                      <a
                        href={`${explorerBaseUrl}/tx/${receipt.transactionHash}`}
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

            <div className="modal-actions">
              {status === "success" && (
                <button className="secondary-action" type="button" onClick={resetForm}>
                  Create another
                </button>
              )}
              <button
                className="secondary-action"
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {status === "success" ? "Close" : "Cancel"}
              </button>
              {status !== "success" && (
                <button
                  className="submit-project"
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? "Creating project…" : "Create project"}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
