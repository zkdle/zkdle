// All site copy in one place.
export const copy = {
  en: {
    'nav.how': 'How it works', 'nav.modes': 'Modes', 'nav.token': 'Token', 'nav.trust': 'Trust', 'nav.play': 'Play today',
    'hero.kicker': 'A five-letter word game · zero-knowledge clues · Solana',
    'hero.title': 'The word was sealed <em>before</em> you guessed.',
    'hero.lede': 'Every green, yellow and gray comes with a zero-knowledge proof that it was computed against a hash posted on-chain first. Nobody — not even us — can move the answer after the fact.',
    'hero.cta': 'Play today’s word', 'hero.cta2': 'See how the seal works',
    'hero.note': 'verify, don’t trust · free daily, no wallet needed',
    'scroll.hint': 'scroll — watch the letters',
    'flip.a': 'Most word games ask you to trust the house.', 'flip.b': 'Ours hands you a proof for every tile.',
    'how.title': 'Verify, don’t trust — in three moves',
    'how.1.t': 'Seal', 'how.1.b': 'Before anyone plays, the word and a random salt are hashed with Poseidon. Only the hash goes on-chain.',
    'how.2.t': 'Prove', 'how.2.b': 'Each guess gets its colours plus a Groth16 proof. The Solana program verifies the proof against the stored hash before it records the row.',
    'how.3.t': 'Reveal', 'how.3.b': 'When the day or round closes, the word and salt are published. Hash them yourself — the seal has to match.',
    'how.margin': 'a proof is ~256 bytes and checks in one transaction',
    'modes.title': 'Pick your table',
    'modes.daily.t': 'The Daily', 'modes.daily.b': 'One word for everyone, six tries, no money. Keep your streak in your own on-chain account — or just play in the browser.', 'modes.daily.tag': 'free',
    'modes.bounty.t': 'Bounty rounds', 'modes.bounty.b': 'Hourly rounds paid in $PROOF — 0.01 SOL worth per seat, up to 12 players during early access. Everyone gets their own word from a seed committed in advance, and your clock starts when you sit down, so there is nothing to copy and no head start. Fewest guesses, then shortest own time. The top 30% split the pot.', 'modes.bounty.tag': 'top 30% paid · $PROOF',
    'modes.duel.t': 'Duels', 'modes.duel.b': 'Two players, equal SOL stakes, a word each. Fewer guesses wins; a tie goes to the shorter own time. Post the link on X — it unfolds into a “take the duel” button.', 'modes.duel.tag': 'shareable link',
    'split.title': 'How a pot gets split',
    'split.body': 'Ten players take seats at 2,000 $PROOF each (≈ 0.01 SOL). On every entry 10% is burned and 5% goes to the treasury, so 17,000 $PROOF sits in the round’s escrow. Three places get paid on a 3 : 2 : 1 curve — 8,500 · 5,667 · 2,833. If nobody solves, every seat gets its 85% back. Settlement is one instruction anyone can call.',
    'token.title': 'The token', 'token.ca': 'Contract', 'token.soon': 'Not launched yet — the address appears here automatically once it’s live.',
    'token.treasury': 'Treasury', 'token.unset': 'set at launch',
    'token.u1': '<b>Bounty entries.</b> Every seat is paid in $PROOF; 10% of each entry is burned on the spot with a real SPL burn.',
    'token.u2': '<b>Streak repair.</b> Missed a day? Burn 500 $PROOF to bridge exactly one gap.',
    'token.u3': '<b>Holder frame.</b> Hold 100,000+ $PROOF and your share card gets the gold frame and a holder badge.',
    'token.u4': '<b>Treasury.</b> 5% of each entry goes to a public treasury account you can watch on Solscan.',
    'token.u5': '<b>A gold frame</b> on your share card.',
    'trust.title': 'What you trust, honestly',
    'trust.chain': 'Enforced by the program', 'trust.us': 'Still trusting us',
    'trust.c1': 'Clues match the sealed word (proof checked on-chain for every recorded guess).',
    'trust.c2': 'Bounty pots sit in a token account owned by the round’s program address, not our wallet. Burn, fee, payout order and the 30% cut are all computed on-chain.',
    'trust.c3': 'The fee is capped at 20% in code (set to 5%) and can only go to the public treasury; the burn is capped at 50% (set to 10%).',
    'trust.c4': 'Round seeds are committed before entry; the reveal must hash to the commitment.',
    'trust.u1': 'Our server knows the answers (it has to, to build proofs). A dishonest operator could leak them.',
    'trust.u2': 'We hand out the proofs, so we ration guesses (six per seat) and must co-sign seats.',
    'trust.u3': 'Daily word picks and seat seeds are random on our side; the commit stops us from changing them later, not from choosing them.',
    'trust.u4': 'The trusted setup for the circuit was a single-party ceremony. A multi-party ceremony is on the list.',
    'trust.u5': 'Free daily guesses are verified in your browser and on our server; only “seal my run” puts them on-chain.',
    'cta.title': 'Today’s answer is sealed. Don’t trust us — verify.', 'cta.btn': 'Break the seal',
    'tab.daily': 'Daily', 'tab.bounty': 'Bounty', 'tab.duel': 'Duel', 'wallet.connect': 'Connect',
    'g.day': 'Daily', 'g.sealed': 'Sealed', 'g.next': 'Next word in', 'g.trust': 'The answer’s hash was posted before the day opened. Every clue you get is proven against it.',
    'g.yesterday': 'Yesterday', 'g.check': 'Check the seal', 'g.short': 'Five letters, please', 'g.proving': 'Proving…', 'g.verified': 'ZK verified',
    'g.win': 'Solved — and every clue was proven.', 'g.lose': 'Out of rows. The word is revealed tomorrow.', 'g.notword': 'Please enter a real 5-letter word',
    'g.local': 'This browser', 'g.onchain': 'On-chain streak', 'g.streak': 'streak', 'g.best': 'best', 'g.solves': 'solves',
    'g.share': 'Share', 'g.sealrun': 'Seal my run on-chain', 'g.mend': 'Repair streak', 'g.copied': 'Copied',
    'b.title': 'Bounty round', 'b.entry': 'entry', 'b.players': 'players', 'b.pot': 'pot', 'b.ends': 'ends in',
    'b.rule': 'Everyone gets their own word. Your clock starts when you sit down. Fewest guesses, then shortest own time, wins. Top 30% split the pot.',
    'b.commit': 'Seed commitment', 'b.board': 'Standings', 'b.over': 'Round closed — settling.', 'b.full': 'Round full · next round opens in', 'b.left': 'seats left', 'b.left1': 'seat left', 'b.join': 'Take a seat', 'b.need': 'connect a wallet first',
    'b.none': 'No open round right now. A new one opens as soon as the last one closes.', 'b.seated': 'You’re in. Your word is sealed — go.',
    'd.title': 'Duel', 'd.rule': 'Two players, equal stakes, a word each. Fewer guesses wins; a tie goes to the clock.', 'd.stake': 'Stake (SOL)',
    'd.create': 'Open a duel', 'd.join': 'Take the duel', 'd.link': 'Post the link on X — it unfolds into a “take the duel” button.',
    's.title': 'Shared run', 's.verify': 'Verify every proof', 's.reveal': 'The word', 's.play': 'Play today’s word',
    's.ok': 'All proofs check out against seal', 's.bad': 'A proof failed to verify.', 's.match': 'matches the seal',
    'foot.made': 'Open source. MIT licensed.', 'foot.sound': 'sound',
  }
};

export function applyCopy(root = document) {
  root.querySelectorAll('[data-t]').forEach((el) => {
    const v = copy.en[el.dataset.t];
    if (v != null) el.innerHTML = v;
  });
}
export const t = (k) => copy.en[k] ?? k;
