import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

/**
 * Home promo carousel. Reads the public banners endpoint that the super-admin
 * panel manages (/api/banners/public). Renders nothing if there are no active
 * banners, so it degrades cleanly when none are configured.
 *
 * A banner's cta_url may be an internal path ("/student/test-series") or an
 * external URL ("https://…"); the card routes accordingly.
 */
export default function BannerCarousel() {
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    let alive = true;
    api.get('/api/banners/public')
      .then((res) => { if (alive) setBanners(Array.isArray(res.data) ? res.data : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (banners.length === 0) return null;

  const go = (url) => {
    if (!url) return;
    if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener');
    else navigate(url);
  };

  return (
    <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', padding: '2px 2px 6px', scrollSnapType: 'x mandatory' }}>
      {banners.map((b) => (
        <div
          key={b.id}
          onClick={() => go(b.cta_url)}
          style={{
            flex: 'none', width: '300px', minHeight: '150px', borderRadius: '20px', scrollSnapAlign: 'start',
            position: 'relative', overflow: 'hidden', cursor: b.cta_url ? 'pointer' : 'default',
            background: 'linear-gradient(120deg,#12203A,#0B1830)', border: '1px solid var(--line2)',
          }}
        >
          {b.image_url && (
            <>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '52%', backgroundImage: `url(${b.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#12203A 0%,#12203A 50%,transparent 100%)', pointerEvents: 'none' }} />
            </>
          )}
          <div style={{ position: 'relative', padding: '18px 16px', display: 'flex', flexDirection: 'column', height: '100%', maxWidth: b.image_url ? '66%' : '100%' }}>
            {b.kicker && (
              <span style={{ alignSelf: 'flex-start', font: '800 10px var(--font-body)', letterSpacing: '.12em', color: '#1a1206', background: '#ffc968', padding: '4px 9px', borderRadius: '999px' }}>{b.kicker}</span>
            )}
            <div style={{ font: '800 19px/1.15 var(--font-display)', color: '#fff', marginTop: b.kicker ? '10px' : 0, letterSpacing: '-.02em' }}>{b.title}</div>
            {b.subtitle && <div style={{ font: '600 12px var(--font-body)', color: 'rgba(255,255,255,.82)', marginTop: '4px' }}>{b.subtitle}</div>}
            {b.cta_label && (
              <span style={{ alignSelf: 'flex-start', marginTop: '12px', font: '800 12px var(--font-body)', color: '#1a1206', background: '#f5a623', padding: '8px 15px', borderRadius: '999px' }}>{b.cta_label}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
