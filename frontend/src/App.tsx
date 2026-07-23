import { useEffect, useState } from "react";
import "./App.css";
import {
  connectWallet,
  restoreWallet,
  shortenAddress,
  type WalletSession,
} from "./lib/wallet";
import type { Project } from "milestone-escrow";
import { getUserProjects } from "./lib/escrow";
import { CreateProjectModal } from "./components/CreateProjectModal";


const stats = [
  { label: "Active projects" },
  { label: "Funds in escrow" },
  { label: "Released payments" },
];

function App() {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [projectsRefreshKey, setProjectsRefreshKey] = useState(0);
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [walletStatus, setWalletStatus] = useState<
    "restoring" | "idle" | "connecting"
  >("restoring");
  const [walletError, setWalletError] = useState<string | null>(null);
 const [userProjects, setUserProjects] = useState<Project[]>([]);
const [projectsStatus, setProjectsStatus] = useState<
  "idle" | "loading" | "success" | "error"
>("idle");
const [projectsError, setProjectsError] = useState<string | null>(null);
  const totalEscrowed = userProjects.reduce(
    (total, project) => total + project.escrowed_amount,
    0n,
  );

  const totalReleased = userProjects.reduce(
    (total, project) => total + project.released_amount,
    0n,
  );

  function getStatValue(label: string): string {
    if (!wallet) {
      return "—";
    }

    if (projectsStatus === "loading") {
      return "...";
    }

    if (projectsStatus === "error") {
      return "!";
    }

    if (label === "Active projects") {
      return userProjects.length.toString();
    }

    if (label === "Funds in escrow") {
      return totalEscrowed.toLocaleString();
    }

    return totalReleased.toLocaleString();
  }

  function getStatDetail(label: string): string {
    if (!wallet) {
      return "Connect your wallet to load on-chain data";
    }

    if (projectsStatus === "loading") {
      return "Loading from Stellar Testnet...";
    }

    if (projectsStatus === "error") {
      return projectsError ?? "Unable to load contract data";
    }

    if (label === "Active projects") {
      return `${userProjects.length} project${
        userProjects.length === 1 ? "" : "s"
      } found on-chain`;
    }

    if (label === "Funds in escrow") {
      return "Total token units currently locked";
    }

    return "Total token units released to freelancers";
  }

  useEffect(() => {
    let isActive = true;

    async function restorePreviousWallet() {
      try {
        const session = await restoreWallet();

        if (isActive && session) {
          setWallet(session);
        }
      } finally {
        if (isActive) {
          setWalletStatus("idle");
        }
      }
    }

    void restorePreviousWallet();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!wallet) {
      setUserProjects([]);
      setProjectsStatus("idle");
      setProjectsError(null);
      return;
    }

    let isActive = true;
    const walletAddress = wallet.address;

    setProjectsStatus("loading");
    setProjectsError(null);

    async function loadWalletProjects() {
      try {
        const projects = await getUserProjects(walletAddress);

        if (isActive) {
          setUserProjects(projects);
          setProjectsStatus("success");
        }
      } catch (error) {
        if (isActive) {
          setUserProjects([]);
          setProjectsStatus("error");
          setProjectsError(
            error instanceof Error
              ? error.message
              : "Unable to load projects from Stellar Testnet.",
          );
        }
      }
    }

    void loadWalletProjects();

    return () => {
      isActive = false;
    };
  }, [wallet, projectsRefreshKey]);

  async function handleWalletConnect() {
    setWalletStatus("connecting");
    setWalletError(null);

    try {
      const session = await connectWallet();
      setWallet(session);
    } catch (error) {
      setWalletError(
        error instanceof Error
          ? error.message
          : "Unable to connect the Freighter wallet.",
      );
    } finally {
      setWalletStatus("idle");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Stellar Milestone Escrow home">
          <span className="brand-mark">S</span>
          <span>
            Stellar <strong>Escrow</strong>
          </span>
        </a>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a className="active" href="#dashboard">
            Dashboard
          </a>
          <a href="#projects">Projects</a>
          <a href="#activity">Activity</a>
        </nav>

        <button
  className={`wallet-button ${wallet ? "connected" : ""}`}
  type="button"
  onClick={handleWalletConnect}
  disabled={walletStatus !== "idle" || Boolean(wallet)}
  aria-busy={walletStatus !== "idle"}
  title={wallet?.address}
>
  {wallet
    ? shortenAddress(wallet.address)
    : walletStatus === "restoring"
      ? "Checking wallet..."
      : walletStatus === "connecting"
        ? "Connecting..."
        : "Connect wallet"}
</button>
           </header>

      {walletError && (
        <div className="wallet-error" role="alert">
          <span>{walletError}</span>
          <button
            type="button"
            onClick={() => setWalletError(null)}
            aria-label="Dismiss wallet error"
          >
            ×
          </button>
        </div>
      )}

      <main>
        <section className="hero" id="dashboard">
          <div>
            <span className="network-badge">
              <span className="status-dot" />
              Stellar Testnet
            </span>
            <p className="eyebrow">Milestone-based payments</p>
            <h1>Build trust into every freelance payment.</h1>
            <p className="hero-copy">
              Lock project funds in escrow, approve completed milestones, and
              release payments securely through a Soroban smart contract.
            </p>

            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => setIsCreateProjectOpen(true)}
              >
                Create project
              </button>
              <a className="secondary-button" href="#projects">
                View projects
              </a>
            </div>
          </div>

          <aside className="escrow-card" aria-label="Escrow workflow">
            <p className="card-label">Secure workflow</p>
            <ol className="workflow-list">
              <li>
                <span>1</span>
                <div>
                  <strong>Create milestones</strong>
                  <p>Define deliverables, deadlines, and payment amounts.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Fund escrow</strong>
                  <p>Lock the agreed asset inside the Soroban contract.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Approve and release</strong>
                  <p>Pay the freelancer when milestone work is approved.</p>
                </div>
              </li>
            </ol>
          </aside>
        </section>

        <section className="stats-grid" aria-label="Dashboard summary">
          {stats.map((stat) => (
  <article className="stat-card" key={stat.label}>
    <p>{stat.label}</p>
    <strong>{getStatValue(stat.label)}</strong>
    <span>{getStatDetail(stat.label)}</span>
  </article>
))}
        </section>

        <section className="projects-section" id="projects">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your workspace</p>
              <h2>Recent projects</h2>
            </div>
            <button className="text-button" type="button">
              View all
            </button>
          </div>

          <div className="project-grid">
  {!wallet && (
    <div className="projects-empty">
      <strong>Connect your wallet</strong>
      <p>Your Stellar Testnet projects will appear here.</p>
    </div>
  )}

  {wallet && projectsStatus === "loading" && (
    <div className="projects-empty" role="status">
      <strong>Loading projects...</strong>
      <p>Reading your project records from Stellar Testnet.</p>
    </div>
  )}

  {wallet && projectsStatus === "error" && (
    <div className="projects-empty error" role="alert">
      <strong>Projects could not be loaded</strong>
      <p>{projectsError}</p>
    </div>
  )}

  {wallet &&
    projectsStatus === "success" &&
    userProjects.length === 0 && (
      <div className="projects-empty">
        <strong>No projects yet</strong>
        <p>Create your first milestone escrow project to get started.</p>
      </div>
    )}

  {wallet &&
    projectsStatus === "success" &&
    userProjects.map((project) => {
      const paidMilestones = project.milestones.filter(
        (milestone) => milestone.status.tag === "Paid",
      ).length;

      const progress =
        project.milestones.length === 0
          ? 0
          : Math.round(
              (paidMilestones / project.milestones.length) * 100,
            );

      const role =
        project.client === wallet.address ? "Client" : "Freelancer";

      return (
        <article className="project-card" key={project.id.toString()}>
          <div className="project-card-header">
            <span
              className={`project-status ${project.status.tag.toLowerCase()}`}
            >
              {project.status.tag}
            </span>
            <span className="project-role">{role}</span>
          </div>

          <h3>{project.title}</h3>
          <p className="wallet-reference">
            Freelancer: {shortenAddress(project.freelancer)}
          </p>

          <div className="progress-copy">
            <span>Paid milestone progress</span>
            <strong>{progress}%</strong>
          </div>

          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="project-footer">
            <div>
              <span>Total contract amount</span>
              <strong>
                {project.total_amount.toLocaleString()} token units
              </strong>
            </div>
            <button type="button">Open project</button>
          </div>
        </article>
      );
    })}
</div>
        </section>
      </main>

      <footer>
        <span>Stellar Milestone Escrow</span>
        <span>Built on Stellar · Testnet MVP</span>
      </footer>

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        walletAddress={wallet?.address ?? null}
        onClose={() => setIsCreateProjectOpen(false)}
        onConnectWallet={handleWalletConnect}
        onCreated={() => setProjectsRefreshKey((current) => current + 1)}
      />
    </div>
  );
}

export default App;
