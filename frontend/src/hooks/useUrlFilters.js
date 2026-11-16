import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * List filters stored in the URL (?status=open&page=2) so views are shareable
 * and survive reloads. Changing any filter other than `page` resets to page 1.
 */
export function useUrlFilters(defaults = {}) {
  const [params, setParams] = useSearchParams();
  const key = JSON.stringify(defaults);

  const filters = useMemo(() => {
    const base = JSON.parse(key);
    const values = { ...base };
    for (const [k, v] of params.entries()) values[k] = v;
    values.page = Number(values.page ?? 1) || 1;
    return values;
  }, [params, key]);

  const setFilters = useCallback(
    (patch) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === '' || v === null || v === undefined) next.delete(k);
            else next.set(k, String(v));
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [filters, setFilters];
}

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Text input that writes to a URL filter after the user stops typing. */
export function useDebouncedFilter(filters, setFilters, name = 'search') {
  const [text, setText] = useState(filters[name] ?? '');
  const debounced = useDebouncedValue(text);
  useEffect(() => {
    if ((filters[name] ?? '') !== debounced) setFilters({ [name]: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return [text, setText];
}
