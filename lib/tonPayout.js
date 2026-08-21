const MAINNET = '-239';
const TESTNET = '-3';

function flag(name) {
  return String(process.env[name] || '').trim().toLowerCase() === 'true';
}

/**
 * Reports the safe TON payout configuration boundary.
 *
 * This module deliberately does not sign or broadcast a transfer. Production
 * signing must be delegated to a reviewed multisig or HSM-backed service; a
 * web/API process must never acquire an unrestricted treasury key.
 */
export function tonPayoutConfig() {
  const network = String(process.env.TON_NETWORK || 'testnet').trim().toLowerCase();
  const chainId = network === 'mainnet' ? MAINNET : TESTNET;
  const rpcUrl = String(process.env.TON_RPC_URL || '').trim();
  const jettonMaster = String(process.env.SPNX_TON_JETTON_MASTER || '').trim();
  const treasuryMultisig = String(process.env.TON_TREASURY_MULTISIG_ADDRESS || '').trim();
  const signerMode = String(process.env.TON_TREASURY_SIGNER_MODE || '').trim().toLowerCase();
  const requested = flag('TON_PAYOUTS_ENABLED');
  const mainnetExplicitlyApproved = flag('TON_MAINNET_PAYOUTS_ENABLED');
  const validNetwork = network === 'testnet' || network === 'mainnet';
  const multisigSignerConfigured = signerMode === 'multisig' || signerMode === 'hsm';
  const configurationComplete = Boolean(
    validNetwork && rpcUrl && jettonMaster && treasuryMultisig && multisigSignerConfigured,
  );

  const reasons = [];
  if (!requested) reasons.push('TON_PAYOUTS_ENABLED is not true.');
  if (!validNetwork) reasons.push('TON_NETWORK must be testnet or mainnet.');
  if (!rpcUrl) reasons.push('TON_RPC_URL is missing.');
  if (!jettonMaster) reasons.push('SPNX_TON_JETTON_MASTER is missing.');
  if (!treasuryMultisig) reasons.push('TON_TREASURY_MULTISIG_ADDRESS is missing.');
  if (!multisigSignerConfigured) reasons.push('TON_TREASURY_SIGNER_MODE must be multisig or hsm.');
  if (network === 'mainnet' && !mainnetExplicitlyApproved) {
    reasons.push('TON_MAINNET_PAYOUTS_ENABLED is not true.');
  }
  // The transfer adapter is intentionally withheld until the testnet Jetton,
  // ton_proof verification, reconciliation, and treasury controls are tested.
  reasons.push('TON transfer adapter is not released yet.');

  return {
    selectedNetwork: 'ton',
    network: validNetwork ? network : 'testnet',
    chainId,
    requested,
    configurationComplete,
    mainnetExplicitlyApproved,
    signingBoundary: multisigSignerConfigured ? signerMode : 'unconfigured',
    rpcUrlConfigured: Boolean(rpcUrl),
    jettonMasterConfigured: Boolean(jettonMaster),
    treasuryMultisigConfigured: Boolean(treasuryMultisig),
    transferAdapterReleased: false,
    ready: false,
    error: reasons.join(' '),
  };
}

export const TON_CHAIN_ID = { MAINNET, TESTNET };
