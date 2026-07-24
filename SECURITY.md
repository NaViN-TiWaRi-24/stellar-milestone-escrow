# Security Review

## Scope and status

This document records an internal security review of the Stellar Milestone
Escrow Level 4 MVP contract, React/Vite frontend, wallet and transaction
helpers, telemetry, tests, dependencies, and CI configuration. It is not a
third-party professional audit and must not be represented as one.

No Critical or unmitigated High finding was identified. The previously reported
High storage-lifetime finding is mitigated by explicit TTL renewal. Three
Medium, seven Low, and two Informational findings remain.

## Security model and trusted roles

- The **client** creates a project, funds escrow, approves milestones, releases
  payments, cancels an unfunded project, and requests a refund.
- The **freelancer** accepts a project, submits milestone work, and approves a
  requested refund.
- Freighter provides user authorization; the application never requests a
  private key or seed phrase.
- The Stellar ledger and Soroban authorization/atomic transaction semantics are
  trusted. The configured token contract must be a genuine, correctly behaving
  asset contract.
- RPC responses and the frontend are not authorization boundaries. Contract
  `require_auth` and stored-role checks are the final enforcement layer.
- Project data, participant addresses, amounts, deadlines, and work references
  stored on a public blockchain are public.

## Security controls already implemented

- Every state-changing participant function calls `require_auth` and verifies
  the authenticated address against the stored client or freelancer.
- Project and milestone state checks prevent out-of-order acceptance, funding,
  submission, approval, payment, cancellation, and refund operations.
- Funding is limited to the `Accepted` state and rejects nonzero prior escrow.
- Payment requires an `Approved` milestone, rejects already-paid milestones,
  and checks cumulative releases against escrow.
- Refund approval requires the stored freelancer, the `RefundRequested` state,
  and a positive checked remaining balance.
- Token transfers use the project asset and contract address, and Soroban
  transaction atomicity rolls state changes back if a transfer fails.
- Positive amounts, future creation-time deadlines, distinct participants,
  nonempty milestone sets, exact milestone totals, and nonempty work references
  are enforced.
- Contract arithmetic uses checked operations for milestone totals, releases,
  and refunds. The frontend converts XLM with strings and `BigInt`, not
  floating-point arithmetic.
- React escapes displayed project data. Work references are rendered as text,
  and external transaction links use `target="_blank"` with `rel="noreferrer"`.
- Wallet connection verifies Stellar Testnet and transaction failures remain
  subject to contract authorization.
- Analytics accepts only fixed event names. Sentry handled-error reporting uses
  allow-listed tags and strips user, request, breadcrumb, context, route, extra,
  and raw exception-message data.
- Lockfiles, read-only GitHub Actions permissions, Rust/frontend tests, lint,
  formatting checks, and production builds are present in CI.

## Review checklist and findings

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| SEC-01 | **High — Mitigated** | Soroban storage lifetime | Creation and every successful project state change now renew the project, both participant indexes, contract instance, code, and instance-stored `NextProjectId` to approximately 180 days whenever fewer than 30 days remain. Focused tests cover creation and near-expiry funding renewal. Residual risk remains: persistent entries that receive no state-changing transaction for longer than their TTL can be archived and may require Stellar state restoration or a maintenance transaction before use. |
| SEC-02 | **Medium** | Fund recovery and disputes | A funded client can only request a refund, and the stored freelancer must approve it. There is no timeout, dispute resolver, abandonment path, or emergency recovery mechanism. An unavailable or hostile freelancer can leave funds locked indefinitely. |
| SEC-03 | **Medium** | Storage scalability | `UserProjects(Address)` is an unbounded vector rewritten on every creation, while milestone vectors and strings have no application-level limits. A high-volume address can eventually hit ledger/resource limits and lose the ability to create or enumerate projects. |
| SEC-04 | **Medium** | Asset trust | The contract accepts any Soroban `Address` as an asset and does not allow-list or verify a known SAC before project creation. The frontend fixes creation to Testnet XLM SAC, but direct callers can use a malicious or valueless token contract. Users must verify the asset before acceptance. |
| SEC-05 | **Low** | Deadline semantics | Deadlines must be future timestamps at creation, but submission, approval, and payment do not enforce them later. Deadlines are descriptive rather than an on-chain expiry rule. |
| SEC-06 | **Low** | Input bounds | Project and milestone titles may be empty, and titles, work references, milestone counts, and per-user project counts lack explicit size limits. Ledger limits mitigate unbounded execution but failures may be costly or confusing. |
| SEC-07 | **Low** | Refund accounting display | After refund, `escrowed_amount` and `released_amount` remain gross historical values. Status prevents reuse, but `escrowed_amount - released_amount` can appear as remaining escrow even though it was refunded. Consumers must treat `Refunded` as authoritative. |
| SEC-08 | **Low** | Frontend configuration | RPC URL, contract ID, XLM SAC ID, explorer URL, and network passphrase are checked mainly for presence, not strict format, HTTPS scheme, or expected Testnet identity. Deployment configuration is trusted and should be protected and reviewed. |
| SEC-09 | **Low** | Authorization tests | Contract tests use `mock_all_auths` and validate stored-role comparisons, but do not explicitly assert each function's `require_auth` invocation or missing-signature failure. Add authorization-tree and negative-auth tests. |
| SEC-10 | **Low** | Dependency and CI supply chain | npm/Cargo lockfiles provide reproducibility, but generated bindings use Stellar SDK 14 while the app uses SDK 16. GitHub Actions are pinned to version tags rather than immutable commit SHAs, and CI does not run dependency vulnerability auditing. |
| SEC-11 | **Low** | Browser hardening | No repository-level Content Security Policy or other deployment security headers are defined. Explorer links inherit a deployment-configured base URL; restrict it to the expected HTTPS Stellar Expert origin. |
| SEC-12 | **Informational** | Public access and privacy | `get_project` and `get_user_projects` are unauthenticated. This is consistent with public-ledger data, but titles and work references must never contain secrets or personal data. Raw operational errors are also logged to the local browser console, though telemetry sanitizes remote events. |
| SEC-13 | **Informational** | Extreme arithmetic limits | Checked `i128` accounting prevents amount overflow, but the next project ID and milestone ID increments are not explicitly checked. Exhausting `u64`/`u32` is not practical under current ledger limits, but explicit checks would make invariants complete. |

### Checklist conclusion

- **Authorization:** Covered for all writes by `require_auth` plus stored-role
  checks; read methods are intentionally public.
- **State transitions:** Ordered and protected; completed, cancelled, refunded,
  paid, and already-funded states cannot repeat their protected actions.
- **Transfers and accounting:** Positive, cumulative, checked, and atomic;
  residual risks are asset trust, refund presentation, and long-term liveness.
- **Input and address handling:** Stellar address decoding is delegated to SDK
  types; frontend G-address validation is present. Contract-level content and
  size validation remains limited.
- **Frontend safety:** No private-key handling or unsafe HTML rendering was
  found. Wallet rejection, RPC, simulation, and contract errors receive
  user-friendly handling.
- **Telemetry privacy:** Custom analytics and handled-error monitoring do not
  transmit project, wallet, transaction, form, or RPC payload data.
- **CI/dependencies:** Reproducible builds and tests are present; immutable
  action pinning and automated dependency auditing remain recommended.

## Known limitations and residual risks

This MVP has no contract upgrade, pause, administrator recovery, arbitration,
or timeout-based escape path. Contract data and submitted references are public.
TTL renewal occurs only on creation and successful state-changing project
operations; normal dashboard reads intentionally remain read-only. Long-inactive
persistent entries may therefore require Stellar state restoration or a
maintenance transaction. The contract has not been fuzzed, formally verified,
load-tested to ledger limits, or reviewed by an independent auditor. Testnet
validation does not establish safety for assets with real value.

Before production-value use, define an operational restoration/maintenance
process, define a dispute/liveness policy, constrain input and index growth,
restrict or clearly validate supported assets, add explicit authorization
tests, and obtain an independent professional audit.

## Responsible disclosure

Please report suspected vulnerabilities privately to the repository owner. Use
GitHub Private Vulnerability Reporting or a private security advisory when it
is enabled; otherwise use a private contact method listed on the repository
owner's GitHub profile. Include affected components, reproduction steps, impact,
and suggested mitigations. Do not include private keys, seed phrases, or other
users' data, and do not open a public issue until disclosure has been
coordinated.
