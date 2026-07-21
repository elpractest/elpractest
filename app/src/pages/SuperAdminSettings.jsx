import React, { useState, useEffect } from 'react';
import api from '../api';

export default function SuperAdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('branding');

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/super-admin/settings');
      setSettings(res.data.settings || {});
    } catch (err) {
      setError('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleChange = (key) => {
    const currentValue = settings[key];
    const newValue = currentValue === 'true' || currentValue === true ? 'false' : 'true';
    setSettings((prev) => ({ ...prev, [key]: newValue }));
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post('/api/super-admin/settings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const key = type === 'logo' ? 'site_logo' : 'site_favicon';
      setSettings((prev) => ({ ...prev, [key]: res.data.url }));
      setSuccess(`${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully.`);
    } catch (err) {
      setError(err.response?.data?.message || 'File upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.put('/api/super-admin/settings', { settings });
      setSuccess(res.data.message || 'Settings updated successfully.');
      // Refresh to ensure we have the correct server state
      fetchSettings();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
        <span>⏳ Loading platform settings...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          White-Label &amp; Platform Settings
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Configure branding assets, feature toggles, SEO preferences, and analytics tracking for this tenant deployment.
        </p>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', marginBottom: '24px', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--success-text)', marginBottom: '24px', fontSize: '0.9rem' }}>
          ✅ {success}
        </div>
      )}

      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '32px' }}>
        {[
          { id: 'branding', label: '🎨 Branding & Theme' },
          { id: 'contact', label: '📞 Contact & Social' },
          { id: 'seo', label: '🔍 SEO & Analytics' },
          { id: 'features', label: '⚡ Feature Toggles' },
        ].map((subTab) => (
          <button
            key={subTab.id}
            type="button"
            onClick={() => setActiveSubTab(subTab.id)}
            style={{
              padding: '8px 16px',
              background: activeSubTab === subTab.id ? 'var(--accent-soft)' : 'transparent',
              border: 'none',
              borderBottom: activeSubTab === subTab.id ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: activeSubTab === subTab.id ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              transition: 'all 0.2s ease',
            }}
          >
            {subTab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="glass-panel" style={{ padding: '32px' }}>
        
        {/* BRANDING SUB-TAB */}
        {activeSubTab === 'branding' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Site Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.site_name || ''}
                  onChange={(e) => handleTextChange('site_name', e.target.value)}
                  placeholder="e.g. Practest"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Footer Copyright Text
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.footer_text || ''}
                  onChange={(e) => handleTextChange('footer_text', e.target.value)}
                  placeholder="e.g. © 2026 Practest. All rights reserved."
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Primary Color (Hex)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="color"
                    style={{ width: '48px', height: '42px', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', background: 'transparent', padding: 0 }}
                    value={settings.primary_color || '#2563EB'}
                    onChange={(e) => handleTextChange('primary_color', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={settings.primary_color || ''}
                    onChange={(e) => handleTextChange('primary_color', e.target.value)}
                    placeholder="#2563EB"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Accent Color (Hex)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="color"
                    style={{ width: '48px', height: '42px', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', background: 'transparent', padding: 0 }}
                    value={settings.accent_color || '#7C3AED'}
                    onChange={(e) => handleTextChange('accent_color', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={settings.accent_color || ''}
                    onChange={(e) => handleTextChange('accent_color', e.target.value)}
                    placeholder="#7C3AED"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Site Logo
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {settings.site_logo ? (
                    <img src={settings.site_logo} alt="Logo" style={{ maxHeight: '48px', maxWidth: '120px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px', background: 'var(--surface-1)' }} />
                  ) : (
                    <div style={{ height: '48px', width: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      No Logo
                    </div>
                  )}
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'logo')}
                      style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    />
                    <button type="button" className="btn-secondary" style={{ width: '100%', padding: '10px' }}>
                      Upload New Logo
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Site Favicon
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {settings.site_favicon ? (
                    <img src={settings.site_favicon} alt="Favicon" style={{ height: '32px', width: '32px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px', background: 'var(--surface-1)' }} />
                  ) : (
                    <div style={{ height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      -
                    </div>
                  )}
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="file"
                      accept="image/x-icon,image/png,image/jpeg"
                      onChange={(e) => handleFileUpload(e, 'favicon')}
                      style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    />
                    <button type="button" className="btn-secondary" style={{ width: '100%', padding: '10px' }}>
                      Upload Favicon
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTACT & SOCIAL SUB-TAB */}
        {activeSubTab === 'contact' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Contact Email
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={settings.contact_email || ''}
                  onChange={(e) => handleTextChange('contact_email', e.target.value)}
                  placeholder="contact@institute.com"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Contact Phone
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.contact_phone || ''}
                  onChange={(e) => handleTextChange('contact_phone', e.target.value)}
                  placeholder="+91 99999 99999"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Contact Address
              </label>
              <textarea
                className="form-input"
                style={{ height: '80px', resize: 'vertical' }}
                value={settings.contact_address || ''}
                onChange={(e) => handleTextChange('contact_address', e.target.value)}
                placeholder="123 Education Street, Delhi, India"
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Social Links</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Facebook URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.social_facebook || ''}
                    onChange={(e) => handleTextChange('social_facebook', e.target.value)}
                    placeholder="https://facebook.com/..."
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Twitter / X URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.social_twitter || ''}
                    onChange={(e) => handleTextChange('social_twitter', e.target.value)}
                    placeholder="https://twitter.com/..."
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Instagram URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.social_instagram || ''}
                    onChange={(e) => handleTextChange('social_instagram', e.target.value)}
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>YouTube Channel URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.social_youtube || ''}
                    onChange={(e) => handleTextChange('social_youtube', e.target.value)}
                    placeholder="https://youtube.com/c/..."
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Telegram Channel URL</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.social_telegram || ''}
                  onChange={(e) => handleTextChange('social_telegram', e.target.value)}
                  placeholder="https://t.me/..."
                />
              </div>
            </div>
          </div>
        )}

        {/* SEO & ANALYTICS SUB-TAB */}
        {activeSubTab === 'seo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Default SEO Title
              </label>
              <input
                type="text"
                className="form-input"
                value={settings.seo_title || ''}
                onChange={(e) => handleTextChange('seo_title', e.target.value)}
                placeholder="e.g. Academy - Best Mock Tests Platform"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Default SEO Meta Description
              </label>
              <textarea
                className="form-input"
                style={{ height: '80px', resize: 'vertical' }}
                value={settings.seo_description || ''}
                onChange={(e) => handleTextChange('seo_description', e.target.value)}
                placeholder="Brief summary of the website content for search engines..."
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tracking &amp; Analytics IDs</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Google Tag Manager (GTM) Container ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.gtm_container_id || ''}
                    onChange={(e) => handleTextChange('gtm_container_id', e.target.value)}
                    placeholder="GTM-XXXXXX"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Google Analytics 4 (GA4) Measurement ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.ga4_measurement_id || ''}
                    onChange={(e) => handleTextChange('ga4_measurement_id', e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Meta (Facebook) Pixel ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.meta_pixel_id || ''}
                  onChange={(e) => handleTextChange('meta_pixel_id', e.target.value)}
                  placeholder="123456789012345"
                />
              </div>
            </div>
          </div>
        )}

        {/* FEATURE TOGGLES SUB-TAB */}
        {activeSubTab === 'features' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Toggle Platforms Features</h3>
            <p style={{ margin: '-12px 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Enable or disable core system systems at the tenant level. Disabling toggles will hide all linked routes and action fields.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Payment Gateway Switch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Razorpay Online Payments</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Allow students to pay online for instant enrollment. When disabled, only manual Admin activations and activation codes are supported.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleChange('payment_gateway_enabled')}
                  style={{
                    position: 'relative',
                    width: '60px',
                    height: '32px',
                    background: (settings.payment_gateway_enabled === 'true' || settings.payment_gateway_enabled === true) ? 'var(--accent-color)' : 'var(--surface-3)',
                    border: 'none',
                    borderRadius: '32px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: (settings.payment_gateway_enabled === 'true' || settings.payment_gateway_enabled === true) ? '0 0 10px var(--accent-border)' : 'none',
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: (settings.payment_gateway_enabled === 'true' || settings.payment_gateway_enabled === true) ? '32px' : '4px',
                      width: '24px',
                      height: '24px',
                      background: '#ffffff',
                      borderRadius: '50%',
                      transition: 'all 0.3s ease',
                    }}
                  />
                </button>
              </div>

              {/* Social Login Switch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>OAuth Social Login (Google &amp; Facebook)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Enable social login option on the registration and login forms using Google and Facebook Socialite integrations.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleChange('social_login_enabled')}
                  style={{
                    position: 'relative',
                    width: '60px',
                    height: '32px',
                    background: (settings.social_login_enabled === 'true' || settings.social_login_enabled === true) ? 'var(--accent-color)' : 'var(--surface-3)',
                    border: 'none',
                    borderRadius: '32px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: (settings.social_login_enabled === 'true' || settings.social_login_enabled === true) ? '0 0 10px var(--accent-border)' : 'none',
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: (settings.social_login_enabled === 'true' || settings.social_login_enabled === true) ? '32px' : '4px',
                      width: '24px',
                      height: '24px',
                      background: '#ffffff',
                      borderRadius: '50%',
                      transition: 'all 0.3s ease',
                    }}
                  />
                </button>
              </div>

              {/* LMS Video Module Switch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>LMS Video Course Player</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Enable course LMS video playback features for students. If disabled, students will only see test-series details and analytics reports.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleChange('lms_video_enabled')}
                  style={{
                    position: 'relative',
                    width: '60px',
                    height: '32px',
                    background: (settings.lms_video_enabled === 'true' || settings.lms_video_enabled === true) ? 'var(--accent-color)' : 'var(--surface-3)',
                    border: 'none',
                    borderRadius: '32px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: (settings.lms_video_enabled === 'true' || settings.lms_video_enabled === true) ? '0 0 10px var(--accent-border)' : 'none',
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: (settings.lms_video_enabled === 'true' || settings.lms_video_enabled === true) ? '32px' : '4px',
                      width: '24px',
                      height: '24px',
                      background: '#ffffff',
                      borderRadius: '50%',
                      transition: 'all 0.3s ease',
                    }}
                  />
                </button>
              </div>

            </div>
          </div>
        )}

        <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ minWidth: '150px' }}
          >
            {saving ? '⏳ Saving...' : 'Save Settings'}
          </button>
        </div>

      </form>
    </div>
  );
}
