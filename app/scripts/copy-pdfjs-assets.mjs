/* ============================================================
   Copy pdf.js's character maps and standard-font data into public/.
   ------------------------------------------------------------
   pdf.js fetches these at runtime, by URL, and only when a document
   actually needs them:

     · cmaps/          — CJK and other non-Latin character encodings.
     · standard_fonts/ — metrics for the "standard 14" (Helvetica,
                         Times, Courier…) which many PDFs reference
                         without embedding. Without them the engine
                         substitutes a system font and the invisible
                         text layer drifts out of line with the picture
                         underneath, so selection and highlighting land
                         a few pixels off the words.

   They are vendor assets, so they are copied out of node_modules at
   build time rather than committed. Wired into `dev` and `build` in
   package.json (not `postinstall`) because the Docker build runs
   `npm ci` before it copies the source tree in, and a postinstall's
   output into public/ would be overwritten by that copy.
   ============================================================ */

import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '..', 'node_modules', 'pdfjs-dist');
const dest = resolve(here, '..', 'public', 'pdfjs');

if (!existsSync(pkg)) {
  console.error('[pdfjs-assets] pdfjs-dist is not installed — run npm install first.');
  process.exit(1);
}

// Wiped first so a version bump cannot leave a stale .bcmap behind that
// the new engine no longer knows how to read.
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

for (const dir of ['cmaps', 'standard_fonts']) {
  await cp(resolve(pkg, dir), resolve(dest, dir), { recursive: true });
}

console.log('[pdfjs-assets] copied cmaps + standard_fonts to public/pdfjs');
