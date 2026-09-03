import React, { useState, useEffect } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import {
  PageHead, TableCard, Toolbar, Chip, Table, Row, Cell, CellTitle, CellSub, RowChevron,
  StatusDot, Badge, EmptyState, SkeletonRows, Pagination, Modal, Drawer, Field, FormGrid,
  FormSection, Notice, Num,
} from '../components/admin/ui';

export default function AdminTests() {
  const [tests, setTests] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [questionBank, setQuestionBank] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  // Form toggle
  const [showForm, setShowForm] = useState(false);
  // presentation only: the toolbar chip and the row detail drawer
  const [publishFilter, setPublishFilter] = useState('all');
  const [detailTest, setDetailTest] = useState(null);
  const [testForm, setTestForm] = useState({
    id: null,
    title: '',
    course_id: '',
    batch_id: '',
    type: 'mock',
    duration_seconds: 3600,
    max_attempts: 1,
    instructions: '',
    available_from: '',
    available_until: '',
    // Exam pattern. Empty / false throughout = an ordinary ungraded mock.
    cutoff_marks: '',
    cutoff_percentage: '',
    shuffle_questions: false,
    shuffle_options: false,
    shift_group: '',
    shift_label: '',
    normalization_method: 'none',
    sections: [
      { title: 'Section 1', duration_seconds: 1800, cutoff_marks: '', is_qualifying: false, question_ids: [], questions: [] }
    ]
  });

  // Current active section index inside form editor
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);

  // Search states for Question Bank Picker inside form editor
  const [qSearchSubject, setQSearchSubject] = useState('');
  const [qSearchTopic, setQSearchTopic] = useState('');
  const [qSearchQuery, setQSearchQuery] = useState('');
  const [qBankPage, setQBankPage] = useState(1);
  const [qBankLastPage, setQBankLastPage] = useState(1);

  const fetchTests = async () => {
    try {
      const res = await api.get('/api/admin/tests', { params: { page } });
      setTests(res.data.data);
      setLastPage(res.data.last_page);
    } catch (err) {
      setError('Failed to fetch tests.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await api.get('/api/admin/courses');
      setCourses(res.data);
    } catch (e) {}
  };

  const fetchBatches = async (courseId) => {
    if (!courseId) {
      setBatches([]);
      return;
    }
    try {
      const res = await api.get(`/api/admin/courses/${courseId}/batches`);
      setBatches(res.data);
    } catch (e) {}
  };

  const fetchQuestionBank = async () => {
    try {
      const params = {
        page: qBankPage,
        subject: qSearchSubject,
        topic: qSearchTopic,
        search: qSearchQuery
      };
      const res = await api.get('/api/admin/questions', { params });
      setQuestionBank(res.data.data);
      setQBankLastPage(res.data.last_page);
    } catch (e) {}
  };

  useEffect(() => {
    fetchTests();
    fetchCourses();
  }, [page]);

  useEffect(() => {
    if (showForm) {
      fetchQuestionBank();
    }
  }, [showForm, qBankPage, qSearchSubject, qSearchTopic]);

  useEffect(() => {
    if (testForm.course_id) {
      fetchBatches(testForm.course_id);
    }
  }, [testForm.course_id]);

  const handleQSearchSubmit = (e) => {
    e.preventDefault();
    setQBankPage(1);
    fetchQuestionBank();
  };

  // Section CRUD inside editor
  const addSectionToForm = () => {
    const nextIdx = testForm.sections.length;
    setTestForm({
      ...testForm,
      sections: [
        ...testForm.sections,
        { title: `Section ${nextIdx + 1}`, duration_seconds: 1800, cutoff_marks: '', is_qualifying: false, question_ids: [], questions: [] }
      ]
    });
    setActiveSectionIdx(nextIdx);
  };

  const removeSectionFromForm = (idx) => {
    if (testForm.sections.length <= 1) return;
    const updated = testForm.sections.filter((_, i) => i !== idx);
    setTestForm({ ...testForm, sections: updated });
    setActiveSectionIdx(0);
  };

  // Add question to active section
  const toggleQuestionSelection = (question) => {
    const updatedSections = [...testForm.sections];
    const activeSection = updatedSections[activeSectionIdx];
    
    const exists = activeSection.question_ids.includes(question.id);
    if (exists) {
      // Remove
      activeSection.question_ids = activeSection.question_ids.filter(id => id !== question.id);
      activeSection.questions = activeSection.questions.filter(q => q.id !== question.id);
    } else {
      // Add
      activeSection.question_ids.push(question.id);
      activeSection.questions.push(question);
    }
    setTestForm({ ...testForm, sections: updatedSections });
  };

  const handleTestSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Verification
    if (!testForm.course_id) {
      setError('Please select a course.');
      return;
    }

    // Validate that each section has at least 1 question
    const emptySection = testForm.sections.find(sec => sec.question_ids.length === 0);
    if (emptySection) {
      setError(`Section "${emptySection.title}" must have at least one question.`);
      return;
    }

    // Convert date formats to server format (optional fields)
    // '' means "no bar". It has to go to the server as null, not as an empty
    // string, or numeric validation rejects it and a cut-off becomes impossible
    // to clear once set.
    const blankToNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

    const payload = {
      ...testForm,
      batch_id: testForm.batch_id || null,
      available_from: testForm.available_from ? testForm.available_from.replace('T', ' ') : null,
      available_until: testForm.available_until ? testForm.available_until.replace('T', ' ') : null,
      cutoff_marks: blankToNull(testForm.cutoff_marks),
      cutoff_percentage: blankToNull(testForm.cutoff_percentage),
      shift_group: testForm.shift_group || null,
      shift_label: testForm.shift_label || null,
      sections: testForm.sections.map((sec) => ({
        ...sec,
        cutoff_marks: blankToNull(sec.cutoff_marks),
        is_qualifying: !!sec.is_qualifying,
      })),
    };

    try {
      if (testForm.id) {
        await api.put(`/api/admin/tests/${testForm.id}`, payload);
        setSuccess('Test updated successfully.');
      } else {
        await api.post('/api/admin/tests', payload);
        setSuccess('Test created successfully (Draft).');
      }
      setShowForm(false);
      fetchTests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save test.');
    }
  };

  const editTest = async (testId) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/admin/tests/${testId}`);
      const t = res.data;
      
      // Format sections for form state
      const formattedSections = t.sections.map(sec => ({
        title: sec.title,
        duration_seconds: sec.duration_seconds || 1800,
        // '' not null, so a cleared field round-trips as "no bar" rather than 0.
        cutoff_marks: sec.cutoff_marks ?? '',
        is_qualifying: !!sec.is_qualifying,
        question_ids: sec.questions.map(q => q.id),
        questions: sec.questions
      }));

      // Format dates for input field datetime-local compatibility (YYYY-MM-DDTHH:MM)
      const fmtDate = (dStr) => {
        if (!dStr) return '';
        const d = new Date(dStr);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      setTestForm({
        id: t.id,
        title: t.title,
        course_id: t.course_id,
        batch_id: t.batch_id || '',
        type: t.type,
        duration_seconds: t.duration_seconds,
        max_attempts: t.max_attempts || 1,
        instructions: t.instructions || '',
        available_from: fmtDate(t.available_from),
        available_until: fmtDate(t.available_until),
        cutoff_marks: t.cutoff_marks ?? '',
        cutoff_percentage: t.cutoff_percentage ?? '',
        shuffle_questions: !!t.shuffle_questions,
        shuffle_options: !!t.shuffle_options,
        shift_group: t.shift_group ?? '',
        shift_label: t.shift_label ?? '',
        normalization_method: t.normalization_method || 'none',
        sections: formattedSections
      });
      setActiveSectionIdx(0);
      setShowForm(true);
    } catch (err) {
      setError('Failed to fetch test details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishToggle = async (test) => {
    setError('');
    setSuccess('');
    try {
      if (test.is_published) {
        await api.post(`/api/admin/tests/${test.id}/unpublish`);
        setSuccess(`Test "${test.title}" unpublished successfully.`);
      } else {
        await api.post(`/api/admin/tests/${test.id}/publish`);
        setSuccess(`Test "${test.title}" published successfully!`);
      }
      fetchTests();
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating test status.');
    }
  };

  const COLUMNS = [
    { key: 'title', label: 'Test', width: 'minmax(0,1.9fr)' },
    { key: 'scope', label: 'Course / batch', width: 'minmax(0,1.3fr)', hideBelow: 'tablet' },
    { key: 'type', label: 'Type', width: '100px' },
    { key: 'shape', label: 'Duration', width: '120px', hideBelow: 'tablet' },
    { key: 'status', label: 'Status', width: '110px' },
    { key: 'go', label: '', width: '32px' },
  ];

  const visibleTests = tests.filter((t) =>
    publishFilter === 'all' ? true : publishFilter === 'live' ? t.is_published : !t.is_published,
  );
  const liveTests = tests.filter((t) => t.is_published).length;

  const blankTest = () => ({
    id: null,
    title: '',
    course_id: '',
    batch_id: '',
    type: 'mock',
    duration_seconds: 3600,
    max_attempts: 1,
    instructions: '',
    available_from: '',
    available_until: '',
    sections: [
      { title: 'Quantitative Aptitude', duration_seconds: 1800, cutoff_marks: '', is_qualifying: false, question_ids: [], questions: [] },
    ],
  });

  const startNewTest = () => {
    setTestForm(blankTest());
    setActiveSectionIdx(0);
    setShowForm(true);
  };

  const activeSection = testForm.sections[activeSectionIdx];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
      <style>{`
        .tst-editor { display: grid; grid-template-columns: 1fr; gap: 18px; }
        .tst-editor > section { min-width: 0; }
        @media (min-width: 900px) { .tst-editor { grid-template-columns: 1.2fr 1fr; } }
        @media (min-width: 1300px) { .tst-editor { grid-template-columns: 1.25fr 1fr 1fr; } }
      `}</style>

      <PageHead
        title="Tests manager"
        subtitle="A paper is its sections: each carries its own clock, its own cut-off, and the questions you pick for it."
      >
        <button type="button" onClick={startNewTest} className="btn-primary">
          <Icon name="plus" size={16} strokeWidth={2.4} />
          New test
        </button>
      </PageHead>

      {success && <Notice tone="success" icon="check-circle" onDismiss={() => setSuccess('')}>{success}</Notice>}
      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      <TableCard>
        <Toolbar
          trailing={
            !loading && (
              <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <Num>{liveTests}</Num> live on this page
              </span>
            )
          }
        >
          <Chip active={publishFilter === 'all'} onClick={() => setPublishFilter('all')}>All</Chip>
          <Chip active={publishFilter === 'live'} onClick={() => setPublishFilter('live')}>Published</Chip>
          <Chip active={publishFilter === 'draft'} onClick={() => setPublishFilter('draft')}>Draft</Chip>
        </Toolbar>

        {loading && tests.length === 0 ? (
          <SkeletonRows />
        ) : visibleTests.length === 0 ? (
          <EmptyState
            icon="award"
            message={
              tests.length === 0
                ? 'No test exists yet. Create one, add its sections, then publish it to a batch.'
                : 'No test in that state on this page.'
            }
            action={
              tests.length === 0 && (
                <button type="button" onClick={startNewTest} className="btn-primary">
                  <Icon name="plus" size={16} strokeWidth={2.4} />
                  New test
                </button>
              )
            }
          />
        ) : (
          <>
            <Table columns={COLUMNS}>
              {visibleTests.map((test) => (
                <Row key={test.id} selected={detailTest?.id === test.id} onClick={() => setDetailTest(test)}>
                  <Cell label="Test">
                    <CellTitle>{test.title}</CellTitle>
                    <CellSub>
                      {test.sections_count || 0} sections · {test.max_attempts ? `${test.max_attempts} attempts` : 'unlimited attempts'}
                    </CellSub>
                  </Cell>
                  <Cell label="Course / batch" hideBelow="tablet">
                    <CellTitle>{test.course?.title || 'Unknown course'}</CellTitle>
                    <CellSub>{test.batch?.name || 'All batches'}</CellSub>
                  </Cell>
                  <Cell label="Type">
                    <Badge tone={test.type === 'mock' ? 'primary' : 'success'}>{test.type}</Badge>
                  </Cell>
                  <Cell label="Duration" hideBelow="tablet">
                    <Num style={{ fontSize: '13px', color: 'var(--tx)' }}>{Math.round(test.duration_seconds / 60)}m</Num>
                    <CellSub>{test.total_marks || 0} marks</CellSub>
                  </Cell>
                  <Cell label="Status">
                    <StatusDot tone={test.is_published ? 'success' : 'reward'}>
                      {test.is_published ? 'Published' : 'Draft'}
                    </StatusDot>
                  </Cell>
                  <Cell align="right">
                    <RowChevron onClick={() => setDetailTest(test)} label="Open test" />
                  </Cell>
                </Row>
              ))}
            </Table>
            <Pagination page={page} lastPage={lastPage} onPage={setPage} />
          </>
        )}
      </TableCard>

      {/* ---- row detail ---- */}
      {detailTest && (
        <Drawer
          title={detailTest.title}
          subtitle={`${detailTest.course?.title || 'Unknown course'} · ${detailTest.batch?.name || 'All batches'}`}
          onClose={() => setDetailTest(null)}
          footer={
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { handlePublishToggle(detailTest); setDetailTest(null); }}
              >
                {detailTest.is_published ? 'Unpublish' : 'Publish'}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => { const id = detailTest.id; setDetailTest(null); editTest(id); }}
              >
                <Icon name="edit" size={16} />
                Edit test
              </button>
            </>
          }
        >
          <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
            {[
              ['Type', detailTest.type],
              ['Sections', detailTest.sections_count || 0],
              ['Duration', `${Math.round(detailTest.duration_seconds / 60)} min`],
              ['Total marks', detailTest.total_marks || 0],
              ['Max attempts', detailTest.max_attempts || 'Unlimited'],
            ].map(([label, value], i) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginTop: i === 0 ? 0 : '9px',
                  font: '400 12.5px var(--font-body)',
                  color: 'var(--muted)',
                }}
              >
                <span>{label}</span>
                <Num style={{ color: 'var(--tx)', fontSize: '12.5px' }}>{value}</Num>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginTop: '9px',
                font: '400 12.5px var(--font-body)',
                color: 'var(--muted)',
              }}
            >
              <span>Status</span>
              <StatusDot tone={detailTest.is_published ? 'success' : 'reward'}>
                {detailTest.is_published ? 'Published' : 'Draft'}
              </StatusDot>
            </div>
          </div>
        </Drawer>
      )}

      {/* ---- editor: setup · selected questions · picker ---- */}
      {showForm && (
        <Modal
          title={testForm.id ? 'Edit test' : 'New test'}
          description="Fill the setup on the left, pick a section, then assign its questions from the bank."
          width={1360}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" form="test-form" className="btn-primary">Save test</button>
            </>
          }
        >
          <div className="tst-editor">

            {/* ---- setup ---- */}
            <section>
              <form onSubmit={handleTestSubmit} id="test-form">
                <FormSection title="Basics">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <Field label="Test title" htmlFor="tst-title">
                      <input
                        id="tst-title"
                        type="text"
                        value={testForm.title}
                        onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                        className="form-input"
                        required
                      />
                    </Field>
                    <FormGrid min="170px">
                      <Field label="Course" htmlFor="tst-course">
                        <select
                          id="tst-course"
                          value={testForm.course_id}
                          onChange={(e) => setTestForm({ ...testForm, course_id: e.target.value, batch_id: '' })}
                          className="form-input"
                          required
                        >
                          <option value="">Select a course</option>
                          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                      </Field>
                      <Field label="Batch scope" hint="Leave unset to open it to every batch." htmlFor="tst-batch">
                        <select
                          id="tst-batch"
                          value={testForm.batch_id}
                          onChange={(e) => setTestForm({ ...testForm, batch_id: e.target.value })}
                          className="form-input"
                        >
                          <option value="">All batches</option>
                          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </Field>
                    </FormGrid>
                    <FormGrid min="150px">
                      <Field label="Type" htmlFor="tst-type">
                        <select
                          id="tst-type"
                          value={testForm.type}
                          onChange={(e) => setTestForm({ ...testForm, type: e.target.value, max_attempts: e.target.value === 'mock' ? 1 : '' })}
                          className="form-input"
                        >
                          <option value="mock">Mock test</option>
                          <option value="practice">Practice test</option>
                        </select>
                      </Field>
                      <Field label="Duration (seconds)" htmlFor="tst-dur">
                        <input
                          id="tst-dur"
                          type="number"
                          value={testForm.duration_seconds}
                          onChange={(e) => setTestForm({ ...testForm, duration_seconds: parseInt(e.target.value) })}
                          className="form-input"
                          required
                        />
                      </Field>
                      <Field label="Max attempts" hint="Blank = unlimited." htmlFor="tst-att">
                        <input
                          id="tst-att"
                          type="number"
                          value={testForm.max_attempts}
                          onChange={(e) => setTestForm({ ...testForm, max_attempts: e.target.value ? parseInt(e.target.value) : '' })}
                          className="form-input"
                          placeholder="Unlimited"
                        />
                      </Field>
                    </FormGrid>
                    <FormGrid min="180px">
                      <Field label="Available from" htmlFor="tst-from">
                        <input
                          id="tst-from"
                          type="datetime-local"
                          value={testForm.available_from}
                          onChange={(e) => setTestForm({ ...testForm, available_from: e.target.value })}
                          className="form-input"
                        />
                      </Field>
                      <Field label="Available until" htmlFor="tst-until">
                        <input
                          id="tst-until"
                          type="datetime-local"
                          value={testForm.available_until}
                          onChange={(e) => setTestForm({ ...testForm, available_until: e.target.value })}
                          className="form-input"
                        />
                      </Field>
                    </FormGrid>
                    <Field label="Instructions" htmlFor="tst-inst">
                      <textarea
                        id="tst-inst"
                        value={testForm.instructions}
                        onChange={(e) => setTestForm({ ...testForm, instructions: e.target.value })}
                        className="form-input"
                        rows={2}
                      />
                    </Field>
                  </div>
                </FormSection>

                <FormSection
                  title="Exam pattern"
                  description="Leave the cut-off blank for an ungraded mock. Absolute marks win over the percentage when both are set, and the bar applies to the merit score."
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <FormGrid min="170px">
                      <Field label="Overall cut-off (marks)" htmlFor="tst-com">
                        <input
                          id="tst-com"
                          type="number"
                          min="0"
                          step="0.25"
                          value={testForm.cutoff_marks}
                          onChange={(e) => setTestForm({ ...testForm, cutoff_marks: e.target.value })}
                          className="form-input"
                          placeholder="none"
                        />
                      </Field>
                      <Field label="Overall cut-off (%)" htmlFor="tst-cop">
                        <input
                          id="tst-cop"
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={testForm.cutoff_percentage}
                          onChange={(e) => setTestForm({ ...testForm, cutoff_percentage: e.target.value })}
                          className="form-input"
                          placeholder="none"
                        />
                      </Field>
                    </FormGrid>

                    <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '44px', font: '400 13px var(--font-body)', color: 'var(--tx)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={testForm.shuffle_questions}
                          onChange={(e) => setTestForm({ ...testForm, shuffle_questions: e.target.checked })}
                        />
                        Shuffle questions per candidate
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '44px', font: '400 13px var(--font-body)', color: 'var(--tx)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={testForm.shuffle_options}
                          onChange={(e) => setTestForm({ ...testForm, shuffle_options: e.target.checked })}
                        />
                        Shuffle options per candidate
                      </label>
                    </div>

                    <FormGrid min="150px">
                      <Field label="Shift group" htmlFor="tst-sg">
                        <input
                          id="tst-sg"
                          type="text"
                          value={testForm.shift_group}
                          onChange={(e) => setTestForm({ ...testForm, shift_group: e.target.value })}
                          className="form-input"
                          placeholder="e.g. cgl-2026-t1"
                        />
                      </Field>
                      <Field label="Shift label" htmlFor="tst-sl">
                        <input
                          id="tst-sl"
                          type="text"
                          value={testForm.shift_label}
                          onChange={(e) => setTestForm({ ...testForm, shift_label: e.target.value })}
                          className="form-input"
                          placeholder="e.g. morning"
                        />
                      </Field>
                      <Field label="Normalisation" htmlFor="tst-nm">
                        <select
                          id="tst-nm"
                          value={testForm.normalization_method}
                          onChange={(e) => setTestForm({ ...testForm, normalization_method: e.target.value })}
                          className="form-input"
                        >
                          <option value="none">None</option>
                          <option value="equipercentile">Equipercentile</option>
                          <option value="zscore">Z-score (linear)</option>
                        </select>
                      </Field>
                    </FormGrid>

                    <p style={{ margin: 0, font: '400 11.5px/1.55 var(--font-body)', color: 'var(--muted)' }}>
                      Tests sharing a shift group are one exam run in several sittings. Normalised marks are computed by{' '}
                      <code style={{ font: '500 11px var(--font-mono)', background: 'var(--surf)', padding: '2px 5px', borderRadius: '5px' }}>
                        php artisan practest:normalize
                      </code>{' '}
                      once every shift has finished — running it early would score a half cohort.
                    </p>
                  </div>
                </FormSection>
              </form>

              <FormSection title="Sections" description="Pick one to edit which questions it holds. A qualifying section must be cleared, but its marks stay out of the merit score.">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                  <button type="button" onClick={addSectionToForm} className="btn-secondary" style={{ padding: '8px 13px', minHeight: '40px', fontSize: '12px' }}>
                    <Icon name="plus" size={14} strokeWidth={2.4} />
                    Add section
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {testForm.sections.map((sec, idx) => {
                    const isActive = activeSectionIdx === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setActiveSectionIdx(idx)}
                        style={{
                          padding: '13px',
                          borderRadius: '14px',
                          border: `1px solid ${isActive ? 'var(--primary-border)' : 'var(--line)'}`,
                          background: isActive ? 'var(--primary-soft)' : 'var(--card2)',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            type="text"
                            aria-label={`Section ${idx + 1} title`}
                            value={sec.title}
                            onChange={(e) => {
                              const updated = [...testForm.sections];
                              updated[idx].title = e.target.value;
                              setTestForm({ ...testForm, sections: updated });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--tx)',
                              font: '600 13.5px var(--font-body)',
                              width: '100%',
                              outline: 'none',
                              padding: 0,
                            }}
                          />

                          <div style={{ marginTop: '7px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', font: '400 11.5px var(--font-body)', color: 'var(--muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              Duration
                              <input
                                type="number"
                                aria-label={`Duration for ${sec.title}`}
                                value={sec.duration_seconds}
                                onChange={(e) => {
                                  const updated = [...testForm.sections];
                                  updated[idx].duration_seconds = parseInt(e.target.value) || 0;
                                  setTestForm({ ...testForm, sections: updated });
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  borderBottom: '1px solid var(--line2)',
                                  color: 'var(--tx)',
                                  width: '58px',
                                  outline: 'none',
                                  textAlign: 'center',
                                  font: '600 11.5px var(--font-mono)',
                                }}
                              />
                              s
                            </span>
                            <span>
                              <Num style={{ fontSize: '11.5px', color: 'var(--tx2)' }}>{sec.question_ids.length}</Num> questions
                            </span>
                          </div>

                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginTop: '7px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', font: '400 11.5px var(--font-body)', color: 'var(--muted)' }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              Cut-off
                              <input
                                type="number"
                                min="0"
                                step="0.25"
                                aria-label={`Cut-off for ${sec.title}`}
                                value={sec.cutoff_marks ?? ''}
                                placeholder="none"
                                onChange={(e) => {
                                  const updated = [...testForm.sections];
                                  updated[idx].cutoff_marks = e.target.value;
                                  setTestForm({ ...testForm, sections: updated });
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  borderBottom: '1px solid var(--line2)',
                                  color: 'var(--tx)',
                                  width: '62px',
                                  outline: 'none',
                                  textAlign: 'center',
                                  font: '600 11.5px var(--font-mono)',
                                }}
                              />
                            </span>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={!!sec.is_qualifying}
                                onChange={(e) => {
                                  const updated = [...testForm.sections];
                                  updated[idx].is_qualifying = e.target.checked;
                                  setTestForm({ ...testForm, sections: updated });
                                }}
                              />
                              Qualifying only
                            </label>
                          </div>
                        </div>

                        {testForm.sections.length > 1 && (
                          <button
                            type="button"
                            className="adm-rowaction"
                            onClick={(e) => { e.stopPropagation(); removeSectionFromForm(idx); }}
                            aria-label={`Remove ${sec.title}`}
                            title="Remove section"
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </FormSection>
            </section>

            {/* ---- questions already in the active section ---- */}
            <section>
              <FormSection title={`In “${activeSection?.title || 'this section'}”`} description="Remove anything that does not belong; the order here is the order candidates see.">
                {activeSection?.questions.length === 0 ? (
                  <EmptyState icon="file-text" message="Nothing assigned yet. Use the picker to add questions to this section." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', maxHeight: '46vh', overflowY: 'auto' }}>
                    {activeSection?.questions.map((q, qidx) => (
                      <div
                        key={q.id}
                        style={{
                          padding: '11px 12px',
                          background: 'var(--card2)',
                          border: '1px solid var(--line)',
                          borderRadius: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <Num style={{ fontSize: '11.5px', color: 'var(--primary)', flex: 'none' }}>{qidx + 1}</Num>
                          <span style={{ font: '400 12.5px var(--font-body)', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {q.question_text.replace(/\$/g, '')}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="adm-rowaction"
                          onClick={() => toggleQuestionSelection(q)}
                          aria-label="Remove from section"
                          title="Remove from section"
                        >
                          <Icon name="x" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>
            </section>

            {/* ---- question bank picker ---- */}
            <section>
              <FormSection title="Question picker" description="Search the bank and tap a card to add it to the active section.">
                <form onSubmit={handleQSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '14px' }}>
                  <FormGrid min="120px">
                    <input
                      type="text"
                      aria-label="Subject"
                      placeholder="Subject"
                      value={qSearchSubject}
                      onChange={(e) => setQSearchSubject(e.target.value)}
                      className="form-input"
                    />
                    <input
                      type="text"
                      aria-label="Topic"
                      placeholder="Topic"
                      value={qSearchTopic}
                      onChange={(e) => setQSearchTopic(e.target.value)}
                      className="form-input"
                    />
                  </FormGrid>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      aria-label="Search question text"
                      placeholder="Search question text…"
                      value={qSearchQuery}
                      onChange={(e) => setQSearchQuery(e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn-secondary" style={{ flex: 'none', padding: '0 16px' }}>
                      <Icon name="search" size={15} />
                    </button>
                  </div>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', maxHeight: '42vh', overflowY: 'auto' }}>
                  {questionBank.length === 0 ? (
                    <EmptyState icon="search" message="No question matches that search." />
                  ) : (
                    questionBank.map((q) => {
                      const isSelected = activeSection?.question_ids.includes(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => toggleQuestionSelection(q)}
                          aria-pressed={isSelected}
                          style={{
                            padding: '11px 12px',
                            background: isSelected ? 'var(--success-bg)' : 'var(--card2)',
                            border: `1px solid ${isSelected ? 'var(--success-border)' : 'var(--line)'}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                            textAlign: 'left',
                            minHeight: '44px',
                          }}
                        >
                          <span style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                            <span className="t-overline" style={{ color: 'var(--muted)', fontSize: '9px' }}>
                              {q.subject} · {q.topic}
                            </span>
                            <span style={{ font: '600 11px var(--font-body)', color: isSelected ? 'var(--success)' : 'var(--primary)', flex: 'none' }}>
                              {isSelected ? 'Added' : 'Add'}
                            </span>
                          </span>
                          <span
                            style={{
                              font: '400 12.5px/1.45 var(--font-body)',
                              color: 'var(--tx2)',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {q.question_text.replace(/\$/g, '')}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                {qBankLastPage > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setQBankPage((prev) => Math.max(1, prev - 1))}
                      className="btn-secondary"
                      style={{ padding: '8px 12px', minHeight: '40px', fontSize: '12px' }}
                      disabled={qBankPage === 1}
                    >
                      <Icon name="chevron-left" size={15} />
                    </button>
                    <span style={{ font: '500 12px var(--font-body)', color: 'var(--muted)' }}>
                      <Num>{qBankPage}</Num> / <Num>{qBankLastPage}</Num>
                    </span>
                    <button
                      type="button"
                      onClick={() => setQBankPage((prev) => Math.min(qBankLastPage, prev + 1))}
                      className="btn-secondary"
                      style={{ padding: '8px 12px', minHeight: '40px', fontSize: '12px' }}
                      disabled={qBankPage === qBankLastPage}
                    >
                      <Icon name="chevron-right" size={15} />
                    </button>
                  </div>
                )}
              </FormSection>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
