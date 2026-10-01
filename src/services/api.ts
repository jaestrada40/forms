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

async function request<T>(path: string, init: RequestInit = {}, bearerToken?: string): Promise<T> {
  const currentSession = session.read();
  const token = bearerToken ?? currentSession?.token;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'No fue posible completar la solicitud.');
  return body as T;
}

export interface FormRow {
  id: string;
  title: string;
  description: string;
  department: string;
  status: 'draft' | 'published' | 'closed';
  definition: { fields: unknown[]; design: Record<string, unknown>; settings: Record<string, unknown> };
  created_by: string;
  creator_name: string;
  creator_email: string;
  response_count: number;
  created_at: string;
  updated_at: string;
}

export interface ResponseRow {
  id: string;
  form_id: string;
  folio: string;
  answers: Record<string, unknown>;
  respondent_email?: string;
  respondent_name?: string;
  respondent_department?: string;
  completion_time_seconds?: number;
  submitted_at: string;
}

export interface PublicFormRow {
  id: string;
  title: string;
  description: string;
  department: string;
  definition: { fields: unknown[]; design: Record<string, unknown>; settings: Record<string, unknown> };
}

export interface AuditLogRow {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Creador' | 'Analista' | 'Respondedor';
  department: string;
  status: 'Activo' | 'Invitado' | 'Inactivo';
  mfa_enabled: boolean;
  created_at: string;
}

export type LoginResult =
  | (AuthSession & { mfaRequired?: false; mfaSetupRequired?: false })
  | { mfaRequired: true; mfaToken: string }
  | { mfaSetupRequired: true; mfaToken: string };

export interface MfaSetupInfo {
  secret: string;
  qrDataUrl: string;
}

export interface BrandingInfo {
  name: string;
  logoDataUrl: string | null;
  loginLogoDataUrl: string | null;
}

export interface InstitutionSettings {
  name: string;
  allowedDomains: string;
  retentionPeriod: '1_year' | '3_years' | '5_years' | 'indefinite';
  enableAuditLog: boolean;
  logoDataUrl: string | null;
  loginLogoDataUrl: string | null;
}

export interface UpdateProfilePayload {
  name: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResult>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  mfaSetup: (mfaToken: string) => request<MfaSetupInfo>('/api/auth/mfa/setup', { method: 'POST' }, mfaToken),
  mfaActivate: async (mfaToken: string, code: string) => {
    const result = await request<AuthSession>('/api/auth/mfa/activate', { method: 'POST', body: JSON.stringify({ code }) }, mfaToken);
    session.save(result);
    return result;
  },
  mfaVerify: async (mfaToken: string, code: string) => {
    const result = await request<AuthSession>('/api/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ code }) }, mfaToken);
    session.save(result);
    return result;
  },
  getMfaPolicy: () => request<{ enforced: boolean }>('/api/settings/mfa'),
  setMfaPolicy: (enforced: boolean) => request<{ enforced: boolean }>('/api/settings/mfa', { method: 'PATCH', body: JSON.stringify({ enforced }) }),
  getBranding: () => request<BrandingInfo>('/api/settings/branding'),
  getInstitutionSettings: () => request<InstitutionSettings>('/api/settings/institution'),
  getAuditLog: () => request<AuditLogRow[]>('/api/audit-log'),
  updateInstitutionSettings: (payload: InstitutionSettings) => request<InstitutionSettings>('/api/settings/institution', { method: 'PATCH', body: JSON.stringify(payload) }),
  resetUserMfa: (userId: string) => request<UserRow>(`/api/users/${userId}/mfa-reset`, { method: 'POST' }),
  me: () => request<{ user: SessionUser }>('/api/auth/me'),
  updateProfile: async (payload: UpdateProfilePayload) => {
    const result = await request<AuthSession>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(payload) });
    session.save(result);
    return result;
  },
  forms: () => request<FormRow[]>('/api/forms'),
  createForm: (payload: unknown) => request<FormRow>('/api/forms', { method: 'POST', body: JSON.stringify(payload) }),
  updateForm: (id: string, payload: unknown) => request<FormRow>(`/api/forms/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteForm: (id: string) => request<void>(`/api/forms/${id}`, { method: 'DELETE' }),
  getFormResponses: (formId: string) => request<ResponseRow[]>(`/api/forms/${formId}/responses`),
  allResponses: () => request<ResponseRow[]>('/api/responses'),
  getPublicForm: (id: string) => request<PublicFormRow>(`/api/public/forms/${id}`),
  submitResponse: (formId: string, payload: unknown) => request<{ id: string; folio: string; submitted_at: string }>(`/api/public/forms/${formId}/responses`, { method: 'POST', body: JSON.stringify(payload) }),
  users: () => request<UserRow[]>('/api/users'),
  inviteUser: (payload: { name: string; email: string; role: string; department: string }) => request<UserRow>('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id: string, payload: { role?: string; status?: string }) => request<UserRow>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
};
