# SpaceNovaX Enterprise Readiness

Status: **in progress — no production asset settlement is enabled.**

## Purpose

This document is the release boundary for production asset functions. It separates implemented preview features from operations that require reviewed infrastructure, legal approval, and controlled activation.

## Current baseline

- Captain identity, mining, mission, game, community, risk scoring, administrative controls, and server-authoritative ledgers are implemented as preview services.
- TON is the selected production settlement network. TON Connect is currently a **testnet connection foundation** and does not enable token claims, transfers, staking, marketplace payments, or NFT minting.
- A legacy Solana payout-readiness path remains in the repository for audit/reference only. It is not enabled and must not be extended for production payout.
- No browser or community node holds a treasury key, user seed phrase, private key, or direct ledger-write authority.

## Settlement decision

The selected SPNX settlement network is **TON**. All new settlement, claim, vesting, staking, marketplace-payment, and wallet-verification work uses TON and TON Connect.

Before any mainnet work:

1. Update the whitepaper, wallet architecture, API contracts, UI copy, and deployment configuration to TON.
2. Isolate the unused Solana implementation so it cannot be enabled through a production setting.
3. Publish the conversion, vesting, KYC, fees, treasury, incident-response, and user-support policies for TON.

## Release gates

| Gate | Required evidence | Status |
| --- | --- | --- |
| Reproducible build | Exact dependency versions, lockfile, clean build in CI | In progress |
| Data integrity | PostgreSQL transaction ledger, migration, backup/restore test, reconciliation | Not complete |
| Treasury custody | Multisig or HSM/KMS, separated roles, key rotation and recovery drill | Not complete |
| Wallet ownership | Single-use signature proof, replay protection, audit events | Testnet preparation only |
| Smart contracts | Published source, independent review, testnet load/replay/fee tests | Not complete |
| KYC and fraud | Contracted provider, signed webhook verification, review workflow | Integration preparation only |
| Legal and privacy | Terms, privacy, supported-country review, risk disclosures | Not complete |
| Controlled launch | Small cap, monitoring, incident playbook, reconciliation and rollback plan | Not complete |

## Activation rule

No production conversion, transfer, claim, stake, marketplace payment, NFT mint, or automatic distribution may be enabled until every relevant gate is marked complete with dated evidence and an accountable approver.

## Near-term order

1. Maintain current documentation and pin build dependencies.
2. Isolate legacy Solana payout code and implement TON testnet payout adapters.
3. Move the complete financial ledger and payout state to PostgreSQL transactions.
4. Replace any single treasury key with an appropriate multisig or HSM/KMS custody design.
5. Run testnet-only integration, security, reconciliation, and incident-response rehearsals.
