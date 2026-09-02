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
