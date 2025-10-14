/*
  Quick test for backend signing flow (no TypeScript required)
  Usage (from backend/):
    node scripts/test-signature.js \
      --user 0x0123... \
      --amount 100 \
      --token 0xUSDC... \
      --accountNumber 1234567890 \
      --bankCode 044 \
      --accountName "John Doe"
*/

require('dotenv').config();
const { ec, hash } = require('starknet');
const crypto = require('crypto');

function asHexFelt(value) {
  if (typeof value === 'number') return '0x' + value.toString(16);
  if (typeof value === 'bigint') return '0x' + value.toString(16);
  if (typeof value === 'string') {
    if (value.startsWith('0x')) return value;
    if (/^\d+$/.test(value)) return '0x' + BigInt(value).toString(16);
    return '0x' + Buffer.from(value).toString('hex');
  }
  throw new Error('Unsupported value type for felt conversion');
}

function genTxRef({ accountNumber, bankCode, accountName }) {
  const data = `${accountNumber}-${bankCode}-${accountName}`;
  const h = crypto.createHash('sha256').update(data).digest('hex');
  return '0x' + h;
}

function argvFlag(name, fallback) {
  const idx = process.argv.findIndex((v) => v === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

async function main() {
  const priv = (process.env.SENDPAY_BACKEND_PRIVATE_KEY || '').replace(/^0x/, '');
  if (!priv) {
    console.error('SENDPAY_BACKEND_PRIVATE_KEY not set');
    process.exit(1);
  }

  const user = argvFlag('user', '0x0123');
  const amount = argvFlag('amount', '100');
  const token = argvFlag('token', '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf56a5fc');
  const accountNumber = argvFlag('accountNumber', '1234567890');
  const bankCode = argvFlag('bankCode', '044');
  const accountName = argvFlag('accountName', 'John Doe');

  const tx_ref = genTxRef({ accountNumber, bankCode, accountName });
  const nonce = argvFlag('nonce', '0');
  const timestamp = Math.floor(Date.now() / 1000);

  const userF = asHexFelt(user);
  const amountF = asHexFelt(amount);
  const tokenF = asHexFelt(token);
  const txRefF = asHexFelt(tx_ref);
  const nonceF = asHexFelt(nonce);
  // Domain values (must match contract)
  const DOMAIN_VERSION = hash.getSelectorFromName('SENDPAY_V1');
  const DOMAIN_PURPOSE = hash.getSelectorFromName('WITHDRAWAL_REQUEST');
  const CONTRACT = asHexFelt(process.env.SENDPAY_CONTRACT_ADDRESS || '0x0');
  const CHAIN_ID = (process.env.STARKNET_CHAIN_ID || 'SN_SEPOLIA').toUpperCase().includes('MAIN')
    ? '0x534e5f4d41494e'
    : '0x534e5f5345504f4c4941';

  const messageHash = hash.computePoseidonHashOnElements([
    DOMAIN_VERSION,
    DOMAIN_PURPOSE,
    CONTRACT,
    CHAIN_ID,
    userF,
    amountF,
    tokenF,
    txRefF,
    nonceF,
  ]);

  const pubKey = '0x' + ec.starkCurve.getStarkKey(priv);
  const sig = ec.starkCurve.sign(messageHash, priv);

  const result = {
    derivedPublicKey: pubKey,
    request: { user, amount, token, tx_ref, nonce, timestamp },
    messageHash,
    signature: { r: '0x' + sig.r.toString(16), s: '0x' + sig.s.toString(16) },
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


