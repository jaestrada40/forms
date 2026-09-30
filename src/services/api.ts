const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Creador' | 'Analista' | 'Respondedor';
  department?: string;
}

export interface AuthSession {
  token: string;
  user: SessionUser;
}

const sessionKey = 'formularios_session';

export const session = {
  read(): AuthSession | null {
    try {
      const value = localStorage.getItem(sessionKey);
      return value ? JSON.parse(value) as AuthSession : null;
    } catch { return null; }
  },
  save(value: AuthSession) { localStorage.setItem(sessionKey, JSON.stringify(value)); },
  clear() { localStorage.removeItem(sessionKey); },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const currentSession = session.read();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(currentSession ? { Authorization: `Bearer ${currentSession.token}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'No fue posible completar la solicitud.');
  return body as T;
}

export const api = {
  login: async (email: string, password: string) => {
    const result = await request<AuthSession>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    session.save(result);
    return result;
  },
  me: () => request<{ user: SessionUser }>('/api/auth/me'),
  forms: () => request<unknown[]>('/api/forms'),
  createForm: (payload: unknown) => request<unknown>('/api/forms', { method: 'POST', body: JSON.stringify(payload) }),
  updateForm: (id: string, payload: unknown) => request<unknown>(`/api/forms/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getPublicForm: (id: string) => request<unknown>(`/api/public/forms/${id}`),
  submitResponse: (formId: string, payload: unknown) => request<unknown>(`/api/public/forms/${formId}/responses`, { method: 'POST', body: JSON.stringify(payload) }),
};
