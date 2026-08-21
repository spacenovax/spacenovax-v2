# SPNX TON Automatic Payout Architecture

Status: **design locked; testnet implementation only. Mainnet automatic payout is disabled.**

## Scope

SPNX Points are earned and reconciled in the server-authoritative off-chain ledger. A TON payout is created only after an eligible Captain submits a claim. The application is non-custodial for the user's wallet: it never receives a seed phrase or private key.

## Eligibility gates

A payout job can be queued only when all conditions are true:

1. The Captain is authenticated and passes applicable anti-fraud review.
2. KYC is approved where the published conversion terms require it.
3. The recipient TON wallet is verified using a single-use, time-limited `ton_proof` for the exact SpaceNovaX domain and network.
4. The conversion window is open and the requested balance is settled in the server ledger.
5. The requested amount is unlocked by the approved vesting schedule.
6. The configured TON Jetton master, treasury multisig, and network are approved for the active environment.
7. The user sees the amount, recipient address, network, estimated required TON, and a statement that the recipient pays the TON network fee before confirming the claim.

## Automatic payout flow

1. A Captain submits an explicit claim request.
2. The server creates an immutable conversion hold with an idempotency key.
3. The server creates one payout job in `queued` state; duplicate requests return the existing job.
4. A controlled worker requests a transfer proposal from the TON treasury multisig or HSM/KMS-backed signing service. It must not use a single application environment private key.
5. The job is signed, broadcast, and then confirmed from an independent TON RPC read.
6. Only after confirmation does the server mark the payout and claim complete and write immutable audit events.
7. A failed, expired, or ambiguous chain result moves to `needs_review`; it never silently retries with a newly signed transfer.

## Vesting and locking

- KYC-approved conversion: 10% is initially claimable.
- A further 10% becomes claimable every three months, for ten release slices in total.
- Locked allocations cannot be transferred, staked, spent, or used as marketplace payment.
- Staking accepts only already-claimed, unlocked SPNX; it never consumes a vesting balance.

## Payout states

`queued` → `proposal_created` → `awaiting_treasury_approval` → `broadcasting` → `confirmed`

Exceptional states: `needs_review`, `cancelled_before_signing`, `rejected`, `failed_before_broadcast`.

Every transition records a timestamp, actor/service identity, idempotency key, recipient address, Jetton amount, fee estimate, query ID, chain transaction reference where present, and a tamper-evident ledger reference.

## Treasury controls

- Production treasury: multisig or HSM/KMS-backed signer with separated operator and approver roles.
- The web app and Render service cannot hold an unrestricted production treasury private key.
- Daily, per-user, and per-batch limits are enforced before a proposal is created.
- Emergency pause prevents new claims only; it cannot move user assets or change an approved vesting schedule.

## Testnet-to-mainnet release gates

1. Verified TON `ton_proof` implementation with replay, expiry, wrong-domain, wrong-network, and duplicate-wallet tests.
2. Reviewed tSPNX Jetton contract and testnet transfer adapter.
3. Full reconciliation tests for broadcast success, timeout, duplicate request, insufficient recipient TON, and RPC disagreement.
4. PostgreSQL transaction ledger migration with backup and recovery rehearsal.
5. Treasury multisig/HSM integration, approval threshold, key rotation, and incident drill.
6. Independent contract/security review and legal/compliance approval.
7. Limited mainnet pilot under explicit operational approval.

## Prohibited shortcuts

- No automatic payout from a single Render environment private key.
- No payout based only on a connected wallet; `ton_proof` verification is required.
- No claim, stake, or transfer action before every relevant gate is complete.
- No silent retry that can create a second TON transfer.
