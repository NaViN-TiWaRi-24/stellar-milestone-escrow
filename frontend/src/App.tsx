import { useEffect, useState } from "react";
import "./App.css";
import {
  connectWallet,
  restoreWallet,
  shortenAddress,
  type WalletSession,
} from "./lib/wallet";

const projects = [
  {
    id: 1,
    title: "Landing Page Design",
    role: "Client",
    freelancer: "GCFX...8Q2P",
    progress: 65,
    amount: "1,000 USDC",
    status: "Active",
  },
  {
    id: 2,
    title: "Mobile App Development",
    role: "Freelancer",
    freelancer: "You",
    progress: 30,
    amount: "2,500 USDC",
    status: "Funded",
  },
];

const stats = [
  { label: "Active projects", value: "2", detail: "1 as client · 1 as freelancer" },
  { label: "Funds in escrow", value: "3,500", detail: "USDC on Stellar Testnet" },
  { label: "Released payments", value: "400", detail: "Across completed milestones" },
];

function App() {
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [walletStatus, setWalletStatus] = useState<
    "restoring" | "idle" | "connecting"
  >("restoring");
  const [walletError, setWalletError] = useState<string | null>(null);

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
              <button className="primary-button" type="button">
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
              <strong>{stat.value}</strong>
              <span>{stat.detail}</span>
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
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-card-header">
                  <span className={`project-status ${project.status.toLowerCase()}`}>
                    {project.status}
                  </span>
                  <span className="project-role">{project.role}</span>
                </div>

                <h3>{project.title}</h3>
                <p className="wallet-reference">
                  Freelancer: {project.freelancer}
                </p>

                <div className="progress-copy">
                  <span>Milestone progress</span>
                  <strong>{project.progress}%</strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuenow={project.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${project.progress}%` }} />
                </div>

                <div className="project-footer">
                  <div>
                    <span>Escrow value</span>
                    <strong>{project.amount}</strong>
                  </div>
                  <button type="button">Open project</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <span>Stellar Milestone Escrow</span>
        <span>Built on Stellar · Testnet MVP</span>
      </footer>
    </div>
  );
}

export default App;