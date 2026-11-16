import { api } from './client.js';

// One function per backend endpoint. Components never call fetch directly.
const data = (p) => p.then((r) => r.data);

export const authApi = {
  me: () => data(api.get('/auth/me')),
  login: (credentials) => data(api.post('/auth/login', credentials)),
  logout: () => api.post('/auth/logout'),
  updateProfile: (body) => data(api.patch('/auth/me', body)),
  changePassword: (body) => data(api.post('/auth/change-password', body)),
};

export const dashboardApi = {
  get: () => data(api.get('/dashboard')),
  notifications: () => data(api.get('/notifications')),
};

export const ticketsApi = {
  list: (params) => api.get('/tickets', params),
  get: (id) => data(api.get(`/tickets/${id}`)),
  create: (body) => data(api.post('/tickets', body)),
  update: (id, body) => data(api.patch(`/tickets/${id}`, body)),
  comment: (id, body) => data(api.post(`/tickets/${id}/comments`, body)),
  activity: (id) => data(api.get(`/tickets/${id}/activity`)),
};

export const kbApi = {
  list: (params) => api.get('/knowledge-base', params),
  get: (idOrSlug, params) => data(api.get(`/knowledge-base/${idOrSlug}`, params)),
  create: (body) => data(api.post('/knowledge-base', body)),
  update: (id, body) => data(api.patch(`/knowledge-base/${id}`, body)),
  archive: (id) => data(api.delete(`/knowledge-base/${id}`)),
  destroy: (id) => data(api.delete(`/knowledge-base/${id}`, { permanent: 'true' })),
  tags: () => data(api.get('/knowledge-base/tags')),
};

export const aiApi = {
  status: () => data(api.get('/ai/status')),
  chat: (body) => data(api.post('/ai/chat', body)),
  ticketAssist: (body) => data(api.post('/ai/ticket-assist', body)),
};

export const assetsApi = {
  list: (params) => api.get('/assets', params),
  get: (id) => data(api.get(`/assets/${id}`)),
  create: (body) => data(api.post('/assets', body)),
  update: (id, body) => data(api.patch(`/assets/${id}`, body)),
};

export const usersApi = {
  directory: (roles) => data(api.get('/users/directory', { roles })),
};

export const reportsApi = {
  summary: (params) => data(api.get('/reports/summary', params)),
  tickets: (params) => data(api.get('/reports/tickets', params)),
};

export const adminApi = {
  users: (params) => api.get('/admin/users', params),
  createUser: (body) => data(api.post('/admin/users', body)),
  updateUser: (id, body) => data(api.patch(`/admin/users/${id}`, body)),
  auditLogs: (params) => api.get('/admin/audit-logs', params),
  auditActions: () => data(api.get('/admin/audit-logs/actions')),
  integrations: () => data(api.get('/admin/integrations')),
  deliveries: (params) => api.get('/admin/integrations/deliveries', params),
  retryDelivery: (id) => data(api.post(`/admin/integrations/deliveries/${id}/retry`)),
  sendTestEvent: () => data(api.post('/admin/integrations/test')),
  updateNotificationSettings: (body) => data(api.patch('/admin/settings/notifications', body)),
  updateAiSettings: (body) => data(api.patch('/admin/settings/ai', body)),
};
