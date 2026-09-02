import React, { useState, useEffect } from 'react';
import api from '../api';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Math Renderer helper
const renderMath = (text) => {
  if (!text) return { __html: '' };
  try {
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Process block math $$...$$
    const blocks = escaped.split(/\$\$(.*?)\$\$/gs);
    for (let i = 1; i < blocks.length; i += 2) {
      const math = blocks[i];
      try {
        const rendered = katex.renderToString(math, { displayMode: true, throwOnError: false });
        escaped = escaped.replace(`$$${math}$$`, rendered);
      } catch (e) {
        // ignore
      }
    }

    // Process inline math $...$
    const inlineRegex = /\$((?!\$)[^\$]+?)\$/g;
    escaped = escaped.replace(inlineRegex, (match, math) => {
      try {
        return katex.renderToString(math, { displayMode: false, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    // Replace linebreaks with <br/> for paragraph rendering
    escaped = escaped.replace(/\n/g, '<br/>');

    return { __html: escaped };
  } catch (err) {
    return { __html: text };
  }
};

export default function AdminQuestions({ csvState, triggerCsvImport, csvJobId }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [search, setSearch] = useState('');
  // Review queue + item-health filters.
  const [status, setStatus] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  // Item analysis for one question, fetched on demand.
  const [analysis, setAnalysis] = useState(null);
  const [analysisFor, setAnalysisFor] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Drag and Drop CSV file state
  const [dragOver, setDragOver] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Single Question Form State
  const [showForm, setShowForm] = useState(false);
  const blankForm = () => ({
    id: null,
    subject: '',
    topic: '',
    difficulty: 'medium',
    marks: 1.0,
    negative_marks: 0.25,
    question_text: '',
    explanation: '',
    exam_tags: [],
    question_type: 'single_choice',
    numeric_answer: '',
    numeric_tolerance: 0,
    passage_id: '',
    options: [
      { label: 'a', option_text: '', is_correct: false },
      { label: 'b', option_text: '', is_correct: false },
      { label: 'c', option_text: '', is_correct: false },
      { label: 'd', option_text: '', is_correct: false },
    ]
  });
  const [form, setForm] = useState(blankForm());

  // Passages — shared comprehension text a question can link to. A manual,
  // low-volume authoring flow (unlike the CSV path for plain questions).
  const [passages, setPassages] = useState([]);
  const [showPassageManager, setShowPassageManager] = useState(false);
  const [passageForm, setPassageForm] = useState({ id: null, title: '', body: '' });

  const fetchPassages = async () => {
    try {
      const res = await api.get('/api/admin/passages', { params: { per_page: 100 } });
      setPassages(res.data.data || []);
    } catch (err) {
      // Non-critical — the picker just stays empty.
    }
  };

  useEffect(() => { fetchPassages(); }, []);

  const savePassage = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (passageForm.id) {
        await api.put(`/api/admin/passages/${passageForm.id}`, passageForm);
      } else {
        await api.post('/api/admin/passages', passageForm);
      }
      setPassageForm({ id: null, title: '', body: '' });
      fetchPassages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save passage.');
    }
  };

  const deletePassage = async (id) => {
    if (!window.confirm('Delete this passage? Only possible while no questions are linked to it.')) return;
    setError('');
    try {
      await api.delete(`/api/admin/passages/${id}`);
      fetchPassages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete passage.');
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        subject,
        topic,
        difficulty,
        search,
        status,
        // Server-side filter for items whose measured stats look wrong.
        ...(flaggedOnly ? { flagged: 1 } : {}),
      };
      const res = await api.get('/api/admin/questions', { params });
      setQuestions(res.data.data);
      setLastPage(res.data.last_page);
    } catch (err) {
      setError('Failed to load questions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [page, subject, topic, difficulty, status, flaggedOnly]);

  /**
   * Move a question through review. Approving is the only transition that lets
   * it into a published test, and it is recorded against the reviewer.
   */
  const reviewQuestion = async (questionId, nextStatus) => {
    setError(''); setSuccess('');
    try {
      await api.post(`/api/admin/questions/${questionId}/review`, { status: nextStatus });
      setSuccess(`Question marked ${nextStatus.replace('_', ' ')}.`);
      fetchQuestions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update review status.');
    }
  };

  /** Difficulty, discrimination and distractor breakdown, from real attempts. */
  const openAnalysis = async (question) => {
    setAnalysisFor(question);
    setAnalysis(null);
    setAnalysisLoading(true);
    try {
      const res = await api.get(`/api/admin/questions/${question.id}/item-analysis`);
      setAnalysis(res.data.analysis);
    } catch (err) {
      setError('Failed to load item analysis.');
      setAnalysisFor(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchQuestions();
  };

  // Option text / correct toggle helpers
  const handleOptionTextChange = (index, value) => {
    const updatedOptions = [...form.options];
    updatedOptions[index].option_text = value;
    setForm({ ...form, options: updatedOptions });
  };

  // single_choice: picking one clears every other (radio behaviour).
  // multi_select: each option toggles independently (checkbox behaviour) —
  // several may be correct, matching a "which of the above" statement question.
  const handleCorrectOptionSelect = (index) => {
    const updatedOptions = form.question_type === 'multi_select'
      ? form.options.map((opt, i) => i === index ? { ...opt, is_correct: !opt.is_correct } : opt)
      : form.options.map((opt, i) => ({ ...opt, is_correct: i === index }));
    setForm({ ...form, options: updatedOptions });
  };

  const nextOptionLabel = () => 'abcdef'[form.options.length] || null;

  const addOption = () => {
    const label = nextOptionLabel();
    if (!label || form.options.length >= 6) return;
    setForm({ ...form, options: [...form.options, { label, option_text: '', is_correct: false }] });
  };

  const removeOption = (index) => {
    if (form.options.length <= 2) return;
    setForm({ ...form, options: form.options.filter((_, i) => i !== index) });
  };

  // Question Form submit
  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const isNumeric = form.question_type === 'numeric';

    if (isNumeric) {
      if (form.numeric_answer === '' || form.numeric_answer === null) {
        setError('Enter the correct numeric answer.');
        return;
      }
    } else {
      const correctCount = form.options.filter(opt => opt.is_correct).length;
      if (form.question_type === 'single_choice' && correctCount !== 1) {
        setError(`Exactly one option must be marked correct (${correctCount} were).`);
        return;
      }
      if (form.question_type === 'multi_select' && correctCount < 1) {
        setError('Select at least one correct option.');
        return;
      }
    }

    const payload = { ...form };
    if (isNumeric) {
      delete payload.options;
    } else {
      delete payload.numeric_answer;
      delete payload.numeric_tolerance;
    }
    if (!payload.passage_id) payload.passage_id = null;

    try {
      if (form.id) {
        await api.put(`/api/admin/questions/${form.id}`, payload);
        setSuccess('Question updated successfully.');
      } else {
        await api.post('/api/admin/questions', payload);
        setSuccess('Question created successfully.');
      }
      setShowForm(false);
      fetchQuestions();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving question.');
    }
  };

  const handleEditClick = (q) => {
    setForm({
      id: q.id,
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      marks: q.marks,
      negative_marks: q.negative_marks,
      question_text: q.question_text,
      explanation: q.explanation || '',
      exam_tags: q.exam_tags || [],
      question_type: q.question_type || 'single_choice',
      numeric_answer: q.numeric_answer ?? '',
      numeric_tolerance: q.numeric_tolerance ?? 0,
      passage_id: q.passage_id ?? '',
      options: q.question_type === 'numeric' || !q.options?.length
        ? blankForm().options
        : q.options.map(opt => ({
            label: opt.label,
            option_text: opt.option_text,
            is_correct: !!opt.is_correct
          }))
    });
    setShowForm(true);
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm('Deactivate this question? It will no longer appear in test selections.')) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/api/admin/questions/${id}`);
      setSuccess('Question deactivated.');
      fetchQuestions();
    } catch (err) {
      setError('Failed to deactivate question.');
    }
  };

  // CSV Drag and Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Only CSV files are supported.');
      return;
    }

    uploadCsvFile(file);
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length === 0) return;
    uploadCsvFile(files[0]);
  };

  const uploadCsvFile = async (file) => {
    setUploadingCsv(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/admin/questions/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      triggerCsvImport(res.data.job_id);
      setSuccess('CSV upload successful. Question import queued.');
    } catch (err) {
      setError(err.response?.data?.message || 'CSV upload failed.');
    } finally {
      setUploadingCsv(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>Question Bank</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Search, create, and upload questions in bulk with LaTeX support.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowPassageManager(true)} className="btn-secondary">
            📖 Passages
          </button>
          <button
            onClick={() => { setForm(blankForm()); setShowForm(true); }}
            className="btn-primary"
          >
            ➕ Add Question
          </button>
        </div>
      </div>

      {success && (
        <div style={{ padding: '16px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '8px', color: 'var(--success)' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* CSV Import Progress Banner (If errors exist, render them) */}
      {csvState.status === 'complete' && csvState.errors && csvState.errors.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px', border: '1px solid var(--danger-border)', background: 'var(--danger-bg)' }}>
          <h3 style={{ color: 'var(--danger)', margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 700 }}>⚠️ Failed CSV Rows Report</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 16px 0' }}>The import successfully registered some rows, but skipped the following lines due to validation errors:</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Row #</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Field</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Error Details</th>
                </tr>
              </thead>
              <tbody>
                {csvState.errors.map((err, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--surface-2)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{err.row}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--accent-color)' }}>{err.field || 'General'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--danger-text)' }}>{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Two columns: CSV drag uploader & Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'start' }}>
        
        {/* CSV Drag and Drop */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="glass-panel"
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            border: dragOver ? '2px dashed var(--accent-color)' : '2px dashed var(--border-color)',
            background: dragOver ? 'var(--accent-soft)' : 'var(--panel-bg)',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div style={{ fontSize: '3rem' }}>📂</div>
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 700 }}>Drag & Drop Question CSV</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Required: subject, topic, difficulty, question_text, option_a...option_f, correct_option, marks, negative_marks, explanation. Optional: question_type (single_choice/multi_select/numeric — defaults to single_choice), numeric_answer, numeric_tolerance. For multi_select, pipe-separate correct_option (e.g. "a|c").</p>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>— OR —</div>
          <label className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer' }}>
            Browse CSV File
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
          </label>
          {uploadingCsv && <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)' }}>Uploading and parsing CSV...</div>}
          {csvJobId && <div style={{ fontSize: '0.85rem', color: 'var(--success)' }}>Queued in background...</div>}
        </div>

        {/* Filters */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px 0', fontWeight: 700 }}>Filter Questions</h2>
          <form onSubmit={handleSearchSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="form-input" placeholder="e.g. Quantitative" style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Topic</label>
              <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="form-input" placeholder="e.g. Algebra" style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="form-input" style={{ padding: '8px 12px', fontSize: '0.9rem' }}>
                <option value="">All</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Review status</label>
              <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="form-input" style={{ padding: '8px 12px', fontSize: '0.9rem' }}>
                <option value="">All</option>
                <option value="pending_review">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Draft</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }} title="Items whose measured statistics suggest a problem">
                <input type="checkbox" checked={flaggedOnly} onChange={(e) => { setPage(1); setFlaggedOnly(e.target.checked); }} />
                Needs attention
              </label>
            </div>
            <div style={{ gridColumn: 'span 3', display: 'flex', gap: '12px' }}>
              <input 
                type="text" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="form-input" 
                placeholder="Search question text..." 
                style={{ padding: '8px 12px', fontSize: '0.9rem', flex: 1 }} 
              />
              <button type="submit" className="btn-primary" style={{ padding: '8px 24px', fontSize: '0.9rem' }}>Search</button>
            </div>
          </form>
        </div>

      </div>

      {/* Questions list Table */}
      <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <th style={{ padding: '12px 16px' }}>Subject / Topic</th>
              <th style={{ padding: '12px 16px' }}>Difficulty</th>
              <th style={{ padding: '12px 16px' }}>Question Text (Preview)</th>
              <th style={{ padding: '12px 16px' }}>Marks (Negative)</th>
              <th style={{ padding: '12px 16px' }}>Review</th>
              <th style={{ padding: '12px 16px' }}>Item health</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading question bank...</td>
              </tr>
            ) : questions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No questions match filters.</td>
              </tr>
            ) : (
              questions.map((q) => (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--surface-2)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600 }}>{q.subject}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{q.topic}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        background: q.difficulty === 'easy' ? 'var(--success-bg)' : q.difficulty === 'medium' ? 'var(--warning-bg)' : 'var(--danger-bg)',
                        color: q.difficulty === 'easy' ? 'var(--success)' : q.difficulty === 'medium' ? 'var(--warning)' : 'var(--danger)'
                      }}
                    >
                      {q.difficulty}
                    </span>
                    {q.question_type && q.question_type !== 'single_choice' && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'capitalize' }}>
                        {q.question_type.replace('_', ' ')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {/* Render KaTeX inline for preview safely */}
                    <span dangerouslySetInnerHTML={renderMath(q.question_text.substring(0, 100))} />
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>+{q.marks}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--danger)', marginLeft: '6px' }}>-{q.negative_marks}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                      background: q.status === 'approved' ? 'var(--success-bg)' : q.status === 'rejected' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                      color: q.status === 'approved' ? 'var(--success)' : q.status === 'rejected' ? 'var(--danger)' : 'var(--warning)',
                    }}>
                      {(q.status || 'approved').replace('_', ' ')}
                    </span>
                    {q.status !== 'approved' && (
                      <button onClick={() => reviewQuestion(q.id, 'approved')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.7rem', marginTop: '6px', display: 'block' }}>Approve</button>
                    )}
                    {q.status !== 'rejected' && (
                      <button onClick={() => reviewQuestion(q.id, 'rejected')} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.7rem', marginTop: '4px', display: 'block' }}>Reject</button>
                    )}
                  </td>
                  <td style={{ padding: '16px', fontSize: '0.78rem' }}>
                    {q.stats_sample_size >= 30 ? (
                      <>
                        <div>p = {Number(q.difficulty_index).toFixed(2)}</div>
                        {/* A NEGATIVE discrimination index means the strong
                            candidates got it wrong — nearly always a wrong key. */}
                        <div style={{ color: q.discrimination_index < 0 ? 'var(--danger)' : q.discrimination_index < 0.15 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>
                          {q.discrimination_index < 0 ? 'check key' : `r = ${Number(q.discrimination_index).toFixed(2)}`}
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>n = {q.stats_sample_size}</div>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {q.stats_sample_size ? `n = ${q.stats_sample_size}` : 'no attempts'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button onClick={() => openAnalysis(q)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Item analysis">📊</button>
                      <button onClick={() => handleEditClick(q)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Edit">✏️</button>
                      <button onClick={() => handleDeleteClick(q.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Deactivate">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination buttons */}
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

      {/* Item analysis modal — measured, not asserted */}
      {analysisFor && (
        <div
          onClick={() => setAnalysisFor(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}
        >
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '620px', maxHeight: '85vh', overflowY: 'auto', padding: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Item analysis</h3>
              <button onClick={() => setAnalysisFor(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span dangerouslySetInnerHTML={renderMath(analysisFor.question_text.substring(0, 160))} />
            </p>

            {analysisLoading ? (
              <p style={{ color: 'var(--text-secondary)' }}>Computing from raw attempts…</p>
            ) : !analysis ? (
              <p style={{ color: 'var(--text-secondary)' }}>This question has no recorded attempts yet.</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                  <Metric label="Difficulty (p)" value={analysis.difficulty_index == null ? '—' : Number(analysis.difficulty_index).toFixed(2)} hint="Share answering correctly" />
                  <Metric
                    label="Discrimination (r)"
                    value={analysis.discrimination_index == null ? '—' : Number(analysis.discrimination_index).toFixed(2)}
                    hint="Strong vs weak separation"
                    danger={analysis.discrimination_index != null && analysis.discrimination_index < 0}
                  />
                  <Metric label="Sample" value={analysis.sample_size} hint={`${analysis.skipped_count} left blank`} />
                </div>

                {analysis.flags && analysis.flags.length > 0 && (
                  <div style={{ marginBottom: '18px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {analysis.flags.map((f) => (
                      <span key={f} style={{
                        fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: '4px',
                        background: f === 'negative_discrimination' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                        color: f === 'negative_discrimination' ? 'var(--danger)' : 'var(--warning)',
                      }}>
                        {f.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {analysis.flags?.includes('negative_discrimination') && (
                  <p style={{ margin: '0 0 16px', padding: '10px 12px', borderRadius: '6px', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>
                    The candidates who scored well overall were MORE likely to get this one wrong.
                    In practice that means the answer key is wrong or the stem is ambiguous.
                  </p>
                )}

                <h4 style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.9rem' }}>Option breakdown</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Option</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Chosen</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Share</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Mean ability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.distractors.map((d) => (
                      <tr key={d.option_id} style={{ borderBottom: '1px solid var(--surface-2)' }}>
                        <td style={{ padding: '7px 8px', fontWeight: d.is_correct ? 700 : 400, color: d.is_correct ? 'var(--success)' : 'inherit' }}>
                          {d.label.toUpperCase()}{d.is_correct ? ' ✓' : ''}
                        </td>
                        <td style={{ padding: '7px 8px', textAlign: 'right' }}>{d.chosen_count}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right' }}>{Math.round(d.chosen_share * 100)}%</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right' }}>{d.mean_ability == null ? '—' : `${d.mean_ability}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  A distractor chosen by the highest-ability candidates is defective. One chosen by
                  nobody is a wasted slot.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Passage manager — shared comprehension text that questions link to */}
      {showPassageManager && (
        <div
          onClick={() => { setShowPassageManager(false); setPassageForm({ id: null, title: '', body: '' }); }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}
        >
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '720px', maxHeight: '85vh', overflowY: 'auto', padding: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800 }}>Comprehension passages</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Author a passage once, then link several questions to it from the question form.
                </p>
              </div>
              <button onClick={() => { setShowPassageManager(false); setPassageForm({ id: null, title: '', body: '' }); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
            </div>

            <form onSubmit={savePassage} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px', padding: '16px', borderRadius: '10px', background: 'var(--surface-sunken, var(--surface-1))' }}>
              <input
                type="text" placeholder="Title (optional, e.g. 'RC Passage 1 — Climate Change')"
                value={passageForm.title} onChange={(e) => setPassageForm({ ...passageForm, title: e.target.value })}
                className="form-input" style={{ padding: '8px 12px' }}
              />
              <textarea
                placeholder="Passage text" rows={5} required
                value={passageForm.body} onChange={(e) => setPassageForm({ ...passageForm, body: e.target.value })}
                className="form-input" style={{ padding: '8px 12px' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                {passageForm.id && (
                  <button type="button" onClick={() => setPassageForm({ id: null, title: '', body: '' })} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>Cancel edit</button>
                )}
                <button type="submit" className="btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>{passageForm.id ? 'Update passage' : 'Add passage'}</button>
              </div>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {passages.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No passages yet.</p>
              )}
              {passages.map(p => (
                <div key={p.id} style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.title || `Passage #${p.id}`}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.body}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{p.questions_count ?? 0} question(s) linked</div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                    <button onClick={() => setPassageForm({ id: p.id, title: p.title || '', body: p.body })} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} title="Edit">✏️</button>
                    <button onClick={() => deletePassage(p.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Single Question Creator/Editor Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '1000px', height: '90vh', padding: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', overflowY: 'auto' }}>
            
            {/* Left side: Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
                {form.id ? 'Edit Question' : 'Create Question'}
              </h3>

              <form onSubmit={handleQuestionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Meta details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Subject</label>
                    <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="form-input" style={{ padding: '8px 12px' }} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Topic</label>
                    <input type="text" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="form-input" style={{ padding: '8px 12px' }} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Difficulty</label>
                    <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="form-input" style={{ padding: '8px 12px' }}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Marks</label>
                    <input type="number" step="0.01" value={form.marks} onChange={(e) => setForm({ ...form, marks: parseFloat(e.target.value) })} className="form-input" style={{ padding: '8px 12px' }} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Negative Marks</label>
                    <input type="number" step="0.01" value={form.negative_marks} onChange={(e) => setForm({ ...form, negative_marks: parseFloat(e.target.value) })} className="form-input" style={{ padding: '8px 12px' }} required />
                  </div>
                </div>

                {/* Question type + passage link */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Question type</label>
                    <select
                      value={form.question_type}
                      onChange={(e) => setForm({ ...form, question_type: e.target.value })}
                      className="form-input"
                      style={{ padding: '8px 12px' }}
                    >
                      <option value="single_choice">Single choice (one correct)</option>
                      <option value="multi_select">Multi-select (several correct)</option>
                      <option value="numeric">Numeric answer</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Passage (comprehension set)</label>
                    <select
                      value={form.passage_id || ''}
                      onChange={(e) => setForm({ ...form, passage_id: e.target.value })}
                      className="form-input"
                      style={{ padding: '8px 12px' }}
                    >
                      <option value="">None — standalone question</option>
                      {passages.map(p => (
                        <option key={p.id} value={p.id}>{p.title || `Passage #${p.id}`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Question Text */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Question Text (LaTeX supported, e.g. $x^2$ or $$\sum x$$)</label>
                  <textarea 
                    value={form.question_text} 
                    onChange={(e) => setForm({ ...form, question_text: e.target.value })} 
                    className="form-input" 
                    rows={4} 
                    required 
                  />
                </div>

                {/* Options (single_choice / multi_select) or numeric answer key */}
                {form.question_type === 'numeric' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Numeric answer key</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Correct value</label>
                        <input
                          type="number" step="any"
                          value={form.numeric_answer}
                          onChange={(e) => setForm({ ...form, numeric_answer: e.target.value })}
                          className="form-input" style={{ padding: '8px 12px' }} required
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Tolerance (± accepted range)</label>
                        <input
                          type="number" step="any" min="0"
                          value={form.numeric_tolerance}
                          onChange={(e) => setForm({ ...form, numeric_tolerance: e.target.value })}
                          className="form-input" style={{ padding: '8px 12px' }}
                        />
                      </div>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      A response is correct when it falls within ±tolerance of the value above. Use 0 for an exact match.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                      Answer Options & Correct Key
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '8px' }}>
                        {form.question_type === 'multi_select' ? '— tick every correct statement' : '— tick the one correct option'}
                      </span>
                    </label>
                    {form.options.map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={opt.is_correct}
                          onChange={() => handleCorrectOptionSelect(idx)}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                          title="Set as correct answer"
                        />
                        <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{opt.label}.</span>
                        <input
                          type="text"
                          value={opt.option_text}
                          onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                          className="form-input"
                          placeholder={`Option ${opt.label.toUpperCase()}`}
                          style={{ padding: '8px 12px', flex: 1 }}
                          required
                        />
                        <button
                          type="button" onClick={() => removeOption(idx)} disabled={form.options.length <= 2}
                          style={{ background: 'transparent', border: 'none', cursor: form.options.length <= 2 ? 'not-allowed' : 'pointer', opacity: form.options.length <= 2 ? 0.3 : 1, fontSize: '0.95rem' }}
                          title="Remove option"
                        >✕</button>
                      </div>
                    ))}
                    {form.options.length < 6 && (
                      <button type="button" onClick={addOption} className="btn-secondary" style={{ alignSelf: 'flex-start', padding: '6px 14px', fontSize: '0.82rem' }}>
                        + Add option {nextOptionLabel()?.toUpperCase()}
                      </button>
                    )}
                  </div>
                )}

                {/* Explanation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Explanations / Solution</label>
                  <textarea 
                    value={form.explanation} 
                    onChange={(e) => setForm({ ...form, explanation: e.target.value })} 
                    className="form-input" 
                    rows={3} 
                  />
                </div>

                {/* Submit buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Save Question</button>
                </div>
              </form>
            </div>

            {/* Right side: Live Preview */}
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700, color: 'var(--accent-color)' }}>👁️ Live Render Preview</h3>
              
              <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', background: 'var(--surface-sunken)' }}>
                {/* Subject & topic breadcrumb */}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {form.subject || 'Subject'} &gt; {form.topic || 'Topic'} • {form.difficulty} • +{form.marks}/-{form.negative_marks} Marks
                  {form.question_type !== 'single_choice' && (
                    <span style={{ marginLeft: '8px', textTransform: 'capitalize' }}>• {form.question_type.replace('_', ' ')}</span>
                  )}
                </div>

                {/* Passage preview, pinned above the question exactly like the student sees it */}
                {form.passage_id && passages.find(p => String(p.id) === String(form.passage_id)) && (
                  <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--surf, var(--surface-1))', border: '1px dashed var(--border-color)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                    {passages.find(p => String(p.id) === String(form.passage_id)).body}
                  </div>
                )}

                {/* Question Text preview */}
                <div style={{ fontSize: '1.05rem', lineHeight: '1.6', borderBottom: '1px solid var(--surface-2)', paddingBottom: '16px' }}>
                  {form.question_text ? (
                    <div dangerouslySetInnerHTML={renderMath(form.question_text)} />
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Type question text to preview...</span>
                  )}
                </div>

                {/* Answer preview: options for choice-based types, key for numeric */}
                {form.question_type === 'numeric' ? (
                  <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--accent-soft)', border: '1px solid var(--accent-color)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Accepted answer</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                      {form.numeric_answer !== '' ? form.numeric_answer : '—'}
                      {Number(form.numeric_tolerance) > 0 && (
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}> ± {form.numeric_tolerance}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {form.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className={`mcq-option ${opt.is_correct ? 'selected' : ''}`}
                        style={{ margin: 0, padding: '10px 16px', cursor: 'default' }}
                      >
                        <span className="option-badge">{opt.label}</span>
                        {/* renderMath escapes markup, so an HTML placeholder would
                            print as literal tags — render the empty state as JSX. */}
                        {opt.option_text
                          ? <div dangerouslySetInnerHTML={renderMath(opt.option_text)} />
                          : <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Option {opt.label.toUpperCase()} empty</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Explanation preview */}
                {form.explanation && (
                  <div style={{ marginTop: '16px', padding: '16px', background: 'var(--accent-soft)', borderLeft: '3px solid var(--accent-color)', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '6px' }}>Explanation:</div>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }} dangerouslySetInnerHTML={renderMath(form.explanation)} />
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

/** One measured statistic with its plain-language meaning underneath. */
function Metric({ label, value, hint, danger }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: danger ? 'var(--danger)' : 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{hint}</div>
    </div>
  );
}
