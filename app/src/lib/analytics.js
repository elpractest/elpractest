/**
 * Utility helper for GTM dataLayer pushes in the React SPA.
 */
export function trackEvent(name, params = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: name,
    ...params
  });
}
