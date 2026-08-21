# tSPNX testnet transfer release gate

The Wallet may show a testnet dashboard before transfers are available. It must not invent a balance, recipient, transfer result, or transaction record.

User-to-user tSPNX transfers open only after all of the following are complete:

1. A reviewed tSPNX Jetton master and wallet contract are deployed to TON **testnet** and their addresses are recorded in the service configuration.
2. TON Connect accepts `CHAIN.TESTNET` only; mainnet connections remain rejected.
3. A server-side `ton_proof` challenge verifies wallet ownership with a single-use expiry, domain, timestamp, address/state-init, public key and signature checks.
4. The sender has enough test TON for the exact estimated transaction fee.
5. The transfer request uses the recipient testnet address, the configured Jetton master, an attached TON amount for the Jetton-wallet forwarding rules, and a unique query/idempotency value.
6. The app reads the resulting transaction from TON testnet before marking it completed. Failed/pending transactions must never alter an internal balance.

Test TON and tSPNX are valueless test assets. They do not convert to SPNX, TON, cash, rewards, KYC status, or mainnet balances.

No private key, seed phrase, or administrator secret is accepted by the app. The deployer wallet and any testnet faucet key stay outside the application server.

## Practice faucet

- Every Captain may request **10,000 Test Points** once every 24 hours.
- Test Points are a clearly labelled server-side practice ledger, not a TON Jetton, wallet balance, or claimable SPNX allocation.
- Native **Test TON** send and receive are signed directly in the user's testnet wallet through TON Connect.
- When a reviewed tSPNX Jetton is deployed, the same testnet screen will expose its on-chain balance and transfer flow; it must not relabel Test Points as tSPNX.
