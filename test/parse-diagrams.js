#!/usr/bin/env node
'use strict';

// Parses test/cvp-diagrams.txt (Dragonchess piece diagrams) and writes
// test/fixtures.json: one scenario per (piece, group) that holds a piece token.
// Usage: node test/parse-diagrams.js

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'cvp-diagrams.txt');
const OUTPUT = path.join(__dirname, 'fixtures.json');

const PIECE_NAMES = [
  'Sylph', 'Griffin', 'Dragon', 'Oliphant', 'Unicorn', 'Hero', 'Thief', 'Cleric',
  'Mage', 'King', 'Paladin', 'Warrior', 'Basilisk', 'Elemental', 'Dwarf',
];
const PIECE_LETTERS = new Set(['S', 'G', 'R', 'O', 'U', 'H', 'T', 'C', 'M', 'K', 'P', 'W', 'B', 'E', 'D']);
const MARK_LETTERS = new Set(['x', 'm', 'c', 'a']);
const IGNORED_LETTERS = new Set(['f']);
const LEVELS = { TOP: 3, MIDDLE: 2, BOTTOM: 1 };
const CELLS_PER_ROW = 12;
const ROW_RE = /^([1-8])\s+(.*)$/;
const LABEL_RE = /\b(TOP|MIDDLE|BOTTOM)\b/;

function fail(message) {
  throw new Error(message);
}

function checkToken(ch, where) {
  if (ch === '-' || PIECE_LETTERS.has(ch) || MARK_LETTERS.has(ch) || IGNORED_LETTERS.has(ch)) return;
  fail(`${where}: unknown cell token "${ch}"`);
}

// Turns the cell text of one row into 12 tokens, each tagged with its group.
// Brackets and braces are not tokens; they only set the group of what they enclose.
function tokenizeCells(cellText, where) {
  const tokens = [];
  let square = 0;
  let curly = 0;
  for (const ch of cellText) {
    if (ch === ' ' || ch === '\t') continue;
    if (ch === '[' || ch === ']' || ch === '{' || ch === '}') {
      if (ch === '[') square++;
      else if (ch === ']') square--;
      else if (ch === '{') curly++;
      else curly--;
      if (square < 0 || curly < 0) fail(`${where}: unbalanced closing bracket`);
      continue;
    }
    const group = curly > 0 ? 'brace' : square > 0 ? 'bracket' : 'plain';
    tokens.push({ ch, group });
  }
  if (square !== 0 || curly !== 0) fail(`${where}: unclosed bracket or brace`);
  if (tokens.length !== CELLS_PER_ROW) {
    fail(`${where}: expected ${CELLS_PER_ROW} cells, found ${tokens.length}`);
  }
  for (const t of tokens) checkToken(t.ch, where);
  return tokens;
}

// Reads every board of every piece into a flat list of cells:
// { piece, level, file, rank, ch, group }.
function parseDiagrams(text) {
  const lines = text.split(/\r?\n/);
  const cells = [];
  const seenPieces = new Set();
  let piece = null;
  let boardsInPiece = 0;
  let boardRows = [];
  let expectedRank = 8;

  const endPiece = () => {
    if (piece === null) return;
    if (expectedRank !== 8) fail(`${piece}: board is incomplete at end of piece`);
    if (boardsInPiece < 1 || boardsInPiece > 3) {
      fail(`${piece}: has ${boardsInPiece} boards (expected 1 to 3)`);
    }
  };

  const finishBoard = () => {
    const labels = boardRows.map((r) => r.label).filter(Boolean);
    if (labels.length !== 1) {
      fail(`${piece}: board has ${labels.length} labels (expected 1)`);
    }
    const level = LEVELS[labels[0]];
    for (const row of boardRows) {
      const where = `${piece}, rank ${row.rank} (line ${row.lineNo})`;
      const tokens = tokenizeCells(row.cellText, where);
      tokens.forEach((t, file) => {
        cells.push({ piece, level, file, rank: row.rank - 1, ch: t.ch, group: t.group });
      });
    }
    boardRows = [];
    boardsInPiece++;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (PIECE_NAMES.includes(trimmed)) {
      endPiece();
      if (seenPieces.has(trimmed)) fail(`${trimmed}: heading appears twice (line ${i + 1})`);
      seenPieces.add(trimmed);
      piece = trimmed;
      boardsInPiece = 0;
      continue;
    }

    const m = ROW_RE.exec(line);
    if (!m) continue;
    if (piece === null) fail(`board row before any piece heading (line ${i + 1})`);

    const rank = Number(m[1]);
    if (rank !== expectedRank) {
      fail(`${piece}: expected rank ${expectedRank}, found ${rank} (line ${i + 1})`);
    }

    let cellText = m[2];
    let label = null;
    const labelMatch = LABEL_RE.exec(cellText);
    if (labelMatch) {
      label = labelMatch[1];
      cellText = cellText.slice(0, labelMatch.index);
    }
    boardRows.push({ rank, label, cellText, lineNo: i + 1 });

    expectedRank = rank === 1 ? 8 : rank - 1;
    if (rank === 1) finishBoard();
  }
  endPiece();

  for (const name of PIECE_NAMES) {
    if (!seenPieces.has(name)) fail(`piece heading "${name}" not found`);
  }
  return cells;
}

// One scenario per (piece, group) that holds an uppercase piece token.
function buildScenarios(cells) {
  const scenarios = [];
  for (const piece of PIECE_NAMES) {
    const own = cells.filter((c) => c.piece === piece);
    const byGroup = new Map();

    for (const c of own) {
      if (!PIECE_LETTERS.has(c.ch)) continue;
      if (byGroup.has(c.group)) {
        fail(`${piece}: more than one piece token in the ${c.group} group`);
      }
      byGroup.set(c.group, {
        piece,
        letter: c.ch,
        group: c.group,
        from: { level: c.level, file: c.file, rank: c.rank },
        marks: [],
      });
    }

    for (const c of own) {
      if (!MARK_LETTERS.has(c.ch)) continue;
      const scenario = byGroup.get(c.group);
      if (scenario) {
        scenario.marks.push({ level: c.level, file: c.file, rank: c.rank, mark: c.ch });
      }
    }

    scenarios.push(...byGroup.values());
  }
  return scenarios;
}

function main() {
  const text = fs.readFileSync(INPUT, 'utf8');
  const cells = parseDiagrams(text);
  const scenarios = buildScenarios(cells);
  fs.writeFileSync(OUTPUT, JSON.stringify(scenarios, null, 2) + '\n');

  const perPiece = new Map();
  for (const s of scenarios) perPiece.set(s.piece, (perPiece.get(s.piece) || 0) + 1);
  console.log(`Wrote ${scenarios.length} scenarios for ${perPiece.size} pieces to ${OUTPUT}`);
  for (const name of PIECE_NAMES) {
    console.log(`  ${name}: ${perPiece.get(name) || 0}`);
  }
}

main();
