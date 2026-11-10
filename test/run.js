// Rules and engine tests. Usage: node test/run.js
const DC = require('../src/engine.js');
const fixtures = require('./fixtures.json');
let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('FAIL: ' + msg); } }
const key = o => DC.idx(o.level, o.file, o.rank);
const T = l => DC.LETTERS.indexOf(l);
function st0(pieces, turn) { const s = DC.emptyState(); for (const [sq, p] of pieces) s.board[sq] = p; s.turn = turn || 1; return DC.refresh(s); }
const names = a => [...a].sort((x, y) => x - y).map(DC.sqName).join(',');
const sq = n => DC.idx(+n[0], 'abcdefghijkl'.indexOf(n[1]), +n[2] - 1);

// 1. Chess Variant Pages move diagrams (see RULES.md rulings 3 and 4 for the two overrides).
for (const sc of fixtures) {
  const from = key(sc.from), t = T(sc.letter), id = sc.piece + '/' + sc.group;
  let marks = sc.marks.map(m => ({ sq: key(m), mark: m.mark, level: m.level }));
  if (sc.piece === 'Elemental' && sc.from.level === 1) marks.forEach(m => { if (m.level === 2 && m.mark === 'x') m.mark = 'c'; });
  if (sc.piece === 'King' && sc.from.level === 1) marks = [{ sq: from + 96, mark: 'x', level: 2 }];
  const mv = new Set(marks.filter(m => m.mark === 'x' || m.mark === 'm').map(m => m.sq));
  const cp = new Set(marks.filter(m => m.mark === 'x' || m.mark === 'c').map(m => m.sq));
  const rm = new Set(marks.filter(m => m.mark === 'a').map(m => m.sq));
  const got = new Set(DC.pseudoMoves(st0([[from, t]])).map(m => m.to));
  ok(names(got) === names(mv), `${id} quiet moves: got ${names(got)} want ${names(mv)}`);
  const gc = new Set(), gr = new Set();
  for (let q = 0; q < 288; q++) {
    if (q === from) continue;
    for (const m of DC.pseudoMoves(st0([[from, t], [q, -DC.W]]))) if (m.to === q && m.capture) (m.remote ? gr : gc).add(q);
  }
  ok(names(gc) === names(cp), `${id} captures: got ${names(gc)} want ${names(cp)}`);
  ok(names(gr) === names(rm), `${id} remote: got ${names(gr)} want ${names(rm)}`);
}

// 2. Starting position.
const g = DC.newGame();
const want = { '3c1': 'G', '3k1': 'G', '3g1': 'R', '3a2': 'S', '3k2': 'S', '2a1': 'O', '2b1': 'U', '2c1': 'H', '2d1': 'T', '2e1': 'C', '2f1': 'M', '2g1': 'K', '2h1': 'P', '2i1': 'T', '2j1': 'H', '2k1': 'U', '2l1': 'O', '2e2': 'W', '1c1': 'B', '1k1': 'B', '1g1': 'E', '1b2': 'D', '1l2': 'D' };
for (const n in want) {
  ok(g.board[sq(n)] === T(want[n]), 'start gold ' + n);
  const mir = n[0] + n[1] + (9 - +n[2]);
  ok(g.board[sq(mir)] === -T(want[n]), 'start scarlet ' + mir);
}
let cg = 0, cs = 0; for (let i = 0; i < 288; i++) { if (g.board[i] > 0) cg++; if (g.board[i] < 0) cs++; }
ok(cg === 42 && cs === 42, '42 pieces per side');
ok(g.turn === 1, 'gold moves first');

// 3. Special rules.
const has = (s, a, b) => DC.pseudoMoves(s).some(m => m.from === sq(a) && m.to === sq(b));
ok(!has(st0([[sq('2e4'), DC.O], [sq('1e4'), -DC.B]]), '2e4', '2e5'), 'basilisk freezes piece above');
ok(has(st0([[sq('2e4'), DC.O], [sq('1e4'), DC.B]]), '2e4', '2e5'), 'own basilisk does not freeze');
ok(has(st0([[sq('2e4'), -DC.O], [sq('1e4'), DC.B]], -1), '2e4', '2e5') === false, 'scarlet piece frozen by gold basilisk');
let s = st0([[sq('2e7'), DC.W], [sq('2a1'), DC.K], [sq('2l8'), -DC.K]]);
let pm = DC.legalMoves(s).find(m => (m & 511) === sq('2e7')); DC.make(s, pm);
ok(s.board[sq('2e8')] === DC.H, 'warrior promotes to hero'); DC.unmake(s, pm);
ok(s.board[sq('2e7')] === DC.W && s.board[sq('2e8')] === 0, 'promotion undone');
ok(!has(st0([[sq('1c4'), DC.E], [sq('1c5'), DC.D]]), '1c4', '1c6'), 'elemental cannot leap');
ok(!has(st0([[sq('1c4'), DC.E], [sq('1c5'), DC.D], [sq('2c5'), -DC.W]]), '1c4', '2c5'), 'elemental rise blocked');
ok(!has(st0([[sq('2j4'), DC.E], [sq('1j4'), DC.D]]), '2j4', '1j5'), 'elemental descent blocked');
ok(!has(st0([[sq('3b7'), DC.M], [sq('2b7'), -DC.W]]), '3b7', '1b7'), 'mage cannot pass through occupied land square');
ok(has(st0([[sq('3b7'), DC.M], [sq('2b7'), -DC.W]]), '3b7', '2b7'), 'mage captures on land square below');
s = st0([[sq('3g5'), DC.R], [sq('2g6'), -DC.O], [sq('2a1'), DC.K], [sq('2l8'), -DC.K]]);
pm = DC.legalMoves(s).find(m => DC.toObj(m).remote); DC.make(s, pm);
ok(s.board[sq('3g5')] === DC.R && s.board[sq('2g6')] === 0, 'dragon remote capture leaves dragon in place');
s = st0([[sq('3g5'), DC.R], [sq('2g5'), -DC.K], [sq('2a1'), DC.K]], -1);
ok(DC.inCheck(s), 'dragon above gives check');
s = st0([[sq('2j4'), DC.S], [sq('3a2'), DC.W]]);
ok(!has(s, '2j4', '3a2') && has(s, '2j4', '3c2'), 'sylph returns only to empty home squares');
s = st0([[sq('2j5'), -DC.S]], -1);
ok(has(s, '2j5', '3a7') && !has(s, '2j5', '3a2'), 'scarlet sylph home squares are on rank 7');
// checkmate / stalemate
s = st0([[sq('2a1'), DC.K], [sq('2a3'), -DC.K], [sq('2l1'), -DC.O], [sq('1a2'), DC.D], [sq('3a1'), DC.S], [sq('1a1'), DC.D]], 1);
let r = DC.status(s); ok(r.over && r.result === 'checkmate' && r.winner === -1, 'checkmate detected: ' + JSON.stringify(r));
s = st0([[sq('2a1'), DC.K], [sq('2l8'), -DC.K]]); ok(DC.status(s).result === 'material', 'bare kings draw');

// 4. Random self-play: make/unmake and incremental hash/score stay consistent, games terminate legally.
let plies = 0, ends = {};
for (let game = 0; game < 150; game++) {
  const st = DC.newGame();
  for (let n = 0; n < 500; n++) {
    const legal = DC.legalMoves(st), res = DC.status(st, legal);
    if (res.over) { ends[res.result] = (ends[res.result] || 0) + 1; break; }
    const m = legal[(Math.random() * legal.length) | 0];
    const before = Array.from(st.board).join() + st.lo + ',' + st.hi + ',' + st.score + ',' + st.half;
    DC.make(st, m); DC.unmake(st, m);
    if (Array.from(st.board).join() + st.lo + ',' + st.hi + ',' + st.score + ',' + st.half !== before) { ok(false, 'make/unmake mismatch ' + DC.moveText(st, m)); break; }
    DC.make(st, m); plies++;
    const a = [st.lo, st.hi, st.score]; DC.refresh(st);
    if (a[0] !== st.lo || a[1] !== st.hi || a[2] !== st.score) { ok(false, 'incremental state drift'); break; }
    let k = 0; for (let i = 0; i < 288; i++) if (Math.abs(st.board[i]) === DC.K) k++;
    if (k !== 2) { ok(false, 'king count ' + k); break; }
  }
}
ok(true, 'self-play'); console.log('random self-play plies:', plies, 'endings:', JSON.stringify(ends));

// 5. AI sanity.
s = st0([[sq('2a1'), DC.K], [sq('2h8'), -DC.K], [sq('2a7'), DC.O], [sq('2b6'), DC.O], [sq('2l2'), -DC.W], [sq('3h8'), -DC.S], [sq('1h8'), -DC.D]]);
r = DC.think(s, { depth: 3 }); ok(r.score >= DC.MATE - 10 , 'AI finds mate in one, got ' + DC.moveText(s, r.move) + ' ' + r.score);
s = st0([[sq('2a1'), DC.K], [sq('2h8'), -DC.K], [sq('2d4'), DC.O], [sq('2d7'), -DC.M], [sq('2l2'), -DC.W]]);
r = DC.think(s, { depth: 2 }); ok(DC.moveText(s, r.move).indexOf('2d7') > 0, 'AI takes hanging mage, got ' + DC.moveText(s, r.move));

// 6. Wyvern Chess (9 files a to i, Sky and Land only).
DC.setVariant('wyvern');
const wsq = n => DC.idx(+n[0], 'abcdefghi'.indexOf(n[1]), +n[2] - 1);
const wg = DC.newGame();
let wGold = 0, wScar = 0, wBad = 0;
for (let i = 0; i < 288; i++) { const v = wg.board[i]; if (v > 0) wGold++; if (v < 0) wScar++; if (v && !DC.VALID[i]) wBad++; }
ok(wGold === 30 && wScar === 30, 'wyvern 30 pieces per side: ' + wGold + '/' + wScar);
ok(wBad === 0, 'wyvern no pieces on removed squares');
const wantW = { '3a1': 'G', '3i1': 'G', '3e1': 'R', '2a1': 'U', '2b1': 'H', '2c1': 'T', '2d1': 'C', '2e1': 'K', '2f1': 'O', '2g1': 'T', '2h1': 'H', '2i1': 'U', '2a2': 'W', '2i2': 'W', '3a2': 'Y', '3i2': 'Y' };
for (const n in wantW) ok(wg.board[wsq(n)] === DC.LETTERS.indexOf(wantW[n]), 'wyvern start ' + n + ' ' + wg.board[wsq(n)]);
ok(wg.board[wsq('3a8')] === -DC.G && wg.board[wsq('3i8')] === -DC.G, 'scarlet griffons on the ends of rank 8');
ok(wg.board[wsq('3a7')] === -DC.Y && wg.board[wsq('3i7')] === -DC.Y, 'scarlet wyverns on rank 7');
ok(DC.fileLetter(0) === 'a' && DC.fileList().length === 9, 'wyvern 9 files a to i');
ok(!DC.VALID[DC.idx(1, 2, 0)], 'wyvern underworld invalid');
const wy = (sqs) => { const s = DC.emptyState(); for (const [q, p] of sqs) s.board[q] = p; s.turn = 1; return DC.refresh(s); };
// Wyvern movement: one or two squares in 8 directions on Sky (jumps allowed); capture only directly below, from afar, no move.
let t1 = wy([[wsq('3e4'), DC.Y], [wsq('2a8'), -DC.K], [wsq('2a1'), DC.K]]);
const yt = DC.pseudoMoves(t1).filter(m => m.from === wsq('3e4')).map(m => DC.sqName(m.to) + (m.remote ? 'r' : ''));
const wantY = ['3d4','3f4','3e3','3e5','3d3','3f5','3d5','3f3','3c4','3g4','3e2','3e6','3c2','3g6','3c6','3g2'];
ok(wantY.every(q => yt.indexOf(q) >= 0) && yt.length === 16, 'wyvern sky moves 1 or 2 squares in 8 directions: ' + yt.join(' '));
ok(yt.every(q => q[0] === '3'), 'wyvern never steps to Land by move');
ok(yt.every(q => !q.endsWith('r')), 'no remote entries without an enemy below');
let t2 = wy([[wsq('3e4'), DC.Y], [wsq('2e4'), -DC.W], [wsq('2a1'), DC.K], [wsq('2a8'), -DC.K]]);
ok(DC.pseudoMoves(t2).some(m => m.from === wsq('3e4') && m.remote && m.to === wsq('2e4')), 'wyvern captures Land piece directly below from afar');
let t3 = wy([[wsq('3e4'), DC.Y], [wsq('2e6'), -DC.W], [wsq('2a1'), DC.K], [wsq('2a8'), -DC.K]]);
ok(!DC.pseudoMoves(t3).some(m => m.from === wsq('3e4') && m.to === wsq('2e6')), 'wyvern cannot capture two squares away on Land from afar');
let t4 = wy([[wsq('3e4'), DC.Y], [wsq('2e5'), -DC.W], [wsq('2a1'), DC.K], [wsq('2a8'), -DC.K]]);
ok(!DC.pseudoMoves(t4).some(m => m.from === wsq('3e4') && m.to === wsq('2e5') && m.remote), 'wyvern cannot capture adjacent Land piece from afar');
// Wyvern start: gold has legal moves, and random games stay on the board.
let wPlies = 0, wEnds = {}, wOff = 0;
for (let game = 0; game < 120; game++) {
  const st = DC.newGame();
  for (let n = 0; n < 400; n++) {
    const legal = DC.legalMoves(st), res = DC.status(st, legal);
    if (res.over) { wEnds[res.result] = (wEnds[res.result] || 0) + 1; break; }
    for (const m of legal) if (!DC.VALID[(m >> 9) & 511]) wOff++;
    DC.make(st, legal[(Math.random() * legal.length) | 0]); wPlies++;
    for (let i = 0; i < 288; i++) if (st.board[i] && !DC.VALID[i]) { wOff++; break; }
    if (st.board.some(v => { const a = Math.abs(v); return a === DC.S || a === DC.M || a === DC.B || a === DC.E || a === DC.D; })) { wOff++; break; }
  }
}
ok(wOff === 0, 'wyvern moves stay on board and removed pieces never appear: ' + wOff);
console.log('wyvern self-play plies:', wPlies, 'endings:', JSON.stringify(wEnds));
DC.setVariant('dragonchess');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
