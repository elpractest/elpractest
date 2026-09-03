import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import Icon from '../Icon';
import { setStudyTab } from '../../lib/readerStore';
import { HIGHLIGHT_SWATCHES, highlightColor, highlightLabel } from './palette';

/**
 * THE STUDY DRAWER — one right-hand surface with two tabs: the marks the
 * student has made, and the conversation about them.
 *
 * They are tabs rather than two drawers because they compete for exactly
 * the same slot on the screen and are used in the same breath: you
 * highlight a paragraph, then you ask what it means. Two independent
 * overlays in one slot means opening either closes the other, which is
 * the behaviour of tabs with none of the affordance.
 *
 * Vajini here is the same companion as /vajini and the same endpoint. It
 * is given the passage and the page as context so "explain this" has a
 * referent — the chat on its own page cannot know what "this" is.
 */
export default function StudyDrawer({
  open,
  tab,
  annotations,
  currentPage,
  materialTitle,
  seedQuestion,
  onSeedUsed,
  onGoTo,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onClose,
}) {
  const { t } = useTranslation();

  return (
    <aside
      className={`rd-panel rd-panel-right${open ? ' is-open' : ''}`}
      aria-label={t('reader.study')}
      aria-hidden={!open}
      inert={!open}
    >
      <header className="rd-panel-head">
        <h2 className="rd-panel-title">
          <Icon name="bookmark" size={18} /> {t('reader.study')}
        </h2>
        <button type="button" className="rd-icon-btn" onClick={onClose} aria-label={t('reader.close')}>
          <Icon name="x" size={18} />
        </button>
      </header>

      <div className="rd-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notes'}
          className={`rd-tab${tab === 'notes' ? ' is-active' : ''}`}
          onClick={() => setStudyTab('notes')}
        >
          <Icon name="file-text" size={15} />
          <span>{t('reader.myMarks')}</span>
          {annotations.length > 0 && <span className="rd-tab-count">{annotations.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'vajini'}
          className={`rd-tab${tab === 'vajini' ? ' is-active' : ''}`}
          onClick={() => setStudyTab('vajini')}
        >
          <Icon name="sparkles" size={15} />
          <span>{t('vajini.name')}</span>
        </button>
      </div>

      {tab === 'notes' ? (
        <MarksList
          annotations={annotations}
          onGoTo={onGoTo}
          onUpdate={onUpdateAnnotation}
          onDelete={onDeleteAnnotation}
        />
      ) : (
        <VajiniTab
          active={open && tab === 'vajini'}
          currentPage={currentPage}
          materialTitle={materialTitle}
          seedQuestion={seedQuestion}
          onSeedUsed={onSeedUsed}
        />
      )}
    </aside>
  );
}

/* ── Marks ── */

function MarksList({ annotations, onGoTo, onUpdate, onDelete }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');

  if (annotations.length === 0) {
    return (
      <div className="rd-panel-body">
        <div className="rd-empty">
          <span className="rd-empty-glyph"><Icon name="edit" size={22} /></span>
          <p className="rd-empty-title">{t('reader.noMarksTitle')}</p>
          <p className="rd-empty-body">{t('reader.noMarksBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rd-panel-body rd-panel-body-pad">
      <ul className="rd-marks-list">
        {annotations.map((a) => (
          <li key={a.id} className="rd-mark-card" style={{ borderLeftColor: highlightColor(a.color) }}>
            <div className="rd-mark-head">
              <button type="button" className="rd-mark-page" onClick={() => onGoTo(a.page)}>
                {t('reader.pageN', { n: a.page })}
              </button>
              <div className="rd-mark-actions">
                {/* Recolour in place. A student who highlighted three
                    themes in one colour by accident should not have to
                    delete and re-select the passage to fix it. */}
                {HIGHLIGHT_SWATCHES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`rd-mini-swatch${a.color === s.value ? ' is-active' : ''}`}
                    style={{ background: s.light }}
                    aria-label={t('reader.recolourTo', { colour: highlightLabel(s.value) })}
                    onClick={() => onUpdate(a.id, { color: s.value })}
                  />
                ))}
                <button
                  type="button"
                  className="rd-icon-btn rd-icon-btn-sm"
                  onClick={() => onDelete(a.id)}
                  aria-label={t('reader.deleteMark')}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>

            {a.selected_text && <blockquote className="rd-mark-quote">{a.selected_text}</blockquote>}

            {editing === a.id ? (
              <div className="rd-note-edit">
                <textarea
                  className="form-input"
                  rows={3}
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('reader.notePlaceholder')}
                />
                <div className="rd-note-edit-actions">
                  <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                    {t('reader.cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => { onUpdate(a.id, { note: draft }); setEditing(null); }}
                  >
                    {t('reader.save')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="rd-note-body"
                onClick={() => { setEditing(a.id); setDraft(a.note || ''); }}
              >
                {a.note
                  ? <span>{a.note}</span>
                  : <span className="rd-note-add"><Icon name="plus" size={14} /> {t('reader.addNote')}</span>}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Vajini ── */

function VajiniTab({ active, currentPage, materialTitle, seedQuestion, onSeedUsed }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([{ role: 'assistant', content: t('reader.vajiniHello') }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    const history = messages
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/api/student/vajini/chat', { message, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, sources: data.sources || [] }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('vajini.error'), error: true }]);
    } finally {
      setLoading(false);
    }
  };

  /* A passage sent over from the selection sheet is asked immediately —
     the student already expressed the intent by tapping "Ask Vajini", and
     making them press send again for a question they did not type is a
     step that buys nothing. The page and the booklet ride along so the
     model has a referent for "this". */
  useEffect(() => {
    if (!active || !seedQuestion) return;
    send(t('reader.vajiniPassagePrompt', {
      title: materialTitle,
      page: currentPage,
      passage: seedQuestion,
    }));
    onSeedUsed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, seedQuestion]);

  return (
    <>
      <div className="rd-panel-body rd-chat" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`rd-bubble rd-bubble-${m.role}${m.error ? ' is-error' : ''}`}>
            {m.content}
            {m.sources?.length > 0 && (
              <div className="rd-sources">
                <span className="t-overline">{t('vajini.sources')}</span>
                {m.sources.map((s, j) => <span key={j} className="chip">{s.title}</span>)}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="rd-bubble rd-bubble-assistant is-thinking">{t('vajini.thinking')}</div>}
      </div>

      <div className="rd-composer">
        <textarea
          className="form-input"
          rows={2}
          value={input}
          placeholder={t('reader.askAboutPage', { n: currentPage })}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <button
          type="button"
          className="btn-ai rd-send"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          aria-label={t('reader.send')}
        >
          <Icon name="send" size={17} />
        </button>
      </div>
      <p className="rd-hint rd-disclaimer">{t('vajini.disclaimer')}</p>
    </>
  );
}
