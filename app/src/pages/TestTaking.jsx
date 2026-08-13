import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import katex from 'katex';
import api from '../api';
import Icon from '../components/Icon';
import { buildDemoQuestions } from '../lib/demoData';

// Math Renderer helper to parse inline ($...$) and block ($$...$$) LaTeX equations
const MathRenderer = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2);
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch (e) {
            return <span key={index}>{math}</span>;
          }
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch (e) {
            return <span key={index}>{math}</span>;
          }
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default function TestTaking() {
  const { session: sessionId } = useParams();
  const navigate = useNavigate();

  // Demo mode: reachable via "Free test" / "Attempt free". Renders the CBT
  // reference against local demo questions with NO backend calls. The real
  // server-authoritative engine below is untouched for any real session id.
  const isDemo = sessionId === 'demo';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Test structures
  const [session, setSession] = useState(null);
  const [sections, setSections] = useState([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Interactive timers (in seconds)
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [sectionTimeRemaining, setSectionTimeRemaining] = useState(null);

  // Status states
  const [palette, setPalette] = useState({}); // { question_id: 'status' }
  const [answers, setAnswers] = useState({}); // { question_id: selected_option_id }
  const [markedForReview, setMarkedForReview] = useState({}); // { question_id: boolean }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Keep track of active question start time for calculating time spent
  const questionStartTime = useRef(Date.now());
  const [timeSpentOnCurrentQuestion, setTimeSpentOnCurrentQuestion] = useState(0);

  // Prevent duplicate double-clicks within 300ms
  const lastSaveTime = useRef(0);

  // Build a synthetic session from demo questions (no backend).
  const buildDemoSession = () => {
    const dq = buildDemoQuestions(20);
    const demoSection = {
      id: 'demo-sec', title: 'Full Mock', duration_seconds: 0,
      questions: dq.map((q, i) => ({
        id: `dq-${i}`, marks: 2, negative_marks: 0.5, question_text: q.text,
        section: q.sec,
        options: q.opts.map((t, j) => ({ id: `dq-${i}-o${j}`, label: 'ABCD'[j], option_text: t })),
      })),
    };
    setSession({ test_title: 'Free Practest Scholarship Test', current_section_index: 0, time_remaining_seconds: 1800, section_time_remaining_seconds: null });
    setSections([demoSection]);
    setCurrentSectionIndex(0);
    setTimeRemaining(1800);
    setSectionTimeRemaining(null);
    setAnswers({});
    setMarkedForReview({});
    setCurrentQuestionIndex(0);
    setPalette({ 'dq-0': 'not_answered' });
    setLoading(false);
  };

  // Fetch session details and resume state
  const fetchSessionState = async (showProgressLoader = false) => {
    if (isDemo) { buildDemoSession(); return; }
    if (showProgressLoader) setAutoAdvancing(true);
    try {
      const res = await api.get(`/api/student/tests/sessions/${sessionId}`);
      const data = res.data;

      setSession(data.session);
      setSections(data.sections || []);
      setCurrentSectionIndex(data.session.current_section_index);

      setTimeRemaining(data.session.time_remaining_seconds);
      setSectionTimeRemaining(data.session.section_time_remaining_seconds);

      // Map answers to local state
      const initialAnswers = {};
      const initialMarked = {};

      if (data.answers) {
        data.answers.forEach((ans) => {
          initialAnswers[ans.question_id] = ans.selected_option_id;
          initialMarked[ans.question_id] = !!ans.is_marked_for_review;
        });
      }
      setAnswers(initialAnswers);
      setMarkedForReview(initialMarked);

      // Initialize question pointer to the first question of the current section
      setCurrentQuestionIndex(0);
      questionStartTime.current = Date.now();
      setTimeSpentOnCurrentQuestion(0);

      // Load palette status
      await refreshPalette();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resume test session.');
    } finally {
      setLoading(false);
      setAutoAdvancing(false);
    }
  };

  // Fetch latest question palette status
  const refreshPalette = async () => {
    if (isDemo) return;
    try {
      const res = await api.get(`/api/student/tests/sessions/${sessionId}/palette`);
      const palList = res.data.palette || [];
      const palMap = {};
      palList.forEach((item) => {
        palMap[item.question_id] = item.status;
      });
      setPalette(palMap);
    } catch (e) {
      // ignore
    }
  };

  // Mount/resume hook
  useEffect(() => {
    fetchSessionState();
  }, [sessionId]);

  // Timer interval hook
  useEffect(() => {
    if (loading || isSubmitting || autoAdvancing || timeRemaining === null) return;

    const timer = setInterval(() => {
      // 1. Tick timers down
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });

      // 2. Track question timer
      setTimeSpentOnCurrentQuestion((prev) => prev + 1);

      // 3. Sectional timer handling
      if (sectionTimeRemaining !== null) {
        setSectionTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSectionExpiry();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, isSubmitting, autoAdvancing, timeRemaining, sectionTimeRemaining]);

  // Self-healing section transition
  const handleSectionExpiry = async () => {
    setAutoAdvancing(true);
    try {
      // Fetch session state which automatically reconciles and heals the timing boundaries on the backend
      await fetchSessionState(false);
    } catch (e) {
      setError('Section timing reconciliation failed. Please refresh.');
    } finally {
      setAutoAdvancing(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (isDemo) { navigate('/tests/demo/result'); return; }
    setIsSubmitting(true);
    try {
      await api.post(`/api/student/tests/sessions/${sessionId}/submit`);
      navigate(`/tests/${sessionId}/result`);
    } catch (err) {
      setError('Failed to auto-submit expired session. Please refresh to view scorecard.');
    }
  };

  const handleManualSubmit = async () => {
    if (isDemo) { navigate('/tests/demo/result'); return; }
    setIsSubmitting(true);
    try {
      await api.post(`/api/student/tests/sessions/${sessionId}/submit`);
      navigate(`/tests/${sessionId}/result`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit test. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Get current active question & section details
  const activeSection = sections[currentSectionIndex];
  const activeQuestion = activeSection?.questions?.[currentQuestionIndex];

  // Visit a question: triggers visit endpoint and updates palette locally
  const markQuestionVisited = async (questionId) => {
    if (!palette[questionId] || palette[questionId] === 'not_visited') {
      // Update locally immediately to keep UX snappy
      setPalette((prev) => ({ ...prev, [questionId]: 'not_answered' }));
      if (isDemo) return;
      try {
        await api.put(`/api/student/tests/sessions/${sessionId}/answers/${questionId}/visit`);
      } catch (e) {
        // ignore network drop, backend will heal on next action
      }
    }
  };

  // Trigger visit whenever active question changes
  useEffect(() => {
    if (activeQuestion) {
      markQuestionVisited(activeQuestion.id);
      questionStartTime.current = Date.now();
      setTimeSpentOnCurrentQuestion(0);
    }
  }, [currentSectionIndex, currentQuestionIndex, activeQuestion?.id]);

  // Navigate Questions (snappy, checks visited state)
  const navigateToQuestion = (sectionIdx, questionIdx) => {
    if (sectionIdx !== currentSectionIndex) {
      // Sectional timing mode restriction checks
      const hasSectionalTiming = sections.some(s => s.duration_seconds > 0);
      if (hasSectionalTiming && sectionIdx !== session.current_section_index) {
        return; // locked
      }
      setCurrentSectionIndex(sectionIdx);
    }
    setCurrentQuestionIndex(questionIdx);
  };

  // Instant Option Selection & Auto-Save
  const selectOption = async (optionId) => {
    const nowTime = Date.now();
    if (nowTime - lastSaveTime.current < 300) return; // double-click protection
    lastSaveTime.current = nowTime;

    const questionId = activeQuestion.id;

    // Snappy local UI update
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    setPalette((prev) => {
      const isMarked = markedForReview[questionId];
      return {
        ...prev,
        [questionId]: isMarked ? 'answered_and_marked' : 'answered'
      };
    });

    if (isDemo) return;
    try {
      await api.put(`/api/student/tests/sessions/${sessionId}/answers/${questionId}`, {
        selected_option_id: optionId,
        time_spent_seconds: timeSpentOnCurrentQuestion,
      });
    } catch (err) {
      setError('Failed to save answer. Please check connection.');
    }
  };

  // Clear selected MCQ option
  const clearResponse = async () => {
    const questionId = activeQuestion.id;

    setAnswers((prev) => ({ ...prev, [questionId]: null }));
    setPalette((prev) => {
      const isMarked = markedForReview[questionId];
      return {
        ...prev,
        [questionId]: isMarked ? 'marked_for_review' : 'not_answered'
      };
    });

    if (isDemo) return;
    try {
      await api.put(`/api/student/tests/sessions/${sessionId}/answers/${questionId}`, {
        selected_option_id: null,
        time_spent_seconds: timeSpentOnCurrentQuestion,
      });
    } catch (err) {
      setError('Failed to clear answer.');
    }
  };

  // Toggle Mark for Review
  const toggleMarkForReview = async () => {
    const questionId = activeQuestion.id;
    const nextMarkedState = !markedForReview[questionId];

    setMarkedForReview((prev) => ({ ...prev, [questionId]: nextMarkedState }));
    setPalette((prev) => {
      const hasAnswer = !!answers[questionId];
      if (nextMarkedState) {
        return { ...prev, [questionId]: hasAnswer ? 'answered_and_marked' : 'marked_for_review' };
      } else {
        return { ...prev, [questionId]: hasAnswer ? 'answered' : 'not_answered' };
      }
    });

    if (isDemo) return;
    try {
      await api.put(`/api/student/tests/sessions/${sessionId}/answers/${questionId}/review`);
    } catch (err) {
      setError('Failed to toggle review state.');
    }
  };

  // Save & Next button
  const handleSaveAndNext = () => {
    if (currentQuestionIndex < activeSection.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Check if there's a next section, and if sectional timing allows
      const hasSectionalTiming = sections.some(s => s.duration_seconds > 0);
      if (!hasSectionalTiming && currentSectionIndex < sections.length - 1) {
        setCurrentSectionIndex((prev) => prev + 1);
        setCurrentQuestionIndex(0);
      } else {
        // Last question of test or section, prompt submission
        setShowSubmitConfirm(true);
      }
    }
  };

  // Section manual advancement
  const handleAdvanceSection = async () => {
    setAutoAdvancing(true);
    try {
      await api.post(`/api/student/tests/sessions/${sessionId}/advance-section`);
      await fetchSessionState(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to advance section.');
    } finally {
      setAutoAdvancing(false);
    }
  };

  // Format seconds to HH:MM:SS
  const formatTime = (secs) => {
    if (secs === null || secs === undefined) return '00:00';
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return [
      hours > 0 ? String(hours).padStart(2, '0') : null,
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0'),
    ].filter(Boolean).join(':');
  };

  if (loading) {
    return (
      <div className="cbt-root" style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (autoAdvancing) {
    return (
      <div className="cbt-root" style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '14px' }}>
        <div style={{ color: '#F5A623', fontSize: '1.15rem', fontWeight: 800 }}>Section time expired</div>
        <div style={{ color: '#5A6A85' }}>Auto-advancing to the next section…</div>
      </div>
    );
  }

  // ---- palette legend counts (across the whole test) ----
  const allQuestions = sections.flatMap((s) => s.questions || []);
  const statusOf = (qid) => palette[qid] || 'not_visited';
  const cAnswered = allQuestions.filter((q) => ['answered', 'answered_and_marked'].includes(statusOf(q.id))).length;
  const cMarked = allQuestions.filter((q) => ['marked_for_review', 'answered_and_marked'].includes(statusOf(q.id))).length;
  const cNotVisited = allQuestions.filter((q) => statusOf(q.id) === 'not_visited').length;
  const cNotAnswered = allQuestions.filter((q) => statusOf(q.id) === 'not_answered').length;

  const clockLow = timeRemaining !== null && timeRemaining < 300;

  return (
    <div className="cbt-root" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* ---- Deep header: title + section + clock ---- */}
      <div style={{ flex: 'none', padding: 'max(env(safe-area-inset-top),18px) 16px 12px', background: 'linear-gradient(180deg,#12203A,#16264A)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 14px var(--font-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.test_title || 'Mock Test'}</div>
            <div style={{ font: '600 11px var(--font-body)', color: '#9AB0E0', marginTop: '2px' }}>{activeQuestion?.section || activeSection?.title}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 12px', borderRadius: '11px', background: clockLow ? 'rgba(229,72,77,.18)' : 'rgba(255,255,255,.1)', border: `1px solid ${clockLow ? 'rgba(251,143,146,.5)' : 'rgba(255,255,255,.18)'}` }}>
            <Icon name="clock" size={15} style={{ color: clockLow ? '#FFB4B6' : '#DCE6FF' }} />
            <span style={{ font: '800 15px var(--font-mono)', color: clockLow ? '#FFB4B6' : '#DCE6FF', letterSpacing: '.04em' }}>{formatTime(timeRemaining)}</span>
          </div>
        </div>
        {sectionTimeRemaining !== null && (
          <div style={{ marginTop: '8px', font: '700 11px var(--font-body)', color: sectionTimeRemaining < 60 ? '#FFB4B6' : '#9AB0E0' }}>
            Section time: <span style={{ fontFamily: 'var(--font-mono)' }}>{formatTime(sectionTimeRemaining)}</span>
          </div>
        )}
      </div>

      {/* ---- Section tabs ---- */}
      {sections.length > 1 && (
        <div style={{ flex: 'none', display: 'flex', gap: '8px', overflowX: 'auto', padding: '11px 16px', background: '#fff', borderBottom: '1px solid #E2E7F0' }}>
          {sections.map((section, idx) => {
            const isCurrent = idx === currentSectionIndex;
            const hasSectionalTiming = sections.some((s) => s.duration_seconds > 0);
            const isLocked = hasSectionalTiming && idx !== session.current_section_index;
            return (
              <span key={section.id} onClick={() => !isLocked && navigateToQuestion(idx, 0)}
                style={{ flex: 'none', padding: '8px 15px', borderRadius: '999px', font: '700 12px var(--font-body)', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1, color: isCurrent ? '#fff' : '#5A6A85', background: isCurrent ? '#12203A' : '#F0F3F8' }}>
                {section.title}{isLocked ? ' 🔒' : ''}
              </span>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ flex: 'none', margin: '10px 16px 0', background: 'rgba(229,72,77,.1)', border: '1px solid rgba(217,45,51,.3)', padding: '10px 14px', borderRadius: '10px', color: '#CB2F37', fontSize: '0.85rem' }}>{error}</div>
      )}

      {/* ---- Scroll body ---- */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px' }}>
        {activeQuestion ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ font: '800 15px var(--font-display)', color: '#12203A' }}>
                Question {currentQuestionIndex + 1} <span style={{ color: '#93A0B5', fontWeight: 600 }}>/ {activeSection.questions.length}</span>
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ font: '800 11px var(--font-mono)', color: '#0B9E6D', background: 'rgba(11,158,109,.12)', padding: '4px 9px', borderRadius: '8px' }}>+{activeQuestion.marks}</span>
                <span style={{ font: '800 11px var(--font-mono)', color: '#D92D33', background: 'rgba(217,45,51,.1)', padding: '4px 9px', borderRadius: '8px' }}>−{activeQuestion.negative_marks}</span>
              </div>
            </div>

            {/* Question card */}
            <div style={{ padding: '16px', borderRadius: '16px', background: '#fff', border: '1px solid #E2E7F0', boxShadow: '0 6px 20px -12px rgba(18,32,58,.25)' }}>
              <div style={{ font: '600 15.5px/1.5 var(--font-body)', color: '#1A2233', margin: '0 0 16px' }}>
                <MathRenderer text={activeQuestion.question_text} />
              </div>
              {activeQuestion.options?.map((option) => {
                const isSelected = answers[activeQuestion.id] === option.id;
                return (
                  <div key={option.id} onClick={() => selectOption(option.id)} className={`mcq-option ${isSelected ? 'selected' : ''}`}>
                    <span className="option-badge">{option.label}</span>
                    <span style={{ fontSize: '14.5px' }}><MathRenderer text={option.option_text} /></span>
                  </div>
                );
              })}
            </div>

            {/* Legend + palette */}
            <div style={{ marginTop: '16px', padding: '15px', borderRadius: '16px', background: '#fff', border: '1px solid #E2E7F0' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 16px' }}>
                {[['#0ea371', 'Answered', cAnswered], ['#e5484d', 'Not answered', cNotAnswered], ['#8b5cf6', 'Marked', cMarked], ['#64748b', 'Not visited', cNotVisited]].map(([c, label, n]) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '700 11px var(--font-body)', color: '#5A6A85' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: c }} />{label} {n}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '9px', marginTop: '14px' }}>
                {activeSection?.questions?.map((q, idx) => {
                  const qStatus = statusOf(q.id);
                  const isActive = idx === currentQuestionIndex;
                  return (
                    <button key={q.id} onClick={() => navigateToQuestion(currentSectionIndex, idx)} className={`palette-btn ${qStatus} ${isActive ? 'active' : ''}`}>
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div style={{ color: '#5A6A85' }}>No questions available.</div>
        )}
      </div>

      {/* ---- Bottom action bar ---- */}
      <div style={{ flex: 'none', display: 'flex', gap: '8px', padding: '12px 14px calc(14px + env(safe-area-inset-bottom,8px))', background: '#fff', borderTop: '1px solid #E2E7F0' }}>
        <button onClick={toggleMarkForReview} style={{ flex: 'none', padding: '13px 12px', border: '1px solid #C9D2E0', borderRadius: '12px', background: markedForReview[activeQuestion?.id] ? 'rgba(139,92,246,.1)' : '#fff', color: markedForReview[activeQuestion?.id] ? '#6A34DE' : '#5A6A85', font: '700 12px var(--font-body)', cursor: 'pointer' }}>
          {markedForReview[activeQuestion?.id] ? 'Unmark' : 'Mark'}
        </button>
        <button onClick={clearResponse} style={{ flex: 'none', padding: '13px 12px', border: '1px solid #C9D2E0', borderRadius: '12px', background: '#fff', color: '#5A6A85', font: '700 12px var(--font-body)', cursor: 'pointer' }}>Clear</button>
        {(() => {
          const isLastQuestionOfSection = currentQuestionIndex === activeSection?.questions?.length - 1;
          const hasSectionalTiming = sections.some((s) => s.duration_seconds > 0);
          const isNotLastSection = currentSectionIndex < sections.length - 1;
          if (isLastQuestionOfSection && hasSectionalTiming && isNotLastSection) {
            return <button onClick={handleAdvanceSection} style={{ flex: 1, padding: '13px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg,#FFC968,#F5A623 55%,#E07C0A)', color: '#1A1206', font: '800 14px var(--font-display)', cursor: 'pointer' }}>Submit Section</button>;
          }
          return <button onClick={handleSaveAndNext} style={{ flex: 1, padding: '13px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg,#FFC968,#F5A623 55%,#E07C0A)', color: '#1A1206', font: '800 14px var(--font-display)', cursor: 'pointer' }}>Save &amp; Next</button>;
        })()}
        <button onClick={() => setShowSubmitConfirm(true)} style={{ flex: 'none', padding: '13px 16px', border: 'none', borderRadius: '12px', background: '#0B9E6D', color: '#fff', font: '800 13px var(--font-body)', cursor: 'pointer' }}>Submit</button>
      </div>

      {/* Submit confirmation */}
      {showSubmitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,24,48,.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '380px', padding: '26px', borderRadius: '20px', background: '#fff', border: '1px solid #E2E7F0', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ margin: 0, font: '800 19px var(--font-display)', color: '#12203A' }}>Submit test?</h3>
            <p style={{ margin: 0, color: '#5A6A85', fontSize: '0.9rem', lineHeight: 1.5 }}>You cannot change responses after submission. {cNotVisited + cNotAnswered > 0 && `${cNotVisited + cNotAnswered} question(s) are unanswered.`}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSubmitConfirm(false)} style={{ padding: '10px 18px', border: '1px solid #C9D2E0', borderRadius: '12px', background: '#fff', color: '#5A6A85', font: '700 13px var(--font-body)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleManualSubmit} disabled={isSubmitting} style={{ padding: '10px 18px', border: 'none', borderRadius: '12px', background: '#0B9E6D', color: '#fff', font: '800 13px var(--font-body)', cursor: 'pointer', opacity: isSubmitting ? 0.6 : 1 }}>{isSubmitting ? 'Submitting…' : 'Yes, submit'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
