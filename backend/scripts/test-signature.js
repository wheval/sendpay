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
const { ec } = require('elliptic');
const { hash } = require('starknet');
const crypto = require('crypto');

function asHexFelt(value) {
  if (typeof value === 'number') return '0x' + value.toString(16);
  if (typeof value === 'bigint') return '0x' + value.toString(16);
  if (typeof value === 'string') {
    if (value.startsWith('0x')) return value;
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
  const priv = process.env.SENDPAY_BACKEND_PRIVATE_KEY;
  const pub = process.env.SENDPAY_BACKEND_PUBLIC_KEY;
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
  const tsF = asHexFelt(timestamp);

  const messageHash = hash.computePoseidonHashOnElements([
    userF,
    amountF,
    tokenF,
    txRefF,
    nonceF,
    tsF,
  ]);

  const e = new ec('secp256k1');
  const keyPair = e.keyFromPrivate(priv, 'hex');
  const sig = keyPair.sign(messageHash);

  const result = {
    envPublicKey: pub || null,
    request: { user, amount, token, tx_ref, nonce, timestamp },
    messageHash,
    signature: { r: sig.r.toString('hex'), s: sig.s.toString('hex') },
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


