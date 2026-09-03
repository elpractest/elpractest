import React, { useState, useEffect } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import {
  PageHead, TableCard, Toolbar, Chip, Table, Row, Cell, CellTitle, CellSub, RowChevron,
  StatusDot, Badge, DifficultyBadge, EmptyState, SkeletonRows, Pagination, Modal, Drawer,
  Field, FormGrid, FormSection, Notice, Num,
} from '../components/admin/ui';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * A question or a passage can now carry a File (a fresh image upload)
 * alongside its ordinary fields, so both save as multipart FormData rather
 * than JSON. This is the one generic serializer for that: it walks the
 * object recursively and appends each leaf under Laravel's own bracket
 * convention (`options[0][option_text]`, `exam_tags[]`), which the
 * FormRequest classes on the other end already parse into normal nested
 * arrays — no server-side change needed to accept this shape.
 *
 * null/undefined are skipped entirely rather than sent as the string
 * "null" — that is what lets a field stay `nullable` and simply absent
 * when the admin has not touched it (an untouched question image, for
 * instance).
 */
function appendToFormData(formData, data, parentKey) {
  if (data === null || data === undefined) return;

  if (data instanceof File) {
    formData.append(parentKey, data);
    return;
  }

  if (Array.isArray(data)) {
    // An empty array is sent as nothing at all — multipart form encoding
    // has no wire representation for "a present but empty array" the way
    // JSON does, and the one trick that fakes it (`field[]=''`) arrives
    // server-side as a ONE-element array containing an empty string,
    // which is worse than simply omitting the key. handleQuestionSubmit
    // uses the plain JSON path instead of this serializer whenever
    // nothing in the form is actually a File, which is what makes
    // "clear every exam tag" and "switch to numeric (empty options)"
    // both still work correctly for the common, no-upload save.
    data.forEach((value, index) => appendToFormData(formData, value, `${parentKey}[${index}]`));
    return;
  }

  if (typeof data === 'object') {
    Object.entries(data).forEach(([key, value]) => {
      const nextKey = parentKey ? `${parentKey}[${key}]` : key;
      appendToFormData(formData, value, nextKey);
    });
    return;
  }

  if (typeof data === 'boolean') {
    formData.append(parentKey, data ? '1' : '0');
    return;
  }

  formData.append(parentKey, String(data));
}

function toFormData(data) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => appendToFormData(formData, value, key));
  return formData;
}

/**
 * `api` (src/api.js) sets `Content-Type: application/json` as a DEFAULT
 * header on every request, for the JSON body every other endpoint in this
 * app sends. axios only auto-detects a FormData body and fills in the
 * correct `multipart/form-data; boundary=...` header when Content-Type has
 * NOT already been set — an explicit default always wins, so a plain
 * `api.post(url, formData)` silently sent the JSON content type over an
 * actual multipart body. The server received a request it could not
 * parse as either: no files, and field values arriving mangled. Every
 * upload in this file goes through this instead of touching `api.post`
 * directly, so that mistake cannot quietly reappear at a future call site.
 */
function postFormData(url, formData) {
  return api.post(url, formData, { headers: { 'Content-Type': undefined } });
}

/**
 * One object URL per File, reused for as long as that exact File instance
 * is selected. Calling URL.createObjectURL() directly inside render mints
 * a brand new blob URL on every re-render of the form (every keystroke in
 * an unrelated field) and never releases the old ones — a real leak over
 * an editing session. Keyed by the File object itself in a WeakMap, so a
 * File that is no longer referenced anywhere in the form can be collected
 * normally; the blob URL only needs releasing at all if the admin churns
 * through many different files in one sitting, which this form's six-
 * option ceiling makes a non-issue.
 */
const objectUrlCache = new WeakMap();
function previewUrlFor(file) {
  if (!file) return null;
  if (!objectUrlCache.has(file)) {
    objectUrlCache.set(file, URL.createObjectURL(file));
  }
  return objectUrlCache.get(file);
}

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

/**
 * A single image field: shows the current picture (a fresh upload, or the
 * one already stored when editing) with a Change/Remove pair, or a plain
 * file input when there is none yet. Shared by the question's own diagram
 * and the passage exhibit — both are exactly this "zero or one image"
 * shape, unlike an option's image which lives inline in its own row.
 */
function ImagePicker({ id, file, existingUrl, onChange, onClear }) {
  const previewUrl = file ? previewUrlFor(file) : existingUrl;

  if (previewUrl) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src={previewUrl} alt="" style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--line)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="btn-secondary" style={{ padding: '7px 12px', fontSize: '12px', cursor: 'pointer', textAlign: 'center' }}>
            Change
            <input
              id={id}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => onChange(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />
          </label>
          <button type="button" onClick={onClear} className="btn-secondary" style={{ padding: '7px 12px', fontSize: '12px' }}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <input
      id={id}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      onChange={(e) => onChange(e.target.files?.[0] || null)}
      className="form-input"
    />
  );
}

/** A read-only rendering of {headers, rows} for the live preview and the
    passage manager — the same shape TestTaking.jsx renders for real. */
function PreviewTable({ table }) {
  if (!table?.headers?.length) return null;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '10px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '280px', font: '400 12px var(--font-body)' }}>
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th key={i} style={{ textAlign: 'left', padding: '6px 10px', background: 'var(--surf)', color: 'var(--tx)', fontWeight: 700, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(table.rows || []).map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '5px 10px', color: 'var(--tx2)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A flat Data Interpretation grid — headers plus rows of the same width,
 * nothing else. No cell typing, no merged cells, no per-column formatting:
 * a real DI table on an SSC/Banking paper is short labels and numbers, and
 * that is all this needs to author. Deliberately not a spreadsheet.
 */
function TableEditor({ table, onChange }) {
  if (!table) {
    return (
      <button
        type="button"
        onClick={() => onChange({ headers: ['', ''], rows: [['', '']] })}
        className="btn-secondary"
        style={{ padding: '8px 14px', minHeight: '38px', fontSize: '12px', alignSelf: 'flex-start' }}
      >
        <Icon name="plus" size={14} strokeWidth={2.4} />
        Add a data table
      </button>
    );
  }

  const colCount = table.headers.length;

  const setHeader = (i, value) => {
    const headers = [...table.headers];
    headers[i] = value;
    onChange({ ...table, headers });
  };
  const setCell = (ri, ci, value) => {
    const rows = table.rows.map((row, r) => (r === ri ? row.map((c, cc) => (cc === ci ? value : c)) : row));
    onChange({ ...table, rows });
  };
  const addColumn = () => {
    onChange({ headers: [...table.headers, ''], rows: table.rows.map((row) => [...row, '']) });
  };
  const removeColumn = (i) => {
    if (colCount <= 1) return;
    onChange({ headers: table.headers.filter((_, c) => c !== i), rows: table.rows.map((row) => row.filter((_, c) => c !== i)) });
  };
  const addRow = () => {
    onChange({ ...table, rows: [...table.rows, Array(colCount).fill('')] });
  };
  const removeRow = (ri) => {
    if (table.rows.length <= 1) return;
    onChange({ ...table, rows: table.rows.filter((_, r) => r !== ri) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} style={{ padding: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <input
                      value={h}
                      onChange={(e) => setHeader(i, e.target.value)}
                      placeholder={`Col ${i + 1}`}
                      className="form-input"
                      style={{ width: '104px', padding: '6px 8px', fontSize: '12px', fontWeight: 700 }}
                    />
                    <button type="button" onClick={() => removeColumn(i)} disabled={colCount <= 1} className="adm-rowaction" style={{ opacity: colCount <= 1 ? 0.3 : 1 }} aria-label={`Remove column ${i + 1}`}>
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                </th>
              ))}
              <th style={{ padding: '2px' }}>
                <button type="button" onClick={addColumn} className="adm-rowaction" aria-label="Add column" title="Add column">
                  <Icon name="plus" size={13} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '2px' }}>
                    <input
                      value={cell}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      className="form-input"
                      style={{ width: '104px', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </td>
                ))}
                <td style={{ padding: '2px' }}>
                  <button type="button" onClick={() => removeRow(ri)} disabled={table.rows.length <= 1} className="adm-rowaction" style={{ opacity: table.rows.length <= 1 ? 0.3 : 1 }} aria-label={`Remove row ${ri + 1}`}>
                    <Icon name="x" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={addRow} className="btn-secondary" style={{ padding: '6px 12px', minHeight: '32px', fontSize: '11.5px' }}>
          <Icon name="plus" size={13} strokeWidth={2.4} /> Add row
        </button>
        <button type="button" onClick={() => onChange(null)} className="btn-secondary" style={{ padding: '6px 12px', minHeight: '32px', fontSize: '11.5px' }}>
          Remove table
        </button>
      </div>
    </div>
  );
}

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
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

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
    // `image` is a fresh upload (a File, or null); `image_url` is the
    // already-stored picture's preview when editing. Only `image` is ever
    // sent back to the server — `image_url` exists purely to show the
    // admin what is currently attached.
    image: null,
    image_url: null,
    // Explicit removal signal for the question's OWN image — distinct from
    // "no new file chosen", which on its own means "leave it alone". Set
    // by the remove button next to the preview, cleared the moment a new
    // file is chosen instead.
    remove_image: false,
    explanation: '',
    exam_tags: [],
    question_type: 'single_choice',
    numeric_answer: '',
    numeric_tolerance: 0,
    passage_id: '',
    // `image` is a fresh upload for this option; `image_path` is the
    // already-stored file's path, carried forward so an untouched image
    // survives the save (options are replaced wholesale — see
    // QuestionController::update). `image_url` is the preview only.
    options: [
      { label: 'a', option_text: '', image: null, image_path: null, image_url: null, is_correct: false },
      { label: 'b', option_text: '', image: null, image_path: null, image_url: null, is_correct: false },
      { label: 'c', option_text: '', image: null, image_path: null, image_url: null, is_correct: false },
      { label: 'd', option_text: '', image: null, image_path: null, image_url: null, is_correct: false },
    ]
  });
  const [form, setForm] = useState(blankForm());

  // Passages — shared comprehension text a question can link to. A manual,
  // low-volume authoring flow (unlike the CSV path for plain questions).
  const [passages, setPassages] = useState([]);
  const [showPassageManager, setShowPassageManager] = useState(false);
  const blankPassageForm = () => ({
    id: null,
    title: '',
    body: '',
    image: null,
    image_url: null,
    remove_image: false,
    // {headers: string[], rows: string[][]} — a Data Interpretation table,
    // or null for a plain text (or image-only) passage.
    table: null,
  });
  const [passageForm, setPassageForm] = useState(blankPassageForm());

  /* Presentation only: row selection for bulk review, the detail drawer,
     and the two destructive confirmations. No fetch or mutation changes. */
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailQuestion, setDetailQuestion] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [pendingPassageDelete, setPendingPassageDelete] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

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

    const { image_url: _imageUrl, ...payload } = passageForm; // display-only

    try {
      if (payload.image) {
        // Multipart only when a file is actually attached — see
        // handleQuestionSubmit for why plain JSON is kept as the default
        // path (it is the only one that can faithfully clear a nested
        // field like `table` back to null).
        if (payload.id) {
          await postFormData(`/api/admin/passages/${payload.id}`, toFormData({ ...payload, _method: 'PUT' }));
        } else {
          await postFormData('/api/admin/passages', toFormData(payload));
        }
      } else if (payload.id) {
        await api.put(`/api/admin/passages/${payload.id}`, payload);
      } else {
        await api.post('/api/admin/passages', payload);
      }
      setPassageForm(blankPassageForm());
      fetchPassages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save passage.');
    }
  };

  const deletePassage = async (id) => {
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
    setForm({ ...form, options: [...form.options, { label, option_text: '', image: null, image_path: null, image_url: null, is_correct: false }] });
  };

  const setQuestionImage = (file) => {
    setForm({ ...form, image: file, remove_image: false });
  };

  const clearQuestionImage = () => {
    setForm({ ...form, image: null, image_url: null, remove_image: true });
  };

  const setOptionImage = (index, file) => {
    const updated = [...form.options];
    // A fresh upload replaces whatever path was being carried forward —
    // the new file is what will actually be stored on save.
    updated[index] = { ...updated[index], image: file, image_path: null };
    setForm({ ...form, options: updated });
  };

  const clearOptionImage = (index) => {
    const updated = [...form.options];
    updated[index] = { ...updated[index], image: null, image_path: null, image_url: null };
    setForm({ ...form, options: updated });
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
      // Mirrors the server's own check (StoreQuestionRequest) so a bare
      // option is caught before the round trip, not after it.
      const emptyOption = form.options.find(
        (opt) => !opt.option_text?.trim() && !opt.image && !opt.image_path
      );
      if (emptyOption) {
        setError(`Option ${emptyOption.label.toUpperCase()} needs either text or an image.`);
        return;
      }
    }

    const payload = { ...form };
    // Display-only; the server has no use for it and never validates it.
    delete payload.image_url;
    if (isNumeric) {
      delete payload.options;
    } else {
      delete payload.numeric_answer;
      delete payload.numeric_tolerance;
      // image_url is a display-only preview; the server has no use for it
      // and image/image_path are what actually carry the option's picture.
      payload.options = payload.options.map(({ image_url: _imageUrl, ...opt }) => opt);
    }
    if (!payload.passage_id) payload.passage_id = null;

    // Plain JSON stays the path for the overwhelming common case — a
    // text-only save — because multipart form encoding has no faithful
    // way to send an EMPTY array (see appendToFormData), which would
    // otherwise put clearing every exam tag, or switching to numeric with
    // its now-empty options list, at risk. Multipart is used only when
    // this save actually attaches a new file somewhere.
    const hasNewUpload = !!payload.image
      || (Array.isArray(payload.options) && payload.options.some((opt) => opt.image));

    try {
      if (form.id) {
        if (hasNewUpload) {
          await postFormData(`/api/admin/questions/${form.id}`, toFormData({ ...payload, _method: 'PUT' }));
        } else {
          const { image: _image, ...jsonPayload } = payload; // image is always null here
          await api.put(`/api/admin/questions/${form.id}`, jsonPayload);
        }
        setSuccess('Question updated successfully.');
      } else if (hasNewUpload) {
        await postFormData('/api/admin/questions', toFormData(payload));
        setSuccess('Question created successfully.');
      } else {
        const { image: _image, ...jsonPayload } = payload; // image is always null here
        await api.post('/api/admin/questions', jsonPayload);
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
      image: null,
      image_url: q.image_url || null,
      remove_image: false,
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
            option_text: opt.option_text || '',
            image: null,
            image_path: opt.image_path || null,
            image_url: opt.image_url || null,
            is_correct: !!opt.is_correct
          }))
    });
    setShowForm(true);
  };

  const handleDeleteClick = async (id) => {
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

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setError('');
    try {
      const res = await api.get('/api/admin/questions/import-template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'question_import_sample.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download the sample CSV template.');
    } finally {
      setDownloadingTemplate(false);
    }
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

  const COLUMNS = [
    { key: 'pick', label: '', width: '28px' },
    { key: 'q', label: 'Question', width: 'minmax(0,2fr)' },
    { key: 'subject', label: 'Subject', width: '130px', hideBelow: 'tablet' },
    { key: 'difficulty', label: 'Difficulty', width: '110px' },
    { key: 'marks', label: 'Marks', width: '110px', hideBelow: 'tablet' },
    { key: 'status', label: 'Review', width: '120px' },
    { key: 'go', label: '', width: '32px' },
  ];

  const allOnPageSelected = questions.length > 0 && questions.every((q) => selectedIds.includes(q.id));
  const toggleRow = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setSelectedIds(allOnPageSelected ? [] : questions.map((q) => q.id));

  /* Bulk review reuses reviewQuestion one row at a time — the same request the
     single-row buttons already make, just issued for each selected id. */
  const bulkReview = async (decision) => {
    setBulkBusy(true);
    for (const id of selectedIds) {
      await reviewQuestion(id, decision);
    }
    setSelectedIds([]);
    setBulkBusy(false);
  };

  /* Unlike bulkReview, this hits one batch endpoint rather than looping —
     the whole reason it exists is to claw back a bad CSV import (wrong tags,
     a passage_id nobody had created yet) without one request per row. */
  const bulkDeactivate = async () => {
    setBulkBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/api/admin/questions/bulk-deactivate', { ids: selectedIds });
      setSuccess(`${selectedIds.length} question(s) deactivated.`);
      setSelectedIds([]);
      fetchQuestions();
    } catch (err) {
      setError('Failed to deactivate the selected questions.');
    } finally {
      setBulkBusy(false);
    }
  };

  const statusTone = (st) =>
    st === 'approved' ? 'success' : st === 'rejected' ? 'danger' : 'reward';

  const healthOf = (q) => {
    if (!q.stats_sample_size) return { tone: 'neutral', label: 'No attempts' };
    if (q.stats_sample_size < 30) return { tone: 'neutral', label: `n = ${q.stats_sample_size}` };
    if (q.discrimination_index < 0) return { tone: 'danger', label: 'Check key' };
    if (q.discrimination_index < 0.15) return { tone: 'reward', label: 'Weak item' };
    return { tone: 'success', label: `r = ${Number(q.discrimination_index).toFixed(2)}` };
  };

  const csvFailed = csvState.status === 'complete' && csvState.errors && csvState.errors.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
      <style>{`
        .qb-intake { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; }
        @media (min-width: 1024px) { .qb-intake { grid-template-columns: minmax(0,1fr) minmax(0,1.5fr); } }
        .qb-editor { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 980px) { .qb-editor { grid-template-columns: 1fr 1fr; } }
      `}</style>

      <PageHead
        title="Question bank"
        subtitle="Author one at a time or import a CSV. LaTeX is supported in the stem, the options and the explanation."
      >
        <button type="button" onClick={() => setShowPassageManager(true)} className="btn-secondary">
          <Icon name="file-text" size={16} />
          Passages
        </button>
        <button type="button" onClick={() => { setForm(blankForm()); setShowForm(true); }} className="btn-primary">
          <Icon name="plus" size={16} strokeWidth={2.4} />
          New question
        </button>
      </PageHead>

      {success && <Notice tone="success" icon="check-circle" onDismiss={() => setSuccess('')}>{success}</Notice>}
      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      {csvFailed && (
        <TableCard>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <h3 className="t-heading" style={{ margin: 0, color: 'var(--danger)' }}>
              <Num style={{ color: 'inherit', fontSize: '17px' }}>{csvState.errors.length}</Num> rows failed
            </h3>
            <p style={{ margin: '5px 0 0', font: '400 12.5px/1.55 var(--font-body)', color: 'var(--muted)' }}>
              The rest imported. These lines were skipped because they did not validate.
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-ltable">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Row</th>
                  <th style={{ width: '160px' }}>Field</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {csvState.errors.map((err, idx) => (
                  <tr key={idx}>
                    <td><Num style={{ fontSize: '12.5px' }}>{err.row}</Num></td>
                    <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{err.field || 'General'}</td>
                    <td style={{ color: 'var(--danger)' }}>{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableCard>
      )}

      {/* ---- intake: CSV drop + filters ---- */}
      <div className="qb-intake">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            padding: '26px 20px',
            textAlign: 'center',
            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--line2)'}`,
            background: dragOver ? 'var(--primary-soft)' : 'var(--card)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            transition: 'background var(--t-base) ease, border-color var(--t-base) ease',
          }}
        >
          <span className="adm-empty-tile"><Icon name="upload" size={24} /></span>
          <div>
            <h3 className="t-heading" style={{ margin: 0, fontSize: '15px', color: 'var(--tx)' }}>Drop a question CSV</h3>
            <p style={{ margin: '6px auto 0', maxWidth: '48ch', font: '400 12px/1.6 var(--font-body)', color: 'var(--muted)' }}>
              Required: subject, topic, difficulty, question_text, option_a…option_f, correct_option, marks,
              negative_marks, explanation. Optional: question_type, numeric_answer, numeric_tolerance,
              question_image_url and option_a_image_url…option_f_image_url (diagrams fetched from those
              URLs — an option can be image-only, with its text column left blank, for reasoning
              figure-series questions), passage_id (links into an existing comprehension/DI set). For
              multi-select, pipe-separate correct_option (e.g. <code style={{ font: '500 11px var(--font-mono)' }}>a|c</code>).
              Passage images/tables are still authored one at a time in the passage editor, not through the CSV.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <label className="btn-secondary" style={{ cursor: 'pointer' }}>
              Browse for a file
              <input type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="download" size={14} />
              {downloadingTemplate ? 'Downloading…' : 'Download template'}
            </button>
          </div>
          {uploadingCsv && (
            <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--primary)' }}>Uploading and parsing…</span>
          )}
          {csvJobId && (
            <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--success)' }}>Queued in the background…</span>
          )}
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px 20px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FormGrid min="160px">
              <Field label="Subject" htmlFor="qb-subject">
                <input
                  id="qb-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Quantitative"
                />
              </Field>
              <Field label="Topic" htmlFor="qb-topic">
                <input
                  id="qb-topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Algebra"
                />
              </Field>
              <Field label="Difficulty" htmlFor="qb-diff">
                <select
                  id="qb-diff"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="form-input"
                >
                  <option value="">All</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>
            </FormGrid>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                aria-label="Search question text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                placeholder="Search question text…"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-secondary" style={{ flex: 'none', padding: '0 18px' }}>
                <Icon name="search" size={16} />
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ---- the bank ---- */}
      <TableCard>
        <Toolbar
          trailing={
            selectedIds.length > 0 ? (
              <>
                <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--tx2)' }}>
                  <Num>{selectedIds.length}</Num> selected
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '7px 13px', minHeight: '36px', fontSize: '11.5px' }}
                  disabled={bulkBusy}
                  onClick={() => bulkReview('approved')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '7px 13px', minHeight: '36px', fontSize: '11.5px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                  disabled={bulkBusy}
                  onClick={() => bulkReview('rejected')}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '7px 13px', minHeight: '36px', fontSize: '11.5px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                  disabled={bulkBusy}
                  onClick={() => setPendingBulkDelete(true)}
                >
                  Deactivate
                </button>
              </>
            ) : (
              !loading && (
                <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                  Page <Num>{page}</Num> of <Num>{lastPage}</Num>
                </span>
              )
            )
          }
        >
          <Chip
            active={!status && !flaggedOnly}
            onClick={() => { setPage(1); setStatus(''); setFlaggedOnly(false); }}
          >
            All
          </Chip>
          <Chip
            queue
            active={status === 'pending_review'}
            onClick={() => { setPage(1); setFlaggedOnly(false); setStatus('pending_review'); }}
          >
            Pending review
          </Chip>
          <Chip active={status === 'approved'} onClick={() => { setPage(1); setFlaggedOnly(false); setStatus('approved'); }}>
            Approved
          </Chip>
          <Chip active={status === 'rejected'} onClick={() => { setPage(1); setFlaggedOnly(false); setStatus('rejected'); }}>
            Rejected
          </Chip>
          <Chip
            queue
            active={flaggedOnly}
            onClick={() => { setPage(1); setStatus(''); setFlaggedOnly(!flaggedOnly); }}
            title="Items whose measured statistics suggest a problem"
          >
            Needs attention
          </Chip>
        </Toolbar>

        {loading ? (
          <SkeletonRows />
        ) : questions.length === 0 ? (
          <EmptyState
            icon="file-text"
            message="No question matches these filters. Clear one to widen the search, or import a CSV."
            action={
              <button type="button" onClick={() => { setForm(blankForm()); setShowForm(true); }} className="btn-primary">
                <Icon name="plus" size={16} strokeWidth={2.4} />
                New question
              </button>
            }
          />
        ) : (
          <>
            <Table columns={COLUMNS}>
              <Row style={{ minHeight: 0, padding: '8px 16px', background: 'var(--card2)' }}>
                <Cell>
                  <button
                    type="button"
                    className={`adm-check${allOnPageSelected ? ' on' : ''}`}
                    onClick={toggleAll}
                    aria-label={allOnPageSelected ? 'Clear selection' : 'Select every row on this page'}
                  >
                    <Icon name="check" size={11} strokeWidth={3.5} />
                  </button>
                </Cell>
                <Cell>
                  <span style={{ font: '500 11.5px var(--font-body)', color: 'var(--muted)' }}>
                    {allOnPageSelected ? 'Every row on this page is selected' : 'Select rows to review them together'}
                  </span>
                </Cell>
              </Row>

              {questions.map((q) => {
                const health = healthOf(q);
                const picked = selectedIds.includes(q.id);
                return (
                  <Row key={q.id} selected={picked || detailQuestion?.id === q.id}>
                    <Cell>
                      <button
                        type="button"
                        className={`adm-check${picked ? ' on' : ''}`}
                        onClick={() => toggleRow(q.id)}
                        aria-label={picked ? 'Deselect this question' : 'Select this question'}
                      >
                        <Icon name="check" size={11} strokeWidth={3.5} />
                      </button>
                    </Cell>
                    <Cell label="Question">
                      <CellTitle>
                        <span dangerouslySetInnerHTML={renderMath(q.question_text.substring(0, 120))} />
                      </CellTitle>
                      <CellSub>
                        {q.question_type && q.question_type !== 'single_choice'
                          ? q.question_type.replace('_', ' ')
                          : health.label}
                      </CellSub>
                    </Cell>
                    <Cell label="Subject" hideBelow="tablet">
                      <CellTitle>{q.subject}</CellTitle>
                      <CellSub>{q.topic}</CellSub>
                    </Cell>
                    <Cell label="Difficulty">
                      <DifficultyBadge value={q.difficulty} />
                    </Cell>
                    <Cell label="Marks" hideBelow="tablet">
                      <Num style={{ fontSize: '12.5px', color: 'var(--success)' }}>+{q.marks}</Num>
                      <span style={{ font: '500 12px var(--font-mono)', color: 'var(--danger)', marginLeft: '6px' }}>−{q.negative_marks}</span>
                    </Cell>
                    <Cell label="Review">
                      <StatusDot tone={statusTone(q.status || 'approved')}>
                        {(q.status || 'approved').replace('_', ' ')}
                      </StatusDot>
                    </Cell>
                    <Cell align="right">
                      <RowChevron onClick={() => setDetailQuestion(q)} label="Open question" />
                    </Cell>
                  </Row>
                );
              })}
            </Table>
            <Pagination page={page} lastPage={lastPage} onPage={setPage} />
          </>
        )}
      </TableCard>

      {/* ---- row detail: review, item health and the row's actions ---- */}
      {detailQuestion && (
        <Drawer
          title={`${detailQuestion.subject} · ${detailQuestion.topic}`}
          subtitle={`${detailQuestion.difficulty} · +${detailQuestion.marks} / −${detailQuestion.negative_marks}`}
          onClose={() => setDetailQuestion(null)}
          footer={
            <>
              <button
                type="button"
                className="btn-secondary"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                onClick={() => setPendingDelete(detailQuestion)}
              >
                <Icon name="trash" size={15} />
                Deactivate
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => { const q = detailQuestion; setDetailQuestion(null); handleEditClick(q); }}
              >
                <Icon name="edit" size={16} />
                Edit
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ font: '400 14px/1.62 var(--font-body)', color: 'var(--tx)' }}>
              <span dangerouslySetInnerHTML={renderMath(detailQuestion.question_text)} />
            </div>

            <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <span>Review status</span>
                <StatusDot tone={statusTone(detailQuestion.status || 'approved')}>
                  {(detailQuestion.status || 'approved').replace('_', ' ')}
                </StatusDot>
              </div>
              <div style={{ marginTop: '9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <span>Item health</span>
                <Badge tone={healthOf(detailQuestion).tone}>{healthOf(detailQuestion).label}</Badge>
              </div>
              {detailQuestion.stats_sample_size >= 30 && (
                <div style={{ marginTop: '9px', display: 'flex', justifyContent: 'space-between', gap: '12px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
                  <span>Difficulty index (p)</span>
                  <Num style={{ color: 'var(--tx)', fontSize: '12.5px' }}>{Number(detailQuestion.difficulty_index).toFixed(2)}</Num>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {detailQuestion.status !== 'approved' && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { reviewQuestion(detailQuestion.id, 'approved'); setDetailQuestion(null); }}
                >
                  <Icon name="check-circle" size={15} />
                  Approve
                </button>
              )}
              {detailQuestion.status !== 'rejected' && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { reviewQuestion(detailQuestion.id, 'rejected'); setDetailQuestion(null); }}
                >
                  <Icon name="x" size={15} />
                  Reject
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { const q = detailQuestion; setDetailQuestion(null); openAnalysis(q); }}
              >
                <Icon name="chart" size={15} />
                Item analysis
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {/* ---- item analysis — measured, not asserted ---- */}
      {analysisFor && (
        <Modal
          title="Item analysis"
          description="Computed from the raw attempts, so a re-scored session changes it the next time you open this."
          width={620}
          onClose={() => setAnalysisFor(null)}
        >
          <p style={{ margin: '0 0 18px', font: '400 13px/1.6 var(--font-body)', color: 'var(--tx2)' }}>
            <span dangerouslySetInnerHTML={renderMath(analysisFor.question_text.substring(0, 200))} />
          </p>

          {analysisLoading ? (
            <div className="skeleton" style={{ height: '90px', borderRadius: '14px' }} />
          ) : !analysis ? (
            <EmptyState icon="chart" message="This question has no recorded attempts yet." />
          ) : (
            <>
              <FormGrid min="150px">
                <Metric
                  label="Difficulty (p)"
                  value={analysis.difficulty_index == null ? '—' : Number(analysis.difficulty_index).toFixed(2)}
                  hint="Share answering correctly"
                />
                <Metric
                  label="Discrimination (r)"
                  value={analysis.discrimination_index == null ? '—' : Number(analysis.discrimination_index).toFixed(2)}
                  hint="Strong vs weak separation"
                  danger={analysis.discrimination_index != null && analysis.discrimination_index < 0}
                />
                <Metric label="Sample" value={analysis.sample_size} hint={`${analysis.skipped_count} left blank`} />
              </FormGrid>

              {analysis.flags && analysis.flags.length > 0 && (
                <div style={{ margin: '18px 0 0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {analysis.flags.map((f) => (
                    <Badge key={f} tone={f === 'negative_discrimination' ? 'danger' : 'reward'}>
                      {f.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}

              {analysis.flags?.includes('negative_discrimination') && (
                <div style={{ marginTop: '16px' }}>
                  <Notice tone="danger" icon="alert">
                    The candidates who scored well overall were MORE likely to get this one wrong. In practice that
                    means the answer key is wrong or the stem is ambiguous.
                  </Notice>
                </div>
              )}

              <h4 className="t-heading" style={{ margin: '22px 0 10px', fontSize: '15px', color: 'var(--tx)' }}>Option breakdown</h4>
              <div className="adm-tablecard" style={{ overflowX: 'auto' }}>
                <table className="adm-ltable">
                  <thead>
                    <tr>
                      <th>Option</th>
                      <th className="ta-r">Chosen</th>
                      <th className="ta-r">Share</th>
                      <th className="ta-r">Mean ability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.distractors.map((d) => (
                      <tr key={d.option_id}>
                        <td style={{ fontWeight: d.is_correct ? 700 : 400, color: d.is_correct ? 'var(--success)' : 'inherit' }}>
                          {d.label.toUpperCase()}
                          {d.is_correct && <Icon name="check" size={12} style={{ marginLeft: 4, verticalAlign: '-1px' }} />}
                        </td>
                        <td className="ta-r"><Num style={{ fontSize: '12.5px' }}>{d.chosen_count}</Num></td>
                        <td className="ta-r"><Num style={{ fontSize: '12.5px' }}>{Math.round(d.chosen_share * 100)}%</Num></td>
                        <td className="ta-r">
                          {d.mean_ability == null ? '—' : <Num style={{ fontSize: '12.5px' }}>{d.mean_ability}%</Num>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ margin: '12px 0 0', font: '400 11.5px/1.55 var(--font-body)', color: 'var(--muted)' }}>
                A distractor chosen by the highest-ability candidates is defective. One chosen by nobody is a wasted slot.
              </p>
            </>
          )}
        </Modal>
      )}

      {/* ---- passage manager ---- */}
      {showPassageManager && (
        <Modal
          title="Comprehension passages"
          description="Author a passage once, then link several questions to it from the question form."
          width={720}
          onClose={() => { setShowPassageManager(false); setPassageForm(blankPassageForm()); }}
        >
          <FormSection title={passageForm.id ? 'Edit passage' : 'New passage'}>
            <form onSubmit={savePassage} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label="Title" hint="Optional — a label for the picker." htmlFor="pg-title">
                <input
                  id="pg-title"
                  type="text"
                  placeholder="e.g. RC Passage 1 — Climate Change, or DI Set 3 — Company sales"
                  value={passageForm.title}
                  onChange={(e) => setPassageForm({ ...passageForm, title: e.target.value })}
                  className="form-input"
                />
              </Field>
              <Field label="Passage text" hint="For a Data Interpretation set this can just be the instruction line — the table or chart below carries the actual data." htmlFor="pg-body">
                <textarea
                  id="pg-body"
                  placeholder="Paste the passage here, or write the instruction for a table/chart below…"
                  rows={5}
                  required
                  value={passageForm.body}
                  onChange={(e) => setPassageForm({ ...passageForm, body: e.target.value })}
                  className="form-input"
                />
              </Field>
              <Field label="Chart or exhibit image (optional)" htmlFor="pg-image">
                <ImagePicker
                  id="pg-image"
                  file={passageForm.image}
                  existingUrl={passageForm.remove_image ? null : passageForm.image_url}
                  onChange={(file) => setPassageForm({ ...passageForm, image: file, remove_image: false })}
                  onClear={() => setPassageForm({ ...passageForm, image: null, image_url: null, remove_image: true })}
                />
              </Field>
              <Field label="Data table (optional)" hint="For a DI set — headers plus rows of numbers. Rendered as a real table, not a picture.">
                <TableEditor table={passageForm.table} onChange={(table) => setPassageForm({ ...passageForm, table })} />
              </Field>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                {passageForm.id && (
                  <button
                    type="button"
                    onClick={() => setPassageForm(blankPassageForm())}
                    className="btn-secondary"
                  >
                    Cancel edit
                  </button>
                )}
                <button type="submit" className="btn-primary">
                  {passageForm.id ? 'Update passage' : 'Add passage'}
                </button>
              </div>
            </form>
          </FormSection>

          <FormSection title="Existing passages">
            {passages.length === 0 ? (
              <EmptyState icon="file-text" message="No passage yet. Add one above and questions can link to it." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {passages.map((pg) => (
                  <div
                    key={pg.id}
                    style={{
                      padding: '13px 14px',
                      borderRadius: '14px',
                      background: 'var(--card2)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: '600 13px var(--font-body)', color: 'var(--tx)' }}>
                        {pg.title || `Passage #${pg.id}`}
                      </div>
                      <div
                        style={{
                          marginTop: '4px',
                          font: '400 12px var(--font-body)',
                          color: 'var(--muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {pg.body}
                      </div>
                      <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px', font: '400 11.5px var(--font-body)', color: 'var(--muted)' }}>
                        <Num style={{ fontSize: '11.5px' }}>{pg.questions_count ?? 0}</Num> linked
                        {pg.image_url && <Badge tone="ai">image</Badge>}
                        {pg.table_data && <Badge tone="ai">table</Badge>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="adm-rowaction"
                        onClick={() => setPassageForm({
                          id: pg.id,
                          title: pg.title || '',
                          body: pg.body,
                          image: null,
                          image_url: pg.image_url || null,
                          remove_image: false,
                          table: pg.table_data || null,
                        })}
                        aria-label="Edit passage"
                        title="Edit"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        type="button"
                        className="adm-rowaction"
                        onClick={() => setPendingPassageDelete(pg)}
                        aria-label="Delete passage"
                        title="Delete"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        </Modal>
      )}

      {/* ---- question editor + live preview ---- */}
      {showForm && (
        <Modal
          title={form.id ? 'Edit question' : 'New question'}
          description="The preview is exactly what a candidate sees, LaTeX and all."
          width={1000}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" form="question-form" className="btn-primary">Save question</button>
            </>
          }
        >
          <div className="qb-editor">
            <form id="question-form" onSubmit={handleQuestionSubmit}>
              <FormSection title="Classification">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <FormGrid min="160px">
                    <Field label="Subject" htmlFor="qf-subject">
                      <input
                        id="qf-subject"
                        type="text"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        className="form-input"
                        required
                      />
                    </Field>
                    <Field label="Topic" htmlFor="qf-topic">
                      <input
                        id="qf-topic"
                        type="text"
                        value={form.topic}
                        onChange={(e) => setForm({ ...form, topic: e.target.value })}
                        className="form-input"
                        required
                      />
                    </Field>
                  </FormGrid>
                  <FormGrid min="140px">
                    <Field label="Difficulty" htmlFor="qf-diff">
                      <select
                        id="qf-diff"
                        value={form.difficulty}
                        onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                        className="form-input"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </Field>
                    <Field label="Marks" htmlFor="qf-marks">
                      <input
                        id="qf-marks"
                        type="number"
                        step="0.01"
                        value={form.marks}
                        onChange={(e) => setForm({ ...form, marks: parseFloat(e.target.value) })}
                        className="form-input"
                        required
                      />
                    </Field>
                    <Field label="Negative marks" htmlFor="qf-neg">
                      <input
                        id="qf-neg"
                        type="number"
                        step="0.01"
                        value={form.negative_marks}
                        onChange={(e) => setForm({ ...form, negative_marks: parseFloat(e.target.value) })}
                        className="form-input"
                        required
                      />
                    </Field>
                  </FormGrid>
                  <FormGrid min="180px">
                    <Field label="Question type" htmlFor="qf-type">
                      <select
                        id="qf-type"
                        value={form.question_type}
                        onChange={(e) => setForm({ ...form, question_type: e.target.value })}
                        className="form-input"
                      >
                        <option value="single_choice">Single choice (one correct)</option>
                        <option value="multi_select">Multi-select (several correct)</option>
                        <option value="numeric">Numeric answer</option>
                      </select>
                    </Field>
                    <Field label="Passage" hint="Link a comprehension set, or leave standalone." htmlFor="qf-passage">
                      <select
                        id="qf-passage"
                        value={form.passage_id || ''}
                        onChange={(e) => setForm({ ...form, passage_id: e.target.value })}
                        className="form-input"
                      >
                        <option value="">Standalone question</option>
                        {passages.map((pg) => (
                          <option key={pg.id} value={pg.id}>{pg.title || `Passage #${pg.id}`}</option>
                        ))}
                      </select>
                    </Field>
                  </FormGrid>
                </div>
              </FormSection>

              <FormSection title="Stem">
                <Field label="Question text" hint="LaTeX supported — $x^2$ inline, $$\sum x$$ on its own line." htmlFor="qf-text">
                  <textarea
                    id="qf-text"
                    value={form.question_text}
                    onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                    className="form-input"
                    rows={4}
                    required
                  />
                </Field>

                <Field
                  label="Diagram (optional)"
                  hint="A figure THIS question refers to — a chart, a mirror-image puzzle. For an exhibit several questions share, attach it to a passage instead (below)."
                  htmlFor="qf-image"
                >
                  <ImagePicker
                    id="qf-image"
                    file={form.image}
                    existingUrl={form.remove_image ? null : form.image_url}
                    onChange={setQuestionImage}
                    onClear={clearQuestionImage}
                  />
                </Field>
              </FormSection>

              <FormSection
                title={form.question_type === 'numeric' ? 'Answer key' : 'Options & key'}
                description={
                  form.question_type === 'numeric'
                    ? 'A response is correct when it falls within ±tolerance of the value. Use 0 for an exact match.'
                    : form.question_type === 'multi_select'
                      ? 'Tick every correct statement.'
                      : 'Tick the one correct option.'
                }
              >
                {form.question_type === 'numeric' ? (
                  <FormGrid min="170px">
                    <Field label="Correct value" htmlFor="qf-num">
                      <input
                        id="qf-num"
                        type="number"
                        step="any"
                        value={form.numeric_answer}
                        onChange={(e) => setForm({ ...form, numeric_answer: e.target.value })}
                        className="form-input"
                        required
                      />
                    </Field>
                    <Field label="Tolerance (±)" htmlFor="qf-tol">
                      <input
                        id="qf-tol"
                        type="number"
                        step="any"
                        min="0"
                        value={form.numeric_tolerance}
                        onChange={(e) => setForm({ ...form, numeric_tolerance: e.target.value })}
                        className="form-input"
                      />
                    </Field>
                  </FormGrid>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {form.options.map((opt, idx) => {
                      const optionImageUrl = opt.image
                        ? previewUrlFor(opt.image)
                        : opt.image_path
                          ? opt.image_url
                          : null;
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={opt.is_correct}
                            onChange={() => handleCorrectOptionSelect(idx)}
                            style={{ width: '20px', height: '20px', flex: 'none', cursor: 'pointer' }}
                            aria-label={`Mark option ${opt.label.toUpperCase()} correct`}
                            title="Set as correct answer"
                          />
                          <span style={{ font: '600 13px var(--font-body)', color: 'var(--tx2)', width: '18px', flex: 'none', textTransform: 'uppercase' }}>
                            {opt.label}
                          </span>

                          {/* Reasoning figure-series options (SSC CGL/CHSL
                              non-verbal reasoning) are routinely image-only —
                              a 32px square doubling as thumbnail-or-add-button
                              keeps that possible without breaking this row
                              onto a second line for the common text-only case. */}
                          <label
                            title={optionImageUrl ? 'Change image' : 'Add an image for this option'}
                            style={{
                              width: '34px', height: '34px', flex: 'none', borderRadius: '8px',
                              border: '1.5px dashed var(--line2)', cursor: 'pointer', overflow: 'hidden',
                              display: 'grid', placeItems: 'center', background: 'var(--card2)',
                            }}
                          >
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={(e) => setOptionImage(idx, e.target.files?.[0] || null)}
                              style={{ display: 'none' }}
                            />
                            {optionImageUrl
                              ? <img src={optionImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <Icon name="image" size={15} style={{ color: 'var(--muted)' }} />}
                          </label>
                          {optionImageUrl && (
                            <button
                              type="button"
                              className="adm-rowaction"
                              onClick={() => clearOptionImage(idx)}
                              aria-label={`Remove image from option ${opt.label.toUpperCase()}`}
                              title="Remove image"
                              style={{ flex: 'none' }}
                            >
                              <Icon name="x" size={13} />
                            </button>
                          )}

                          <input
                            type="text"
                            value={opt.option_text}
                            onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                            className="form-input"
                            placeholder={optionImageUrl ? `Caption for option ${opt.label.toUpperCase()} (optional)` : `Option ${opt.label.toUpperCase()}`}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="adm-rowaction"
                            onClick={() => removeOption(idx)}
                            disabled={form.options.length <= 2}
                            style={{ opacity: form.options.length <= 2 ? 0.35 : 1 }}
                            aria-label={`Remove option ${opt.label.toUpperCase()}`}
                            title="Remove option"
                          >
                            <Icon name="x" size={16} />
                          </button>
                        </div>
                      );
                    })}
                    {form.options.length < 6 && (
                      <button
                        type="button"
                        onClick={addOption}
                        className="btn-secondary"
                        style={{ alignSelf: 'flex-start', padding: '8px 14px', minHeight: '40px', fontSize: '12px' }}
                      >
                        <Icon name="plus" size={14} strokeWidth={2.4} />
                        Add option {nextOptionLabel()?.toUpperCase()}
                      </button>
                    )}
                  </div>
                )}
              </FormSection>

              <FormSection title="Explanation">
                <Field label="Solution shown after submission" htmlFor="qf-exp">
                  <textarea
                    id="qf-exp"
                    value={form.explanation}
                    onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                    className="form-input"
                    rows={3}
                  />
                </Field>
              </FormSection>
            </form>

            {/* ---- live preview ---- */}
            <div>
              <FormSection title="Live preview">
                <div
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    background: 'var(--card2)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div className="t-overline" style={{ color: 'var(--muted)' }}>
                    {form.subject || 'SUBJECT'} · {form.topic || 'TOPIC'} · {form.difficulty} · +{form.marks}/−{form.negative_marks}
                    {form.question_type !== 'single_choice' && ` · ${form.question_type.replace('_', ' ')}`}
                  </div>

                  {form.passage_id && passages.find((pg) => String(pg.id) === String(form.passage_id)) && (() => {
                    const pg = passages.find((p) => String(p.id) === String(form.passage_id));
                    return (
                      <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--card)', border: '1px dashed var(--line2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ font: '400 13px/1.62 var(--font-body)', color: 'var(--tx2)' }}>{pg.body}</div>
                        {pg.table_data && <PreviewTable table={pg.table_data} />}
                        {pg.image_url && (
                          <img src={pg.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '8px', border: '1px solid var(--line)' }} />
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ font: '400 15px/1.62 var(--font-body)', color: 'var(--tx)' }}>
                      {form.question_text ? (
                        <div dangerouslySetInnerHTML={renderMath(form.question_text)} />
                      ) : (
                        <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Type the stem to preview it…</span>
                      )}
                    </div>
                    {(form.image || (form.image_url && !form.remove_image)) && (
                      <img
                        src={form.image ? previewUrlFor(form.image) : form.image_url}
                        alt=""
                        style={{ maxWidth: '260px', maxHeight: '180px', borderRadius: '10px', border: '1px solid var(--line)' }}
                      />
                    )}
                  </div>

                  {form.question_type === 'numeric' ? (
                    <div style={{ padding: '14px 16px', borderRadius: '14px', background: 'var(--primary-soft)', border: '1px solid var(--primary-border)' }}>
                      <div className="t-overline" style={{ color: 'var(--primary)' }}>ACCEPTED ANSWER</div>
                      <div className="t-num" style={{ marginTop: '6px', fontSize: '20px', color: 'var(--tx)' }}>
                        {form.numeric_answer !== '' ? form.numeric_answer : '—'}
                        {Number(form.numeric_tolerance) > 0 && (
                          <span style={{ font: '500 13px var(--font-mono)', color: 'var(--muted)' }}> ± {form.numeric_tolerance}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {form.options.map((opt, idx) => {
                        const optImg = opt.image ? previewUrlFor(opt.image) : opt.image_path ? opt.image_url : null;
                        return (
                          <div
                            key={idx}
                            className={`mcq-option ${opt.is_correct ? 'selected' : ''}`}
                            style={{ margin: 0, padding: '12px 15px', cursor: 'default', display: 'flex', alignItems: 'center', gap: '10px' }}
                          >
                            <span className="option-badge">{opt.label}</span>
                            {optImg && (
                              <img src={optImg} alt="" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', flex: 'none' }} />
                            )}
                            {/* renderMath escapes markup, so an HTML placeholder would
                                print as literal tags — render the empty state as JSX. */}
                            {opt.option_text ? (
                              <div dangerouslySetInnerHTML={renderMath(opt.option_text)} />
                            ) : optImg ? null : (
                              <div style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Option {opt.label.toUpperCase()} empty</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {form.explanation && (
                    <div style={{ padding: '14px 16px', background: 'var(--primary-soft)', borderLeft: '3px solid var(--primary)', borderRadius: '0 12px 12px 0' }}>
                      <div className="t-overline" style={{ color: 'var(--primary)', marginBottom: '7px' }}>EXPLANATION</div>
                      <div style={{ font: '400 13px/1.6 var(--font-body)', color: 'var(--tx2)' }} dangerouslySetInnerHTML={renderMath(form.explanation)} />
                    </div>
                  )}
                </div>
              </FormSection>
            </div>
          </div>
        </Modal>
      )}

      {/* ---- destructive confirmations ---- */}
      {pendingDelete && (
        <Modal
          danger
          title="Deactivate this question?"
          description="It stops appearing in test selection. Papers that already contain it keep it, and nothing already scored changes."
          width={480}
          onClose={() => setPendingDelete(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => { const q = pendingDelete; setPendingDelete(null); setDetailQuestion(null); handleDeleteClick(q.id); }}
              >
                Deactivate question
              </button>
            </>
          }
        >
          <div style={{ font: '400 13.5px/1.6 var(--font-body)', color: 'var(--tx2)' }}>
            <span dangerouslySetInnerHTML={renderMath(pendingDelete.question_text.substring(0, 200))} />
          </div>
        </Modal>
      )}

      {pendingBulkDelete && (
        <Modal
          danger
          title={`Deactivate ${selectedIds.length} question(s)?`}
          description="They stop appearing in test selection. Papers that already contain them keep them, and nothing already scored changes."
          width={480}
          onClose={() => setPendingBulkDelete(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setPendingBulkDelete(false)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => { setPendingBulkDelete(false); bulkDeactivate(); }}
              >
                Deactivate {selectedIds.length} question(s)
              </button>
            </>
          }
        />
      )}

      {pendingPassageDelete && (
        <Modal
          danger
          title={`Delete “${pendingPassageDelete.title || `Passage #${pendingPassageDelete.id}`}”?`}
          description={
            (pendingPassageDelete.questions_count ?? 0) > 0
              ? `${pendingPassageDelete.questions_count} question(s) still link to it — the API will refuse until they are unlinked.`
              : 'Nothing links to it, so the delete will go through.'
          }
          width={480}
          onClose={() => setPendingPassageDelete(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setPendingPassageDelete(null)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => { const pg = pendingPassageDelete; setPendingPassageDelete(null); deletePassage(pg.id); }}
              >
                Delete passage
              </button>
            </>
          }
        />
      )}
    </div>
  );
}

/** One measured statistic with its plain-language meaning underneath. */
function Metric({ label, value, hint, danger }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'var(--card2)', border: '1px solid var(--line)' }}>
      <div className="t-overline" style={{ color: 'var(--muted)', fontSize: '9px' }}>{label}</div>
      <div className="t-num" style={{ marginTop: '6px', fontSize: '20px', color: danger ? 'var(--danger)' : 'var(--tx)' }}>{value}</div>
      <div style={{ marginTop: '4px', font: '400 11px var(--font-body)', color: 'var(--muted)' }}>{hint}</div>
    </div>
  );
}
