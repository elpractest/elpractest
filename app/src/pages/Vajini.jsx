import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import api from '../api';

/**
 * VAJINI — the AI study companion. Chat over course content (RAG): the composer
 * posts to `POST /api/student/vajini/chat`, which retrieves the most relevant
 * course/question chunks and asks OpenAI to answer from them. The reply carries
 * the sources it drew on, shown as chips under the bubble.
 *
 * Degrades honestly: a 503 (Vajini not configured / upstream down) surfaces as
 * an error bubble, not a crash.
 */
export default function Vajini() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [messages, setMessages] = useState([
    { role: 'assistant', content: t('vajini.hello') },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const message = input.trim();
    if (!message || loading) return;

    // The turns we send as context: real exchanges only, no error bubbles.
    const history = messages
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/api/student/vajini/chat', { message, history });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, sources: data.sources || [] },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('vajini.error'), error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const botAvatar = (
    <span
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '10px',
        background: 'var(--ai)',
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--on-ai)',
      }}
    >
      <Icon name="bot" size={16} strokeWidth={2.2} />
    </span>
  );

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--tx)' }}>
      {/* header — the AI accent identifies Vajini; the surface is the app's own */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: 'max(env(safe-area-inset-top), 14px) 16px 12px',
          background: 'var(--card)',
          borderBottom: '1px solid var(--line)',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label={t('common.back')}
          className="chrome-btn"
        >
          <Icon name="arrow-left" size={19} />
        </button>

        <span
          style={{
            width: '40px',
            height: '40px',
            flex: 'none',
            borderRadius: '13px',
            background: 'var(--ai)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--on-ai)',
          }}
        >
          <Icon name="bot" size={22} strokeWidth={2} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '700 16px var(--font-display)', letterSpacing: '-.025em', color: 'var(--tx)' }}>
            {t('vajini.name')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '500 11.5px var(--font-body)', color: 'var(--muted)' }}>
            <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
            {t('vajini.status')}
          </div>
        </div>
      </div>

      {/* conversation */}
      <div
        ref={scrollRef}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  maxWidth: '82%',
                  padding: '12px 15px',
                  borderRadius: '18px 18px 5px 18px',
                  background: 'var(--ai)',
                  color: 'var(--on-ai)',
                  font: '400 14px/1.55 var(--font-body)',
                }}
              >
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} style={{ display: 'flex', gap: '9px', alignItems: 'flex-end' }}>
              {botAvatar}
              <div style={{ maxWidth: '82%', minWidth: 0 }}>
                <div
                  style={{
                    padding: '13px 15px',
                    borderRadius: '18px 18px 18px 5px',
                    background: m.error ? 'var(--danger-bg)' : 'var(--card)',
                    border: `1px solid ${m.error ? 'var(--danger-border)' : 'var(--line)'}`,
                    color: m.error ? 'var(--danger)' : 'var(--tx)',
                    font: '400 14px/1.6 var(--font-body)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.content}
                </div>
                {m.sources?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
                    <span className="t-overline" style={{ fontSize: '9px', color: 'var(--muted)' }}>
                      {t('vajini.sources')}
                    </span>
                    {m.sources.map((src, j) => (
                      <span
                        key={j}
                        style={{
                          font: '600 11px var(--font-body)',
                          color: 'var(--ai)',
                          background: 'var(--ai-bg)',
                          padding: '4px 10px',
                          borderRadius: '999px',
                        }}
                      >
                        {src.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {loading && (
          <div style={{ display: 'flex', gap: '9px', alignItems: 'flex-end' }}>
            {botAvatar}
            <div
              style={{
                padding: '13px 15px',
                borderRadius: '18px 18px 18px 5px',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                font: '400 13.5px var(--font-body)',
                color: 'var(--muted)',
              }}
            >
              {t('vajini.thinking')}
            </div>
          </div>
        )}
      </div>

      {/* composer */}
      <div
        style={{
          flex: 'none',
          padding: '10px 14px calc(14px + env(safe-area-inset-bottom, 8px))',
          background: 'var(--card)',
          borderTop: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('vajini.placeholder')}
            aria-label={t('vajini.placeholder')}
            className="form-input"
            style={{ flex: 1, minHeight: '48px' }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            aria-label="Send"
            style={{
              width: '48px',
              height: '48px',
              flex: 'none',
              borderRadius: '14px',
              border: 'none',
              background: 'var(--ai)',
              opacity: loading || !input.trim() ? 0.5 : 1,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--on-ai)',
            }}
          >
            <Icon name="send" size={20} />
          </button>
        </div>
        <div style={{ textAlign: 'center', font: '400 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '10px' }}>
          {t('vajini.disclaimer')}
        </div>
      </div>
    </div>
  );
}
