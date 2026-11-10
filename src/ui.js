(function () {
  'use strict';
  var LEVELS = [
    { name: 'Novice', depth: 1, noise: 300, note: 'Looks one move ahead and blunders often. Good for learning the pieces.' },
    { name: 'Easy', depth: 2, noise: 140, note: 'Sees simple captures but makes frequent mistakes.' },
    { name: 'Medium', depth: 3, noise: 20, note: 'Plays solid short tactics. Rarely gives pieces away.' },
    { name: 'Hard', depth: 5, time: 3000, note: 'Searches several moves deep. Thinks for up to 3 seconds.' },
    { name: 'Expert', depth: 9, time: 8000, note: 'Deepest search. Thinks for up to 8 seconds per move.' }
  ];
  var REALM = ['', 'Underworld', 'Land', 'Sky'];
  var WY = typeof VARIANT_ID !== 'undefined' && VARIANT_ID === 'wyvern';
  var KEY = WY ? 'wyvern.v2' : 'dragonchess.v1'; // bump the version when the Wyvern layout changes, so old saves are ignored
  var $ = function (id) { return document.getElementById(id); };
  var cfg = { mode: 'ai', side: 1, level: 1, simG: 0, simS: 0, sound: true };
  var st, moves = [], texts = [], caps = [], legal = [], stat = null;
  var sel = -1, targets = {}, flipped = false, busy = false, worker = null, useWorker = true, reqId = 0, reqAt = 0;
  var cells = new Array(288), guideByLetter = {};
  GUIDE.forEach(function (g) { guideByLetter[g.letter] = g; });

  /* ---------- storage ---------- */
  function store() {
    try { localStorage.setItem(KEY, JSON.stringify({ cfg: cfg, moves: moves, flipped: flipped })); } catch (e) { }
  }
  function restore() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY));
      if (!o || !o.cfg) return null;
      if (o.cfg.mode === 'ai' || o.cfg.mode === '2p' || o.cfg.mode === 'sim') cfg.mode = o.cfg.mode;
      ['simG', 'simS'].forEach(function (k) { if (o.cfg[k] >= 0 && o.cfg[k] < LEVELS.length) cfg[k] = o.cfg[k] | 0; });
      if (o.cfg.side === 1 || o.cfg.side === -1) cfg.side = o.cfg.side;
      if (o.cfg.level >= 0 && o.cfg.level < LEVELS.length) cfg.level = o.cfg.level | 0;
      cfg.sound = o.cfg.sound !== false;
      flipped = !!o.flipped;
      return Array.isArray(o.moves) ? o.moves : null;
    } catch (e) { return null; }
  }

  /* ---------- game state ---------- */
  function push(m) {
    var t = DC.moveText(st, m), c = st.board[(m >> 9) & 511];
    DC.make(st, m);
    legal = DC.legalMoves(st); stat = DC.status(st, legal);
    t += stat.result === 'checkmate' ? '#' : (stat.check ? '+' : '');
    moves.push(m); texts.push(t); caps.push(c);
  }
  function replay(list) {
    st = DC.newGame(); moves = []; texts = []; caps = [];
    legal = DC.legalMoves(st); stat = DC.status(st, legal);
    for (var i = 0; i < list.length; i++) {
      if (stat.over || legal.indexOf(list[i]) < 0) break;
      push(list[i]);
    }
  }
  function humanTurn() { return cfg.mode === '2p' || (cfg.mode === 'ai' && st.turn === cfg.side); }
  // Level index of the bot playing the given colour, or -1 for a human.
  function botLevel(side) {
    if (cfg.mode === 'sim') return side > 0 ? cfg.simG : cfg.simS;
    return cfg.mode === 'ai' && side !== cfg.side ? cfg.level : -1;
  }
  function sideName(side, cap) {
    var l = botLevel(side), n;
    if (l >= 0) n = LEVELS[l].name + ' bot';
    else n = cfg.mode === '2p' ? (side > 0 ? 'Gold player' : 'Scarlet player') : 'Player';
    return cap ? n : n.charAt(0).toLowerCase() + n.slice(1);
  }

  /* ---------- DOM ---------- */
  function pieceEl(p) {
    var d = document.createElement('div');
    d.className = 'piece ' + (p > 0 ? 'gold' : 'scarlet');
    d.innerHTML = '<svg viewBox="0 0 512 512"><use href="#pc-' + DC.LETTERS.charAt(p > 0 ? p : -p) + '"/></svg>';
    return d;
  }
  function buildBoards() {
    var root = $('boards'); root.innerHTML = '';
    var files = DC.fileList(), nf = files.length, base = files[0];
    var levels = DC.levelNums();
    for (var li = 0; li < levels.length; li++) {
      var L = levels[li];
      var wrap = document.createElement('div'); wrap.className = 'bwrap b' + L;
      var lab = document.createElement('div'); lab.className = 'blabel'; lab.textContent = REALM[L];
      var bd = document.createElement('div'); bd.className = 'board';
      for (var row = 0; row < 8; row++) for (var col = 0; col < nf; col++) {
        var r = flipped ? row : 7 - row, f = flipped ? files[nf - 1 - col] : files[col], sq = DC.idx(L, f, r);
        var c = document.createElement('div');
        c.className = 'cell ' + ((nf - 1 - (f - base) + r) % 2 === 0 ? 'l' : 'd');
        c.setAttribute('data-sq', sq);
        if (col === 0) c.innerHTML += '<span class="coord r">' + (r + 1) + '</span>';
        if (row === 7) c.innerHTML += '<span class="coord f">' + DC.fileLetter(f) + '</span>';
        cells[sq] = c; bd.appendChild(c);
      }
      bd.style.setProperty('--cols', nf);
      wrap.appendChild(bd); wrap.appendChild(lab); root.appendChild(wrap);
    }
    for (var i = 0; i < 288; i++) if (st.board[i] !== 0) cells[i].appendChild(pieceEl(st.board[i]));
  }
  function pieceIn(sq) { return cells[sq].querySelector('.piece:not(.dying):not(.burn)'); }

  function refreshMarks() {
    var i, k;
    for (i = 0; i < 288; i++) if (cells[i]) cells[i].classList.remove('sel', 'tgt', 'cap', 'rem', 'last', 'check', 'col', 'frozen');
    if (moves.length) {
      var lm = moves[moves.length - 1];
      cells[lm & 511].classList.add('last'); cells[(lm >> 9) & 511].classList.add('last');
    }
    for (i = 96; i < 192; i++) if (cells[i] && DC.isFrozen(st, i)) cells[i].classList.add('frozen');
    if (stat && stat.check) for (i = 0; i < 288; i++) if (st.board[i] === st.turn * DC.K) cells[i].classList.add('check');
    if (sel >= 0) {
      cells[sel].classList.add('sel');
      for (k = sel % 96; k < 288; k += 96) if (k !== sel && cells[k]) cells[k].classList.add('col');
      for (k in targets) {
        var o = DC.toObj(targets[k]);
        cells[k].classList.add(o.remote ? 'rem' : (o.capture ? 'cap' : 'tgt'));
      }
    }
  }
  function mini(p) {
    var w = document.createElement('span'); w.className = 'mini'; w.appendChild(pieceEl(p));
    w.title = DC.NAMES[p > 0 ? p : -p]; return w;
  }
  function refreshPanel() {
    var tok = $('turnTok'), txt;
    tok.className = st.turn > 0 ? 'gold' : 'scarlet';
    var who = st.turn > 0 ? 'Gold' : 'Scarlet';
    if (stat.over) txt = overTitle();
    else if (cfg.mode === 'sim') txt = sideName(st.turn, true) + ' (' + who + ') is thinking';
    else if (cfg.mode === 'ai') txt = humanTurn() ? 'Your move (' + who + ')' : 'Computer is thinking';
    else txt = who + ' to move';
    if (!stat.over && stat.check) txt += '. Check!';
    $('statusText').textContent = txt;
    $('spin').hidden = !busy;
    $('matchup').innerHTML = cfg.mode === 'sim'
      ? 'Simulation<small>Gold: ' + sideName(1, true) + '</small><small>Scarlet: ' + sideName(-1, true) + '</small>'
      : cfg.mode === 'ai'
        ? 'You: ' + (cfg.side > 0 ? 'Gold' : 'Scarlet') + '<small>Computer: ' + LEVELS[cfg.level].name + '</small>'
        : 'Two players<small>Gold moves first</small>';
    var cg = $('capG'), cs = $('capS'), i, list = caps.filter(function (c) { return c !== 0; });
    list.sort(function (a, b) { return DC.VALUE[Math.abs(b)] - DC.VALUE[Math.abs(a)]; });
    cg.innerHTML = ''; cs.innerHTML = '';
    for (i = 0; i < list.length; i++) (list[i] > 0 ? cg : cs).appendChild(mini(list[i]));
    var ml = $('movelist'), h = '';
    for (i = 0; i < texts.length; i += 2) {
      h += '<li class="n">' + (i / 2 + 1) + '.</li><li class="mv' + (i === texts.length - 1 ? ' cur' : '') + '">' + texts[i] + '</li>' +
        '<li class="mv' + (i + 1 === texts.length - 1 ? ' cur' : '') + '">' + (texts[i + 1] || '') + '</li>';
    }
    ml.innerHTML = h; ml.scrollTop = ml.scrollHeight;
    $('bUndo').disabled = moves.length === 0 || cfg.mode === 'sim';
    $('bSound').className = cfg.sound ? '' : 'off';
  }
  function showInfo(p, sq) {
    var t = p > 0 ? p : -p, g = guideByLetter[DC.LETTERS.charAt(t)];
    var s = '<b>' + (p > 0 ? 'Gold ' : 'Scarlet ') + DC.NAMES[t] + '</b> ' + DC.sqName(sq);
    if (DC.isFrozen(st, sq)) s += ' (frozen by Basilisk)';
    else if (g) s += ': ' + g.lines.join(' ');
    $('info').innerHTML = s; $('info').title = g ? g.lines.join(' ') : '';
  }
  function layout() {
    var W = window.innerWidth, H = window.innerHeight;
    var wide = W >= 880 && W > H;
    document.body.classList.toggle('wide', wide);
    var top = $('top').offsetHeight + 6 + 30 + 24;
    var nf = DC.fileList().length, nl = DC.levelNums().length;
    document.documentElement.style.setProperty('--cols', nf);
    var cw = ((wide ? W - 340 : W) - 16 - 18 - 6) / nf;
    var ch = (H - top - (nl - 1) * 6 - (nl - 1) * 8 - 8) / (nl * 8);
    var c = Math.floor(Math.min(cw, ch));
    if (c < 26) c = Math.max(18, Math.floor(Math.min(cw, 32))); // small screens: larger cells, page scrolls
    if (c > 64) c = 64;
    document.documentElement.style.setProperty('--cell', c + 'px');
  }

  /* ---------- interaction ---------- */
  function deselect() { sel = -1; targets = {}; }
  function onCell(sq) {
    if (sel >= 0 && targets[sq] !== undefined && !busy) { var m = targets[sq]; deselect(); doMove(m); return; }
    var p = st.board[sq];
    deselect();
    if (p !== 0) {
      showInfo(p, sq);
      if (!busy && !stat.over && humanTurn() && (p > 0) === (st.turn > 0)) {
        sel = sq;
        for (var i = 0; i < legal.length; i++) if ((legal[i] & 511) === sq) targets[(legal[i] >> 9) & 511] = legal[i];
        SFX.play('select');
      }
    }
    refreshMarks();
  }
  function animate(m, moverBefore) {
    var from = m & 511, to = (m >> 9) & 511, o = DC.toObj(m), victim = pieceIn(to);
    if (o.remote) {
      if (victim) { victim.classList.add('burn'); setTimeout(function () { victim.remove(); }, 460); }
      return;
    }
    var el = pieceIn(from);
    if (!el) { buildBoards(); return; }
    if (victim) { victim.classList.add('dying'); setTimeout(function () { victim.remove(); }, 300); }
    var a = el.getBoundingClientRect();
    cells[to].appendChild(el);
    var b = el.getBoundingClientRect();
    el.style.transition = 'none';
    el.style.transform = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px)';
    el.classList.add('moving');
    void el.offsetWidth;
    el.style.transition = '';
    el.style.transform = '';
    setTimeout(function () {
      el.classList.remove('moving');
      if (o.promo) el.querySelector('use').setAttribute('href', WY ? '#pc-P' : '#pc-H');
    }, 320);
  }
  function doMove(m) {
    var o = DC.toObj(m), wasFrozen = frozenCount();
    push(m);
    animate(m);
    if (cfg.sound) {
      if (stat.over) SFX.play(stat.winner === 0 ? 'draw' : (cfg.mode !== 'ai' || stat.winner === cfg.side ? 'win' : 'lose'));
      else if (stat.check) SFX.play('check');
      else if (o.remote) SFX.play('remote');
      else if (o.promo) SFX.play('promote');
      else if (o.capture) SFX.play('capture');
      else if (frozenCount() > wasFrozen) SFX.play('freeze');
      else SFX.play('move');
    }
    refreshMarks(); refreshPanel(); store();
    if (stat.over) setTimeout(showOver, 700);
    else if (!humanTurn()) askAI();
  }
  function frozenCount() { var n = 0; for (var i = 96; i < 192; i++) if (DC.isFrozen(st, i)) n++; return n; }

  /* ---------- AI ---------- */
  function makeWorker() {
    try {
      var src = $('engine-src').textContent +
        '\nonmessage=function(e){var d=e.data;DC.setVariant(d.variant);postMessage({id:d.id,r:DC.think(DC.load(d.state),d.opt)});};';
      var w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = function (e) { aiDone(e.data.id, e.data.r); };
      w.onerror = function () { useWorker = false; worker = null; if (busy) thinkSync(reqId); };
      return w;
    } catch (e) { useWorker = false; return null; }
  }
  function aiOpt() { var L = LEVELS[Math.max(0, botLevel(st.turn))]; return { depth: L.depth, time: L.time || 0, noise: L.noise || 0 }; }
  function thinkSync(id) {
    setTimeout(function () {
      if (id !== reqId) return;
      aiDone(id, DC.think(DC.load(DC.save(st)), aiOpt()));
    }, 60);
  }
  function askAI() {
    busy = true; reqAt = Date.now(); var id = ++reqId;
    refreshPanel();
    if (useWorker && !worker) worker = makeWorker();
    if (worker) worker.postMessage({ id: id, variant: WY ? 'wyvern' : 'dragonchess', state: DC.save(st), opt: aiOpt() });
    else thinkSync(id);
  }
  function aiDone(id, r) {
    if (id !== reqId || !busy) return;
    var wait = Math.max(0, 450 - (Date.now() - reqAt));
    setTimeout(function () {
      if (id !== reqId || !busy) return;
      busy = false;
      var m = r && r.move;
      if (legal.indexOf(m) < 0) m = legal[0];
      if (m !== undefined) doMove(m);
    }, wait);
  }
  function cancelAI() {
    reqId++;
    if (busy && worker) { worker.terminate(); worker = null; }
    busy = false;
  }

  /* ---------- dialogs ---------- */
  function overTitle() {
    if (stat.winner === 0) return 'Draw: ' + sideName(1) + ' vs ' + sideName(-1);
    return sideName(stat.winner, true) + ' defeated ' + sideName(-stat.winner);
  }
  function showOver() {
    if (!stat.over) return;
    var why = {
      checkmate: 'Checkmate. ' + (stat.winner > 0 ? 'Gold' : 'Scarlet') + ' has won the game.',
      stalemate: 'Stalemate. The side to move has no legal move.',
      repetition: 'The same position occurred three times.',
      moves: '100 moves each passed with no capture or Warrior move.',
      material: 'Only the two Kings remain.'
    };
    $('overTitle').textContent = overTitle(); $('overText').textContent = why[stat.result] || '';
    $('dlgOver').hidden = false;
  }
  var pend = { mode: 'ai', side: 1, level: 1 }; // level may be 'sim'
  function markOpts() {
    var set = function (id, v) {
      var bs = $(id).children;
      for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-v') === String(v));
    };
    set('optMode', pend.mode); set('optSide', pend.side); set('optLevel', pend.level);
    $('aiOpts').style.display = pend.mode === 'ai' ? '' : 'none';
    var sim = pend.level === 'sim';
    $('sideOpts').style.display = sim ? 'none' : '';
    $('levelNote').textContent = sim ? 'Watch two bots fight. Each bot gets its own randomly chosen difficulty.' : LEVELS[pend.level].note;
  }
  function openNew() {
    pend = { mode: cfg.mode === '2p' ? '2p' : 'ai', side: cfg.side, level: cfg.mode === 'sim' ? 'sim' : cfg.level };
    markOpts(); $('dlgOver').hidden = true; $('dlgNew').hidden = false;
  }
  function startNew() {
    cancelAI();
    if (pend.mode === 'ai' && pend.level === 'sim') {
      cfg.mode = 'sim';
      cfg.simG = (Math.random() * LEVELS.length) | 0; cfg.simS = (Math.random() * LEVELS.length) | 0;
    } else {
      cfg.mode = pend.mode; if (pend.level !== 'sim') cfg.level = pend.level;
      cfg.side = pend.side === 0 ? (Math.random() < 0.5 ? 1 : -1) : pend.side;
    }
    flipped = cfg.mode === 'ai' && cfg.side < 0;
    replay([]); deselect();
    $('dlgNew').hidden = true;
    $('info').textContent = 'Tap a piece to see where it can go.';
    buildBoards(); refreshMarks(); refreshPanel(); store();
    if (!humanTurn()) askAI();
  }
  function undo() {
    if (!moves.length || cfg.mode === 'sim') return;
    cancelAI();
    var list = moves.slice(0, -1);
    if (cfg.mode === 'ai' && list.length % 2 !== (cfg.side > 0 ? 0 : 1) && list.length) list.pop();
    replay(list); deselect();
    $('dlgOver').hidden = true;
    buildBoards(); refreshMarks(); refreshPanel(); store();
    if (!stat.over && !humanTurn()) askAI();
  }
  function buildGuide() {
    var h = '<ul>' + (WY ?
      '<li>Two stacked 9 by 8 boards: Sky (level 3) and Land (level 2). There is no Underworld.</li>' +
      '<li>Gold moves first. Checkmate the enemy King to win. There is no castling.</li>' +
      '<li>Tap a piece to see its moves on both boards. Green dot: move. Green ring: capture. Orange ring: Dragon fire (capture from above without moving).</li>' +
      '<li>White outlines mark the squares directly above and below the selected piece.</li>' +
      '<li>Wyvern Chess has no Sylph, Mage, Dwarf, Basilisk or Elemental. The second rank of Sky is filled with Wyverns.</li>' +
      '<li>Draws: stalemate, the same position three times, or 100 moves each with no capture or Warrior move.</li>' +
      '<li>Notation: piece letter, level, file, rank. Example: W2e2-2e3. A star marks Dragon fire.</li></ul>' :
      '<li>Three stacked 12 by 8 boards: Sky (level 3), Land (level 2) and Underworld (level 1).</li>' +
      '<li>Gold moves first. Checkmate the enemy King to win. There is no castling.</li>' +
      '<li>Tap a piece to see its moves on all three boards. Green dot: move. Green ring: capture. Orange ring: Dragon fire (capture from above without moving).</li>' +
      '<li>White outlines mark the squares directly above and below the selected piece.</li>' +
      '<li>A Basilisk freezes the enemy piece standing directly above it on the Land board.</li>' +
      '<li>Simulation (in the difficulty menu) lets you watch two bots of random difficulty play each other.</li>' +
      '<li>Draws: stalemate, the same position three times, or 100 moves each with no capture or Warrior move.</li>' +
      '<li>Notation: piece letter, level, file, rank. Example: W2e2-2e3. A star marks Dragon fire.</li></ul>');
    GUIDE.forEach(function (g) {
      var t = DC.LETTERS.indexOf(g.letter);
      h += '<div class="gp"><div class="tok"></div><div><h4>' + g.name + ' (' + g.letter + ')<small>' + g.home +
        (g.value ? ', value ' + g.value : '') + '</small></h4><ul>' +
        g.lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul></div></div>';
      h = h.replace('<div class="tok"></div>', '<div class="tok" data-t="' + t + '"></div>');
    });
    h += '<p class="credits">' + (WY ? 'Wyvern Chess is a variant of Dragonchess, which Gary Gygax designed (Dragon Magazine #100, 1985). It is an unofficial fan variant. ' :
      'Dragonchess was designed by Gary Gygax (Dragon Magazine #100, 1985). This is an unofficial fan implementation. ') +
      'Rules follow Wikipedia and The Chess Variant Pages (E. Jackman, H. Bodlaender). Piece icons by Lorc and Delapouite, ' +
      'game-icons.net, licensed CC BY 3.0.</p>';
    $('guideBody').innerHTML = h;
    var toks = $('guideBody').querySelectorAll('.tok');
    for (var i = 0; i < toks.length; i++) toks[i].appendChild(pieceEl(+toks[i].getAttribute('data-t')));
  }

  /* ---------- wiring ---------- */
  function init() {
    DC.setVariant(WY ? 'wyvern' : 'dragonchess');
    var saved = restore();
    replay(saved || []);
    SFX.setMuted(!cfg.sound);
    LEVELS.forEach(function (L, i) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-v', i); b.textContent = L.name;
      $('optLevel').appendChild(b);
    });
    var sb = document.createElement('button'); sb.type = 'button'; sb.setAttribute('data-v', 'sim'); sb.textContent = 'Simulation';
    $('optLevel').appendChild(sb);
    layout(); buildBoards(); buildGuide(); refreshMarks(); refreshPanel();
    $('boards').addEventListener('click', function (e) {
      var c = e.target.closest ? e.target.closest('.cell') : null;
      if (c) onCell(+c.getAttribute('data-sq'));
    });
    ['optMode', 'optSide', 'optLevel'].forEach(function (id) {
      $(id).addEventListener('click', function (e) {
        var v = e.target.getAttribute && e.target.getAttribute('data-v');
        if (v === null || v === undefined) return;
        if (id === 'optMode') pend.mode = v; else if (id === 'optSide') pend.side = +v; else pend.level = v === 'sim' ? 'sim' : +v;
        markOpts();
      });
    });
    $('bNew').onclick = openNew;
    $('newCancel').onclick = function () { $('dlgNew').hidden = true; };
    $('newStart').onclick = startNew;
    $('bUndo').onclick = undo;
    $('bFlip').onclick = function () { flipped = !flipped; buildBoards(); refreshMarks(); store(); };
    $('bSound').onclick = function () { cfg.sound = !cfg.sound; SFX.setMuted(!cfg.sound); refreshPanel(); store(); if (cfg.sound) SFX.play('move'); };
    $('bGuide').onclick = function () { $('dlgGuide').hidden = false; };
    $('guideClose').onclick = function () { $('dlgGuide').hidden = true; };
    $('overClose').onclick = function () { $('dlgOver').hidden = true; };
    $('overNew').onclick = openNew;
    var mods = document.querySelectorAll('.modal');
    for (var i = 0; i < mods.length; i++) mods[i].addEventListener('click', function (e) { if (e.target === this && this.id !== 'dlgNew') this.hidden = true; });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { $('dlgGuide').hidden = true; $('dlgOver').hidden = true; if (moves.length) $('dlgNew').hidden = true; deselect(); refreshMarks(); }
    });
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
    if (!saved) openNew();
    else if (stat.over) showOver();
    else if (!humanTurn()) askAI();
  }
  init();
})();
