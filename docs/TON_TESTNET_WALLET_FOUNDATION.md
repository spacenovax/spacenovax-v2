# TON Testnet Wallet Foundation

Status: **testnet-only connection foundation. No SPNX smart contract, live asset, claim, staking position, payment, or NFT is enabled.**

## Implemented in this release

- TON Connect provider and public manifest.
- Wallet screen action for connecting a testnet wallet session.
- Explicit rejection of a mainnet wallet in the testnet flow.
- Prepared server ledger collections:
  - `tonTestnetConnections`
  - `tonProofChallenges`
  - `conversionBatches`
  - `vestingClaims`
  - `stakingPositions`
- Default feature flags prevent proof verification, mainnet actions, claims, and staking from running.

## Security boundary

A visible testnet wallet session is **not** a verified wallet association and is not stored as a Captain's payout address. No connected address becomes eligible for conversion, claim, staking, payment, marketplace, or NFT actions.

The next release must implement TON `ton_proof` correctly:

1. Backend creates a random, single-use, short-lived payload.
2. Wallet signs the payload during TON Connect.
3. Backend verifies wallet address, state init/public key, expected domain, timestamp, network and signature.
4. Backend consumes the nonce atomically, then stores a verified testnet address and audit event.
5. Tests cover replay, expired payload, wrong domain, wrong network and malformed signature.

Do not use a testnet connection or testnet proof on mainnet. Mainnet activation requires a separate domain allowlist, contract addresses, security review, audited contract source, and explicit feature-flag release.
