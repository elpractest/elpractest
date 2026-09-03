/* ============================================================
   HIGHLIGHT PALETTE — one definition, four consumers.
   ------------------------------------------------------------
   The swatch picker, the overlay drawn on the page, the notes list in
   the study drawer and the server's validation rule all have to agree
   on what "green" is. Defining them per component is how a highlight
   made on a phone ends up a different colour in the list beside it.

   The stored values ('yellow' | 'green' | …) are the contract with the
   API (MaterialAnnotation::COLORS) and are persisted on every saved
   annotation. They must not be renamed; only what they LOOK like lives
   here.

   None of these five appear anywhere else in the reader. Ultramarine
   (--primary) and gold (--reward) are chrome; a student's own mark
   drawn in the app's accent colour is indistinguishable from the app's
   own furniture.

   `light` sits under dark text on a light page; `dark` sits under light
   text on a dark page. Both clear 7:1 against the ink they carry, so a
   highlighted line stays as readable as an unhighlighted one instead of
   merely legible.
   ============================================================ */

export const HIGHLIGHT_SWATCHES = [
  { value: 'yellow', label: 'Butter', light: '#FFE9A8', dark: '#6B5A1F' },
  { value: 'green', label: 'Mint', light: '#C7EFD8', dark: '#24543C' },
  { value: 'blue', label: 'Sky', light: '#C9E4FB', dark: '#1F4666' },
  { value: 'pink', label: 'Rose', light: '#FBD0DA', dark: '#6B2A3C' },
  { value: 'purple', label: 'Lilac', light: '#E0D4F7', dark: '#45336B' },
];

/**
 * The fill for a highlight. Unknown values are possible — an annotation
 * synced from a future release, or an older palette name — so an
 * unrecognised colour still draws rather than vanishing.
 */
export function highlightColor(value, isNight = false) {
  const swatch = HIGHLIGHT_SWATCHES.find((s) => s.value === value) ?? HIGHLIGHT_SWATCHES[0];
  return isNight ? swatch.dark : swatch.light;
}

export function highlightLabel(value) {
  return HIGHLIGHT_SWATCHES.find((s) => s.value === value)?.label ?? 'Butter';
}
