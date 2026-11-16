// Thin fetch wrapper. All requests are same-origin (/api is proxied), cookies
// carry the session, and the CSRF token is attached to state-changing requests.

let csrfToken = null;
let onUnauthenticated = () => {};

export const setCsrfToken = (token) => {
  csrfToken = token;
};
export const setUnauthenticatedHandler = (fn) => {
  onUnauthenticated = fn;
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error?.code ?? 'UNKNOWN';
    this.details = body?.error?.details ?? [];
  }
  /** Field-level validation messages keyed by field name. */
  fieldErrors() {
    return Object.fromEntries(this.details.filter((d) => d.field).map((d) => [d.field, d.message]));
  }
}

async function fetchCsrfToken() {
  const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  const body = await res.json();
  csrfToken = body.data.csrfToken;
  return csrfToken;
}

function buildUrl(path, params) {
  const url = new URL(`/api${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
    url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  });
  return url.pathname + url.search;
}

export async function apiRequest(method, path, { body, params, retryCsrf = true } = {}) {
  const isMutation = method !== 'GET';
  if (isMutation && !csrfToken) await fetchCsrfToken();

  let res;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(isMutation ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { error: { code: 'NETWORK_ERROR', message: 'Cannot reach the OpsDesk server. Check your connection and try again.' } });
  }

  const payload = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return payload;

  // The session may have been rotated (e.g. after sign-in elsewhere): refresh the token once.
  if (res.status === 403 && payload?.error?.code === 'CSRF_INVALID' && retryCsrf) {
    await fetchCsrfToken();
    return apiRequest(method, path, { body, params, retryCsrf: false });
  }
  if (res.status === 401 && !path.startsWith('/auth/')) onUnauthenticated();
  throw new ApiError(res.status, payload);
}

export const api = {
  get: (path, params) => apiRequest('GET', path, { params }).then((r) => r),
  post: (path, body) => apiRequest('POST', path, { body: body ?? {} }),
  patch: (path, body) => apiRequest('PATCH', path, { body }),
  delete: (path, params) => apiRequest('DELETE', path, { params }),
};
