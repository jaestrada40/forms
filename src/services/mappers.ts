import { Form, FormDesign, FormField, FormSettings, Template, UserAccount } from '../types';
import { FormRow, PublicFormRow, ResponseRow, TemplateRow, UserRow } from './api';

const defaultDesign: FormDesign = {
  primaryColor: '#1D4ED8',
  accentColor: '#3B82F6',
  fontFamily: 'sans',
  themeStyle: 'institutional',
};

const defaultSettings = (department: string): FormSettings => ({
  limitOneResponsePerUser: false,
  allowEditResponses: false,
  collectEmails: false,
  confirmationMessage: 'Su respuesta ha sido registrada exitosamente en los sistemas institucionales.',
  notifyEmailOnSubmit: false,
  notificationEmails: [],
  department,
});

export function formRowToForm(row: FormRow): Form {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creator: { name: row.creator_name, email: row.creator_email, role: '' },
    department: row.department,
    fields: (row.definition?.fields as FormField[]) ?? [],
    design: { ...defaultDesign, ...(row.definition?.design as Partial<FormDesign>) },
    settings: { ...defaultSettings(row.department), ...(row.definition?.settings as Partial<FormSettings>) },
    responseCount: row.response_count ?? 0,
  };
}

export function publicFormRowToForm(row: PublicFormRow): Form {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: 'published',
    createdAt: '',
    updatedAt: '',
    creator: { name: '', email: '', role: '' },
    department: row.department,
    fields: (row.definition?.fields as FormField[]) ?? [],
    design: { ...defaultDesign, ...(row.definition?.design as Partial<FormDesign>) },
    settings: { ...defaultSettings(row.department), ...(row.definition?.settings as Partial<FormSettings>) },
    responseCount: 0,
    captcha: row.captcha ?? null,
  };
}

export function formToPayload(form: Pick<Form, 'title' | 'description' | 'department' | 'fields' | 'design' | 'settings' | 'status'>) {
  return {
    title: form.title,
    description: form.description,
    department: form.department,
    status: form.status,
    definition: { fields: form.fields, design: form.design, settings: form.settings },
  };
}

export function responseRowToResponse(row: ResponseRow) {
  return {
    id: row.id,
    formId: row.form_id,
    folio: row.folio,
    submittedAt: row.submitted_at,
    completionTimeSeconds: row.completion_time_seconds ?? 0,
    respondentEmail: row.respondent_email,
    respondentName: row.respondent_name,
    respondentDepartment: row.respondent_department,
    answers: row.answers,
  };
}

export function userRowToUser(row: UserRow): UserAccount {
  const initials = row.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'US';
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    status: row.status,
    lastActive: row.status === 'Invitado' ? 'Invitación enviada' : new Date(row.created_at).toLocaleDateString('es-GT'),
    initials,
    mfaEnabled: row.mfa_enabled,
  };
}

export function templateRowToTemplate(row: TemplateRow): Template {
  const fields = (row.definition?.fields as FormField[]) ?? [];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    department: row.department,
    iconName: 'LayoutTemplate',
    fieldsCount: fields.length,
    form: {
      title: row.title,
      description: row.description,
      fields,
      design: row.definition?.design as Partial<FormDesign> as FormDesign,
      settings: row.definition?.settings as Partial<FormSettings> as FormSettings,
    },
    custom: true,
    createdById: row.created_by,
    creatorName: row.creator_name,
  };
}
