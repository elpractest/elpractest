import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();

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
  // Presentation only: the right rail becomes a sheet under 1024px.
  const [paletteOpen, setPaletteOpen] = useState(false);

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

      // Map answers to local state. Shape depends on question type:
      // single_choice -> option id, multi_select -> array of option ids,
      // numeric -> a number (or '' while empty, so the input stays controlled).
      const initialAnswers = {};
      const initialMarked = {};

      if (data.answers) {
        data.answers.forEach((ans) => {
          if (ans.selected_option_ids !== null && ans.selected_option_ids !== undefined) {
            initialAnswers[ans.question_id] = ans.selected_option_ids;
          } else if (ans.numeric_response !== null && ans.numeric_response !== undefined) {
            initialAnswers[ans.question_id] = ans.numeric_response;
          } else {
            initialAnswers[ans.question_id] = ans.selected_option_id;
          }
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
      setError(err.response?.data?.message || t('exam.errors.resume'));
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
      setError(t('exam.errors.section'));
    } finally {
      setAutoAdvancing(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (isDemo) { navigate('/tests/demo/result'); return; }
    flushIfNumeric();
    setIsSubmitting(true);
    try {
      await api.post(`/api/student/tests/sessions/${sessionId}/submit`);
      navigate(`/tests/${sessionId}/result`);
    } catch (err) {
      setError(t('exam.errors.autoSubmit'));
    }
  };

  const handleManualSubmit = async () => {
    if (isDemo) { navigate('/tests/demo/result'); return; }
    flushIfNumeric();
    setIsSubmitting(true);
    try {
      await api.post(`/api/student/tests/sessions/${sessionId}/submit`);
      navigate(`/tests/${sessionId}/result`);
    } catch (err) {
      setError(err.response?.data?.message || t('exam.errors.submit'));
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

  // A numeric answer only truly saves on blur; navigating away before that
  // fires would otherwise silently drop whatever was typed.
  const flushIfNumeric = () => {
    if (activeQuestion?.question_type === 'numeric') {
      flushNumericResponse(activeQuestion.id, answers[activeQuestion.id]);
    }
  };

  // Navigate Questions (snappy, checks visited state)
  const navigateToQuestion = (sectionIdx, questionIdx) => {
    flushIfNumeric();
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

  // The field name the API expects, per question type.
  const responseFieldFor = (question) => {
    if (question.question_type === 'multi_select') return 'selected_option_ids';
    if (question.question_type === 'numeric') return 'numeric_response';
    return 'selected_option_id';
  };

  const markPaletteLocally = (questionId, hasAnswer) => {
    setPalette((prev) => {
      const isMarked = markedForReview[questionId];
      if (hasAnswer) return { ...prev, [questionId]: isMarked ? 'answered_and_marked' : 'answered' };
      return { ...prev, [questionId]: isMarked ? 'marked_for_review' : 'not_answered' };
    });
  };

  // Instant Option Selection & Auto-Save (single_choice)
  const selectOption = async (optionId) => {
    const nowTime = Date.now();
    if (nowTime - lastSaveTime.current < 300) return; // double-click protection
    lastSaveTime.current = nowTime;

    const questionId = activeQuestion.id;

    // Snappy local UI update
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    markPaletteLocally(questionId, true);

    if (isDemo) return;
    try {
      await api.put(`/api/student/tests/sessions/${sessionId}/answers/${questionId}`, {
        selected_option_id: optionId,
        time_spent_seconds: timeSpentOnCurrentQuestion,
      });
    } catch (err) {
      setError(t('exam.errors.save'));
    }
  };

  // Toggle one option in/out of a multi_select response, then save the whole set.
  const toggleMultiOption = async (optionId) => {
    const nowTime = Date.now();
    if (nowTime - lastSaveTime.current < 300) return;
    lastSaveTime.current = nowTime;

    const questionId = activeQuestion.id;
    const current = Array.isArray(answers[questionId]) ? answers[questionId] : [];
    const next = current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId];

    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    markPaletteLocally(questionId, next.length > 0);

    if (isDemo) return;
    try {
      await api.put(`/api/student/tests/sessions/${sessionId}/answers/${questionId}`, {
        selected_option_ids: next,
        time_spent_seconds: timeSpentOnCurrentQuestion,
      });
    } catch (err) {
      setError(t('exam.errors.save'));
    }
  };

  // Numeric input updates state on every keystroke (no network call — typing a
  // multi-digit number would otherwise fire a request per digit); it actually
  // persists on blur, and is force-flushed before navigating away so a typed
  // value is never lost to an unfired blur event.
  const setNumericLocal = (value) => {
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: value }));
  };

  const flushNumericResponse = async (questionId, value) => {
    const hasValue = value !== '' && value !== null && value !== undefined;
    markPaletteLocally(questionId, hasValue);

    if (isDemo) return;
    try {
      await api.put(`/api/student/tests/sessions/${sessionId}/answers/${questionId}`, {
        numeric_response: hasValue ? value : null,
        time_spent_seconds: timeSpentOnCurrentQuestion,
      });
    } catch (err) {
      setError(t('exam.errors.save'));
    }
  };

  // Clear the current question's response, whatever its type.
  const clearResponse = async () => {
    const questionId = activeQuestion.id;
    const field = responseFieldFor(activeQuestion);
    const emptyValue = field === 'selected_option_ids' ? [] : null;

    setAnswers((prev) => ({ ...prev, [questionId]: field === 'selected_option_ids' ? [] : null }));
    markPaletteLocally(questionId, false);

    if (isDemo) return;
    try {
      await api.put(`/api/student/tests/sessions/${sessionId}/answers/${questionId}`, {
        [field]: emptyValue,
        time_spent_seconds: timeSpentOnCurrentQuestion,
      });
    } catch (err) {
      setError(t('exam.errors.clear'));
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
      setError(t('exam.errors.review'));
    }
  };

  // Save & Next button
  const handleSaveAndNext = () => {
    flushIfNumeric();
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
    flushIfNumeric();
    setAutoAdvancing(true);
    try {
      await api.post(`/api/student/tests/sessions/${sessionId}/advance-section`);
      await fetchSessionState(false);
    } catch (err) {
      setError(err.response?.data?.message || t('exam.errors.advance'));
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
      <div className="cbt-root" style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px' }}>
        <div style={{ font: '700 18px var(--font-display)', letterSpacing: '-.025em', color: '#1D2130' }}>{t('exam.sectionExpired')}</div>
        <div style={{ font: '400 14px var(--font-body)', color: '#4A5060' }}>{t('exam.autoAdvancing')}</div>
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

  const hasSectionalTiming = sections.some((sec) => sec.duration_seconds > 0);
  const isLastQuestionOfSection = currentQuestionIndex === activeSection?.questions?.length - 1;
  const isNotLastSection = currentSectionIndex < sections.length - 1;
  const advanceInsteadOfNext = isLastQuestionOfSection && hasSectionalTiming && isNotLastSection;
  const isMarked = !!markedForReview[activeQuestion?.id];
  const isHindi = i18n.language.startsWith('hi');
  const candidateName = session?.user_name || session?.student_name || '';
  const initials = (candidateName || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const goPrevious = () => {
    if (currentQuestionIndex > 0) navigateToQuestion(currentSectionIndex, currentQuestionIndex - 1);
  };

  const legend = [
    ['#0ea371', t('exam.legend.answered'), cAnswered],
    ['#e5484d', t('exam.legend.notAnswered'), cNotAnswered],
    ['#8b5cf6', t('exam.legend.marked'), cMarked],
    ['#64748b', t('exam.legend.notVisited'), cNotVisited],
  ];

  const paletteGrid = (
    <div className="cbt-palette-grid">
      {activeSection?.questions?.map((q, idx) => {
        const qStatus = statusOf(q.id);
        const isActive = idx === currentQuestionIndex;
        return (
          <button
            key={q.id}
            onClick={() => { navigateToQuestion(currentSectionIndex, idx); setPaletteOpen(false); }}
            className={`palette-btn ${qStatus} ${isActive ? 'active' : ''}`}
            aria-label={`${t('exam.question')} ${idx + 1}`}
            aria-current={isActive ? 'true' : undefined}
          >
            {idx + 1}
          </button>
        );
      })}
    </div>
  );

  const railBody = (
    <>
      {candidateName && (
        <div className="cbt-candidate">
          <span className="cbt-avatar">{initials}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', font: '600 13.5px var(--font-body)', color: '#1D2130', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {candidateName}
            </span>
            {session?.roll_number && (
              <span style={{ display: 'block', marginTop: '3px', font: '500 10.5px var(--font-mono)', letterSpacing: '.06em', color: 'var(--muted)' }}>
                ROLL {session.roll_number}
              </span>
            )}
          </span>
        </div>
      )}

      <div className="cbt-legend">
        {legend.map(([c, label, n]) => (
          <span key={label} className="cbt-legend-item">
            <span aria-hidden="true" style={{ width: '14px', height: '14px', borderRadius: '4px 4px 4px 0', background: c, flex: 'none' }} />
            <span>{label} <span className="t-num" style={{ fontSize: '11px', color: '#1D2130' }}>{n}</span></span>
          </span>
        ))}
      </div>

      <div className="cbt-palette-scroll">{paletteGrid}</div>

      <button
        type="button"
        onClick={() => { flushIfNumeric(); setPaletteOpen(false); setShowSubmitConfirm(true); }}
        className="cbt-submit-btn"
      >
        {t('exam.submit')}
      </button>
    </>
  );

  return (
    <div className="cbt-root cbt-shell">
      <style>{`
        .cbt-shell { position: fixed; inset: 0; display: flex; flex-direction: column; background: #EEF1F7; }

        .cbt-head {
          flex: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: max(env(safe-area-inset-top), 10px) 16px 10px;
          background: #FFFFFF;
          border-bottom: 1px solid #E2E7F0;
        }
        .cbt-title { font: 700 15px/1.15 var(--font-display); letter-spacing: -.025em; color: #1D2130;
                     overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cbt-sub { margin-top: 3px; font: 600 9.5px var(--font-mono); letter-spacing: .12em;
                   text-transform: uppercase; color: var(--muted);
                   overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cbt-head-tabs { display: none; }
        .cbt-icon-btn {
          width: 40px; height: 40px; flex: none;
          border-radius: 12px; border: 1px solid #DDE3EE; background: #FFFFFF;
          color: #4A5060; display: grid; place-items: center; cursor: pointer;
        }
        .cbt-lang {
          display: inline-flex; align-items: center; gap: 6px; flex: none;
          height: 40px; padding: 0 13px; border-radius: 12px; border: 1px solid #DDE3EE;
          background: #FFFFFF; color: #4A5060; font: 600 12.5px var(--font-body); cursor: pointer;
        }
        .cbt-grid-btn { display: grid; }
        .cbt-card-lang {
          display: inline-flex; align-items: center; gap: 5px; min-height: 32px;
          padding: 0 8px; border: none; background: transparent; cursor: pointer;
          font: 500 11px var(--font-body); color: var(--muted);
        }
        @media (min-width: 640px) { .cbt-card-lang { display: none; } }

        .cbt-tabs {
          flex: none; display: flex; gap: 6px; overflow-x: auto;
          padding: 10px 16px; background: #FFFFFF; border-bottom: 1px solid #E2E7F0;
          scrollbar-width: none;
        }
        .cbt-tabs::-webkit-scrollbar { display: none; }
        .cbt-tab {
          flex: none; padding: 7px 14px; border: none; border-radius: 999px;
          font: 500 12px var(--font-body); color: #4A5060; background: #EEF1F7; cursor: pointer;
        }
        .cbt-tab.on { background: #0E1220; color: #FFFFFF; font-weight: 600; }
        .cbt-tab[disabled] { opacity: .5; cursor: not-allowed; }

        .cbt-body { flex: 1; min-height: 0; display: flex; gap: 20px; overflow: hidden; }
        .cbt-col { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
        .cbt-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
        .cbt-card {
          background: #FFFFFF; border: 1px solid #E4E8F0; border-radius: 18px; padding: 18px;
        }
        .cbt-qtext { margin: 0; font: 400 16px/1.62 var(--font-body); color: #1D2130; max-width: 70ch; }

        .cbt-rail { display: none; }

        .cbt-legendstrip {
          margin-top: 16px; padding: 0 4px; display: flex; flex-wrap: wrap;
          align-items: center; justify-content: space-between; gap: 12px;
        }

        .cbt-actionbar {
          flex: none; display: flex; gap: 9px; align-items: center;
          padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 8px));
          background: #FFFFFF; border-top: 1px solid #E2E7F0;
        }
        .cbt-btn {
          height: 48px; padding: 0 16px; flex: none;
          border-radius: 13px; border: 1px solid #DCE1EA; background: #FFFFFF; color: #4A5060;
          font: 600 13px var(--font-body); cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        }
        .cbt-btn.icon { width: 48px; padding: 0; }
        .cbt-btn.mark { color: #8b5cf6; }
        .cbt-btn.mark.on { background: rgba(139,92,246,.1); border-color: rgba(139,92,246,.35); }
        .cbt-next {
          flex: 1; height: 48px; border: none; border-radius: 13px;
          background: var(--primary); color: #FFFFFF; font: 700 14px var(--font-body); cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
        }
        .cbt-next:active, .cbt-btn:active { transform: scale(.98); }

        .cbt-candidate {
          display: flex; align-items: center; gap: 12px;
          padding-bottom: 16px; border-bottom: 1px solid #EEF1F6;
        }
        .cbt-avatar {
          width: 40px; height: 40px; flex: none; border-radius: 999px; background: #EEF1F7;
          display: grid; place-items: center; font: 600 13px var(--font-body); color: #4A5060;
        }
        .cbt-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 12px; }
        .cbt-legend-item {
          display: flex; align-items: center; gap: 8px;
          font: 500 11px var(--font-body); color: #5A6070;
        }
        .cbt-palette-scroll { flex: 1; min-height: 0; overflow-y: auto; }
        .cbt-palette-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
        .cbt-palette-grid .palette-btn { width: 100%; height: auto; aspect-ratio: 1; }
        .cbt-submit-btn {
          width: 100%; min-height: 48px; padding: 14px;
          border-radius: 12px; border: 1px solid #DDE3EE; background: #EEF1F7; color: #1D2130;
          font: 700 13.5px var(--font-body); cursor: pointer;
        }

        /* --- phone: the rail is a sheet --- */
        .cbt-sheet {
          position: fixed; inset: 0; z-index: 1200; display: flex; align-items: flex-end;
          background: rgba(14,18,32,.44); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        }
        .cbt-sheet-panel {
          width: 100%; max-height: 82vh; display: flex; flex-direction: column; gap: 16px;
          padding: 8px 18px calc(18px + env(safe-area-inset-bottom, 0px));
          background: #FFFFFF; border-radius: 20px 20px 0 0;
          animation: rise-in var(--t-enter) var(--ease-out) both;
        }
        .cbt-sheet-handle { width: 38px; height: 4px; margin: 4px auto 6px; border-radius: 99px; background: #DDE3EE; }

        /* --- tablet: the sheet slides over from the right --- */
        /* phone: header keeps timer + palette only; the bar is
           bookmark · Clear · Save & next, and Previous lives in the palette. */
        @media (max-width: 639px) {
          .cbt-lang { display: none; }
          .cbt-prev, .cbt-prev-spacer { display: none; }
          .cbt-next { white-space: nowrap; padding: 0 12px; font-size: 13.5px; }
        }

        @media (min-width: 640px) {
          .cbt-sheet { align-items: stretch; justify-content: flex-end; }
          .cbt-sheet-panel {
            width: min(340px, 90vw); max-height: none; height: 100%;
            border-radius: 0; padding: 18px;
            animation-name: fade-in;
          }
          .cbt-sheet-handle { display: none; }
        }

        /* --- desktop: fixed 300px rail, tabs move into the header --- */
        @media (min-width: 1024px) {
          .cbt-head { height: 64px; padding: 0 24px; }
          .cbt-head-tabs { display: flex; gap: 4px; }
          .cbt-tabs { display: none; }
          .cbt-grid-btn { display: none; }
          .cbt-body { padding: 20px 24px; }
          .cbt-col {
            background: #FFFFFF; border: 1px solid #E4E8F0; border-radius: 20px;
            padding: 28px 32px;
          }
          .cbt-scroll { padding: 0; }
          .cbt-card { background: transparent; border: none; border-radius: 0; padding: 0; }
          .cbt-qtext { font-size: 19px; }
          .cbt-legendstrip { display: none; }
          .cbt-rail {
            width: 300px; flex: none; display: flex; flex-direction: column; gap: 18px;
            background: #FFFFFF; border: 1px solid #E4E8F0; border-radius: 20px; padding: 20px;
          }
          .cbt-actionbar {
            border-top: 1px solid #EEF1F6; background: transparent;
            padding: 22px 0 0; margin-top: auto;
          }
          .cbt-btn.icon { width: auto; padding: 0 18px; }
          .cbt-btn.mark.icon::after { content: 'Mark for review'; }
        }
      `}</style>

      {/* ---- header ---- */}
      <div className="cbt-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', minWidth: 0, flex: 1 }}>
          <div style={{ minWidth: 0 }}>
            <div className="cbt-title">{session.test_title || 'Mock Test'}</div>
            <div className="cbt-sub">{activeQuestion?.section || activeSection?.title}</div>
          </div>

          {/* section tabs live in the header from 1024px up */}
          {sections.length > 1 && (
            <div className="cbt-head-tabs">
              {sections.map((section, idx) => {
                const isCurrent = idx === currentSectionIndex;
                const isLocked = hasSectionalTiming && idx !== session.current_section_index;
                return (
                  <button
                    key={section.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => !isLocked && navigateToQuestion(idx, 0)}
                    className={`cbt-tab${isCurrent ? ' on' : ''}`}
                    style={{ borderRadius: '10px', padding: '8px 15px', background: isCurrent ? '#0E1220' : 'transparent' }}
                  >
                    {section.title}
                    {isLocked && <Icon name="lock" size={13} style={{ marginLeft: 5, verticalAlign: '-2px' }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 'none' }}>
          {/* The timer never animates — no pulse, no colour shift. */}
          <span className="header-clock">
            <Icon name="clock" size={16} />
            {formatTime(timeRemaining)}
          </span>

          <button
            type="button"
            className="cbt-lang"
            onClick={() => i18n.changeLanguage(isHindi ? 'en' : 'hi')}
            aria-label="Toggle language"
            title="Language"
          >
            <Icon name="languages" size={15} />
            EN / <span style={{ fontFamily: 'var(--font-hindi)' }}>हिं</span>
          </button>

          <button
            type="button"
            className="cbt-icon-btn cbt-grid-btn"
            onClick={() => setPaletteOpen(true)}
            aria-label={t('exam.legend.answered')}
            title="Palette"
          >
            <Icon name="grid" size={18} />
          </button>
        </div>
      </div>

      {sectionTimeRemaining !== null && (
        <div
          style={{
            flex: 'none',
            padding: '8px 16px',
            background: '#FFFFFF',
            borderBottom: '1px solid #E2E7F0',
            font: '500 11.5px var(--font-body)',
            color: sectionTimeRemaining < 60 ? '#C42B2B' : '#4A5060',
          }}
        >
          {t('exam.sectionTime')}:{' '}
          <span className="t-num" style={{ fontSize: '12.5px', color: sectionTimeRemaining < 60 ? '#C42B2B' : '#1D2130' }}>
            {formatTime(sectionTimeRemaining)}
          </span>
        </div>
      )}

      {/* ---- section tabs (phone + tablet) ---- */}
      {sections.length > 1 && (
        <div className="cbt-tabs">
          {sections.map((section, idx) => {
            const isCurrent = idx === currentSectionIndex;
            const isLocked = hasSectionalTiming && idx !== session.current_section_index;
            return (
              <button
                key={section.id}
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && navigateToQuestion(idx, 0)}
                className={`cbt-tab${isCurrent ? ' on' : ''}`}
              >
                {section.title}
                {isLocked && <Icon name="lock" size={13} style={{ marginLeft: 5, verticalAlign: '-2px' }} />}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div
          style={{
            flex: 'none',
            margin: '10px 16px 0',
            background: '#FCECEB',
            border: '1px solid #F2C9C7',
            padding: '10px 14px',
            borderRadius: '12px',
            color: '#C42B2B',
            font: '500 12.5px var(--font-body)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icon name="alert" size={15} />
          {error}
        </div>
      )}

      {/* ---- body ---- */}
      <div className="cbt-body">
        <div className="cbt-col">
          {activeQuestion ? (
            <>
              <div className="cbt-scroll">
              <div className="cbt-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ font: '700 18px var(--font-display)', letterSpacing: '-.025em', color: '#1D2130' }}>
                      {t('exam.question')} {currentQuestionIndex + 1}
                    </span>
                    <span style={{ font: '400 13.5px var(--font-body)', color: 'var(--muted)' }}>
                      of {activeSection.questions.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ padding: '5px 11px', borderRadius: '8px', background: '#E5F2EC', color: '#0E7C5A', font: '600 11.5px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                      +{Number(activeQuestion.marks).toFixed(2)}
                    </span>
                    <span style={{ padding: '5px 11px', borderRadius: '8px', background: '#FCECEB', color: '#C42B2B', font: '600 11.5px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                      −{Number(activeQuestion.negative_marks).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      className="cbt-card-lang"
                      onClick={() => i18n.changeLanguage(isHindi ? 'en' : 'hi')}
                      aria-label="Toggle language"
                    >
                      <Icon name="languages" size={13} />
                      <span style={{ fontFamily: 'var(--font-hindi)' }}>हिंदी</span>
                    </button>
                  </div>
                </div>

                {/* Passage, pinned above a comprehension-linked question */}
                {activeQuestion.passage && (
                  <div style={{ padding: '14px 16px', borderRadius: '14px', background: '#F7F9FC', border: '1px solid #E4E8F0', marginBottom: '14px', maxHeight: '220px', overflowY: 'auto' }}>
                    {activeQuestion.passage.title && (
                      <div style={{ font: '700 13px var(--font-display)', letterSpacing: '-.02em', color: '#1D2130', marginBottom: '6px' }}>
                        {activeQuestion.passage.title}
                      </div>
                    )}
                    <div style={{ font: '400 13.5px/1.62 var(--font-body)', color: '#4A5060', whiteSpace: 'pre-wrap' }}>
                      {activeQuestion.passage.body}
                    </div>
                  </div>
                )}

                <p className="cbt-qtext">
                  <MathRenderer text={activeQuestion.question_text} />
                </p>

                {activeQuestion.question_type === 'multi_select' && (
                  <div style={{ marginTop: '14px', font: '600 11.5px var(--font-body)', color: '#8b5cf6' }}>{t('exam.selectAll')}</div>
                )}

                <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '620px' }}>
                  {activeQuestion.question_type === 'numeric' ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={answers[activeQuestion.id] ?? ''}
                      onChange={(e) => setNumericLocal(e.target.value === '' ? '' : e.target.value)}
                      onBlur={(e) => flushNumericResponse(activeQuestion.id, e.target.value === '' ? '' : e.target.value)}
                      placeholder={t('exam.typeAnswer')}
                      style={{
                        width: '100%',
                        padding: '15px 16px',
                        borderRadius: '14px',
                        border: '1.5px solid #E4E8F0',
                        font: '700 16px var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        color: '#1D2130',
                        background: '#FFFFFF',
                      }}
                    />
                  ) : activeQuestion.question_type === 'multi_select' ? (
                    activeQuestion.options?.map((option) => {
                      const selectedIds = Array.isArray(answers[activeQuestion.id]) ? answers[activeQuestion.id] : [];
                      const isSelected = selectedIds.includes(option.id);
                      return (
                        <div key={option.id} onClick={() => toggleMultiOption(option.id)} className={`mcq-option ${isSelected ? 'selected' : ''}`}>
                          <span className="option-badge" style={{ borderRadius: '7px' }}>
                            {isSelected ? <Icon name="check" size={15} strokeWidth={3} /> : option.label}
                          </span>
                          <span style={{ fontSize: '15px' }}><MathRenderer text={option.option_text} /></span>
                        </div>
                      );
                    })
                  ) : (
                    activeQuestion.options?.map((option) => {
                      const isSelected = answers[activeQuestion.id] === option.id;
                      return (
                        <div key={option.id} onClick={() => selectOption(option.id)} className={`mcq-option ${isSelected ? 'selected' : ''}`}>
                          <span className="option-badge">{option.label}</span>
                          <span style={{ fontSize: '15px' }}><MathRenderer text={option.option_text} /></span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* legend strip + the link that opens the palette sheet (under 1024px) */}
              <div className="cbt-legendstrip">
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  {legend.map(([c, label, n]) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title={label}>
                      <span aria-hidden="true" style={{ width: '11px', height: '11px', borderRadius: '4px 4px 4px 0', background: c }} />
                      <span className="t-num" style={{ font: '500 11px var(--font-mono)', color: '#5A6070' }}>{n}</span>
                    </span>
                  ))}
                </div>
                <button type="button" onClick={() => setPaletteOpen(true)} className="link-btn">
                  Palette
                </button>
              </div>
              </div>

              {/* ---- action bar ---- */}
              <div className="cbt-actionbar">
                <button
                  type="button"
                  onClick={toggleMarkForReview}
                  className={`cbt-btn mark icon${isMarked ? ' on' : ''}`}
                  aria-pressed={isMarked}
                  aria-label={isMarked ? t('exam.unmark') : t('exam.mark')}
                  title={isMarked ? t('exam.unmark') : t('exam.mark')}
                >
                  <Icon name="bookmark" size={20} />
                </button>

                <button type="button" onClick={clearResponse} className="cbt-btn">
                  {t('exam.clear')}
                </button>

                <span className="cbt-prev-spacer" style={{ flex: 1 }} />

                <button
                  type="button"
                  onClick={goPrevious}
                  className="cbt-btn cbt-prev"
                  disabled={currentQuestionIndex === 0}
                  style={{ opacity: currentQuestionIndex === 0 ? 0.45 : 1 }}
                >
                  <Icon name="arrow-left" size={16} strokeWidth={2.2} />
                  Previous
                </button>

                <button
                  type="button"
                  onClick={advanceInsteadOfNext ? handleAdvanceSection : handleSaveAndNext}
                  className="cbt-next"
                >
                  {advanceInsteadOfNext ? t('exam.submitSection') : t('exam.saveNext')}
                  <Icon name="arrow-right" size={16} strokeWidth={2.4} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ font: '400 14px var(--font-body)', color: '#4A5060' }}>{t('exam.noQuestions')}</div>
          )}
        </div>

        {/* ---- fixed right rail (>=1024px) ---- */}
        <aside className="cbt-rail">{railBody}</aside>
      </div>

      {/* ---- palette sheet / slide-over (<1024px) ---- */}
      {paletteOpen && (
        <div className="cbt-sheet" onClick={() => setPaletteOpen(false)} role="presentation">
          <div className="cbt-sheet-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Question palette">
            <div className="cbt-sheet-handle" aria-hidden="true" />
            {railBody}
          </div>
        </div>
      )}

      {/* ---- submit confirmation ---- */}
      {showSubmitConfirm && (
        <div className="cbt-sheet" onClick={() => setShowSubmitConfirm(false)} role="presentation" style={{ alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '24px',
              borderRadius: '20px',
              background: '#FFFFFF',
              border: '1px solid #E4E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3 style={{ margin: 0, font: '700 19px var(--font-display)', letterSpacing: '-.03em', color: '#1D2130' }}>
              {t('exam.confirm.title')}
            </h3>
            <p style={{ margin: 0, font: '400 13.5px/1.6 var(--font-body)', color: '#4A5060' }}>
              {t('exam.confirm.body')}{' '}
              {cNotVisited + cNotAnswered > 0 && t('exam.confirm.unanswered', { count: cNotVisited + cNotAnswered })}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="cbt-btn"
              >
                {t('exam.confirm.cancel')}
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="cbt-next"
                style={{ flex: 'none', padding: '0 22px', opacity: isSubmitting ? 0.6 : 1 }}
              >
                {isSubmitting ? t('exam.confirm.submitting') : t('exam.confirm.yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
