import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import {
  PageHead, TableCard, Toolbar, Chip, Table, Row, Cell, CellTitle, CellSub, RowChevron,
  StatusDot, Badge, EmptyState, SkeletonRows, Modal, Field, FormGrid, FormSection, Notice, Num,
} from '../components/admin/ui';
import { useExamCategories } from '../lib/examCategories';

export default function AdminCourses() {
  const examCategories = useExamCategories();
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
  // presentation only: the filter chip and the destructive confirmations
  const [publishFilter, setPublishFilter] = useState('all');
  const [confirming, setConfirming] = useState(null); // { kind, id, title, note }
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
    try {
      await api.delete(`/api/admin/courses/${courseId}`);
      setSelectedCourse(null);
      fetchCourses();
    } catch (err) {
      setError('Failed to delete course.');
    }
  };

  const deleteModule = async (moduleId) => {
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
    try {
      await api.delete(`/api/admin/lessons/${lessonId}`);
      selectCourse(selectedCourse);
    } catch (err) {
      setError('Failed to delete lesson.');
    }
  };

  const COLUMNS = [
    { key: 'title', label: 'Course', width: 'minmax(0,1.9fr)' },
    { key: 'exam', label: 'Exam', width: '110px', hideBelow: 'tablet' },
    { key: 'size', label: 'Syllabus', width: '130px' },
    { key: 'status', label: 'Status', width: '110px' },
    { key: 'go', label: '', width: '32px' },
  ];

  const visibleCourses = courses.filter((c) =>
    publishFilter === 'all' ? true : publishFilter === 'live' ? c.is_published : !c.is_published,
  );
  const liveCourses = courses.filter((c) => c.is_published).length;

  const confirmLabel = {
    course: 'Delete course',
    module: 'Delete module',
    lesson: 'Delete lesson',
  };

  const runConfirmed = () => {
    const c = confirming;
    setConfirming(null);
    if (!c) return;
    if (c.kind === 'course') deleteCourse(c.id);
    else if (c.kind === 'module') deleteModule(c.id);
    else deleteLesson(c.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
      <style>{`
        .crs-split { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; }
        @media (min-width: 1180px) { .crs-split { grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); } }
      `}</style>

      <PageHead
        title="Courses & syllabus"
        subtitle="The catalogue and its outline: a course holds modules, a module holds video lessons."
      >
        <button
          type="button"
          onClick={() => { setCourseForm(emptyCourseForm); setShowCourseForm(true); }}
          className="btn-primary"
        >
          <Icon name="plus" size={16} strokeWidth={2.4} />
          New course
        </button>
      </PageHead>

      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      <div className="crs-split">
        {/* ---- course list ---- */}
        <TableCard>
          <Toolbar
            trailing={
              !loading && (
                <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                  <Num>{liveCourses}</Num> live of <Num>{courses.length}</Num>
                </span>
              )
            }
          >
            <Chip active={publishFilter === 'all'} onClick={() => setPublishFilter('all')}>All</Chip>
            <Chip active={publishFilter === 'live'} onClick={() => setPublishFilter('live')}>Published</Chip>
            <Chip active={publishFilter === 'draft'} onClick={() => setPublishFilter('draft')}>Draft</Chip>
          </Toolbar>

          {loading && courses.length === 0 ? (
            <SkeletonRows />
          ) : visibleCourses.length === 0 ? (
            <EmptyState
              icon="book-open"
              message={
                courses.length === 0
                  ? 'No course exists yet. Create one, add its modules, then publish it to the public site.'
                  : 'No course in that state.'
              }
              action={
                courses.length === 0 && (
                  <button
                    type="button"
                    onClick={() => { setCourseForm(emptyCourseForm); setShowCourseForm(true); }}
                    className="btn-primary"
                  >
                    <Icon name="plus" size={16} strokeWidth={2.4} />
                    New course
                  </button>
                )
              }
            />
          ) : (
            <Table columns={COLUMNS}>
              {visibleCourses.map((course) => (
                <Row
                  key={course.id}
                  selected={selectedCourse?.id === course.id}
                  onClick={() => selectCourse(course)}
                >
                  <Cell label="Course">
                    <CellTitle>{course.title}</CellTitle>
                    <CellSub>{course.slug}</CellSub>
                  </Cell>
                  <Cell label="Exam" hideBelow="tablet">
                    <Badge tone="primary">{course.exam_category}</Badge>
                  </Cell>
                  <Cell label="Syllabus">
                    <Num style={{ fontSize: '13px', color: 'var(--tx)' }}>{course.modules_count || 0}</Num>
                    <CellSub>{course.lessons_count || 0} lessons</CellSub>
                  </Cell>
                  <Cell label="Status">
                    <StatusDot tone={course.is_published ? 'success' : 'reward'}>
                      {course.is_published ? 'Published' : 'Draft'}
                    </StatusDot>
                  </Cell>
                  <Cell align="right">
                    <RowChevron onClick={() => selectCourse(course)} label="Open syllabus" />
                  </Cell>
                </Row>
              ))}
            </Table>
          )}
        </TableCard>

        {/* ---- syllabus editor for the selected course ---- */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px', overflow: 'hidden' }}>
          {selectedCourse ? (
            <>
              <input type="file" ref={bannerInputRef} onChange={handleBannerChange} accept="image/*" style={{ display: 'none' }} />

              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)' }}>
                {selectedCourse.banner_url ? (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--line)', marginBottom: '16px' }}>
                    <img src={selectedCourse.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={triggerBannerUpload}
                      className="btn-secondary"
                      style={{ position: 'absolute', right: '12px', bottom: '12px', padding: '8px 13px', minHeight: '40px', fontSize: '12px' }}
                    >
                      <Icon name="image" size={15} />
                      Change banner
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      padding: '22px',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'var(--surf)',
                      border: '1px dashed var(--line2)',
                      borderRadius: '14px',
                      marginBottom: '16px',
                    }}
                  >
                    <button type="button" onClick={triggerBannerUpload} className="btn-secondary">
                      <Icon name="image" size={15} />
                      Upload course banner
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 className="t-heading" style={{ margin: 0, color: 'var(--tx)' }}>{selectedCourse.title}</h2>
                    <p style={{ margin: '6px 0 0', font: '400 13px/1.6 var(--font-body)', color: 'var(--muted)', maxWidth: '70ch' }}>
                      {selectedCourse.description || 'No description provided.'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 'none' }}>
                    <button
                      type="button"
                      onClick={() => togglePublished(selectedCourse)}
                      className="btn-secondary"
                      style={{ padding: '8px 13px', minHeight: '40px', fontSize: '12px' }}
                      title={selectedCourse.is_published ? 'Remove from the public site' : 'Show on the public site'}
                    >
                      {selectedCourse.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCourseForm({ ...emptyCourseForm, ...selectedCourse }); setShowCourseForm(true); }}
                      className="btn-secondary"
                      style={{ padding: '8px 13px', minHeight: '40px', fontSize: '12px' }}
                    >
                      <Icon name="edit" size={15} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming({ kind: 'course', id: selectedCourse.id, title: selectedCourse.title, note: `Its ${selectedCourse.modules_count || 0} modules and ${selectedCourse.lessons_count || 0} lessons go with it.` })}
                      className="btn-secondary"
                      aria-label={`Delete ${selectedCourse.title}`}
                      style={{ padding: '8px 11px', minHeight: '40px', fontSize: '12px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                  <h3 className="t-heading" style={{ margin: 0, fontSize: '15px', color: 'var(--tx)' }}>Syllabus outline</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleForm({ id: null, title: '', sort_order: selectedCourse.modules?.length || 0 });
                      setShowModuleForm(true);
                    }}
                    className="btn-secondary"
                    style={{ padding: '8px 13px', minHeight: '40px', fontSize: '12px' }}
                  >
                    <Icon name="plus" size={15} strokeWidth={2.4} />
                    Add module
                  </button>
                </div>

                {!selectedCourse.modules || selectedCourse.modules.length === 0 ? (
                  <EmptyState
                    icon="book-open"
                    message="The syllabus is empty. Create a module, then add its video lessons."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {selectedCourse.modules.map((module) => (
                      <div key={module.id} style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '16px', overflow: 'hidden' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            padding: '12px 14px',
                            borderBottom: '1px solid var(--line)',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ font: '600 13.5px var(--font-body)', color: 'var(--tx)', minWidth: 0 }}>{module.title}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 'none' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetModuleId(module.id);
                                setLessonForm({ id: null, title: '', description: '', youtube_video_id: '', duration_seconds: 300, is_free_preview: false, sort_order: module.lessons?.length || 0 });
                                setShowLessonForm(true);
                              }}
                              className="link-btn"
                              style={{ marginRight: '6px' }}
                            >
                              <Icon name="plus" size={14} strokeWidth={2.4} />
                              Add lesson
                            </button>
                            <button
                              type="button"
                              className="adm-rowaction"
                              onClick={() => { setModuleForm(module); setShowModuleForm(true); }}
                              aria-label={`Edit ${module.title}`}
                              title="Edit module"
                            >
                              <Icon name="edit" size={16} />
                            </button>
                            <button
                              type="button"
                              className="adm-rowaction"
                              onClick={() => setConfirming({ kind: 'module', id: module.id, title: module.title, note: `Its ${module.lessons?.length || 0} ${(module.lessons?.length || 0) === 1 ? 'lesson goes' : 'lessons go'} with it.` })}
                              aria-label={`Delete ${module.title}`}
                              title="Delete module"
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          </span>
                        </div>

                        {!module.lessons || module.lessons.length === 0 ? (
                          <div style={{ padding: '16px 14px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
                            No lesson in this module yet.
                          </div>
                        ) : (
                          <div>
                            {module.lessons.map((lesson) => (
                              <div
                                key={lesson.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '10px',
                                  padding: '12px 14px',
                                  borderBottom: '1px solid var(--line)',
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ font: '500 13px var(--font-body)', color: 'var(--tx)' }}>{lesson.title}</span>
                                    {lesson.is_free_preview && <Badge tone="success">Free preview</Badge>}
                                  </div>
                                  <div style={{ marginTop: '3px', font: '400 11.5px var(--font-body)', color: 'var(--muted)' }}>
                                    <Num style={{ fontSize: '11.5px', fontWeight: 500 }}>{lesson.youtube_video_id || '—'}</Num>
                                    {' · '}
                                    <Num style={{ fontSize: '11.5px', fontWeight: 500 }}>{Math.round(lesson.duration_seconds / 60)}m</Num>
                                  </div>
                                </div>
                                <span style={{ display: 'flex', gap: '4px', flex: 'none' }}>
                                  <button
                                    type="button"
                                    className="adm-rowaction"
                                    onClick={() => { setTargetModuleId(module.id); setLessonForm(lesson); setShowLessonForm(true); }}
                                    aria-label={`Edit ${lesson.title}`}
                                    title="Edit lesson"
                                  >
                                    <Icon name="edit" size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    className="adm-rowaction"
                                    onClick={() => setConfirming({ kind: 'lesson', id: lesson.id, title: lesson.title, note: 'Student progress against it is lost.' })}
                                    aria-label={`Delete ${lesson.title}`}
                                    title="Delete lesson"
                                  >
                                    <Icon name="trash" size={16} />
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState icon="book-open" message="Pick a course on the left to view and edit its syllabus." />
          )}
        </div>
      </div>

      {/* ---- course form ---- */}
      {showCourseForm && (
        <Modal
          title={courseForm.id ? 'Edit course' : 'New course'}
          description="Only published courses appear on practest.live — and only their active batches that have a price."
          onClose={() => setShowCourseForm(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowCourseForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" form="course-form" className="btn-primary">Save course</button>
            </>
          }
        >
          <form id="course-form" onSubmit={handleCourseSubmit}>
            <FormSection title="Listing">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="Course title" htmlFor="crs-title">
                  <input
                    id="crs-title"
                    type="text"
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    className="form-input"
                    required
                  />
                </Field>
                <Field
                  label="Slug"
                  hint={courseForm.id ? 'Locked after creation — the public URL depends on it.' : 'Generated from the title if left blank.'}
                  htmlFor="crs-slug"
                >
                  <input
                    id="crs-slug"
                    type="text"
                    value={courseForm.slug}
                    onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
                    className="form-input"
                    placeholder="auto-generated"
                    readOnly={!!courseForm.id}
                    style={courseForm.id ? { background: 'var(--surf)', color: 'var(--muted)' } : undefined}
                  />
                </Field>
                <Field label="Description" htmlFor="crs-desc">
                  <textarea
                    id="crs-desc"
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    className="form-input"
                    rows={3}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Delivery">
              <FormGrid min="170px">
                <Field label="Exam category" htmlFor="crs-exam">
                  {/* Served by the API from config/exams.php, so this list and
                      the validation rule cannot drift apart again. */}
                  <select
                    id="crs-exam"
                    value={courseForm.exam_category}
                    onChange={(e) => setCourseForm({ ...courseForm, exam_category: e.target.value })}
                    className="form-input"
                  >
                    {examCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Delivery mode" htmlFor="crs-mode">
                  <select
                    id="crs-mode"
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
                </Field>
                <Field label="Sort order" htmlFor="crs-order">
                  <input
                    id="crs-order"
                    type="number"
                    min="0"
                    value={courseForm.sort_order}
                    onChange={(e) => setCourseForm({ ...courseForm, sort_order: e.target.value })}
                    className="form-input"
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection title="Visibility">
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  minHeight: '44px',
                  cursor: 'pointer',
                  font: '400 13px/1.5 var(--font-body)',
                  color: 'var(--tx)',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!courseForm.is_published}
                  onChange={(e) => setCourseForm({ ...courseForm, is_published: e.target.checked })}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  Publish to the public website
                  <span style={{ display: 'block', marginTop: '3px', font: '400 12px/1.5 var(--font-body)', color: 'var(--muted)' }}>
                    Unpublished courses stay invisible on practest.live, whatever their batches say.
                  </span>
                </span>
              </label>
            </FormSection>
          </form>
        </Modal>
      )}

      {/* ---- module form ---- */}
      {showModuleForm && (
        <Modal
          title={moduleForm.id ? 'Edit module' : 'New module'}
          description="A module groups lessons; students see them in this order."
          width={460}
          onClose={() => setShowModuleForm(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowModuleForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" form="module-form" className="btn-primary">Save module</button>
            </>
          }
        >
          <form id="module-form" onSubmit={handleModuleSubmit}>
            <Field label="Module title" htmlFor="mod-title">
              <input
                id="mod-title"
                type="text"
                value={moduleForm.title}
                onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                className="form-input"
                required
              />
            </Field>
          </form>
        </Modal>
      )}

      {/* ---- lesson form ---- */}
      {showLessonForm && (
        <Modal
          title={lessonForm.id ? 'Edit lesson' : 'New lesson'}
          description="The video is served from YouTube; only the id is stored."
          onClose={() => setShowLessonForm(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowLessonForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" form="lesson-form" className="btn-primary">Save lesson</button>
            </>
          }
        >
          <form id="lesson-form" onSubmit={handleLessonSubmit}>
            <FormSection title="Content">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="Lesson title" htmlFor="lsn-title">
                  <input
                    id="lsn-title"
                    type="text"
                    value={lessonForm.title}
                    onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                    className="form-input"
                    required
                  />
                </Field>
                <Field label="Description" htmlFor="lsn-desc">
                  <textarea
                    id="lsn-desc"
                    value={lessonForm.description}
                    onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                    className="form-input"
                    rows={2}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Video">
              <FormGrid min="180px">
                <Field label="YouTube video id" hint="Just the id, not the whole URL." htmlFor="lsn-yt">
                  <input
                    id="lsn-yt"
                    type="text"
                    value={lessonForm.youtube_video_id}
                    onChange={(e) => setLessonForm({ ...lessonForm, youtube_video_id: e.target.value })}
                    className="form-input"
                    placeholder="e.g. dQw4w9WgXcQ"
                    required
                  />
                </Field>
                <Field label="Duration (seconds)" htmlFor="lsn-dur">
                  <input
                    id="lsn-dur"
                    type="number"
                    value={lessonForm.duration_seconds}
                    onChange={(e) => setLessonForm({ ...lessonForm, duration_seconds: parseInt(e.target.value) })}
                    className="form-input"
                    min={1}
                    required
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection title="Access">
              <label
                htmlFor="is_free_preview"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minHeight: '44px',
                  cursor: 'pointer',
                  font: '400 13px var(--font-body)',
                  color: 'var(--tx)',
                }}
              >
                <input
                  type="checkbox"
                  id="is_free_preview"
                  checked={lessonForm.is_free_preview}
                  onChange={(e) => setLessonForm({ ...lessonForm, is_free_preview: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                Free preview for students who have not activated
              </label>
            </FormSection>
          </form>
        </Modal>
      )}

      {/* ---- destructive confirmation, naming the object ---- */}
      {confirming && (
        <Modal
          danger
          title={`Delete “${confirming.title}”?`}
          description={confirming.note}
          width={460}
          onClose={() => setConfirming(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setConfirming(null)}>Cancel</button>
              <button type="button" className="btn-danger" onClick={runConfirmed}>
                {confirmLabel[confirming.kind]}
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
