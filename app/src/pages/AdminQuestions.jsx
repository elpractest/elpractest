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

  // Drag and Drop CSV file state
  const [dragOver, setDragOver] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Single Question Form State
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    id: null,
    subject: '',
    topic: '',
    difficulty: 'medium',
    marks: 1.0,
    negative_marks: 0.25,
    question_text: '',
    explanation: '',
    exam_tags: [],
    options: [
      { label: 'a', option_text: '', is_correct: false },
      { label: 'b', option_text: '', is_correct: false },
      { label: 'c', option_text: '', is_correct: false },
      { label: 'd', option_text: '', is_correct: false },
    ]
  });

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        subject,
        topic,
        difficulty,
        search
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
  }, [page, subject, topic, difficulty]);

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

  const handleCorrectOptionSelect = (index) => {
    const updatedOptions = form.options.map((opt, i) => ({
      ...opt,
      is_correct: i === index
    }));
    setForm({ ...form, options: updatedOptions });
  };

  // Question Form submit
  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation: make sure one option is selected as correct
    const hasCorrect = form.options.some(opt => opt.is_correct);
    if (!hasCorrect) {
      setError('Please select exactly one correct option.');
      return;
    }

    try {
      if (form.id) {
        await api.put(`/api/admin/questions/${form.id}`, form);
        setSuccess('Question updated successfully.');
      } else {
        await api.post('/api/admin/questions', form);
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
      options: q.options.map(opt => ({
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
        <button 
          onClick={() => {
            setForm({
              id: null,
              subject: '',
              topic: '',
              difficulty: 'medium',
              marks: 1.0,
              negative_marks: 0.25,
              question_text: '',
              explanation: '',
              exam_tags: [],
              options: [
                { label: 'a', option_text: '', is_correct: false },
                { label: 'b', option_text: '', is_correct: false },
                { label: 'c', option_text: '', is_correct: false },
                { label: 'd', option_text: '', is_correct: false },
              ]
            });
            setShowForm(true);
          }} 
          className="btn-primary"
        >
          ➕ Add Question
        </button>
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Upload questions in bulk with headers: subject, topic, difficulty, question_text, option_a...option_d, correct_option, explanation</p>
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
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading question bank...</td>
              </tr>
            ) : questions.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No questions match filters.</td>
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
                  </td>
                  <td style={{ padding: '16px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {/* Render KaTeX inline for preview safely */}
                    <span dangerouslySetInnerHTML={renderMath(q.question_text.substring(0, 100))} />
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>+{q.marks}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--danger)', marginLeft: '6px' }}>-{q.negative_marks}</span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Answer Options & Correct Key</label>
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
                        style={{ padding: '8px 12px' }}
                        required 
                      />
                    </div>
                  ))}
                </div>

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
                </div>

                {/* Question Text preview */}
                <div style={{ fontSize: '1.05rem', lineHeight: '1.6', borderBottom: '1px solid var(--surface-2)', paddingBottom: '16px' }}>
                  {form.question_text ? (
                    <div dangerouslySetInnerHTML={renderMath(form.question_text)} />
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Type question text to preview...</span>
                  )}
                </div>

                {/* Options Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {form.options.map((opt, idx) => (
                    <div 
                      key={idx}
                      className={`mcq-option ${opt.is_correct ? 'selected' : ''}`}
                      style={{ margin: 0, padding: '10px 16px', cursor: 'default' }}
                    >
                      <span className="option-badge">{opt.label}</span>
                      <div dangerouslySetInnerHTML={renderMath(opt.option_text || `<span style="color:var(--text-secondary);font-style:italic">Option ${opt.label.toUpperCase()} empty</span>`)} />
                    </div>
                  ))}
                </div>

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
