import { useEffect, useState } from 'react';
import api from '../api';

/**
 * The exam-category list, served by the API from `config/exams.php`.
 *
 * Before this hook the list was a literal array in each admin form, and the two
 * had already drifted: the Test Series form offered Railways / Defence / Other,
 * which the Course API rejected with a 422, while the Course form could not
 * offer anything outside its own five. Reading it from the API means a category
 * exists in exactly one place and the UI can never present one that will fail
 * validation on save.
 *
 * FALLBACK is only for the window before the request resolves (and for an API
 * that is unreachable) — it is intentionally the conservative original five, so
 * a failed fetch degrades to "fewer choices", never to a choice that 422s.
 */
const FALLBACK = ['SSC', 'Banking', 'RRB', 'UPSC', 'State PCS'];

export function useExamCategories() {
  const [categories, setCategories] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    api.get('/api/settings/public')
      .then((res) => {
        const list = res.data?.settings?.exam_categories;
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setCategories(list);
        }
      })
      .catch(() => {
        /* keep FALLBACK — the form stays usable offline */
      });

    return () => { cancelled = true; };
  }, []);

  return categories;
}

/**
 * The question bank's finer taxonomy — exam registry, sources and mediums —
 * from the same endpoint and for the same reason as the categories above: a
 * dropdown must never offer a value the API will reject.
 *
 * `registry` is a map of code → { name, category, papers }, so choosing an exam
 * narrows the paper list client-side with no second request. Everything
 * degrades to empty rather than to a guess: with no registry the taxonomy
 * fields simply do not offer choices, which reads as "not configured" instead
 * of silently mis-filing a question under an exam that does not exist.
 */
export function useExamTaxonomy() {
  const [taxonomy, setTaxonomy] = useState({ registry: {}, sources: {}, mediums: {} });

  useEffect(() => {
    let cancelled = false;

    api.get('/api/settings/public')
      .then((res) => {
        if (cancelled) return;
        const s = res.data?.settings || {};
        setTaxonomy({
          registry: s.exam_registry || {},
          sources: s.question_sources || {},
          mediums: s.question_mediums || {},
        });
      })
      .catch(() => {
        /* keep the empty shape — taxonomy fields render as "not configured" */
      });

    return () => { cancelled = true; };
  }, []);

  return taxonomy;
}

/** Papers a given exam declares. Empty means the exam has no paper division. */
export function papersFor(registry, examCode) {
  return (registry?.[examCode]?.papers) || [];
}
