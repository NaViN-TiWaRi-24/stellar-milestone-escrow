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