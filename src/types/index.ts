export type FormFieldType =
  | 'short_text'
  | 'paragraph'
  | 'number'
  | 'email'
  | 'phone'
  | 'dpi'
  | 'nit'
  | 'date'
  | 'time'
  | 'single_choice'
  | 'multiple_choice'
  | 'dropdown'
  | 'linear_scale'
  | 'matrix'
  | 'file_upload'
  | 'guatemala_location'
  | 'section'
  | 'banner'
  | 'image';

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
  /** Share of the row this field takes (fields with partial width flow side by side). Default: full. */
  width?: 'full' | 'half' | 'third' | 'two_thirds';
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
  /** banner / image fields: picture as data URL */
  imageSrc?: string;
  /** image width as % of the form width (10-100) */
  imageWidth?: number;
  /** banner height in px */
  imageHeight?: number;
  imageAlign?: 'left' | 'center' | 'right';
  /** optional background colour behind the picture (hex) */
  imageBackground?: string;
  /** banner: crop to fill the height (cover) or show the whole picture (contain) */
  imageFit?: 'cover' | 'contain';
  /** where the picture appears: inside the form flow (default) or in the header, above the title */
  imagePlacement?: 'in_form' | 'above_title';
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
  /** Colour of the final submit button; falls back to primaryColor. */
  submitButtonColor?: string;
  /** Label of the final submit button; falls back to "Enviar respuestas". */
  submitButtonText?: string;
}

export interface FormSettings {
  limitOneResponsePerUser: boolean;
  allowEditResponses: boolean;
  collectEmails: boolean;
  confirmationMessage: string;
  notifyEmailOnSubmit: boolean;
  notificationEmails: string[];
  closeDate?: string;
  /** Customisation of the automatic e-mail field */
  emailLabel?: string;
  emailHelp?: string;
  emailPlaceholder?: string;
  emailPosition?: 'top' | 'bottom';
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
  mfaEnabled: boolean;
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
  | 'audit'
  | 'public_view';
