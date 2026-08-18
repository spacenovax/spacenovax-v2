# SPNX TON Vesting and Staking Policy

Status: **testnet specification — no mainnet contract is deployed by this document.**

## Wallet connection

- NOVA Wallet connects to an existing TON wallet only through TON Connect.
- SpaceNovaX must never request, import, store, or transmit a seed phrase or private key.
- Every claim, stake, reward claim, and unlock is signed by the user in the connected wallet.
- The user pays the TON network fee. Before a transaction, the application must display the estimated required TON, current TON balance, and any shortage.

## Conversion vesting

Each approved conversion batch is immutable and uses its own approval timestamp.

- 10% becomes claimable immediately on approval.
- A further 10% unlocks every three months.
- There are 10 release slices in total; the final slice unlocks 27 months after approval.
- Locked SPNX remains in the vesting contract. It cannot be transferred, traded, swapped, or staked.
- Server eligibility is based on settled, server-authoritative mining, mission, and game ledgers; not on a live browser counter.

Use integer atomic units only:

```
releasedSlices = min(10, 1 + floor(monthsSinceApproval / 3))
releasedAmount = floor(batchConvertedAmount * releasedSlices / 10)
claimableAmount = max(0, releasedAmount - batchClaimedAmount)
walletClaimable = sum(claimableAmount for every approved batch)
```

A claim must be idempotent and must reject a duplicate transaction, an incorrect wallet address, an expired authorization, or an amount above the unlocked balance.

## Optional SPNX staking

Only SPNX that was already claimed to the user's wallet can be staked. Automatic vesting allocations are excluded.

| Product | Lock term | Estimated annual reward rate (APR) |
| --- | ---: | ---: |
| FLEX | anytime unlock | 1% |
| NOVA 90 | 90 days | 3% |
| NOVA 180 | 180 days | 5% |
| NOVA 365 | 365 days | 8% |

The displayed rates are annualized APR, not guaranteed investment returns and not automatic compounding. For example, a 90-day 3% APR position earns about 0.75% for its completed term.

Rewards come only from a pre-allocated, capped SPNX reward pool. No reward may be created outside the fixed total supply. The final reward-pool allocation, claim cadence, early-unlock rule, and any future policy change must be disclosed before mainnet activation.

## Contract boundaries

1. Treasury multisig: reserve custody only; it does not execute individual user claims.
2. Vesting and distribution contract: holds conversion allocation and releases only unlocked claims.
3. Staking contract: holds voluntary staked SPNX and calculates rewards only under the public program rules.
4. Backend: validates Captain eligibility and produces short-lived, nonce-protected authorizations; it cannot move user wallet assets.
5. Frontend: displays balances and sends TON Connect requests; it cannot sign for users.

## Required release gates

Before mainnet:

1. Implement TON Connect and host a valid manifest.
2. Implement and test contracts on TON testnet.
3. Estimate each transaction fee using the actual message and show it to the user.
4. Independently audit contract source and deployment configuration.
5. Publish contract addresses, source verification, reward-pool size, and user terms.
6. Complete legal and compliance review for every launch jurisdiction.

Do not activate a claim, staking, transfer, swap, or token conversion button before all gates are complete.
