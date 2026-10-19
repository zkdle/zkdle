// Runtime configuration. Every value comes from the environment; nothing secret is ever sent to browsers.
const path = require('path');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default || require('bs58');

const env = process.env;
const cluster = ({ 'mainnet-beta': 'mainnet' })[env.ZK_CLUSTER] || env.ZK_CLUSTER || 'localnet';
const defaultRpc = { mainnet: 'https://api.mainnet-beta.solana.com', devnet: 'https://api.devnet.solana.com', localnet: 'http://127.0.0.1:8899' };

function hostKey() {
  const raw = (env.ZK_HOST_KEY || '').trim();
  if (!raw) return null;
  return Keypair.fromSecretKey(raw.startsWith('[') ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw));
}

module.exports = {
  cluster,
  network: env.ZK_NETWORK_LABEL || { mainnet: 'Mainnet', devnet: 'Devnet', localnet: 'Local test network' }[cluster] || cluster,
  rpc: env.ZK_RPC || defaultRpc[cluster] || defaultRpc.localnet,
  publicRpc: env.ZK_PUBLIC_RPC || '/api/rpc',
  port: Number(env.PORT || 5290),
  db: env.ZK_DB || path.join(__dirname, '..', 'data.json'),
  programId: env.ZK_PROGRAM_ID || null,
  host: hostKey(),
  treasury: env.ZK_TREASURY || null,
  feeBps: Number(env.ZK_FEE_BPS || 500),
  roundEntry: Math.round(Number(env.ZK_ROUND_ENTRY_SOL || 0.01) * 1e9), // SOL value of a bounty entry, paid in $PROOF
  roundEntryTokens: Number(env.ZK_ROUND_ENTRY_TOKENS || 1000),          // fallback when no price is available
  roundEntryMinTokens: Number(env.ZK_ROUND_ENTRY_MIN_TOKENS || 0),
  roundEntryMaxTokens: Number(env.ZK_ROUND_ENTRY_MAX_TOKENS || 0),
  roundBurnBps: Number(env.ZK_ROUND_BURN_BPS || 1000),
  joinCutoffSecs: Number(env.ZK_JOIN_CUTOFF_SECS || 120),
  price: {
    vaults: env.ZK_PRICE_POOL_VAULTS || null,
    sampleSecs: Number(env.ZK_PRICE_SAMPLE_SECS || 60),
    windowSecs: Number(env.ZK_PRICE_WINDOW_SECS || 300),
    minSamples: Number(env.ZK_PRICE_MIN_SAMPLES || 3),
  },
  roundSecs: Number(env.ZK_ROUND_SECS || 3600),
  roundCap: Math.min(12, Number(env.ZK_ROUND_CAP || 12)), // early access: the program allows at most 12 seats
  duelSecs: Number(env.ZK_DUEL_SECS || 86400),
  token: {
    mint: env.ZK_TOKEN_MINT || null,
    symbol: env.ZK_TOKEN_SYMBOL || 'PROOF',
    name: env.ZK_TOKEN_NAME || 'ZKdle Proof',
    decimals: Number(env.ZK_TOKEN_DECIMALS || 6),
    program: env.ZK_TOKEN_2022 === '1' ? 'token2022' : 'token',
    holderMin: Number(env.ZK_HOLDER_MIN || 100000), // holder badge + gold share-card frame
    mend: Number(env.ZK_MEND_TOKENS || 500),
  },
  base: (env.ZK_BASE_URL || '').replace(/\/$/, ''),
  links: { x: env.ZK_X_URL || 'https://x.com/zkdlefun', github: env.ZK_GITHUB_URL || 'https://github.com/zkdle/zkdle' },
  test: env.ZK_TEST === '1',
  secretKey: env.ZK_SECRET_KEY || null,                 // AES-256-GCM key for the state file; required outside tests
  maxPotSol: Number(env.ZK_MAX_POT_SOL_EQUIV || 5),     // refuse new seats once a round's escrow would pass this (SOL equivalent)
  walletPerMinute: Number(env.ZK_WALLET_PER_MIN || 20), // guesses/joins per wallet per minute
};
