import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';
import MaterialsStrip from '../components/reader/MaterialsStrip';

export default function CourseOutline() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get(`/api/student/courses/${courseId}/outline`)
      .then(res => {
        setCourse(res.data.course);
        setModules(res.data.modules || []);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Failed to load course outline.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [courseId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading course outline...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div style={{ padding: '32px 24px', maxWidth: '800px', margin: '0 auto' }}>
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><span style={{ display: 'inline-flex', padding: '15px', borderRadius: '18px', background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}><Icon name="alert" size={30} /></span></div>
          <h2 style={{ margin: '0 0 12px 0' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error}</p>
          <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none' }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Compute overall completion stats
  let totalLessons = 0;
  let completedLessons = 0;

  modules.forEach(m => {
    m.lessons?.forEach(l => {
      totalLessons++;
      if (l.student_progress?.is_completed) {
        completedLessons++;
      }
    });
  });

  const percentComplete = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Find first uncompleted lesson for "Continue Watching"
  let nextLesson = null;
  for (const m of modules) {
    for (const l of m.lessons || []) {
      if (!l.student_progress?.is_completed) {
        nextLesson = l;
        break;
      }
    }
    if (nextLesson) break;
  }
  // Fallback to first lesson if all completed
  if (!nextLesson && modules.length > 0 && modules[0].lessons?.length > 0) {
    nextLesson = modules[0].lessons[0];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', padding: '0 24px 40px 24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Header & Course Meta */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', background: 'var(--accent-soft)', color: 'var(--accent-color)', borderRadius: '6px', textTransform: 'uppercase', marginBottom: '8px', display: 'inline-block' }}>
              {course.exam_category}
            </span>
            <h1 style={{ margin: '4px 0 8px 0', fontSize: '1.8rem', fontWeight: 700 }}>{course.title}</h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '700px' }}>
              {course.description}
            </p>
          </div>
          {nextLesson && (
            <button
              onClick={() => navigate(`/lessons/${nextLesson.id}`)}
              className="btn-primary"
              style={{ padding: '12px 24px', fontSize: '0.95rem', gap: '8px' }}
            >
              <Icon name="play" size={16} /> {completedLessons > 0 ? 'Continue Learning' : 'Start Course'}
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>Course Progress</span>
            <span style={{ color: 'var(--accent-color)' }}>{completedLessons} of {totalLessons} lessons ({percentComplete}%)</span>
          </div>
          <div style={{ width: '100%', height: '10px', background: 'var(--surface-3)', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{ width: `${percentComplete}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-color), var(--accent-color))', borderRadius: '5px', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>

      {/* Study material — above the syllabus, because a student who came
          here for the formula sheet should not have to scroll past every
          module to find it. Renders nothing when the course has none. */}
      <MaterialsStrip courseId={courseId} />

      {/* Modules & Lessons Hierarchy */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Syllabus & Modules</h2>

        {modules.length === 0 ? (
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No modules published for this course yet.
          </div>
        ) : (
          modules.map((module, mIdx) => (
            <div key={module.id} className="glass-panel" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  Module {mIdx + 1}: {module.title}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {module.lessons?.length || 0} Lessons
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {module.lessons?.map((lesson, lIdx) => {
                  const isCompleted = lesson.student_progress?.is_completed;
                  const watchedSec = lesson.student_progress?.watched_seconds || 0;
                  const duration = lesson.duration_seconds || 0;

                  return (
                    <div
                      key={lesson.id}
                      onClick={() => navigate(`/lessons/${lesson.id}`)}
                      style={{
                        padding: '16px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: lIdx === module.lessons.length - 1 ? 'none' : '1px solid var(--surface-2)',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          background: isCompleted ? 'var(--success-bg)' : 'var(--surface-2)',
                          color: isCompleted ? 'var(--success-text)' : 'var(--text-secondary)',
                          border: isCompleted ? '1px solid var(--success-border)' : '1px solid var(--border-color)',
                        }}>
                          {isCompleted ? <Icon name="check" size={14} /> : lIdx + 1}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{lesson.title}</span>
                            {lesson.is_free_preview && (
                              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}>
                                Free Preview
                              </span>
                            )}
                          </div>
                          {duration > 0 && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {Math.floor(duration / 60)} mins {duration % 60 ? `${duration % 60}s` : ''}
                              {watchedSec > 0 && !isCompleted && ` • Watched ${Math.floor(watchedSec / 60)}m`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.85rem', color: isCompleted ? 'var(--success-text)' : 'var(--accent-color)', fontWeight: 600 }}>
                          {isCompleted ? 'Completed' : watchedSec > 0 ? 'Resume' : 'Play'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
