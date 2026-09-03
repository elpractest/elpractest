import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Carousel from './Carousel';
import { USE_DEMO_DATA, demoBanners } from '../lib/demoData';

/**
 * Home promo carousel. Reads the public banners endpoint that the super-admin
 * panel manages (/api/banners/public). When there are no active banners it
 * falls back to the design demo banners (USE_DEMO_DATA) so the populated
 * reference layout is visible; set USE_DEMO_DATA=false to hide the fallback.
 *
 * A banner's cta_url may be an internal path ("/student/test-series") or an
 * external URL ("https://…"); the card routes accordingly.
 */
/* The scrim only exists to keep the text legible over an uploaded image.
   With no image the card is a flat tint and needs no scrim at all. */
const SCRIM = 'rgba(14,18,32,.62)';

export default function BannerCarousel({ onDemoCta }) {
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    let alive = true;
    api.get('/api/banners/public')
      .then((res) => { if (alive) setBanners(Array.isArray(res.data) ? res.data : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const go = (url) => {
    if (!url) return;
    if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener');
    else navigate(url);
  };

  // Real banners take precedence; demo fills the empty state.
  const useDemo = banners.length === 0 && USE_DEMO_DATA;
  const items = useDemo
    ? demoBanners.map((b, i) => ({
        id: `demo-${i}`, kicker: b.kicker, title: b.title, subtitle: b.subtitle,
        cta_label: b.cta, grad: b.grad, scrim: SCRIM, demo: true,
      }))
    : banners.map((b) => ({ ...b, grad: 'var(--primary-soft)', scrim: SCRIM }));

  if (items.length === 0) return null;

  return (
    <Carousel
      ariaLabel="Promotions"
      autoPlay
      trackStyle={{ display: 'flex', gap: '13px', overflowX: 'auto', padding: '4px 18px', scrollSnapType: 'x mandatory' }}
    >
      {items.map((b) => {
        // Text sits on the image when there is one, on a soft tint otherwise.
        const ink = b.image_url
          ? { title: '#fff', sub: 'rgba(255,255,255,.82)', ctaBg: '#fff', ctaText: 'var(--primary)' }
          : { title: 'var(--tx)', sub: 'var(--tx2)', ctaBg: 'var(--primary)', ctaText: 'var(--brand-ink)' };
        return (
        <div
          key={b.id}
          onClick={() => (b.demo ? onDemoCta?.() : go(b.cta_url))}
          style={{
            flex: 'none', width: '296px', aspectRatio: '16 / 9', borderRadius: '20px', scrollSnapAlign: 'start',
            position: 'relative', overflow: 'hidden', cursor: 'pointer',
            background: b.grad, border: '1px solid var(--line)',
          }}
        >
          {/* Full-bleed at 16:9 — the same crop the Android carousel and the
              course cards get, so one 1920×1080 upload serves every surface.
              The scrim below keeps the left column legible over the art. */}
          {b.image_url && (
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${b.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          )}
          {b.image_url && (
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,${b.scrim} 0%,${b.scrim} 52%,transparent 100%)`, pointerEvents: 'none' }} />
          )}
          <div style={{ position: 'absolute', inset: '0 34% 0 0', padding: '18px 16px 18px 20px', display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
            {b.kicker && (
              <span className="t-overline" style={{ alignSelf: 'flex-start', color: ink.sub }}>{b.kicker}</span>
            )}
            <div style={{ font: '700 19px/1.12 var(--font-display)', color: ink.title, marginTop: 'auto', letterSpacing: '-.025em' }}>{b.title}</div>
            {b.subtitle && <div style={{ font: '400 12.5px var(--font-body)', color: ink.sub, marginTop: '4px' }}>{b.subtitle}</div>}
            {b.cta_label && (
              <span style={{ alignSelf: 'flex-start', marginTop: '11px', font: '600 12px var(--font-body)', color: ink.ctaText, background: ink.ctaBg, padding: '7px 14px', borderRadius: '999px' }}>{b.cta_label}</span>
            )}
          </div>
        </div>
        );
      })}
    </Carousel>
  );
}
