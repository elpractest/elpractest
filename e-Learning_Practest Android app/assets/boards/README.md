# Exam board marks

This folder is **deliberately empty of artwork.** Everything that draws a board
degrades to the board's initials when a file is missing (`BoardArtwork` in
`lib/widgets.dart`), so the app ships and looks finished without a single mark
in here. Dropping files in is the whole integration — there is no code change.

## Before you add anything

SSC, IBPS, RRB, UPSC and the state commission marks are **protected marks.**
Naming the exams you prepare students for is ordinarily nominative use. Placing
a board mark beside yours in a way that implies endorsement is not.

Three safeguards are already built into the app, and they should stay:

- Board marks are visually subordinate — smaller than the Practest mark, and
  always inside a labelled "Your exams" context.
- **Never in the app header.** `AppHeader` draws the product's own mark only.
- `BoardCatalog.disclaimer` is rendered under the rail and in Profile → About:
  *"Not affiliated with or endorsed by any examination authority."*

Play Store listings are reviewed against trademark complaints. **Confirm with
counsel before the store assets go up.**

## File spec

| | |
|---|---|
| Format | PNG, transparent background (SVG preferred upstream; Flutter takes the PNG) |
| Trim | Cropped to the mark's bounding box — no built-in padding |
| Size | Longest edge 240 px at 1×; ship `2.0x/` and `3.0x/` variants beside it |
| Colour | Full colour, as published. Do not invert, tint or greyscale — it is both ugly and legally worse |
| Name | `<key>.png`, where `<key>` is the `ExamBoard.key` in `lib/boards.dart` — e.g. `ssc.png`, `ibps.png`, `uppsc.png` |

The tile supplies its own 9 dp padding and gives the mark 76% of its inner box,
vertically centred, on a paper-white card that stays paper-white in dark theme
too. That card is what lets a wide bank lockup and a square commission emblem
sit on one baseline, so **do not** bake a background or padding into the file.

## Adding a board the registry doesn't know

Add an `ExamBoard` to `BoardCatalog.boards` in `lib/boards.dart`, then drop the
file in here under the same key. `resolve()` matches on a normalised category
string, so `"SSC CGL Tier I"`, `"ssc-cgl"` and `"SSC_CGL"` all land on `ssc`.

A category the registry does not recognise resolves to **null**, and every
caller treats null as *draw nothing*. A mark on the wrong row is worse than no
mark, and a rail tile with an empty catalogue behind it is worse than both.
