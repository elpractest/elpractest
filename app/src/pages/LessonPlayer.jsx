import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';

export default function LessonPlayer() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const playerRef = useRef(null);
  const watchedSecRef = useRef(0);
  const intervalRef = useRef(null);

  // Fetch lesson details
  useEffect(() => {
    setLoading(true);
    api.get(`/api/student/lessons/${lessonId}`)
      .then(res => {
        setLesson(res.data.lesson);
        setProgress(res.data.progress);
        watchedSecRef.current = res.data.progress?.watched_seconds || 0;
      })
      .catch(err => {
        setError(err.response?.data?.message || 'You do not have access to this lesson.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [lessonId]);

  // Post progress helper
  const saveProgress = async (seconds) => {
    if (!lesson || seconds <= 0) return;
    try {
      await api.post(`/api/student/lessons/${lesson.id}/progress`, {
        watched_seconds: Math.floor(seconds),
      });
    } catch (e) {
      // ignore transient network errors
    }
  };

  // YouTube IFrame API Initialization
  useEffect(() => {
    if (!lesson || !lesson.video_id) return;

    // Load YT API script if needed
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      playerRef.current = new window.YT.Player('yt-player-container', {
        height: '100%',
        width: '100%',
        videoId: lesson.video_id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1,
          start: Math.floor(watchedSecRef.current),
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              // Start periodic progress reporting every 15s
              if (!intervalRef.current) {
                intervalRef.current = setInterval(() => {
                  if (playerRef.current?.getCurrentTime) {
                    const currentTime = playerRef.current.getCurrentTime();
                    if (currentTime > watchedSecRef.current) {
                      watchedSecRef.current = currentTime;
                      saveProgress(currentTime);
                    }
                  }
                }, 15000);
              }
            } else {
              // Paused, Ended, or Buffering: clear interval and save current time
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              if (playerRef.current?.getCurrentTime) {
                const currentTime = playerRef.current.getCurrentTime();
                if (currentTime > watchedSecRef.current) {
                  watchedSecRef.current = currentTime;
                  saveProgress(currentTime);
                }
              }
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    // Flush progress on visibility change or unmount
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && playerRef.current?.getCurrentTime) {
        const currentTime = playerRef.current.getCurrentTime();
        if (currentTime > 0) {
          saveProgress(currentTime);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (playerRef.current?.getCurrentTime) {
        const currentTime = playerRef.current.getCurrentTime();
        if (currentTime > 0) saveProgress(currentTime);
      }
    };
  }, [lesson]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading lesson video...</div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div style={{ padding: '32px 24px', maxWidth: '800px', margin: '0 auto' }}>
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><span style={{ display: 'inline-flex', padding: '15px', borderRadius: '18px', background: 'var(--accent-soft)', color: 'var(--accent-color)', border: '1px solid var(--accent-border)' }}><Icon name="lock" size={30} /></span></div>
          <h2 style={{ margin: '0 0 12px 0' }}>Lesson Locked</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error}</p>
          <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none' }}>
            Request Activation or Enter Code
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '0 24px 40px 24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Top Bar Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => navigate(`/courses/${lesson.module?.course_id || ''}/outline`)}
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.85rem', gap: '8px' }}
        >
          ← Back to Course Syllabus
        </button>

        {progress?.is_completed && (
          <span style={{ fontSize: '0.82rem', padding: '4px 12px', borderRadius: '12px', background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)', fontWeight: 600 }}>
            <Icon name="check" size={15} /> Completed
          </span>
        )}
      </div>

      {/* Video Embed Player */}
      <div className="glass-panel" style={{ position: 'relative', width: '100%', paddingTop: '56.25%', overflow: 'hidden', borderRadius: '16px' }}>
        {lesson.video_id ? (
          <div id="yt-player-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
        ) : (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)' }}>
            Video player unavailable for this lesson.
          </div>
        )}
      </div>

      {/* Lesson Details & Description */}
      <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{lesson.title}</h1>
          {lesson.is_free_preview && (
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}>
              Free Preview
            </span>
          )}
        </div>
        {lesson.module && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Module: <strong>{lesson.module.title}</strong>
          </div>
        )}
        {lesson.description && (
          <p style={{ margin: '8px 0 0 0', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {lesson.description}
          </p>
        )}
      </div>
    </div>
  );
}
