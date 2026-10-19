pragma circom 2.1.6;
// Feedback circuit for a sealed five-letter word.
// Clue logic adapted from alxkzmn/zk-wordle (credit in README).
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

template Clue() {
  signal input word[5];     // private, letters 0..25
  signal input salt;        // private
  signal input guess[5];    // public
  signal input seal;        // public: Poseidon(packed word, salt)
  signal output clue[5];    // 0 gray, 1 green, 2 yellow

  component lt[5];
  for (var i = 0; i < 5; i++) { lt[i] = LessThan(5); lt[i].in[0] <== word[i]; lt[i].in[1] <== 26; lt[i].out === 1; }

  signal hit[5];
  component same[5];
  for (var i = 0; i < 5; i++) { same[i] = IsEqual(); same[i].in <== [guess[i], word[i]]; hit[i] <== same[i].out; }

  component m[5][5];
  signal away[5][5];
  signal free[5][5];     // vacant elsewhere-match
  signal first[5][5];    // first vacant match for guess i
  signal seen[5][5];     // any vacant match so far (row i)
  signal taken[5][5];    // solution slot j consumed after row i
  for (var i = 0; i < 5; i++) {
    for (var j = 0; j < 5; j++) {
      m[i][j] = IsEqual(); m[i][j].in <== [guess[i], word[j]];
      var prevTaken = (i == 0) ? hit[j] : taken[i-1][j];
      away[i][j] <== m[i][j].out * (1 - hit[i]);
      free[i][j] <== away[i][j] * (1 - prevTaken);
      var prevSeen = (j == 0) ? 0 : seen[i][j-1];
      first[i][j] <== free[i][j] * (1 - prevSeen);
      seen[i][j] <== prevSeen + first[i][j];
      taken[i][j] <== prevTaken + first[i][j] - prevTaken * first[i][j];
    }
    clue[i] <== hit[i] + 2 * seen[i][4];
  }

  var packed = 0; var base = 1;
  for (var i = 0; i < 5; i++) { packed += word[i] * base; base *= 32; }
  component h = Poseidon(2);
  h.inputs[0] <== packed; h.inputs[1] <== salt;
  seal === h.out;
}
component main { public [guess, seal] } = Clue();
