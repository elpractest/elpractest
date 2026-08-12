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
    <span style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--grad-violet)', flex: 'none', display: 'grid', placeItems: 'center', color: '#fff' }}>
      <Icon name="bot" size={16} strokeWidth={2.2} />
    </span>
  );

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#ECE9FB 0%,#E7EEFF 60%,#E9F0FF 100%)', color: '#1e1b3a' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'max(env(safe-area-inset-top),16px) 16px 14px', background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(59,111,246,.12)', position: 'sticky', top: 0, zIndex: 2 }}>
        <button onClick={() => navigate(-1)} aria-label={t('common.back')} style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.2)', color: '#6d28d9', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <Icon name="arrow-left" size={20} />
        </button>
        <span style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'var(--grad-violet)', display: 'grid', placeItems: 'center', color: '#fff' }}>
          <Icon name="bot" size={24} strokeWidth={2} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ font: '800 16px var(--font-display)', color: '#1e1b3a' }}>{t('vajini.name')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', font: '600 11px var(--font-body)', color: '#6d28d9' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0b9e6d' }} /> {t('vajini.status')}
          </div>
        </div>
      </div>

      {/* conversation */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ maxWidth: '82%', padding: '12px 15px', borderRadius: '18px 18px 5px 18px', background: 'var(--grad-violet)', color: '#fff', font: '600 14px/1.5 var(--font-body)', boxShadow: '0 6px 18px -10px rgba(139,92,246,.6)' }}>
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} style={{ display: 'flex', gap: '9px', alignItems: 'flex-end' }}>
              {botAvatar}
              <div style={{ maxWidth: '82%' }}>
                <div style={{ padding: '13px 15px', borderRadius: '18px 18px 18px 5px', background: m.error ? '#FEF2F2' : '#fff', color: m.error ? '#b42318' : '#1e1b3a', font: '600 14px/1.5 var(--font-body)', whiteSpace: 'pre-wrap', boxShadow: '0 6px 18px -10px rgba(59,111,246,.4)' }}>
                  {m.content}
                </div>
                {m.sources?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '7px', alignItems: 'center' }}>
                    <span style={{ font: '700 10px var(--font-body)', color: '#7c7aa8', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('vajini.sources')}</span>
                    {m.sources.map((s, j) => (
                      <span key={j} style={{ font: '600 11px var(--font-body)', color: '#6d28d9', background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.2)', padding: '3px 9px', borderRadius: '999px' }}>
                        {s.title}
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
            <div style={{ padding: '13px 15px', borderRadius: '18px 18px 18px 5px', background: '#fff', font: '600 13px var(--font-body)', color: '#7c7aa8', boxShadow: '0 6px 18px -10px rgba(59,111,246,.4)' }}>
              {t('vajini.thinking')}
            </div>
          </div>
        )}
      </div>

      {/* composer */}
      <div style={{ padding: '10px 14px calc(16px + env(safe-area-inset-bottom,8px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '16px', background: '#fff', boxShadow: '0 6px 18px -12px rgba(59,111,246,.5)' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t('vajini.placeholder')}
              aria-label={t('vajini.placeholder')}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', font: '600 14px var(--font-body)', color: '#1e1b3a' }}
            />
          </div>
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            aria-label="Send"
            style={{ width: '48px', height: '48px', flex: 'none', borderRadius: '16px', border: 'none', background: 'var(--grad-violet)', opacity: loading || !input.trim() ? 0.55 : 1, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center', color: '#fff' }}
          >
            <Icon name="send" size={21} />
          </button>
        </div>
        <div style={{ textAlign: 'center', font: '600 11px var(--font-body)', color: '#7c7aa8', marginTop: '10px' }}>
          {t('vajini.disclaimer')}
        </div>
      </div>
    </div>
  );
}
