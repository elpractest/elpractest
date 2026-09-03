/* ============================================================
   YOUTUBE IFRAME API — one shared loader for the whole app.
   ------------------------------------------------------------
   The player used to reimplement this ad hoc, inline, with two bugs
   baked in:

   1. It injected a <script> tag guarded only by `if (!window.YT)` —
      which is true for the whole gap between "script requested" and
      "script finished loading and ran its own init code", so opening
      a second lesson while the first was still loading appended a
      SECOND copy of YouTube's loader script.

   2. It wrote directly to the single global
      `window.onYouTubeIframeAPIReady`. That global fires exactly
      once, ever — so the second lesson's callback silently replaced
      the first's, and the first player never finished initialising.

   One promise, created once and resolved once. Every caller after the
   first gets the same settled promise back instead of racing to set
   the API up a second time.
   ============================================================ */

let apiPromise = null;

export function loadYouTubeApi() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window.'));
  }

  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }

  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      // Chain onto whatever was already there rather than clobbering it —
      // some other part of the page may have set this before this module
      // ever ran.
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = () => {
          // Reset so a later retry (the student's connection came back)
          // actually retries instead of replaying a permanently-rejected
          // promise to every caller for the rest of the session.
          apiPromise = null;
          reject(new Error('Could not load the YouTube player script.'));
        };
        document.body.appendChild(tag);
      }
    });
  }

  return apiPromise;
}
