export type FormFieldType =
  | 'short_text'
  | 'paragraph'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'time'
  | 'single_choice'
  | 'multiple_choice'
  | 'dropdown'
  | 'linear_scale'
  | 'matrix'
  | 'file_upload'
  | 'section';

export interface FormFieldValidation {
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  regexPattern?: string;
  customErrorMessage?: string;
}

export interface ConditionalLogic {
  dependsOnFieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'is_filled';
  value: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  title: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  matrixRows?: string[];
  matrixColumns?: string[];
  validation?: FormFieldValidation;
  defaultValue?: string;
  conditionalLogic?: ConditionalLogic;
  fileConfig?: {
    allowedTypes: string[];
    maxMb: number;
  };
}

export interface FormDesign {
  primaryColor: string;
  accentColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  themeStyle: 'clean' | 'compact' | 'institutional';
  headerBanner?: string;
}

export interface FormSettings {
  limitOneResponsePerUser: boolean;
  allowEditResponses: boolean;
  collectEmails: boolean;
  confirmationMessage: string;
  notifyEmailOnSubmit: boolean;
  notificationEmails: string[];
  closeDate?: string;
  maxTotalResponses?: number;
  department: string;
}

export type FormStatus = 'draft' | 'published' | 'closed';

export interface Form {
  id: string;
  title: string;
  description: string;
  status: FormStatus;
  createdAt: string;
  updatedAt: string;
  creator: {
    name: string;
    email: string;
    role: string;
  };
  department: string;
  fields: FormField[];
  design: FormDesign;
  settings: FormSettings;
  responseCount: number;
}

export interface FormResponse {
  id: string;
  formId: string;
  folio: string;
  submittedAt: string;
  completionTimeSeconds: number;
  respondentEmail?: string;
  respondentName?: string;
  respondentDepartment?: string;
  answers: Record<string, any>;
}

export interface Template {
  id: string;
  title: string;
  category: 'Encuestas' | 'Solicitudes' | 'Recursos Humanos' | 'Eventos' | 'Evaluaciones' | 'Registro';
  description: string;
  fieldsCount: number;
  iconName: string;
  department: string;
  form: Partial<Form>;
}

export type UserRole = 'Administrador' | 'Creador' | 'Analista' | 'Respondedor';
export type UserStatus = 'Activo' | 'Invitado' | 'Inactivo';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  status: UserStatus;
  lastActive: string;
  initials: string;
}

export type ActiveScreen =
  | 'home'
  | 'forms'
  | 'builder'
  | 'responses'
  | 'reports'
  | 'templates'
  | 'users'
  | 'settings'
  | 'public_view';
