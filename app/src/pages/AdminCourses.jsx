import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const bannerInputRef = useRef(null);

  const triggerBannerUpload = () => {
    bannerInputRef.current?.click();
  };

  const handleBannerChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCourse) return;

    const formData = new FormData();
    formData.append('banner', file);

    setLoading(true);
    setError('');
    try {
      await api.post(`/api/admin/courses/${selectedCourse.id}/banner`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // Refresh current course details
      const freshRes = await api.get(`/api/admin/courses/${selectedCourse.id}`);
      setSelectedCourse(freshRes.data);
      fetchCourses();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload banner.');
    } finally {
      setLoading(false);
    }
  };
  
  // Forms states
  const [showCourseForm, setShowCourseForm] = useState(false);
  /* `mode` is REQUIRED by the API. It used to be missing from this form, which
     made every create 422 with "The mode field is required." — the form could
     not create a course at all. `is_published` is here for the same reason the
     Publish button below exists: /courses/public only returns published
     courses, so a course with no way to publish never reaches the website. */
  const emptyCourseForm = {
    id: null, title: '', slug: '', description: '', exam_category: 'SSC',
    mode: 'hybrid', sort_order: 0, is_published: false,
  };
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [moduleForm, setModuleForm] = useState({ id: null, title: '', sort_order: 0 });

  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonForm, setLessonForm] = useState({ id: null, title: '', description: '', youtube_video_id: '', duration_seconds: 300, is_free_preview: false, sort_order: 0 });
  const [targetModuleId, setTargetModuleId] = useState(null);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/api/admin/courses');
      setCourses(res.data);
      if (selectedCourse) {
        // Refresh selected course
        const freshRes = await api.get(`/api/admin/courses/${selectedCourse.id}`);
        setSelectedCourse(freshRes.data);
      }
    } catch (err) {
      setError('Failed to fetch courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const selectCourse = async (course) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/admin/courses/${course.id}`);
      setSelectedCourse(res.data);
    } catch (err) {
      setError('Failed to load course details.');
    } finally {
      setLoading(false);
    }
  };

  // Course Submit
  const handleCourseSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Send only what the endpoint validates. An empty slug is dropped rather
    // than sent blank, so the server derives one from the title.
    const payload = {
      title: courseForm.title,
      description: courseForm.description,
      exam_category: courseForm.exam_category,
      mode: courseForm.mode,
      sort_order: Number(courseForm.sort_order) || 0,
      is_published: !!courseForm.is_published,
      ...(courseForm.slug ? { slug: courseForm.slug } : {}),
    };

    try {
      if (courseForm.id) {
        // Update
        await api.put(`/api/admin/courses/${courseForm.id}`, payload);
      } else {
        // Create
        await api.post('/api/admin/courses', payload);
      }
      setShowCourseForm(false);
      setCourseForm(emptyCourseForm);
      fetchCourses();
    } catch (err) {
      // 422s carry per-field reasons; a bare "Error saving course" hid exactly
      // the message that would have explained this form's own missing field.
      const errors = err.response?.data?.errors;
      setError(
        errors ? Object.values(errors).flat().join(' ')
               : (err.response?.data?.message || 'Error saving course.')
      );
    }
  };

  // Module Submit
  const handleModuleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (moduleForm.id) {
        await api.put(`/api/admin/modules/${moduleForm.id}`, moduleForm);
      } else {
        await api.post(`/api/admin/courses/${selectedCourse.id}/modules`, moduleForm);
      }
      setShowModuleForm(false);
      setModuleForm({ id: null, title: '', sort_order: 0 });
      selectCourse(selectedCourse);
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving module.');
    }
  };

  // Lesson Submit
  const handleLessonSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (lessonForm.id) {
        await api.put(`/api/admin/lessons/${lessonForm.id}`, lessonForm);
      } else {
        await api.post(`/api/admin/modules/${targetModuleId}/lessons`, lessonForm);
      }
      setShowLessonForm(false);
      setLessonForm({ id: null, title: '', description: '', youtube_video_id: '', duration_seconds: 300, is_free_preview: false, sort_order: 0 });
      selectCourse(selectedCourse);
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving lesson.');
    }
  };

  const deleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      await api.delete(`/api/admin/courses/${courseId}`);
      setSelectedCourse(null);
      fetchCourses();
    } catch (err) {
      setError('Failed to delete course.');
    }
  };

  const deleteModule = async (moduleId) => {
    if (!window.confirm('Are you sure you want to delete this module?')) return;
    try {
      await api.delete(`/api/admin/modules/${moduleId}`);
      selectCourse(selectedCourse);
    } catch (err) {
      setError('Failed to delete module.');
    }
  };

  /* Publish is what puts a course on the public site: /courses/public returns
     published courses only. There was no way to set it from this panel, so a
     course built here could never appear there. The API already accepted the
     field — only the control was missing. */
  const togglePublished = async (course) => {
    setError('');
    try {
      await api.put(`/api/admin/courses/${course.id}`, { is_published: !course.is_published });
      await fetchCourses();
      if (selectedCourse?.id === course.id) {
        const fresh = await api.get(`/api/admin/courses/${course.id}`);
        setSelectedCourse(fresh.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the publish state.');
    }
  };

  const deleteLesson = async (lessonId) => {
    if (!window.confirm('Are you sure you want to delete this lesson?')) return;
    try {
      await api.delete(`/api/admin/lessons/${lessonId}`);
      selectCourse(selectedCourse);
    } catch (err) {
      setError('Failed to delete lesson.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>Course & Syllabus Setup</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>List, build, and organize your courses, modules, and video lessons.</p>
        </div>
        <button 
          onClick={() => {
            setCourseForm(emptyCourseForm);
            setShowCourseForm(true);
          }} 
          className="btn-primary"
        >
          ➕ Add Course
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Main Grid split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'start' }}>
        
        {/* Left Side: Courses List */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Active Courses</h2>
          
          {loading && courses.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>Loading courses...</div>
          ) : courses.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>No courses created yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {courses.map((course) => {
                const isSelected = selectedCourse?.id === course.id;
                return (
                  <div 
                    key={course.id}
                    onClick={() => selectCourse(course)}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      background: isSelected ? 'var(--accent-soft)' : 'var(--surface-1)',
                      border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{course.title}</span>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
                          background: course.is_published ? 'var(--success-bg)' : 'var(--surface-2)',
                          color: course.is_published ? 'var(--success)' : 'var(--text-secondary)',
                        }}>
                          {course.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {course.exam_category} • {course.modules_count || 0} Modules • {course.lessons_count || 0} Lessons
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 'none' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePublished(course); }}
                        className={course.is_published ? 'btn-secondary' : 'btn-primary'}
                        style={{ padding: '5px 12px', fontSize: '0.72rem' }}
                        title={course.is_published ? 'Remove from the public site' : 'Show on the public site'}
                      >
                        {course.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCourseForm({ ...emptyCourseForm, ...course });
                          setShowCourseForm(true);
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                        title="Edit course"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCourse(course.id);
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                        title="Delete course"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Selected Course Detail & Syllabus Editor */}
        <div className="glass-panel" style={{ padding: '32px', minHeight: '400px' }}>
          {selectedCourse ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Hidden file input for banner upload */}
              <input 
                type="file" 
                ref={bannerInputRef} 
                onChange={handleBannerChange} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />

              {/* Course Title Details & Banner Image */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {selectedCourse.banner_url ? (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <img src={selectedCourse.banner_url} alt="Course Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      onClick={triggerBannerUpload}
                      style={{ position: 'absolute', right: '12px', bottom: '12px', background: 'var(--overlay)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      📷 Change Banner
                    </button>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '120px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--surface-1)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    <button 
                      onClick={triggerBannerUpload}
                      className="btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      📷 Upload Course Banner
                    </button>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', margin: 0, fontWeight: 800 }}>{selectedCourse.title}</h2>
                    <p style={{ color: 'var(--accent-color)', fontSize: '0.9rem', margin: '4px 0 0 0', fontFamily: 'var(--font-mono)' }}>Slug: {selectedCourse.slug}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '12px', lineHeight: '1.5' }}>{selectedCourse.description || 'No description provided.'}</p>
                  </div>
                <button 
                  onClick={() => {
                    setModuleForm({ id: null, title: '', sort_order: selectedCourse.modules?.length || 0 });
                    setShowModuleForm(true);
                  }}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                >
                  ➕ Add Module
                </button>
              </div>
            </div>

              {/* Syllabus Outline Editor */}
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: '0 0 16px 0', fontWeight: 700 }}>Course Syllabus Outline</h3>
                
                {!selectedCourse.modules || selectedCourse.modules.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', padding: '24px', textAlign: 'center', background: 'var(--surface-1)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    Syllabus is empty. Create a module to start adding lessons.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {selectedCourse.modules.map((module) => (
                      <div key={module.id} className="glass-panel" style={{ background: 'var(--surface-1)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        
                        {/* Module header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-2)', paddingBottom: '10px' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>📁 {module.title}</span>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <button 
                              onClick={() => {
                                setTargetModuleId(module.id);
                                setLessonForm({ id: null, title: '', description: '', youtube_video_id: '', duration_seconds: 300, is_free_preview: false, sort_order: module.lessons?.length || 0 });
                                setShowLessonForm(true);
                              }}
                              style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                              ➕ Add Lesson
                            </button>
                            <button 
                              onClick={() => {
                                setModuleForm(module);
                                setShowModuleForm(true);
                              }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => deleteModule(module.id)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Lessons List inside Module */}
                        {!module.lessons || module.lessons.length === 0 ? (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '24px' }}>No lessons in this module.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '16px' }}>
                            {module.lessons.map((lesson) => (
                              <div 
                                key={lesson.id} 
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '12px 16px',
                                  background: 'var(--surface-1)',
                                  borderRadius: '6px',
                                  border: '1px solid var(--surface-2)'
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>📺 {lesson.title}</span>
                                    {lesson.is_free_preview && (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', background: 'var(--success-bg)', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                        Free Preview
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    YouTube ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{lesson.youtube_video_id || 'None'}</span> • Duration: {Math.round(lesson.duration_seconds / 60)}m
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <button 
                                    onClick={() => {
                                      setTargetModuleId(module.id);
                                      setLessonForm(lesson);
                                      setShowLessonForm(true);
                                    }}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                                  >
                                    ✏️
                                  </button>
                                  <button 
                                    onClick={() => deleteLesson(lesson.id)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '340px', color: 'var(--text-secondary)' }}>
              Select a course from the list to view and manage its syllabus.
            </div>
          )}
        </div>

      </div>

      {/* Course Form Modal */}
      {showCourseForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
              {courseForm.id ? 'Edit Course' : 'Create Course'}
            </h3>
            
            <form onSubmit={handleCourseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Course Title</label>
                <input 
                  type="text" 
                  value={courseForm.title} 
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} 
                  className="form-input" 
                  required 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Slug</label>
                <input 
                  type="text" 
                  value={courseForm.slug} 
                  onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })} 
                  className="form-input" 
                  placeholder="Auto-generated if left blank"
                  readOnly={!!courseForm.id} // Slug is locked read-only after creation
                  style={{ background: courseForm.id ? 'var(--surface-1)' : 'var(--surface-2)', color: courseForm.id ? 'var(--text-secondary)' : 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Description</label>
                <textarea 
                  value={courseForm.description} 
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} 
                  className="form-input" 
                  rows={3} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Exam Category</label>
                <select 
                  value={courseForm.exam_category} 
                  onChange={(e) => setCourseForm({ ...courseForm, exam_category: e.target.value })} 
                  className="form-input"
                >
                  {/* These are the only five the API accepts. "Railways" and
                      "Other" used to be offered here and 422'd on save, and
                      UPSC / State PCS could not be chosen at all. */}
                  <option value="SSC">SSC</option>
                  <option value="Banking">Banking</option>
                  <option value="RRB">RRB (Railways)</option>
                  <option value="UPSC">UPSC</option>
                  <option value="State PCS">State PCS</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Delivery Mode</label>
                  <select
                    value={courseForm.mode}
                    onChange={(e) => setCourseForm({ ...courseForm, mode: e.target.value })}
                    className="form-input"
                    required
                  >
                    <option value="hybrid">Hybrid (online + offline)</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="live">Live</option>
                    <option value="recorded">Recorded</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '120px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={courseForm.sort_order}
                    onChange={(e) => setCourseForm({ ...courseForm, sort_order: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!courseForm.is_published}
                  onChange={(e) => setCourseForm({ ...courseForm, is_published: e.target.checked })}
                  style={{ marginTop: '3px' }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Publish to the public website
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Only published courses appear on practest.live — and only their
                    active batches that have a price set.
                  </span>
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCourseForm(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Module Form Modal */}
      {showModuleForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
              {moduleForm.id ? 'Edit Module' : 'Create Module'}
            </h3>
            
            <form onSubmit={handleModuleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Module Title</label>
                <input 
                  type="text" 
                  value={moduleForm.title} 
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} 
                  className="form-input" 
                  required 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModuleForm(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Form Modal */}
      {showLessonForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
              {lessonForm.id ? 'Edit Lesson' : 'Create Lesson'}
            </h3>
            
            <form onSubmit={handleLessonSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Lesson Title</label>
                <input 
                  type="text" 
                  value={lessonForm.title} 
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} 
                  className="form-input" 
                  required 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Description</label>
                <textarea 
                  value={lessonForm.description} 
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} 
                  className="form-input" 
                  rows={2} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>YouTube Video ID</label>
                <input 
                  type="text" 
                  value={lessonForm.youtube_video_id} 
                  onChange={(e) => setLessonForm({ ...lessonForm, youtube_video_id: e.target.value })} 
                  className="form-input" 
                  placeholder="e.g. dQw4w9WgXcQ"
                  required 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Duration (Seconds)</label>
                <input 
                  type="number" 
                  value={lessonForm.duration_seconds} 
                  onChange={(e) => setLessonForm({ ...lessonForm, duration_seconds: parseInt(e.target.value) })} 
                  className="form-input" 
                  min={1} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                <input 
                  type="checkbox" 
                  id="is_free_preview"
                  checked={lessonForm.is_free_preview} 
                  onChange={(e) => setLessonForm({ ...lessonForm, is_free_preview: e.target.checked })} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="is_free_preview" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                  Enable Free Preview for non-activated students
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowLessonForm(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
