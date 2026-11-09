/* Dragonchess rules engine and AI. See RULES.md. Runs in browser, Web Worker and Node. */
var DC = (function () {
  'use strict';
  var S = 1, G = 2, R = 3, W = 4, O = 5, U = 6, H = 7, T = 8, C = 9, M = 10, K = 11, P = 12, D = 13, B = 14, E = 15;
  var LETTERS = ' SGRWOUHTCMKPDBE';
  var NAMES = ['', 'Sylph', 'Griffon', 'Dragon', 'Warrior', 'Oliphant', 'Unicorn', 'Hero', 'Thief', 'Cleric', 'Mage', 'King', 'Paladin', 'Dwarf', 'Basilisk', 'Elemental'];
  // Gygax values x100 (King has no value).
  var VALUE = [0, 100, 500, 800, 100, 500, 250, 450, 400, 900, 1100, 0, 1000, 200, 300, 400];
  var F_REMOTE = 1 << 18, F_PROMO = 2 << 18, F_CAP = 4 << 18;
  var INF = 2000000, KC = 1000000, MATE = 30000;

  function idx(level, file, rank) { return (level - 1) * 96 + rank * 12 + file; }
  function sqLevel(i) { return ((i / 96) | 0) + 1; }
  function sqRank(i) { return ((i % 96) / 12) | 0; }
  function sqFile(i) { return i % 12; }
  function sqName(i) { return sqLevel(i) + 'abcdefghijkl'.charAt(sqFile(i)) + (sqRank(i) + 1); }

  /* ---------- Zobrist + piece-square tables ---------- */
  var ZL = new Int32Array(31 * 288), ZH = new Int32Array(31 * 288), PST = new Int16Array(31 * 288);
  var seed = 0x9E3779B9;
  function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
  var i0;
  for (i0 = 0; i0 < 31 * 288; i0++) { ZL[i0] = rnd(); ZH[i0] = rnd(); }
  var ZTL = rnd(), ZTH = rnd();

  function bonus(t, l, adv, f) {
    var cf = Math.round((5.5 - Math.abs(f - 5.5)) * 2);
    switch (t) {
      case W: return adv * 8 + (adv >= 5 ? 15 : 0);
      case S: return adv * 3 - (l === 1 ? 10 : 0);
      case D: return adv * 4;
      case U: case T: case C: return cf;
      case H: return cf + (l === 1 ? 20 : 0);
      case G: return cf + (l === 2 ? 15 : -5);
      case R: return cf * 2 + adv * 2;
      case M: return cf + (l === 1 ? 40 : 0);
      case P: return cf * 2 + (l === 1 ? 10 : 0);
      case K: return (l === 1 ? 0 : -60) - adv * 15;
      case B: return adv * 4;
      case E: return adv * 3 + cf;
    }
    return 0;
  }
  (function () {
    for (var t = 1; t <= 15; t++) for (var sq = 0; sq < 288; sq++) {
      var l = (sq / 96) | 0, r = ((sq % 96) / 12) | 0, f = sq % 12;
      PST[(t + 15) * 288 + sq] = VALUE[t] + bonus(t, l, r, f);
      PST[(-t + 15) * 288 + sq] = -(VALUE[t] + bonus(t, l, 7 - r, f));
    }
  })();

  /* ---------- State ---------- */
  function emptyState() {
    return { board: new Int8Array(288), turn: 1, half: 0, lo: 0, hi: 0, score: 0, hl: [], hh: [], ucap: [], uhalf: [], uscore: [] };
  }
  function refresh(st) {
    var lo = 0, hi = 0, sc = 0, b = st.board;
    for (var i = 0; i < 288; i++) if (b[i] !== 0) { var k = (b[i] + 15) * 288 + i; lo ^= ZL[k]; hi ^= ZH[k]; sc += PST[k]; }
    if (st.turn < 0) { lo ^= ZTL; hi ^= ZTH; }
    st.lo = lo; st.hi = hi; st.score = sc;
    return st;
  }
  function newGame() {
    var st = emptyState(), b = st.board, f;
    var back = [O, U, H, T, C, M, K, P, T, H, U, O];
    for (f = 0; f < 12; f++) {
      b[idx(2, f, 0)] = back[f]; b[idx(2, f, 7)] = -back[f];
      b[idx(2, f, 1)] = W; b[idx(2, f, 6)] = -W;
      if (f % 2 === 0) { b[idx(3, f, 1)] = S; b[idx(3, f, 6)] = -S; }
      else { b[idx(1, f, 1)] = D; b[idx(1, f, 6)] = -D; }
    }
    b[idx(3, 2, 0)] = G; b[idx(3, 10, 0)] = G; b[idx(3, 6, 0)] = R;
    b[idx(3, 2, 7)] = -G; b[idx(3, 10, 7)] = -G; b[idx(3, 6, 7)] = -R;
    b[idx(1, 2, 0)] = B; b[idx(1, 10, 0)] = B; b[idx(1, 6, 0)] = E;
    b[idx(1, 2, 7)] = -B; b[idx(1, 10, 7)] = -B; b[idx(1, 6, 7)] = -E;
    return refresh(st);
  }
  function save(st) {
    return { board: Array.prototype.slice.call(st.board), turn: st.turn, half: st.half, hl: st.hl.slice(), hh: st.hh.slice() };
  }
  function load(o) {
    var st = emptyState();
    st.board.set(o.board); st.turn = o.turn; st.half = o.half || 0;
    st.hl = (o.hl || []).slice(); st.hh = (o.hh || []).slice();
    return refresh(st);
  }

  /* ---------- Move generation (pseudo-legal) ---------- */
  var gb, gs, gout, gn, gking, gfrom, gflag;
  // mode 0: move or capture, 1: move only, 2: capture only.
  // returns 0 empty, 1 own piece, 2 enemy piece, 3 off board.
  function add(f, r, l, mode) {
    if (f < 0 || f > 11 || r < 0 || r > 7) return 3;
    var to = l * 96 + r * 12 + f, v = gb[to];
    if (v === 0) { if (mode !== 2) gout[gn++] = gfrom | (to << 9) | gflag; return 0; }
    if ((v > 0) === (gs > 0)) return 1;
    if (mode !== 1) { gout[gn++] = gfrom | (to << 9) | gflag | F_CAP; if (v === K || v === -K) gking = true; }
    return 2;
  }
  function slide(f, r, l, dx, dy) {
    f += dx; r += dy;
    while (add(f, r, l, 0) === 0) { f += dx; r += dy; }
  }
  function kingSteps(f, r, l) {
    add(f - 1, r - 1, l, 0); add(f, r - 1, l, 0); add(f + 1, r - 1, l, 0); add(f - 1, r, l, 0);
    add(f + 1, r, l, 0); add(f - 1, r + 1, l, 0); add(f, r + 1, l, 0); add(f + 1, r + 1, l, 0);
  }
  function leaps(f, r, l, a, c) {
    add(f + a, r + c, l, 0); add(f + a, r - c, l, 0); add(f - a, r + c, l, 0); add(f - a, r - c, l, 0);
    add(f + c, r + a, l, 0); add(f + c, r - a, l, 0); add(f - c, r + a, l, 0); add(f - c, r - a, l, 0);
  }
  function diag1(f, r, l) { add(f - 1, r - 1, l, 0); add(f + 1, r - 1, l, 0); add(f - 1, r + 1, l, 0); add(f + 1, r + 1, l, 0); }
  function orth(f, r, l, d, mode) { add(f - d, r, l, mode); add(f + d, r, l, mode); add(f, r - d, l, mode); add(f, r + d, l, mode); }
  function remote(f, r) {
    if (f < 0 || f > 11 || r < 0 || r > 7) return;
    var to = 96 + r * 12 + f, v = gb[to];
    if (v !== 0 && (v > 0) !== (gs > 0)) { gout[gn++] = gfrom | (to << 9) | F_REMOTE | F_CAP; if (v === K || v === -K) gking = true; }
  }
  var ODX = [1, -1, 0, 0], ODY = [0, 0, 1, -1];

  function gen(st, out) {
    var b = st.board, side = st.turn, fw = side, i, p, t, l, r, f, k, x, y, res, hr;
    gb = b; gs = side; gout = out; gn = 0; gking = false; gflag = 0;
    var enemyB = -side * B;
    for (i = 0; i < 288; i++) {
      p = b[i];
      if (p === 0 || (p > 0) !== (side > 0)) continue;
      l = (i / 96) | 0;
      if (l === 1 && b[i - 96] === enemyB) continue; // frozen by Basilisk
      t = p > 0 ? p : -p; r = ((i % 96) / 12) | 0; f = i % 12; gfrom = i;
      switch (t) {
        case S:
          if (l === 2) {
            add(f - 1, r + fw, 2, 1); add(f + 1, r + fw, 2, 1); add(f, r + fw, 2, 2); add(f, r, 1, 2);
          } else if (l === 1) {
            add(f, r, 2, 1);
            hr = side > 0 ? 1 : 6;
            for (k = 0; k < 12; k += 2) if (!(k === f && hr === r)) add(k, hr, 2, 1);
          }
          break;
        case G:
          if (l === 2) { leaps(f, r, 2, 2, 3); diag1(f, r, 1); }
          else if (l === 1) { diag1(f, r, 1); diag1(f, r, 2); }
          break;
        case R:
          slide(f, r, l, 1, 1); slide(f, r, l, 1, -1); slide(f, r, l, -1, 1); slide(f, r, l, -1, -1);
          orth(f, r, l, 1, 0);
          if (l === 2) { remote(f, r); remote(f - 1, r); remote(f + 1, r); remote(f, r - 1); remote(f, r + 1); }
          break;
        case W:
          if (r + fw === 7 || r + fw === 0) gflag = F_PROMO;
          add(f, r + fw, l, 1); add(f - 1, r + fw, l, 2); add(f + 1, r + fw, l, 2);
          gflag = 0;
          break;
        case O:
          slide(f, r, l, 1, 0); slide(f, r, l, -1, 0); slide(f, r, l, 0, 1); slide(f, r, l, 0, -1);
          break;
        case U: leaps(f, r, l, 1, 2); break;
        case H:
          if (l === 1) {
            diag1(f, r, 1);
            add(f - 2, r - 2, 1, 0); add(f + 2, r - 2, 1, 0); add(f - 2, r + 2, 1, 0); add(f + 2, r + 2, 1, 0);
            diag1(f, r, 0); diag1(f, r, 2);
          } else diag1(f, r, 1);
          break;
        case T:
          slide(f, r, l, 1, 1); slide(f, r, l, 1, -1); slide(f, r, l, -1, 1); slide(f, r, l, -1, -1);
          break;
        case C:
          kingSteps(f, r, l);
          if (l > 0) add(f, r, l - 1, 0);
          if (l < 2) add(f, r, l + 1, 0);
          break;
        case M:
          if (l === 1) {
            slide(f, r, 1, 1, 0); slide(f, r, 1, -1, 0); slide(f, r, 1, 0, 1); slide(f, r, 1, 0, -1);
            slide(f, r, 1, 1, 1); slide(f, r, 1, 1, -1); slide(f, r, 1, -1, 1); slide(f, r, 1, -1, -1);
            add(f, r, 0, 0); add(f, r, 2, 0);
          } else {
            orth(f, r, l, 1, 0);
            if (add(f, r, 1, 0) === 0) add(f, r, 2 - l, 0);
          }
          break;
        case K:
          if (l === 1) { kingSteps(f, r, 1); add(f, r, 0, 0); add(f, r, 2, 0); }
          else add(f, r, 1, 0);
          break;
        case P:
          kingSteps(f, r, l);
          if (l === 1) leaps(f, r, 1, 1, 2);
          for (k = 0; k < 3; k++) {
            if (k === l) continue;
            orth(f, r, k, (k - l === 1 || l - k === 1) ? 2 : 1, 0);
          }
          break;
        case D:
          add(f, r + fw, l, 1); add(f - 1, r, l, 1); add(f + 1, r, l, 1);
          add(f - 1, r + fw, l, 2); add(f + 1, r + fw, l, 2);
          if (l === 0) add(f, r, 1, 2);
          else if (l === 1) add(f, r, 0, 1);
          break;
        case B:
          add(f, r + fw, l, 0); add(f - 1, r + fw, l, 0); add(f + 1, r + fw, l, 0); add(f, r - fw, l, 1);
          break;
        case E:
          if (l === 0) {
            for (k = 0; k < 4; k++) {
              x = f + ODX[k]; y = r + ODY[k];
              res = add(x, y, 0, 0);
              if (res === 0) { add(x + ODX[k], y + ODY[k], 0, 0); add(x, y, 1, 2); }
            }
            add(f - 1, r - 1, 0, 1); add(f + 1, r - 1, 0, 1); add(f - 1, r + 1, 0, 1); add(f + 1, r + 1, 0, 1);
          } else if (l === 1 && b[i - 96] === 0) {
            orth(f, r, 0, 1, 0);
          }
          break;
      }
    }
    return gn;
  }

  /* ---------- Make / unmake ---------- */
  function make(st, m) {
    var b = st.board, from = m & 511, to = (m >> 9) & 511, cap = b[to];
    st.ucap.push(cap); st.uhalf.push(st.half); st.uscore.push(st.score); st.hl.push(st.lo); st.hh.push(st.hi);
    var lo = st.lo, hi = st.hi, sc = st.score, k;
    if (cap !== 0) { k = (cap + 15) * 288 + to; lo ^= ZL[k]; hi ^= ZH[k]; sc -= PST[k]; }
    if (m & F_REMOTE) { b[to] = 0; st.half = 0; }
    else {
      var p = b[from]; k = (p + 15) * 288 + from; lo ^= ZL[k]; hi ^= ZH[k]; sc -= PST[k]; b[from] = 0;
      var np = (m & F_PROMO) ? (p > 0 ? H : -H) : p;
      k = (np + 15) * 288 + to; lo ^= ZL[k]; hi ^= ZH[k]; sc += PST[k]; b[to] = np;
      st.half = (cap !== 0 || p === W || p === -W) ? 0 : st.half + 1;
    }
    st.lo = lo ^ ZTL; st.hi = hi ^ ZTH; st.score = sc; st.turn = -st.turn;
  }
  function unmake(st, m) {
    var b = st.board, from = m & 511, to = (m >> 9) & 511, cap = st.ucap.pop();
    st.turn = -st.turn;
    if (m & F_REMOTE) b[to] = cap;
    else { var p = b[to]; b[from] = (m & F_PROMO) ? (p > 0 ? W : -W) : p; b[to] = cap; }
    st.half = st.uhalf.pop(); st.score = st.uscore.pop(); st.lo = st.hl.pop(); st.hi = st.hh.pop();
  }

  /* ---------- Legality and status ---------- */
  var MAXPLY = 64, MV = [], MS = [];
  for (i0 = 0; i0 < MAXPLY + 4; i0++) { MV.push(new Int32Array(700)); MS.push(new Int32Array(700)); }

  function inCheck(st) {
    st.turn = -st.turn; gen(st, MV[MAXPLY + 3]); var c = gking; st.turn = -st.turn; return c;
  }
  function legalMoves(st) {
    var buf = MV[MAXPLY + 2], n = gen(st, buf), out = [], i;
    for (i = 0; i < n; i++) {
      make(st, buf[i]); gen(st, MV[MAXPLY + 3]); var bad = gking; unmake(st, buf[i]);
      if (!bad) out.push(buf[i]);
    }
    return out;
  }
  function toObj(m) {
    return { m: m, from: m & 511, to: (m >> 9) & 511, remote: !!(m & F_REMOTE), promo: !!(m & F_PROMO), capture: !!(m & F_CAP) };
  }
  function pseudoMoves(st) {
    var buf = MV[MAXPLY + 2], n = gen(st, buf), out = [];
    for (var i = 0; i < n; i++) out.push(toObj(buf[i]));
    return out;
  }
  function isFrozen(st, sq) {
    var p = st.board[sq];
    return p !== 0 && sq >= 96 && sq < 192 && st.board[sq - 96] === (p > 0 ? -B : B);
  }
  function repCount(st) {
    var c = 1, n = st.hl.length, lim = n - st.half;
    for (var i = n - 2; i >= lim && i >= 0; i -= 2) if (st.hl[i] === st.lo && st.hh[i] === st.hi) c++;
    return c;
  }
  function isRep(st) {
    var n = st.hl.length, lim = n - st.half, lo = st.lo, hi = st.hi, hl = st.hl;
    for (var i = n - 2; i >= lim && i >= 0; i -= 2) if (hl[i] === lo && st.hh[i] === hi) return true;
    return false;
  }
  function onlyKings(st) {
    for (var i = 0; i < 288; i++) { var p = st.board[i]; if (p !== 0 && p !== K && p !== -K) return false; }
    return true;
  }
  // result: null | 'checkmate' | 'stalemate' | 'repetition' | 'moves' | 'material'; winner: 1, -1 or 0.
  function status(st, legal) {
    legal = legal || legalMoves(st);
    var chk = inCheck(st);
    if (legal.length === 0) return { over: true, check: chk, result: chk ? 'checkmate' : 'stalemate', winner: chk ? -st.turn : 0 };
    if (onlyKings(st)) return { over: true, check: chk, result: 'material', winner: 0 };
    if (repCount(st) >= 3) return { over: true, check: chk, result: 'repetition', winner: 0 };
    if (st.half >= 200) return { over: true, check: chk, result: 'moves', winner: 0 };
    return { over: false, check: chk, result: null, winner: 0 };
  }
  function moveText(st, m) {
    var from = m & 511, to = (m >> 9) & 511, p = st.board[from], L = LETTERS.charAt(p > 0 ? p : -p);
    if (m & F_REMOTE) return L + sqName(from) + '×' + sqName(to) + '*';
    return L + sqName(from) + ((m & F_CAP) ? '×' : '-') + sqName(to) + ((m & F_PROMO) ? '=H' : '');
  }

  /* ---------- Search ---------- */
  var TTBITS = 18, TTSIZE = 1 << TTBITS, TTMASK = TTSIZE - 1;
  var ttLo = null, ttHi, ttMove, ttScore, ttDepth, ttFlag, hist, killers;
  var nodes = 0, deadline = 0, abort = false, QD = 6;

  function initTables() {
    if (ttLo) return;
    ttLo = new Int32Array(TTSIZE); ttHi = new Int32Array(TTSIZE); ttMove = new Int32Array(TTSIZE);
    ttScore = new Int16Array(TTSIZE); ttDepth = new Int8Array(TTSIZE); ttFlag = new Int8Array(TTSIZE);
    hist = new Int32Array(288 * 288); killers = new Int32Array(MAXPLY * 2);
  }
  function capScore(b, m) {
    var v = b[(m >> 9) & 511], a = b[m & 511];
    return 100000 + VALUE[v > 0 ? v : -v] * 16 - VALUE[a > 0 ? a : -a];
  }
  function qs(st, alpha, beta, ply, qd) {
    nodes++;
    var mv = MV[ply], n = gen(st, mv);
    if (gking) return KC;
    var best = st.score * st.turn;
    if (qd <= 0 || ply >= MAXPLY - 1) return best;
    if (best >= beta) return best;
    if (best > alpha) alpha = best;
    var ms = MS[ply], b = st.board, i, j, c = 0, m, s, bi, t;
    for (i = 0; i < n; i++) if (mv[i] & F_CAP) { mv[c] = mv[i]; ms[c] = capScore(b, mv[i]); c++; }
    for (i = 0; i < c; i++) {
      bi = i;
      for (j = i + 1; j < c; j++) if (ms[j] > ms[bi]) bi = j;
      if (bi !== i) { t = mv[i]; mv[i] = mv[bi]; mv[bi] = t; t = ms[i]; ms[i] = ms[bi]; ms[bi] = t; }
      m = mv[i];
      make(st, m); s = -qs(st, -beta, -alpha, ply + 1, qd - 1); unmake(st, m);
      if (s === -KC) continue;
      if (s > best) { best = s; if (s > alpha) { alpha = s; if (s >= beta) break; } }
    }
    return best;
  }
  function search(st, depth, alpha, beta, ply) {
    if (depth <= 0) return qs(st, alpha, beta, ply, QD);
    nodes++;
    if ((nodes & 2047) === 0 && Date.now() > deadline) abort = true;
    if (abort) return 0;
    var mv = MV[ply], n = gen(st, mv);
    if (gking) return KC;
    if (st.half >= 200 || isRep(st)) return 0;
    var ti = st.lo & TTMASK, ttm = 0, s;
    if (ttLo[ti] === st.lo && ttHi[ti] === st.hi) {
      ttm = ttMove[ti];
      if (ttDepth[ti] >= depth) {
        s = ttScore[ti]; var tf = ttFlag[ti];
        if (tf === 0 || (tf === 1 && s >= beta) || (tf === 2 && s <= alpha)) return s;
      }
    }
    var ms = MS[ply], b = st.board, i, j, m, bi, t, k1 = killers[ply * 2], k2 = killers[ply * 2 + 1];
    for (i = 0; i < n; i++) {
      m = mv[i];
      if (m === ttm) ms[i] = 10000000;
      else if (m & F_CAP) ms[i] = capScore(b, m);
      else if (m === k1) ms[i] = 90000;
      else if (m === k2) ms[i] = 80000;
      else { t = hist[(m & 511) * 288 + ((m >> 9) & 511)]; ms[i] = t > 70000 ? 70000 : t; }
    }
    var best = -INF, bestMove = 0, legal = 0, a0 = alpha;
    for (i = 0; i < n; i++) {
      bi = i;
      for (j = i + 1; j < n; j++) if (ms[j] > ms[bi]) bi = j;
      if (bi !== i) { t = mv[i]; mv[i] = mv[bi]; mv[bi] = t; t = ms[i]; ms[i] = ms[bi]; ms[bi] = t; }
      m = mv[i];
      make(st, m); s = -search(st, depth - 1, -beta, -alpha, ply + 1); unmake(st, m);
      if (abort) return 0;
      if (s === -KC) continue;
      legal++;
      if (s > best) {
        best = s; bestMove = m;
        if (s > alpha) {
          alpha = s;
          if (s >= beta) {
            if (!(m & F_CAP)) {
              if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
              hist[(m & 511) * 288 + ((m >> 9) & 511)] += depth * depth;
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return inCheck(st) ? -(MATE - ply) : 0;
    if (best > -29000 && best < 29000) {
      ttLo[ti] = st.lo; ttHi[ti] = st.hi; ttMove[ti] = bestMove; ttScore[ti] = best; ttDepth[ti] = depth;
      ttFlag[ti] = best >= beta ? 1 : (best <= a0 ? 2 : 0);
    }
    return best;
  }

  // opt: {depth, time (ms), noise (centipawns of random error)}
  function think(st, opt) {
    initTables();
    var legal = legalMoves(st), n = legal.length, i, j, t;
    if (n === 0) return null;
    for (i = n - 1; i > 0; i--) { j = (Math.random() * (i + 1)) | 0; t = legal[i]; legal[i] = legal[j]; legal[j] = t; }
    legal.sort(function (a, c) { return ((c & F_CAP) ? capScore(st.board, c) : 0) - ((a & F_CAP) ? capScore(st.board, a) : 0); });
    var noise = opt.noise || 0, maxDepth = opt.depth || 2;
    nodes = 0; abort = false; deadline = Date.now() + (opt.time || 600000);
    hist.fill(0); killers.fill(0);
    var bestMove = legal[0], bestScore = 0, doneDepth = 0, scores = [], d, s, m;
    for (d = 1; d <= maxDepth; d++) {
      var alpha = -INF, itBest = -INF, itMove = 0, cur = [];
      for (i = 0; i < n; i++) {
        m = legal[i];
        make(st, m);
        s = -search(st, d - 1, -INF, noise ? INF : -alpha, 1);
        unmake(st, m);
        if (abort) break;
        cur[i] = s;
        if (s > itBest) { itBest = s; itMove = m; }
        if (s > alpha) alpha = s;
      }
      if (itMove) { bestMove = itMove; bestScore = itBest; }
      if (abort) break;
      doneDepth = d; scores = cur;
      // reorder: best first, rest by score
      var order = legal.map(function (mm, k) { return { m: mm, s: cur[k] }; });
      order.sort(function (a, c) { return c.s - a.s; });
      for (i = 0; i < n; i++) { legal[i] = order[i].m; scores[i] = order[i].s; }
      if (itBest >= MATE - 100 || n === 1) break;
    }
    if (noise && scores.length === n && bestScore < MATE - 100) {
      var pick = -INF;
      for (i = 0; i < n; i++) {
        s = scores[i] <= -(MATE - 100) ? scores[i] : scores[i] + (Math.random() * 2 - 1) * noise;
        if (s > pick) { pick = s; bestMove = legal[i]; bestScore = scores[i]; }
      }
    }
    return { move: bestMove, score: bestScore, depth: doneDepth, nodes: nodes };
  }

  return {
    S: S, G: G, R: R, W: W, O: O, U: U, H: H, T: T, C: C, M: M, K: K, P: P, D: D, B: B, E: E,
    LETTERS: LETTERS, NAMES: NAMES, VALUE: VALUE, MATE: MATE,
    idx: idx, sqLevel: sqLevel, sqRank: sqRank, sqFile: sqFile, sqName: sqName,
    emptyState: emptyState, refresh: refresh, newGame: newGame, save: save, load: load,
    make: make, unmake: unmake, legalMoves: legalMoves, pseudoMoves: pseudoMoves, toObj: toObj,
    inCheck: inCheck, isFrozen: isFrozen, repCount: repCount, status: status, moveText: moveText, think: think
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DC;
