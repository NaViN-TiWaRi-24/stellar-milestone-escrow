# Stellar Milestone Escrow

A milestone-based freelance payment escrow application built on Stellar using Soroban smart contracts.

> **Current status:** Level 4 MVP development in progress. The contract currently runs locally and has not yet been deployed to Stellar Testnet.

## Project Overview

Stellar Milestone Escrow helps clients and freelancers manage project payments safely. A client creates a project, defines payment milestones, and locks funds in a Soroban smart contract. The contract releases each milestone payment after the required approval.

## Problem

Freelancers working across borders may complete work without receiving payment. Clients may also worry about paying before the agreed work is delivered. Traditional international payments can involve delays, high fees, and limited access.

## Solution

The application will provide:

- Wallet-based client and freelancer identities
- Projects containing multiple payment milestones
- Soroban-based token escrow
- Work-reference submission
- Milestone approval and payment release
- Cancellation and refund rules
- Contract events and transaction history
- Responsive client and freelancer dashboards

## Why Stellar?

Stellar provides fast settlement, low transaction costs, support for global digital assets, and Soroban smart contracts. These features make it suitable for milestone-based cross-border payments.

## Planned Architecture

```text
React + TypeScript Frontend
          |
     Freighter Wallet
          |
 Stellar SDK and RPC
          |
 Soroban Escrow Contract
          |
 Stellar Token Contract
```

## Repository Structure

```text
stellar-milestone-escrow/
├── contracts/
│   └── milestone_escrow/
│       ├── src/
│       │   ├── lib.rs
│       │   └── test.rs
│       └── Cargo.toml
├── Cargo.toml
├── Cargo.lock
└── README.md
```

The React frontend, continuous integration, analytics, monitoring, deployment evidence, and user-testing documents will be added during development.

## Current Development Setup

- Stellar CLI 27.0.0
- Rust and Cargo
- Soroban SDK 26.1.1
- Stellar Testnet planned for deployment

## Run Contract Tests

```bash
cargo test
```

Current scaffold verification:

```text
1 test passed
0 tests failed
```

## Level 4 Roadmap

- [x] Idea approved
- [x] Public repository created
- [x] Soroban workspace initialized
- [x] Initial contract test passed
- [ ] Escrow data model
- [ ] Contract authorization and state transitions
- [ ] Token funding and milestone payment
- [ ] Comprehensive contract tests
- [ ] React and TypeScript frontend
- [ ] Freighter wallet integration
- [ ] Testnet contract deployment
- [ ] Analytics and error monitoring
- [ ] Production frontend deployment
- [ ] Ten real-user wallet interactions
- [ ] User-feedback report
- [ ] Demo video

## Security Status

This project is under development and has not been audited. It currently uses local testing only and must not be used with real funds.

## Author

Developed for the Stellar Journey to Mastery Level 4 Green Belt challenge.
## Stellar Testnet Deployment

The Milestone Escrow Soroban contract is deployed on Stellar Testnet.

- **Contract ID:** `CAF4T5XILTB4FMCCCN63K5CVMMZEXIPR54GPFGVGOCFMXDHQW3QBHDRL`
- **Network:** Stellar Testnet
- **Optimized WASM size:** 15,503 bytes
- **Contract functions:** 11
- **WASM upload transaction:** [`000f05e8...690ac`](https://stellar.expert/explorer/testnet/tx/000f05e82d1ddfcf051027e0c89715a2b7eeac95278bfd351245fe87bff690ac)
- **Deployment transaction:** [`9a01d1a9...60826`](https://stellar.expert/explorer/testnet/tx/9a01d1a959067874b5e69382a243dd47ae8d4fbed9f293615f22080b75560826)
- **Contract explorer:** [Open in Stellar Lab](https://lab.stellar.org/r/testnet/contract/CAF4T5XILTB4FMCCCN63K5CVMMZEXIPR54GPFGVGOCFMXDHQW3QBHDRL)

The deployment is for testing only and does not use real funds.

## User Testing and Feedback

Three real testers participated: two freelancers and one general visitor. All
three tested the dashboard and project details, while two tested wallet
connection and the main escrow lifecycle actions.

- All testers rated ease of use 5/5.
- 100% said the escrow purpose and workflow were easy to understand.
- No tester reported an error or confusing behaviour.
- 100% said they would use or recommend the application.
- Positive feedback highlighted the understandable wallet and status
  information, milestones, payment amounts, buttons, full escrow workflow,
  simple dashboard, and mobile responsiveness.
- No critical improvement was requested.

### Improvements Made During MVP Testing

- Responsive desktop and mobile interface.
- Clear transaction and wallet states.
- Exact BigInt XLM/stroop conversion.
- Lazy-loaded generated Stellar bindings.
- Accessible modals and error boundary.
- Privacy-safe analytics and Sentry error monitoring.
- Automated frontend and contract tests with GitHub Actions CI.

## Privacy-safe analytics and monitoring

The frontend uses Vercel Web Analytics for aggregate product events and Sentry
for runtime and handled-operation monitoring. Analytics events contain only a
fixed event name—never wallet addresses, transaction hashes, project titles,
amounts, work references, errors, or form values. Sentry receives only a
generic message with the action, `network=testnet`, and a broad error category;
default personally identifiable information and request/user payloads are
disabled.

Set these frontend environment variables when monitoring is required:

```env
VITE_SENTRY_DSN=
VITE_SENTRY_ENABLE_DEV=false
```

`VITE_SENTRY_DSN` should be configured securely in the deployment environment,
not committed. Monitoring initializes in production when the DSN is present.
Set `VITE_SENTRY_ENABLE_DEV=true` only for deliberate development testing.
Without a DSN the application operates normally with monitoring disabled.

After deploying to Vercel, Web Analytics must also be enabled for the project in
the Vercel dashboard. Sentry requires a browser project and its DSN configured
in the deployment environment; review the Sentry project’s retention and access
settings before enabling it.
