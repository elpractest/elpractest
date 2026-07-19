import React, { useState, useEffect } from 'react';
import api from '../api';

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
    sections: [
      { title: 'Section 1', duration_seconds: 1800, question_ids: [], questions: [] }
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
        { title: `Section ${nextIdx + 1}`, duration_seconds: 1800, question_ids: [], questions: [] }
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
    const payload = {
      ...testForm,
      batch_id: testForm.batch_id || null,
      available_from: testForm.available_from ? testForm.available_from.replace('T', ' ') : null,
      available_until: testForm.available_until ? testForm.available_until.replace('T', ' ') : null,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>Tests Manager</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Configure online tests, sectional timings, and assign questions.</p>
        </div>
        <button 
          onClick={() => {
            setTestForm({
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
                { title: 'Quantitative Aptitude', duration_seconds: 1800, question_ids: [], questions: [] }
              ]
            });
            setActiveSectionIdx(0);
            setShowForm(true);
          }} 
          className="btn-primary"
        >
          ➕ Create Test
        </button>
      </div>

      {success && (
        <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '8px', color: '#10b981' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* Tests Table */}
      <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <th style={{ padding: '12px 16px' }}>Test Title</th>
              <th style={{ padding: '12px 16px' }}>Course / Batch Scope</th>
              <th style={{ padding: '12px 16px' }}>Type</th>
              <th style={{ padding: '12px 16px' }}>Duration / Marks</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && tests.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading tests...</td>
              </tr>
            ) : tests.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No tests created yet.</td>
              </tr>
            ) : (
              tests.map((test) => (
                <tr key={test.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600 }}>{test.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {test.sections_count || 0} Sections • Max Attempts: {test.max_attempts || 'Unlimited'}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div>{test.course?.title || 'Unknown Course'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Batch: {test.batch?.name || 'All Students'}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        background: test.type === 'mock' ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)',
                        color: test.type === 'mock' ? 'var(--accent-color)' : '#10b981'
                      }}
                    >
                      {test.type}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div>{Math.round(test.duration_seconds / 60)} mins</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Total Marks: {test.total_marks || 0}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        background: test.is_published ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                        color: test.is_published ? '#10b981' : 'var(--text-secondary)'
                      }}
                    >
                      {test.is_published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button 
                        onClick={() => handlePublishToggle(test)}
                        className="btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      >
                        {test.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => editTest(test.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Edit">✏️</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && lastPage > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              className="btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              disabled={page === 1}
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Page {page} of {lastPage}
            </span>
            <button 
              onClick={() => setPage(p => Math.min(lastPage, p + 1))} 
              className="btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              disabled={page === lastPage}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Editor Modal containing Syllabus Sections and Question Bank Picker */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '95%', maxWidth: '1400px', height: '90vh', padding: '30px', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '20px', overflow: 'hidden' }}>
            
            {/* Column 1: Test Details & Section Setup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '10px' }}>
              <h3 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
                {testForm.id ? 'Edit Test Setup' : 'Create Test Setup'}
              </h3>
              
              <form onSubmit={handleTestSubmit} id="test-form" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Test Title</label>
                  <input type="text" value={testForm.title} onChange={(e) => setTestForm({ ...testForm, title: e.target.value })} className="form-input" style={{ padding: '8px 12px' }} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Course</label>
                    <select value={testForm.course_id} onChange={(e) => setTestForm({ ...testForm, course_id: e.target.value, batch_id: '' })} className="form-input" style={{ padding: '8px 12px' }} required>
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Batch Scope (Optional)</label>
                    <select value={testForm.batch_id} onChange={(e) => setTestForm({ ...testForm, batch_id: e.target.value })} className="form-input" style={{ padding: '8px 12px' }}>
                      <option value="">All Batches</option>
                      {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Type</label>
                    <select value={testForm.type} onChange={(e) => setTestForm({ ...testForm, type: e.target.value, max_attempts: e.target.value === 'mock' ? 1 : '' })} className="form-input" style={{ padding: '8px 12px' }}>
                      <option value="mock">Mock Test</option>
                      <option value="practice">Practice Test</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Duration (Sec)</label>
                    <input type="number" value={testForm.duration_seconds} onChange={(e) => setTestForm({ ...testForm, duration_seconds: parseInt(e.target.value) })} className="form-input" style={{ padding: '8px 12px' }} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Max Attempts</label>
                    <input type="number" value={testForm.max_attempts} onChange={(e) => setTestForm({ ...testForm, max_attempts: e.target.value ? parseInt(e.target.value) : '' })} className="form-input" style={{ padding: '8px 12px' }} placeholder="Unlimited" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Available From</label>
                    <input type="datetime-local" value={testForm.available_from} onChange={(e) => setTestForm({ ...testForm, available_from: e.target.value })} className="form-input" style={{ padding: '8px 12px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Available Until</label>
                    <input type="datetime-local" value={testForm.available_until} onChange={(e) => setTestForm({ ...testForm, available_until: e.target.value })} className="form-input" style={{ padding: '8px 12px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Instructions</label>
                  <textarea value={testForm.instructions} onChange={(e) => setTestForm({ ...testForm, instructions: e.target.value })} className="form-input" rows={2} />
                </div>
              </form>

              {/* Sections Listing inside Creator */}
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Test Sections</h4>
                  <button onClick={addSectionToForm} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>➕ Add Section</button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {testForm.sections.map((sec, idx) => {
                    const isActive = activeSectionIdx === idx;
                    return (
                      <div 
                        key={idx}
                        onClick={() => setActiveSectionIdx(idx)}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: isActive ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                          background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <input 
                            type="text" 
                            value={sec.title} 
                            onChange={(e) => {
                              const updated = [...testForm.sections];
                              updated[idx].title = e.target.value;
                              setTestForm({ ...testForm, sections: updated });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ background: 'transparent', border: 'none', color: '#ffffff', fontWeight: 'bold', fontSize: '0.9rem', width: '100%', outline: 'none' }}
                          />
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                            <span>Duration:</span>
                            <input 
                              type="number" 
                              value={sec.duration_seconds} 
                              onChange={(e) => {
                                const updated = [...testForm.sections];
                                updated[idx].duration_seconds = parseInt(e.target.value) || 0;
                                setTestForm({ ...testForm, sections: updated });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '50px', outline: 'none', textAlign: 'center', fontSize: '0.75rem' }}
                            />
                            <span>s • Questions: {sec.question_ids.length}</span>
                          </div>
                        </div>
                        {testForm.sections.length > 1 && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSectionFromForm(idx);
                            }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Save bar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                <button type="submit" form="test-form" className="btn-primary" style={{ padding: '8px 24px' }}>Save Test Configuration</button>
              </div>

            </div>

            {/* Column 2: Selected Questions Preview for Active Section */}
            <div style={{ borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              <div>
                <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--accent-color)' }}>
                  Selected questions in: "{testForm.sections[activeSectionIdx]?.title}"
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: '4px 0 0 0' }}>Reorder or remove questions assigned to this section.</p>
              </div>

              {testForm.sections[activeSectionIdx]?.questions.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '40px 20px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px', margin: 'auto 0' }}>
                  No questions selected yet. Use the picker on the right to assign questions.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {testForm.sections[activeSectionIdx]?.questions.map((q, qidx) => (
                    <div 
                      key={q.id}
                      style={{
                        padding: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: '10px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--accent-color)', marginRight: '6px' }}>#{qidx + 1}</span>
                        {q.question_text.replace(/\$/g, '')}
                      </div>
                      <button 
                        onClick={() => toggleQuestionSelection(q)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 3: Question Bank Picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              <div>
                <h4 style={{ margin: 0, fontWeight: 700 }}>Question Picker</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: '4px 0 0 0' }}>Search and add questions to the active section.</p>
              </div>

              {/* Mini-filters */}
              <form onSubmit={handleQSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="text" placeholder="Subj" value={qSearchSubject} onChange={(e) => setQSearchSubject(e.target.value)} className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  <input type="text" placeholder="Topic" value={qSearchTopic} onChange={(e) => setQSearchTopic(e.target.value)} className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" placeholder="Search text..." value={qSearchQuery} onChange={(e) => setQSearchQuery(e.target.value)} className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', flex: 1 }} />
                  <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Go</button>
                </div>
              </form>

              {/* Picker List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                {questionBank.map((q) => {
                  const isSelected = testForm.sections[activeSectionIdx]?.question_ids.includes(q.id);
                  return (
                    <div 
                      key={q.id}
                      onClick={() => toggleQuestionSelection(q)}
                      style={{
                        padding: '12px',
                        background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid #10b981' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        fontSize: '0.8rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{q.subject} &gt; {q.topic}</span>
                        <span style={{ color: isSelected ? '#10b981' : 'var(--text-secondary)' }}>{isSelected ? '✓ Added' : '➕ Add'}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }}>
                        {q.question_text.replace(/\$/g, '')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mini Pagination */}
              {qBankLastPage > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
                  <button type="button" onClick={() => setQBankPage(p => Math.max(1, p - 1))} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} disabled={qBankPage === 1}>Prev</button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{qBankPage} / {qBankLastPage}</span>
                  <button type="button" onClick={() => setQBankPage(p => Math.min(qBankLastPage, p + 1))} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} disabled={qBankPage === qBankLastPage}>Next</button>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
