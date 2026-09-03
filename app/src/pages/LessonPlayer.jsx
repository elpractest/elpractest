import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';
import { loadYouTubeApi } from '../lib/youtubeApi';
import { markPending, clearPending, listPending } from '../lib/pendingLessonProgress';

/** How often the player reports position while actually playing. */
const REPORT_MS = 15000;
/** How long BUFFERING has to persist before it reads as a stall to the student. */
const STALL_MS = 10000;

/** YT IFrame API error codes → a message a student can act on. */
function describePlayerError(code) {
  switch (code) {
    case 2:
      return { message: 'This video could not be found.', canOpenExternally: false };
    case 5:
      return { message: 'This video cannot be played in this browser.', canOpenExternally: false };
    case 100:
      return { message: 'This video has been removed or made private.', canOpenExternally: false };
    case 101:
    case 150:
      return { message: 'The video owner has disabled playback here.', canOpenExternally: true };
    default:
      return { message: 'This video could not be loaded.', canOpenExternally: false };
  }
}

export default function LessonPlayer() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Player lifecycle, separate from the lesson-fetch loading/error above:
  // the API call can succeed while the EMBED itself still fails (a removed
  // video, a network drop fetching the iframe), and the two must not be
  // conflated into one flag or a dead video reads as "loading forever".
  const [playerPhase, setPlayerPhase] = useState('loading'); // loading | ready | error
  const [playerError, setPlayerError] = useState(null);
  const [stalled, setStalled] = useState(false);

  const navigate = useNavigate();

  const playerRef = useRef(null);
  const watchedSecRef = useRef(0);
  const intervalRef = useRef(null);
  const stallTimerRef = useRef(null);
  const containerRef = useRef(null);

  /**
   * Best-effort position save. Never throws: a lost write here must never
   * interrupt playback or surface as an error the student did not cause.
   * A failure is remembered on-device (see lib/pendingLessonProgress) so
   * it gets one more chance the next time a lesson is opened.
   */
  const saveProgress = useCallback(async (lessonForSave, seconds) => {
    if (!lessonForSave || seconds <= 0) return;
    const rounded = Math.floor(seconds);
    try {
      await api.post(`/api/student/lessons/${lessonForSave.id}/progress`, {
        watched_seconds: rounded,
      });
      clearPending(lessonForSave.id);
    } catch {
      markPending(lessonForSave.id, rounded);
    }
  }, []);

  // ── Fetch lesson details, and reset per-lesson state on navigation
  //    between lessons (the route does not remount this component). ──
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');
    setPlayerPhase('loading');
    setPlayerError(null);
    setStalled(false);
    watchedSecRef.current = 0;

    api.get(`/api/student/lessons/${lessonId}`)
      .then((res) => {
        if (cancelled) return;
        const serverProgress = res.data.progress;

        // A save that failed to leave THIS device on a previous visit to
        // this same lesson is worth more than what the server has, if it
        // is actually higher — the whole point of the pending queue.
        const pending = listPending().find(([id]) => String(id) === String(lessonId));
        const pendingSeconds = pending ? pending[1] : 0;
        const startAt = Math.max(serverProgress?.watched_seconds || 0, pendingSeconds);

        setLesson(res.data.lesson);
        setProgress(serverProgress);
        watchedSecRef.current = startAt;

        // Retry every pending save on the device, not only this lesson's —
        // opening any lesson is a sign the student is online right now,
        // which is the best moment to clear a backlog from a bad connection
        // earlier in the course.
        listPending().forEach(([id, seconds]) => {
          saveProgress({ id }, seconds);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message || 'You do not have access to this lesson.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lessonId, saveProgress]);

  // ── YouTube player: create once per lesson, tear down cleanly. ──
  useEffect(() => {
    if (!lesson || !lesson.video_id) return undefined;

    let cancelled = false;
    let player = null;

    const clearStallTimer = () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };

    const flushCurrentTime = () => {
      if (!player?.getCurrentTime) return;
      const t = player.getCurrentTime();
      if (t > watchedSecRef.current) {
        watchedSecRef.current = t;
        saveProgress(lesson, t);
      }
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;

        // The malformed-video-id case is NOT what onError below is for.
        // onError fires asynchronously, after the player has accepted a
        // well-formed id and gone looking for it (removed, private,
        // embedding disabled). A video_id that is not even shaped like a
        // real one — anything but 11 URL-safe characters, which an admin
        // can absolutely paste in by mistake, StoreLessonRequest only
        // checks it is a non-empty string — makes the constructor itself
        // throw SYNCHRONOUSLY, inside this .then(). Left uncaught, that
        // throw is caught by the .catch() below meant for the SCRIPT
        // failing to load at all, and the student sees "check your
        // connection" for a problem that has nothing to do with their
        // connection. Caught here, it gets the message that actually
        // names the fault, same as the async errors below.
        try {
          player = new YT.Player(containerRef.current, {
            height: '100%',
            width: '100%',
            videoId: lesson.video_id,
            host: 'https://www.youtube-nocookie.com',
            playerVars: {
              autoplay: 1,
              start: Math.floor(watchedSecRef.current),
              modestbranding: 1,
              rel: 0,
              // Without this, iOS Safari forces the video into native
              // fullscreen the moment it plays — which would take every
              // on-screen state this component draws (the error and
              // stall banners) with it. The overwhelming majority of
              // this audience is on a phone (CLAUDE.md ยง14), so this is
              // not an edge case.
              playsinline: 1,
            },
            events: {
              onReady: () => {
                if (cancelled) return;
                setPlayerPhase('ready');
              },
              onError: (event) => {
                if (cancelled) return;
                setPlayerPhase('error');
                setPlayerError(describePlayerError(event.data));
              },
              onStateChange: (event) => {
                if (cancelled) return;
                const State = YT.PlayerState;

                if (event.data === State.PLAYING) {
                  clearStallTimer();
                  setStalled(false);
                  if (!intervalRef.current) {
                    intervalRef.current = setInterval(flushCurrentTime, REPORT_MS);
                  }
                  return;
                }

                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = null;
                }

                if (event.data === State.BUFFERING) {
                  // A brief buffer is normal; only a buffer that does
                  // not resolve is worth telling the student about, so
                  // this is armed rather than shown immediately.
                  clearStallTimer();
                  stallTimerRef.current = setTimeout(() => setStalled(true), STALL_MS);
                } else {
                  clearStallTimer();
                  setStalled(false);
                }

                // Paused, ended, or buffering: whatever position is
                // known right now is worth saving rather than waiting
                // for the next 15s tick that may never come if
                // playback does not resume.
                flushCurrentTime();
              },
            },
          });

          playerRef.current = player;
        } catch {
          if (!cancelled) {
            setPlayerPhase('error');
            setPlayerError({ message: 'This video is set up incorrectly and cannot be played.', canOpenExternally: false });
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlayerPhase('error');
          setPlayerError({ message: 'Could not load the video player. Check your connection and reload.', canOpenExternally: false });
        }
      });

    // Position is worth saving on a tab-hide even mid-buffer, and this is
    // the one path a hard navigation or phone lock is likely to actually
    // fire before the page is gone — `pagehide` is the belt-and-braces
    // partner for the browsers that skip visibilitychange on the way out.
    const flushOnExit = () => flushCurrentTime();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushOnExit();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushOnExit);

    return () => {
      cancelled = true;
      clearStallTimer();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      flushOnExit();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushOnExit);
      // The previous version never disposed the YT.Player object at all —
      // switching lessons (this route does not remount the component) left
      // every earlier player alive in memory, still holding the iframe's
      // message-channel listeners, for as long as the student kept
      // studying. `destroy()` is what actually tears that down.
      try { player?.destroy?.(); } catch { /* already gone */ }
      if (playerRef.current === player) playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
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

  const courseId = lesson.module?.course_id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '0 24px 40px 24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Top Bar Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => navigate(courseId ? `/courses/${courseId}/outline` : '/dashboard')}
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
      <div className="glass-panel" style={{ position: 'relative', width: '100%', paddingTop: '56.25%', overflow: 'hidden', borderRadius: '16px', background: '#000' }}>
        {lesson.video_id ? (
          <>
            <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

            {playerPhase === 'loading' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000' }}>
                <div className="spinner" />
              </div>
            )}

            {playerPhase === 'error' && playerError && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center', alignItems: 'center', background: '#0d0f14', color: '#fff', padding: '24px', textAlign: 'center' }}>
                <Icon name="alert" size={30} />
                <p style={{ margin: 0, maxWidth: '40ch', fontSize: '0.92rem' }}>{playerError.message}</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => { setPlayerPhase('loading'); setPlayerError(null); setLesson({ ...lesson }); }}
                  >
                    Try again
                  </button>
                  {playerError.canOpenExternally && (
                    <a
                      href={`https://www.youtube.com/watch?v=${lesson.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                      style={{ textDecoration: 'none' }}
                    >
                      Watch on YouTube
                    </a>
                  )}
                </div>
              </div>
            )}

            {stalled && playerPhase === 'ready' && (
              <div style={{ position: 'absolute', left: '50%', bottom: '16px', transform: 'translateX(-50%)', padding: '6px 14px', borderRadius: '999px', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />
                Buffering is taking a while — check your connection
              </div>
            )}
          </>
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
