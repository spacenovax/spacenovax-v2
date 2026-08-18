# NOVA Wallet Modular Architecture

Status: **application architecture and testnet preparation. It does not deploy or upgrade a mainnet contract.**

## Design goal

NOVA Wallet can add new product modules without replacing Captain ledgers, changing an already-approved vesting batch, or gaining access to a user's wallet key.

## Stable boundaries

| Boundary | Responsibility | Must not do |
| --- | --- | --- |
| Captain ledger | Settled SPNX Points, mining, mission, and game records | Treat browser counters as final balances |
| TON Connect adapter | Connect a compatible TON wallet and request a user signature | Receive or store seed phrases/private keys |
| Conversion & vesting contract | Hold approved SPNX allocation and release scheduled portions | Permit arbitrary operator withdrawals or schedule changes |
| Claim module | Show unlock status, fee preview, and signed claim status | Send a transaction without user confirmation |
| Staking contract | Hold voluntary claimed-SPNX positions and pay from the capped pool | Accept automatic vesting balances |
| Security module | PIN, device biometric verification, recovery process, audit events | Store raw biometric data |
| Treasury multisig | Fund public contracts under published rules | Process individual user claims directly |

## Versioning

- The Wallet application uses a module registry and feature flags.
- New capabilities use a new module or a separately versioned contract (for example, staking V2).
- Existing contract addresses remain visible with version, deployment date, source verification, and status.
- Existing Captain records retain their source batch ID, contract version, claim transaction hash, and immutable timestamp.
- A new version cannot overwrite a settled ledger entry, vesting release schedule, claim result, or staking term.

## Upgrade rules

1. Application UI and server APIs may evolve behind backward-compatible versioned endpoints.
2. A user-facing migration needs an explicit notice, transaction preview, and confirmation where a user signature is required.
3. Smart-contract upgrades must never silently alter user balance, vesting schedule, or lock term.
4. Any emergency pause is limited to preventing new actions after an exploit signal. It cannot transfer user principal, erase eligibility, or modify existing terms.
5. Emergency actions require the published multisig threshold, event logging, and a public status notice.
6. Contract addresses and source verification must be published before activation.

## Activation sequence

1. UI and module registry are visible, but actions remain disabled.
2. TON Connect and a valid manifest are integrated on testnet.
3. Claims, vesting calculations, fee previews, and staking paths are tested with duplicate/replay and insufficient-TON cases.
4. Contract source and deployment configuration are independently audited.
5. Mainnet modules activate one at a time by feature flag.
6. Monitor transaction failures, fee estimates, claim reconciliation, and contract balances before widening access.

## Current program terms

- Conversion vesting: 10% immediately at KYC-approved conversion; 10% every three months afterward; 10 slices total.
- Voluntary staking: FLEX 1% APR, NOVA 90 3% APR, NOVA 180 5% APR, NOVA 365 8% APR.
- Staking rewards are paid only from the capped, pre-allocated program pool.
- Users pay TON fees for claim, stake, reward claim, and unlock transactions.
