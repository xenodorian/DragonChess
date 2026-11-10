# Dragonchess rules as implemented

Game by Gary Gygax, Dragon Magazine #100 (August 1985), pp. 34-40.

Sources used (the magazine itself was not consulted directly):

- **[WP]** Wikipedia, "Dragonchess" (cites Gygax 1985 and Pritchard 1994/2007).
- **[CVP]** Chess Variant Pages, "Dragonchess" by Edward Jackman, edited by Hans Bodlaender
  (https://www.chessvariants.com/3d.dir/dragonchess.html). Includes move diagrams, used as test fixtures.

## Board

- Three 12x8 boards stacked: level 3 = Sky (upper), level 2 = Land (middle), level 1 = Underworld (lower). [WP]
  (CVP numbers the boards the other way round. WP notes Gygax uses 3 = upper in all move text, so that is used here.)
- Files a-l, ranks 1-8. A square is written level + file + rank, e.g. `2g1`. [WP][CVP]
- Near right corner (l1) of every board is light. [CVP]
- Gold moves first. Scarlet moves second. Gold starts on ranks 1-2. [WP][CVP]

## Starting position (Gold; Scarlet mirrors on ranks 8 and 7) [WP][CVP agree]

- Level 3: Griffons c1, k1. Dragon g1. Sylphs a2, c2, e2, g2, i2, k2.
- Level 2: rank 1 a-l = Oliphant, Unicorn, Hero, Thief, Cleric, Mage, King, Paladin, Thief, Hero, Unicorn, Oliphant. Warriors on all of rank 2.
- Level 1: Basilisks c1, k1. Elemental g1. Dwarves b2, d2, f2, h2, j2, l2.

## Pieces

"Forward" = toward the enemy home rank. "Up/down" = same file and rank on the adjacent level.
"Triagonal step" = to a square diagonally adjacent to the square directly above/below.

| Piece | Letter | Rule |
|---|---|---|
| Sylph | S | L3: move (no capture) 1 diagonally forward; capture 1 straight forward; capture straight down to L2. L2: move (no capture) straight up, or to any empty one of the owner's six Sylph starting squares. No promotion. |
| Griffon | G | L3: leaps (2,3) like a zebra, unblockable; or triagonal step down to L2. L2: 1 step diagonally; or triagonal step up to L3. All move or capture. |
| Dragon | R | L3 only. Moves/captures as bishop or king. Instead of moving, may capture remotely one enemy piece on L2 directly below or orthogonally adjacent to that square; the Dragon stays put. |
| Warrior | W | L2 only. Move 1 straight forward (no capture); capture 1 diagonally forward. No double step. Promotes to Hero on the far rank. |
| Oliphant | O | L2 only. Rook. |
| Unicorn | U | L2 only. Knight. |
| Hero | H | L2: 1 or 2 steps diagonally (the 2-step leaps); or triagonal step to L1 or L3. L1/L3: only a triagonal step back to L2. All move or capture. |
| Thief | T | L2 only. Bishop. |
| Cleric | C | Any level: king step, or straight up/down one level. Move or capture. |
| Mage | M | L2: queen; or straight up/down one level. L1/L3: 1 step orthogonally; or 1 or 2 levels straight up/down (cannot pass through an occupied L2 square). Move or capture. |
| King | K | L2: king step; or straight up/down one level. L1/L3: only straight back to L2. Move or capture. |
| Paladin | P | L2: king or knight. L1/L3: king. Between levels: 3D knight leap, unblockable: 1 level up/down + 2 squares orthogonally, or 2 levels + 1 square orthogonally. Move or capture. |
| Dwarf | D | L1 and L2: move (no capture) 1 forward or 1 sideways; capture 1 diagonally forward. L1: capture straight up. L2: move (no capture) straight down. |
| Basilisk | B | L1 only. Move/capture 1 forward or diagonally forward; move (no capture) 1 straight back. Freezes any enemy piece directly above it on L2: that piece cannot move until the Basilisk moves or is captured. |
| Elemental | E | L1: move/capture 1 or 2 orthogonally (no leaping); move (no capture) 1 diagonally; capture only: 1 orthogonal then up to L2 (the L1 square passed through must be empty). L2: move/capture: down then 1 orthogonal (the L1 square directly below must be empty). |

Other rules: no castling [WP][CVP]. Win by checkmate [WP]. A King may not be left in check.

Piece values given by Gygax, per [CVP] (used by the AI): Mage 11, Paladin 10, Cleric 9, Dragon 8, Griffon 5,
Oliphant 5, Hero 4.5, Thief 4, Elemental 4, Basilisk 3, Unicorn 2.5, Dwarf 2, Sylph 1, Warrior 1.

## Rulings where the sources are unclear or disagree

1. **Mage on L1/L3, King returning to L2, Paladin level change: capture allowed?** WP says Gygax does not state it. CVP says move or capture. Implemented: move or capture (CVP).
2. **Mage 2-level move, Elemental 2-step and level change: blockable?** WP says Gygax does not state it. CVP says blockable. Implemented: blockable (CVP).
3. **Elemental move up to L2.** CVP text and WP say capture only. The CVP diagram marks it as move-or-capture. Implemented: capture only (two texts against one diagram).
4. **CVP King diagram** shows a King on 1j5 returning to 2j4. Text in both sources says directly above. Treated as a diagram typo. Implemented: 2j5.
5. **Griffon spelling.** WP "Griffon", CVP "Griffin". "Griffon" used.

## House rules (NOT in either source; added so games can end)

- Stalemate (no legal move, not in check) is a draw, as in chess.
- Threefold repetition is a draw.
- 100 moves by each side without a capture or Warrior move is a draw.
- A frozen piece cannot move or capture, so it gives no check. A frozen King can still be checkmated.
- Only the two Kings left is a draw.

---

# Wyvern Chess (variant)

Built from the same engine and interface as Dragonchess. Page: `wyvern.html`.

## Differences from Dragonchess

- **Boards:** two boards, Sky (level 3) and Land (level 2). No Underworld (level 1).
- **Size:** each board is 10 files by 8 ranks, files a to j. The outer files of Dragonchess (a and l) are removed.
- **Removed pieces:** Sylph, Mage, Dwarf, Basilisk, Elemental. Their rules are not used.
- **Remaining pieces:** Griffon, Dragon, Warrior, Oliphant, Unicorn, Hero, Thief, Cleric, King, Paladin. Their moves are the Dragonchess rules with every move to or from level 1 removed.
- **Win, draws, promotion, Dragon remote capture:** unchanged from Dragonchess.

## Start position (Gold; Scarlet mirrors on ranks 8 and 7)

- Sky, rank 1: Griffon b1, Dragon f1, Griffon j1.
- Land, rank 1: Unicorn a1, Hero b1, Thief c1, Cleric d1, empty e1, King f1, Paladin g1, Thief h1, Hero i1, Unicorn j1.
- Land, rank 2: Warriors a2 to j2.

Notes on this setup:

- The Griffons already start on Sky in Dragonchess (RULES.md, Dragonchess setup, level 3). They are kept on Sky here.
- The Mage stood on e1 in Dragonchess. Its square is left empty, since no piece replaces it.
- The outer Land pieces (Oliphant a1 and l1) are removed with the outer files.
