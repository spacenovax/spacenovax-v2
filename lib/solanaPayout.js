import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import bs58 from 'bs58';

function readTreasuryKeypair() {
  const encoded = String(process.env.SOLANA_TREASURY_SECRET_KEY || '').trim();
  if (!encoded) throw new Error('SOLANA_TREASURY_SECRET_KEY is not configured.');
  let bytes;
  if (encoded.startsWith('[')) bytes = Uint8Array.from(JSON.parse(encoded));
  else bytes = bs58.decode(encoded);
  if (bytes.length !== 64) throw new Error('Solana treasury secret key must contain 64 bytes.');
  return Keypair.fromSecretKey(bytes);
}

function decimalToRaw(value, decimals) {
  const normalized = String(value ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error('SPNX token amount is invalid.');
  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error(`SPNX token amount supports at most ${decimals} decimal places.`);
  }
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction.slice(0, decimals) + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

export function solanaPayoutConfig() {
  const rpcUrl = String(process.env.SOLANA_RPC_URL || '').trim();
  const mintAddress = String(process.env.SPNX_TOKEN_MINT || '').trim();
  const decimals = Number(process.env.SPNX_TOKEN_DECIMALS ?? 9);
  const cluster = String(process.env.SOLANA_CLUSTER || 'mainnet-beta');
  const enabled = String(process.env.SOLANA_PAYOUTS_ENABLED || '').toLowerCase() === 'true';
  let treasuryAddress = '';
  let valid = false;
  let error = '';
  try {
    if (!rpcUrl) throw new Error('SOLANA_RPC_URL is missing.');
    if (!mintAddress) throw new Error('SPNX_TOKEN_MINT is missing.');
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) throw new Error('SPNX_TOKEN_DECIMALS must be between 0 and 9.');
    new PublicKey(mintAddress);
    treasuryAddress = readTreasuryKeypair().publicKey.toBase58();
    valid = true;
  } catch (caught) {
    error = caught.message;
  }
  return { enabled, valid, error, rpcUrlConfigured: Boolean(rpcUrl), mintAddress, decimals, cluster, treasuryAddress };
}

export function validateSolanaAddress(address) {
  try {
    const publicKey = new PublicKey(String(address || '').trim());
    return PublicKey.isOnCurve(publicKey.toBytes());
  } catch {
    return false;
  }
}

export async function inspectSignedPayout(payout) {
  const config = solanaPayoutConfig();
  if (!config.valid) throw new Error(config.error || 'Solana payout configuration is invalid.');
  const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
  const signature = String(payout?.txSignature || '');
  if (!signature) return { state: 'missing' };
  const [status] = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value;
  if (status?.err) return { state: 'failed', error: JSON.stringify(status.err), status };
  if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
    return { state: 'confirmed', status };
  }
  const currentBlockHeight = await connection.getBlockHeight('confirmed');
  if (Number(payout.lastValidBlockHeight || 0) > 0 && currentBlockHeight > Number(payout.lastValidBlockHeight)) {
    return { state: 'expired', currentBlockHeight };
  }
  return { state: status ? 'pending' : 'unknown', status, currentBlockHeight };
}

export async function prepareSignedPayout({ payoutId, recipientAddress, tokenAmount }) {
  const config = solanaPayoutConfig();
  if (!config.enabled) throw new Error('SOLANA_PAYOUTS_ENABLED is not true.');
  if (!config.valid) throw new Error(config.error || 'Solana payout configuration is invalid.');
  if (!validateSolanaAddress(recipientAddress)) throw new Error('Recipient Solana wallet is invalid.');

  const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
  const treasury = readTreasuryKeypair();
  const mint = new PublicKey(config.mintAddress);
  const recipient = new PublicKey(recipientAddress);
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury.publicKey, false, TOKEN_PROGRAM_ID);
  const recipientAta = getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_PROGRAM_ID);
  const rawAmount = decimalToRaw(tokenAmount, config.decimals);
  if (rawAmount <= 0n) throw new Error('SPNX token amount must be positive.');

  const treasuryBalance = await connection.getTokenAccountBalance(treasuryAta, 'confirmed');
  const available = BigInt(treasuryBalance.value.amount);
  if (available < rawAmount) throw new Error('Treasury SPNX balance is insufficient.');

  const latest = await connection.getLatestBlockhash('confirmed');
  const memo = new TransactionInstruction({
    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
    keys: [],
    data: Buffer.from(`SpaceNovaX:${payoutId}`, 'utf8'),
  });
  const transaction = new Transaction({
    feePayer: treasury.publicKey,
    recentBlockhash: latest.blockhash,
  }).add(
    createAssociatedTokenAccountIdempotentInstruction(
      treasury.publicKey,
      recipientAta,
      recipient,
      mint,
      TOKEN_PROGRAM_ID,
    ),
    createTransferCheckedInstruction(
      treasuryAta,
      mint,
      recipientAta,
      treasury.publicKey,
      rawAmount,
      config.decimals,
      [],
      TOKEN_PROGRAM_ID,
    ),
    memo,
  );
  transaction.sign(treasury);
  const serialized = transaction.serialize();
  const txSignature = bs58.encode(transaction.signature);
  return {
    txSignature,
    signedTransactionBase64: serialized.toString('base64'),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    treasuryAddress: treasury.publicKey.toBase58(),
    treasuryTokenAccount: treasuryAta.toBase58(),
    recipientTokenAccount: recipientAta.toBase58(),
    mintAddress: mint.toBase58(),
    tokenDecimals: config.decimals,
    rawAmount: rawAmount.toString(),
    preparedAt: Date.now(),
  };
}

export async function broadcastSignedPayout(payout) {
  const config = solanaPayoutConfig();
  if (!config.enabled || !config.valid) throw new Error(config.error || 'Solana payouts are not ready.');
  if (!payout?.signedTransactionBase64 || !payout?.txSignature) throw new Error('Signed payout transaction is missing.');
  const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
  const serialized = Buffer.from(payout.signedTransactionBase64, 'base64');
  const signature = await connection.sendRawTransaction(serialized, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 4,
  });
  if (signature !== payout.txSignature) throw new Error('Broadcast signature does not match the prepared payout signature.');
  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash: payout.blockhash,
    lastValidBlockHeight: payout.lastValidBlockHeight,
  }, 'confirmed');
  if (confirmation.value.err) throw new Error(`Solana transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  return { signature, confirmedAt: Date.now() };
}
