# ZKdle phase-2 trusted setup transcript

Circuit: circuits/clue.circom (773 constraints, 11 public inputs).

Phase 1: PSE Perpetual Powers of Tau, 80 contributions, power 10 — `ppot_0080_10.ptau` from https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_10.ptau
blake2b-512: `a195cc44e8bc8ceb164fd35ebdac951e8ff1e9c643b0d705e3523bac523b9df897aa74aaea49b97feeccc65e67ec1ed07b1b18dc55d2a3d88eb925e31a40f555`

Beacon committed in advance (before any contribution, 2026-10-19T02:53:02Z): the blockhash of Solana mainnet-beta slot **458674048** (or the first produced slot after it), hashed 2^10 times by snarkjs.

## Contribution 1 — ZKdle team (512 bits fresh OS entropy, discarded)
```
[INFO]  snarkJS: Contribution Hash: 
		759ff819 493a57a3 5c2d5d70 d67bf3d9
		536294e4 4804bc03 f26a7e0b 9d692087
		16b36123 87f4b1ed 32d6dce0 00fc363a
		c0a6ecd4 d6ad685c 4ab8c7dc 91a5ed31
```
## Contribution 2 — ZKdle team (512 bits fresh OS entropy, discarded)
```
[INFO]  snarkJS: Contribution Hash: 
		8d9577eb 7ce67ff4 10de1c30 4e8d1b85
		6bf955e4 7b3a43d4 9027a9c3 6c974273
		20307025 2914c92a 270143ad 19cb7d1a
		a03c97ab c4e091ba 00173bf9 cd2f4a04
```
## Contribution 3 — ZKdle team (512 bits fresh OS entropy, discarded)
```
[INFO]  snarkJS: Contribution Hash: 
		54657e69 55ff392c d55fe630 2b7e53e0
		2d137443 d0295d18 c06abaae b6b87005
		5af7eea5 e1afc274 5952463f 011f0293
		5de3ebe9 00aaf9cd 74008c59 2f122b3a
```

## Final beacon
Solana mainnet-beta slot 458674048, blockhash `7qNv91MqWCLbfMHF9wdvyW6a5ipimeAHhhZB1ECMPrpY` (hex `658ac7f57d00aaf0df038587a3806c8730aee0176fab36bf8879210f0c8e1c79`), 2^10 iterations.
```
[INFO]  snarkJS: Contribution Hash: 
		05f0764f ae0e1e22 b987739b 376ed382
		7ec0a13e b2add186 02173303 de154b8e
		be26e974 062af49b 7ea6b2ee 97cfc5d5
		f1ee343c 18b6671f 01549a08 fe25cf33
```

## `snarkjs zkey verify clue.r1cs ppot_0080_10.ptau clue.zkey`
```
[INFO]  snarkJS: Reading r1cs
[INFO]  snarkJS: Reading tauG1
[INFO]  snarkJS: Reading tauG2
[INFO]  snarkJS: Reading alphatauG1
[INFO]  snarkJS: Reading betatauG1
[INFO]  snarkJS: Circuit hash: 
		0eb89a67 2971a27f aad7bf58 4adb823e
		dee2ee01 54f11660 dc8e0d6f 234de166
		efb565ff 27258d2c 35b87552 77a64629
		4fa7c23b b161c88b 3a29f9b3 a12550fd
[INFO]  snarkJS: Circuit Hash: 
		0eb89a67 2971a27f aad7bf58 4adb823e
		dee2ee01 54f11660 dc8e0d6f 234de166
		efb565ff 27258d2c 35b87552 77a64629
		4fa7c23b b161c88b 3a29f9b3 a12550fd
[INFO]  snarkJS: -------------------------
[INFO]  snarkJS: contribution #4 Final beacon: Solana slot 458674048 blockhash:
		05f0764f ae0e1e22 b987739b 376ed382
		7ec0a13e b2add186 02173303 de154b8e
		be26e974 062af49b 7ea6b2ee 97cfc5d5
		f1ee343c 18b6671f 01549a08 fe25cf33
[INFO]  snarkJS: Beacon generator: 658ac7f57d00aaf0df038587a3806c8730aee0176fab36bf8879210f0c8e1c79
[INFO]  snarkJS: Beacon iterations Exp: 10
[INFO]  snarkJS: -------------------------
[INFO]  snarkJS: contribution #3 ZKdle team contribution 3:
		54657e69 55ff392c d55fe630 2b7e53e0
		2d137443 d0295d18 c06abaae b6b87005
		5af7eea5 e1afc274 5952463f 011f0293
		5de3ebe9 00aaf9cd 74008c59 2f122b3a
[INFO]  snarkJS: -------------------------
[INFO]  snarkJS: contribution #2 ZKdle team contribution 2:
		8d9577eb 7ce67ff4 10de1c30 4e8d1b85
		6bf955e4 7b3a43d4 9027a9c3 6c974273
		20307025 2914c92a 270143ad 19cb7d1a
		a03c97ab c4e091ba 00173bf9 cd2f4a04
[INFO]  snarkJS: -------------------------
[INFO]  snarkJS: contribution #1 ZKdle team contribution 1:
		759ff819 493a57a3 5c2d5d70 d67bf3d9
		536294e4 4804bc03 f26a7e0b 9d692087
		16b36123 87f4b1ed 32d6dce0 00fc363a
		c0a6ecd4 d6ad685c 4ab8c7dc 91a5ed31
[INFO]  snarkJS: -------------------------
[INFO]  snarkJS: ZKey Ok!
```

## Honest note
All three phase-2 contributions were made by the ZKdle team. The setup is secure if at least one contributor destroyed their entropy, or if the beacon was unpredictable; since every contributor here is the team, treat the team as the trust anchor for phase 2 until public contributions are added. Public contributions are welcome — a new ceremony round will be opened before mainnet scale-up; anyone can re-run the verify command above against the published zkey.

zkey sha256: `f6ba1af9c5a7e61793e3c2dac9f63cc646d06fe5513b1f07a42954953d429831`
