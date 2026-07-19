import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import katex from 'katex';
import api from '../api';

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

  // Fetch session details and resume state
  const fetchSessionState = async (showProgressLoader = false) => {
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
    setIsSubmitting(true);
    try {
      await api.post(`/api/student/tests/sessions/${sessionId}/submit`);
      navigate(`/tests/${sessionId}/result`);
    } catch (err) {
      setError('Failed to auto-submit expired session. Please refresh to view scorecard.');
    }
  };

  const handleManualSubmit = async () => {
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
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Resuming test session details...</div>
      </div>
    );
  }

  if (autoAdvancing) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', height: '80vh', flexDirection: 'column', gap: '16px' }}>
        <div style={{ color: 'var(--accent-color)', fontSize: '1.25rem', fontWeight: 'bold' }}>Section Time Expired!</div>
        <div style={{ color: 'var(--text-secondary)' }}>Auto-advancing to next section...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', height: 'calc(100vh - 100px)', padding: '0 24px 24px 24px', overflow: 'hidden' }}>
      
      {/* CBT Subheader / Bar */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{session.test_title || 'Mock Test Series'}</span>
          {activeSection && (
            <span style={{ marginLeft: '12px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-color)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
              Active Section: {activeSection.title}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {sectionTimeRemaining !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Section Time Remaining</span>
              <div className="header-clock" style={{ color: sectionTimeRemaining < 60 ? '#f87171' : 'var(--text-primary)' }}>
                {formatTime(sectionTimeRemaining)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Exam Time Remaining</span>
            <div className="header-clock" style={{ color: timeRemaining < 300 ? '#f87171' : 'var(--text-primary)' }}>
              {formatTime(timeRemaining)}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 16px', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Main CBT Workspace Split */}
      <div style={{ display: 'flex', flex: 1, gap: '20px', overflow: 'hidden' }}>
        
        {/* Left Side: Question area */}
        <div className="glass-panel" style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflowY: 'auto' }}>
          {activeQuestion ? (
            <div>
              {/* Question Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Question {currentQuestionIndex + 1}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Marks: <span style={{ color: '#10b981', fontWeight: 'bold' }}>+{activeQuestion.marks}</span> / Negative: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>-{activeQuestion.negative_marks}</span>
                </span>
              </div>

              {/* Question Text */}
              <div style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '32px', lineHeight: '1.6' }}>
                <MathRenderer text={activeQuestion.question_text} />
              </div>

              {/* Option Selection List */}
              <div>
                {activeQuestion.options?.map((option) => {
                  const isSelected = answers[activeQuestion.id] === option.id;
                  return (
                    <div 
                      key={option.id}
                      onClick={() => selectOption(option.id)}
                      className={`mcq-option ${isSelected ? 'selected' : ''}`}
                    >
                      <span className="option-badge">{option.label}</span>
                      <span style={{ fontSize: '1rem' }}><MathRenderer text={option.option_text} /></span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>No questions available.</div>
          )}

          {/* Action Control Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '24px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={toggleMarkForReview} className="btn-secondary" style={{ borderColor: 'var(--status-marked-bg)', color: '#a78bfa' }}>
                {markedForReview[activeQuestion?.id] ? 'Unmark Review' : 'Mark for Review'}
              </button>
              <button onClick={clearResponse} className="btn-secondary">
                Clear Response
              </button>
            </div>
            {(() => {
              const isLastQuestionOfSection = currentQuestionIndex === activeSection?.questions?.length - 1;
              const hasSectionalTiming = sections.some(s => s.duration_seconds > 0);
              const isNotLastSection = currentSectionIndex < sections.length - 1;

              if (isLastQuestionOfSection && hasSectionalTiming && isNotLastSection) {
                return (
                  <button onClick={handleAdvanceSection} className="btn-primary" style={{ background: '#db2777' }}>
                    Submit Section
                  </button>
                );
              }
              return (
                <button onClick={handleSaveAndNext} className="btn-primary">
                  Save & Next
                </button>
              );
            })()}
          </div>
        </div>

        {/* Right Side: Navigation & Palette */}
        <div className="glass-panel" style={{ width: '320px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
          
          {/* Section Selector Tab (sectional timing restriction checks) */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sections</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sections.map((section, idx) => {
                const isCurrent = idx === currentSectionIndex;
                const hasSectionalTiming = sections.some(s => s.duration_seconds > 0);
                const isLocked = hasSectionalTiming && idx !== session.current_section_index;
                
                return (
                  <button
                    key={section.id}
                    onClick={() => !isLocked && navigateToQuestion(idx, 0)}
                    disabled={isLocked}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: isCurrent ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
                      color: isCurrent ? '#ffffff' : isLocked ? 'var(--text-secondary)' : 'var(--text-primary)',
                      border: '1px solid',
                      borderColor: isCurrent ? 'var(--accent-color)' : 'var(--border-color)',
                      borderRadius: '8px',
                      textAlign: 'left',
                      fontWeight: 600,
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      opacity: isLocked ? 0.4 : 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{section.title}</span>
                    {isLocked && <span style={{ fontSize: '0.7rem', background: '#374151', padding: '2px 6px', borderRadius: '4px' }}>Locked</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color-coded Question Palette Grid */}
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Question Palette</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {activeSection?.questions?.map((q, idx) => {
                const qStatus = palette[q.id] || 'not_visited';
                const isActive = idx === currentQuestionIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => navigateToQuestion(currentSectionIndex, idx)}
                    className={`palette-btn ${qStatus} ${isActive ? 'active' : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Palette Legend */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="palette-btn not_visited" style={{ width: '16px', height: '16px', borderRadius: '4px', border: 'none' }}></span>
              <span>Not Visited</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="palette-btn not_answered" style={{ width: '16px', height: '16px', borderRadius: '4px', border: 'none' }}></span>
              <span>Not Answered</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="palette-btn answered" style={{ width: '16px', height: '16px', borderRadius: '4px', border: 'none' }}></span>
              <span>Answered</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="palette-btn marked_for_review" style={{ width: '16px', height: '16px', borderRadius: '4px', border: 'none' }}></span>
              <span>Marked for Review</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="palette-btn answered_and_marked" style={{ width: '16px', height: '16px', borderRadius: '4px' }}></span>
              <span>Answered & Marked for Review</span>
            </div>
          </div>

          <button onClick={() => setShowSubmitConfirm(true)} className="btn-primary" style={{ background: '#ef4444', width: '100%' }}>
            Submit Test
          </button>
        </div>
      </div>

      {/* Submit Confirmation Modal Overlay */}
      {showSubmitConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Confirm Test Submission</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Are you sure you want to submit your answers? You cannot change responses after submission.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary" style={{ padding: '8px 16px' }}>
                Cancel
              </button>
              <button onClick={handleManualSubmit} className="btn-primary" style={{ background: '#ef4444', padding: '8px 16px' }} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
