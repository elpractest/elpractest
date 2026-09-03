/* ============================================================
   FIND-ON-PAGE — turn a query into rectangles over the rendered page.
   ------------------------------------------------------------
   The results list can be built entirely from the text the engine
   extracts, but MARKING the hits on the page needs their geometry, and
   geometry only exists once a page is rasterised and its text layer is
   in the DOM.

   So this walks the text layer's own text nodes rather than the
   extracted string. Working from the DOM is what makes the rectangles
   correct at any zoom and on any device — a Range measures where the
   glyphs actually are, instead of us re-deriving it from PDF units and
   hoping the two agree.

   pdf.js splits a line across many spans, so the search runs over one
   concatenated string built from every text node in order, and matches
   are mapped back to (node, offset) pairs. A match that straddles two
   spans still produces the right rectangles, because a Range spanning
   them reports one rect per line fragment.
   ============================================================ */

/**
 * @param {Element} pageEl   the `.rd-page` element
 * @param {string}  query    what to look for; case-insensitive
 * @returns {{x:number,y:number,w:number,h:number}[]} rects normalised to
 *          the page box (0..1, top-left origin) — the same coordinate
 *          system annotations are stored in.
 */
export function findOnPage(pageEl, query) {
  const needle = query?.trim().toLowerCase();
  if (!pageEl || !needle || needle.length < 2) return [];

  const layer = pageEl.querySelector('.textLayer');
  if (!layer) return [];

  const box = pageEl.getBoundingClientRect();
  if (!box.width || !box.height) return [];

  // Flatten the layer's text nodes, remembering where each one starts in
  // the concatenated string so an index can be mapped back to a node.
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let haystack = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue) continue;
    nodes.push({ node: n, start: haystack.length, length: n.nodeValue.length });
    haystack += n.nodeValue;
  }
  if (!haystack) return [];

  const lower = haystack.toLowerCase();
  const rects = [];

  // Cap the number of marks per page. A one-letter query on a dense page
  // can match hundreds of times, and painting hundreds of absolutely
  // positioned spans costs more than the answer is worth.
  const LIMIT = 120;

  let from = 0;
  while (rects.length < LIMIT) {
    const at = lower.indexOf(needle, from);
    if (at === -1) break;
    from = at + needle.length;

    const startAt = locate(nodes, at);
    const endAt = locate(nodes, at + needle.length);
    if (!startAt || !endAt) continue;

    try {
      const range = document.createRange();
      range.setStart(startAt.node, startAt.offset);
      range.setEnd(endAt.node, endAt.offset);

      for (const r of range.getClientRects()) {
        if (r.width < 0.5 || r.height < 0.5) continue;
        rects.push({
          x: (r.left - box.left) / box.width,
          y: (r.top - box.top) / box.height,
          w: r.width / box.width,
          h: r.height / box.height,
        });
      }
    } catch {
      // A range that cannot be built (the layer re-rendered mid-walk) is
      // one missing mark, not a broken search.
    }
  }

  return rects;
}

function locate(nodes, index) {
  for (const entry of nodes) {
    if (index <= entry.start + entry.length) {
      return { node: entry.node, offset: Math.max(0, index - entry.start) };
    }
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last.node, offset: last.length } : null;
}
