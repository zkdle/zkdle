# Contributing

1. `npm install`, then `npm run build`.
2. `npm run e2e` boots a throwaway `solana-test-validator`, plays a daily, a bounty round and a duel with real proofs, and must stay green.
3. Circuit changes: `npm run build:circuit`, run a new phase-2 setup, then `npm run build:program` (the verifying key is compiled into the program).
4. Keep PRs small. No keys, RPC URLs or personal data in commits.
