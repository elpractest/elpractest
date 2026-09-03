/* ============================================================
   PDF ENGINE — the one place pdfjs-dist is touched.
   ------------------------------------------------------------
   pdf.js is a rendering engine, not a UI or state library: it
   rasterises PDF pages to a canvas and hands back a text layer. It is
   the same engine every serious in-browser reader is built on, and
   there is no way to offer selection, search, highlighting or
   read-aloud over a PDF without one — an <iframe> gets you the
   browser's own viewer and none of those.

   It is imported LAZILY. The library plus its worker is the largest
   dependency in the app, and a student who never opens a booklet
   should never download it, so nothing outside the reader route
   imports this module at the top level.

   The bytes are fetched through `api` (the shared axios instance), not
   by pdf.js itself. In production the SPA is cross-origin to the API,
   and the auth cookie + CSRF handling that makes every other request
   work lives in that instance. Handing pdf.js a URL would mean a
   second, differently-configured HTTP path for the one request that
   carries a paid asset.
   ============================================================ */

import api from '../api';

let enginePromise = null;

/**
 * Load pdf.js and point it at its worker.
 *
 * The worker URL goes through `new URL(..., import.meta.url)` so Vite
 * fingerprints and serves it from our own origin. A CDN worker would put
 * the rendering of a paid booklet on a third party's uptime and hand
 * them a request log of who is reading what.
 */
export function loadPdfEngine() {
  if (!enginePromise) {
    enginePromise = import('pdfjs-dist/build/pdf.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url,
      ).href;
      return pdfjs;
    }).catch((err) => {
      // Reset so a transient chunk-load failure (a deploy mid-session
      // invalidating the hashed chunk) can be retried rather than being
      // cached as permanently broken.
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

/**
 * Download a study material's PDF as bytes.
 *
 * `onProgress` receives 0–100 where the server sends a length, and null
 * where it does not (a gzipped or chunked response) so the caller can
 * show an indeterminate bar instead of a fake one.
 */
export async function fetchMaterialBytes(materialId, { onProgress, signal } = {}) {
  const res = await api.get(`/api/student/study-materials/${materialId}/file`, {
    responseType: 'arraybuffer',
    signal,
    onDownloadProgress: (e) => {
      if (!onProgress) return;
      onProgress(e.total ? Math.round((e.loaded / e.total) * 100) : null);
    },
  });

  return new Uint8Array(res.data);
}

/**
 * Open a document from bytes.
 *
 * `data` is transferred to the worker, which detaches the buffer on this
 * side — so the caller must not hold on to the array expecting to reuse
 * it. Passing a copy would double the memory cost of a 40 MB booklet on
 * a phone, which is the machine that can least afford it.
 */
export async function openDocument(bytes) {
  const pdfjs = await loadPdfEngine();

  return pdfjs.getDocument({
    data: bytes,
    // Served from our own origin by scripts/copy-pdfjs-assets.mjs, and
    // fetched only when a document actually needs them. Without the font
    // data, a PDF that references the standard 14 without embedding them
    // gets a substituted font and the invisible text layer drifts out of
    // line with the picture — selection and highlights land beside the
    // words rather than on them.
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    // Study material is typed matter, not a form to fill in — and this is
    // third-party content rendered inside an authenticated session, so
    // the engine's optional eval path stays off.
    isEvalSupported: false,
  }).promise;
}

/**
 * The document's own table of contents, flattened to a list with depth,
 * with each entry resolved to a 1-based page number.
 *
 * A PDF outline destination can be a named string or an explicit array,
 * and resolving it costs a round trip to the worker each — done once on
 * open rather than on every panel render.
 */
export async function readOutline(pdf) {
  let raw;
  try {
    raw = await pdf.getOutline();
  } catch {
    return [];
  }
  if (!raw?.length) return [];

  const out = [];

  const walk = async (items, depth) => {
    for (const item of items) {
      let page = null;
      try {
        const dest = typeof item.dest === 'string'
          ? await pdf.getDestination(item.dest)
          : item.dest;
        if (Array.isArray(dest) && dest[0]) {
          page = (await pdf.getPageIndex(dest[0])) + 1;
        }
      } catch {
        // A broken destination is common in scanned or stitched PDFs.
        // The heading is still worth showing; it just will not jump.
      }
      out.push({ title: item.title?.trim() || 'Untitled', page, depth });
      if (item.items?.length) await walk(item.items, depth + 1);
    }
  };

  await walk(raw, 0);
  return out;
}

/**
 * Plain text for one page, with pdf.js's per-item spacing collapsed.
 *
 * Feeds both search and read-aloud. `items` come back in the order the
 * PDF draws them, which is usually reading order and occasionally is
 * not — this is a faithful join, not a reflow, because guessing column
 * order wrong is worse than the occasional odd line.
 */
export async function readPageText(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();

  return content.items
    .map((i) => (i.str ?? '') + (i.hasEOL ? '\n' : ''))
    .join('')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
