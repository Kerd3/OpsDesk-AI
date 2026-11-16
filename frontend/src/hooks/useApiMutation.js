import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext.jsx';

/**
 * useMutation with consistent UX: success toast, error toast (unless the
 * caller handles field errors itself) and cache invalidation.
 */
export function useApiMutation(mutationFn, { invalidate = [], successMessage, onSuccess, onError, toastErrors = true } = {}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (successMessage) toast.success(typeof successMessage === 'function' ? successMessage(data, variables) : successMessage);
      onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      // Validation errors are usually shown next to the fields instead.
      if (toastErrors && !(error.status === 422 && onError)) toast.error(error.message);
      onError?.(error, variables);
    },
  });
}

/** Copy API field errors into react-hook-form. Returns true if any were applied. */
export function applyFieldErrors(error, setError) {
  const fields = error?.fieldErrors?.() ?? {};
  Object.entries(fields).forEach(([name, message]) => setError(name, { type: 'server', message }));
  return Object.keys(fields).length > 0;
}
