import assert from 'node:assert/strict';
import test from 'node:test';

const environment = { ...process.env };
const { tonPayoutConfig, TON_CHAIN_ID } = await import('../lib/tonPayout.js');

test('TON payout is closed by default and reports the testnet boundary', () => {
  delete process.env.TON_PAYOUTS_ENABLED;
  delete process.env.TON_NETWORK;
  const config = tonPayoutConfig();
  assert.equal(config.selectedNetwork, 'ton');
  assert.equal(config.network, 'testnet');
  assert.equal(config.chainId, TON_CHAIN_ID.TESTNET);
  assert.equal(config.ready, false);
  assert.equal(config.transferAdapterReleased, false);
});

test('TON mainnet remains closed even with complete configuration', () => {
  Object.assign(process.env, {
    TON_PAYOUTS_ENABLED: 'true',
    TON_NETWORK: 'mainnet',
    TON_RPC_URL: 'https://example.invalid/rpc',
    SPNX_TON_JETTON_MASTER: 'EQExampleJettonMaster',
    TON_TREASURY_MULTISIG_ADDRESS: 'EQExampleTreasury',
    TON_TREASURY_SIGNER_MODE: 'multisig',
  });
  delete process.env.TON_MAINNET_PAYOUTS_ENABLED;
  const config = tonPayoutConfig();
  assert.equal(config.configurationComplete, true);
  assert.equal(config.ready, false);
  assert.match(config.error, /TON_MAINNET_PAYOUTS_ENABLED/);
});

test.after(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in environment)) delete process.env[key];
  }
  Object.assign(process.env, environment);
});
