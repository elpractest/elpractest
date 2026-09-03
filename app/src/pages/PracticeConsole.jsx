import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';

/**
 * PRACTICE CONSOLE — build your own paper.
 *
 * The student picks a subject, topics, difficulty, a length and a clock; the
 * server draws from the questions their purchases give them access to and
 * generates a real test, which then runs on the same exam engine as a scheduled
 * mock.
 *
 * The console asks the server how many questions match BEFORE the student
 * commits, because the alternative — filling in a form and being told "not
 * enough questions" — reads as a broken feature rather than as "you don't own
 * that subject yet".
 */
export default function PracticeConsole() {
  const navigate = useNavigate();
  const { tint } = useTheme();

  const [options, setOptions] = useState(null);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  const [subject, setSubject] = useState('');
  const [topics, setTopics] = useState([]);
  const [difficulty, setDifficulty] = useState('');
  const [questionCount, setQuestionCount] = useState(20);
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [matching, setMatching] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/student/practice-tests/options'),
      api.get('/api/student/practice-tests'),
    ])
      .then(([opts, mine]) => {
        setOptions(opts.data);
        setPapers(mine.data?.data || []);
      })
      .catch(() => setError('Could not load the practice console.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  // Ask the server how many questions this spec would find. Debounced, because
  // it fires on every filter change.
  useEffect(() => {
    if (!options) return undefined;

    const timer = setTimeout(() => {
      api.post('/api/student/practice-tests/preview', {
        subject: subject || undefined,
        topics: topics.length ? topics : undefined,
        difficulty: difficulty || undefined,
      })
        .then((res) => setMatching(res.data.available))
        .catch(() => setMatching(null));
    }, 250);

    return () => clearTimeout(timer);
  }, [subject, topics, difficulty, options]);

  // Changing subject invalidates topic choices from the previous subject.
  useEffect(() => { setTopics([]); }, [subject]);

  const subjectTopics = (options?.topics || []).filter((t) => !subject || t.subject === subject);

  const toggleTopic = (topic) => {
    setTopics((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));
  };

  const build = async () => {
    setBuilding(true);
    setError('');
    try {
      const res = await api.post('/api/student/practice-tests', {
        subject: subject || undefined,
        topics: topics.length ? topics : undefined,
        difficulty: difficulty || undefined,
        question_count: Number(questionCount),
        duration_minutes: Number(durationMinutes),
      });

      const start = await api.post(`/api/student/tests/${res.data.test.id}/start`);
      navigate(`/tests/${start.data.session.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not build that paper.');
      setBuilding(false);
    }
  };

  const remove = async (id) => {
    await api.delete(`/api/student/practice-tests/${id}`).catch(() => {});
    load();
  };

  const tooFew = matching !== null && matching < Number(questionCount);
  const emptyPool = options && options.total_available === 0;

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ padding: '16px 18px 24px', animation: 'fade-in .35s ease both' }}>
      <h1 className="t-title" style={{ margin: '0 0 4px', color: 'var(--tx)' }}>
        Build a practice paper
      </h1>
      <p style={{ margin: '0 0 18px', font: '500 13px var(--font-body)', color: 'var(--muted)' }}>
        Pick what you want to drill and how long you have. Results stay private and never affect rankings.
      </p>

      {emptyPool ? (
        <div className="glass-panel" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          <span style={{ width: '52px', height: '52px', borderRadius: '15px', background: tint('gold').bg, color: tint('gold').c, display: 'grid', placeItems: 'center' }}>
            <Icon name="edit" size={22} />
          </span>
          <div style={{ font: '700 16px var(--font-display)', color: 'var(--tx)' }}>No questions available yet</div>
          <p style={{ margin: 0, maxWidth: '46ch', font: '500 13px/1.6 var(--font-body)', color: 'var(--muted)' }}>
            Practice papers are built from the courses and test series you have access to. Buy a series or redeem an activation code, and this console fills up.
          </p>
          <button onClick={() => navigate('/store')} className="btn-primary" style={{ marginTop: '4px', padding: '10px 18px', fontSize: '0.85rem' }}>
            Browse the store
          </button>
        </div>
      ) : (
        <>
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Subject */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ font: '700 11px var(--font-body)', color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Subject</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => setSubject('')} className={subject === '' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '7px 13px', fontSize: '0.78rem', borderRadius: '999px' }}>
                  All subjects
                </button>
                {(options?.subjects || []).map((s) => (
                  <button
                    key={s.subject}
                    onClick={() => setSubject(s.subject)}
                    className={subject === s.subject ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '7px 13px', fontSize: '0.78rem', borderRadius: '999px' }}
                  >
                    {s.subject} <span style={{ opacity: 0.65 }}>{s.total}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Topics — only once a subject narrows the list to something usable */}
            {subject && subjectTopics.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ font: '700 11px var(--font-body)', color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  Topics <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {subjectTopics.map((t) => (
                    <button
                      key={t.topic}
                      onClick={() => toggleTopic(t.topic)}
                      className={topics.includes(t.topic) ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 12px', fontSize: '0.76rem', borderRadius: '999px' }}
                    >
                      {t.topic} <span style={{ opacity: 0.65 }}>{t.total}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Difficulty */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ font: '700 11px var(--font-body)', color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Difficulty</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[{ k: '', l: 'Any' }, { k: 'easy', l: 'Easy' }, { k: 'medium', l: 'Medium' }, { k: 'hard', l: 'Hard' }].map((d) => (
                  <button
                    key={d.k || 'any'}
                    onClick={() => setDifficulty(d.k)}
                    className={difficulty === d.k ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '7px 13px', fontSize: '0.78rem', borderRadius: '999px' }}
                  >
                    {d.l}
                    {d.k && options?.difficulty_counts?.[d.k] ? <span style={{ opacity: 0.65 }}> {options.difficulty_counts[d.k]}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            {/* Length and clock */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ font: '700 11px var(--font-body)', color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  Questions — <span style={{ color: 'var(--tx)' }}>{questionCount}</span>
                </label>
                <input
                  type="range"
                  min={options?.limits?.min_questions ?? 5}
                  max={options?.limits?.max_questions ?? 100}
                  step={5}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ font: '700 11px var(--font-body)', color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  Time — <span style={{ color: 'var(--tx)' }}>{durationMinutes} min</span>
                </label>
                <input
                  type="range"
                  min={options?.limits?.min_minutes ?? 1}
                  max={options?.limits?.max_minutes ?? 180}
                  step={5}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ font: '500 12.5px var(--font-body)', color: tooFew ? tint('red').c : 'var(--muted)' }}>
                {matching === null
                  ? 'Counting…'
                  : tooFew
                    ? `Only ${matching} question${matching === 1 ? '' : 's'} match — shorten the paper or widen the filters.`
                    : `${matching} question${matching === 1 ? '' : 's'} available · about ${(durationMinutes * 60 / questionCount).toFixed(0)}s each`}
              </div>

              <button
                onClick={build}
                disabled={building || tooFew || matching === null}
                className="btn-primary"
                style={{ padding: '11px 22px', fontSize: '0.86rem', opacity: (building || tooFew) ? 0.55 : 1 }}
              >
                {building ? 'Building…' : 'Start practice'}
              </button>
            </div>

            {error && (
              <div style={{ font: '500 12.5px var(--font-body)', color: tint('red').c }}>{error}</div>
            )}
          </div>

          {papers.length > 0 && (
            <>
              <h2 style={{ margin: '26px 0 12px', font: '700 16px var(--font-display)', color: 'var(--tx)' }}>Your practice papers</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {papers.map((paper) => (
                  <div key={paper.id} className="glass-panel" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ font: '600 13.5px var(--font-body)', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {paper.title}
                      </div>
                      <div style={{ font: '500 11px var(--font-body)', color: 'var(--muted)' }}>
                        {Math.round(paper.duration_seconds / 60)} min
                        {paper.sessions_count > 0 && ` · attempted ${paper.sessions_count}×`}
                      </div>
                    </div>
                    <button onClick={() => remove(paper.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', flex: 'none' }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
