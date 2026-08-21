# SpaceNovaX Command Network

SpaceNovaX is a preview-stage product network for Captain identity, server-authoritative SPNX Points, NOVA AI, community, Orbit, game services, and a modular wallet foundation.

**Status:** `16.6.0-preview.13` — production asset transfers, token conversion, staking, payments, and marketplace settlement remain disabled until their separate release gates are complete.

## Repository layout

| Area | Purpose |
| --- | --- |
| `server.js` | Express API, Captain session, mining ledger, admin controls, fraud/risk controls, and feature gates |
| `src/` | React application, NOVA AI, wallet UI, Orbit and World Navigation Lite |
| `game/` | NOVA-X game workspace |
| `community-node/` | Read-only community-node client and Windows release workflow |
| `docs/` | Wallet, TON testnet, navigation, and release-gate documentation |
| `tests/` | Backend integrity, mining, referral, node, Orbit, and navigation tests |

## Local development

```bash
npm ci
npm run dev
```

Use `npm run build` for a production build and `npm test` for the configured integrity suite.

## Security and asset boundary

- Mining, missions, game rewards, and Captain balances are server-authoritative; browser counters are not settlement records.
- The app never asks for or stores a wallet seed phrase or private key.
- Testnet wallet connections are not production wallet verification and cannot unlock claims, conversion, staking, marketplace, or payment actions.
- Production asset operations remain feature-gated and require KYC/anti-fraud controls, verified wallet ownership, reviewed contracts, treasury controls, legal approval, and a controlled release.

## Network decision status

**TON is the selected SPNX settlement network.** The repository still contains a legacy Solana payout-readiness path that is not enabled and must not be used for new production work. TON remains testnet-only until the release gates in [Enterprise Readiness](docs/ENTERPRISE_READINESS.md) and [TON Automatic Payout Architecture](docs/TON_AUTOMATIC_PAYOUT_ARCHITECTURE.md) are complete.

## Operations

Run the service with:

```bash
npm start
```

Configure secrets only in the deployment provider's secret environment. Never commit database URLs, treasury keys, Telegram tokens, KYC webhook secrets, or admin credentials.

## Documentation

- [Enterprise readiness plan](docs/ENTERPRISE_READINESS.md)
- [NOVA Wallet modular architecture](docs/NOVA_WALLET_MODULAR_ARCHITECTURE.md)
- [TON testnet wallet foundation](docs/TON_TESTNET_WALLET_FOUNDATION.md)
- [TON testnet transfer release gates](docs/TON_TESTNET_TRANSFER_RELEASE.md)
- [TON automatic payout architecture](docs/TON_AUTOMATIC_PAYOUT_ARCHITECTURE.md)
- [Legacy Solana payout readiness](V16_5_PREVIEW_12_SOLANA_PAYOUT_READINESS_KR.md)
