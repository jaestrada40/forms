import React, { useState, useEffect } from 'react';
import { 
  Form, 
  FormResponse, 
  UserAccount, 
  ActiveScreen, 
  Template, 
  UserRole 
} from './types';
import { 
  INITIAL_FORMS, 
  INITIAL_RESPONSES, 
  INITIAL_USERS 
} from './data/mockData';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastContainer, ToastMessage } from './components/Toast';
import { 
  ShareModal, 
  PublishModal, 
  DeleteModal, 
  DuplicateModal, 
  InviteUserModal, 
  ScheduleReportModal, 
  NewFormModal 
} from './components/Modals';
import { DashboardHome } from './views/DashboardHome';
import { FormsList } from './views/FormsList';
import { FormBuilder } from './views/FormBuilder';
import { PublicFormView } from './views/PublicFormView';
import { ResponsesView } from './views/ResponsesView';
import { ReportsView } from './views/ReportsView';
import { TemplatesView } from './views/TemplatesView';
import { UsersView } from './views/UsersView';
import { SettingsView } from './views/SettingsView';

const STORAGE_KEY_FORMS = 'formularios_state_forms';
const STORAGE_KEY_RESPONSES = 'formularios_state_responses';
const STORAGE_KEY_USERS = 'formularios_state_users';

export default function App() {
  // Global persistent state
  const [forms, setForms] = useState<Form[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FORMS);
      return saved ? JSON.parse(saved) : INITIAL_FORMS;
    } catch {
      return INITIAL_FORMS;
    }
  });

  const [responses, setResponses] = useState<FormResponse[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RESPONSES);
      return saved ? JSON.parse(saved) : INITIAL_RESPONSES;
    } catch {
      return INITIAL_RESPONSES;
    }
  });

  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USERS);
      return saved ? JSON.parse(saved) : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  // Navigation State
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('forms');
  const [activeFormId, setActiveFormId] = useState<string>(forms[0]?.id || 'form-clima-2026');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Modals state
  const [isNewFormModalOpen, setIsNewFormModalOpen] = useState(false);
  const [shareModalForm, setShareModalForm] = useState<Form | null>(null);
  const [publishModalForm, setPublishModalForm] = useState<Form | null>(null);
  const [deleteModalForm, setDeleteModalForm] = useState<Form | null>(null);
  const [duplicateModalForm, setDuplicateModalForm] = useState<Form | null>(null);
  const [isInviteUserModalOpen, setIsInviteUserModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Toast feedback state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FORMS, JSON.stringify(forms));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [forms]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RESPONSES, JSON.stringify(responses));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [responses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [users]);

  // Selected form object
  const activeForm = forms.find(f => f.id === activeFormId) || forms[0];

  // Actions: Create blank form
  const handleCreateBlankForm = () => {
    const newId = `form_${Date.now()}`;
    const newForm: Form = {
      id: newId,
      title: 'Nuevo Formulario Institucional',
      description: 'Ingrese las instrucciones o propósito de este instrumento para los participantes.',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creator: {
        name: 'Lic. Roberto Morales',
        email: 'roberto.morales@gobierno.cl',
        role: 'Administrador',
      },
      department: 'Dirección General',
      responseCount: 0,
      design: {
        primaryColor: '#1D4ED8',
        accentColor: '#3B82F6',
        fontFamily: 'sans',
        themeStyle: 'institutional',
      },
      settings: {
        limitOneResponsePerUser: false,
        allowEditResponses: false,
        collectEmails: true,
        confirmationMessage: 'Su respuesta ha sido registrada exitosamente en los sistemas institucionales.',
        notifyEmailOnSubmit: false,
        notificationEmails: [],
        department: 'Dirección General',
      },
      fields: [
        {
          id: `field_title_${Date.now()}`,
          type: 'short_text',
          title: 'Nombre y Apellido',
          placeholder: 'Ej: Juan Pérez Morales',
          required: true,
        },
        {
          id: `field_email_${Date.now() + 1}`,
          type: 'email',
          title: 'Correo Institucional',
          placeholder: 'nombre@gobierno.cl',
          required: true,
        },
        {
          id: `field_scale_${Date.now() + 2}`,
          type: 'linear_scale',
          title: '¿Cómo calificaría la claridad del requerimiento?',
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Muy deficiente',
          scaleMaxLabel: 'Excelente',
        },
      ],
    };

    setForms(prev => [newForm, ...prev]);
    setActiveFormId(newId);
    setCurrentScreen('builder');
    showToast('Nuevo formulario en blanco creado', 'success');
  };

  // Actions: Use Template
  const handleUseTemplate = (template: Template) => {
    const newId = `form_tpl_${Date.now()}`;
    const newForm: Form = {
      id: newId,
      title: template.title,
      description: template.description,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creator: {
        name: 'Lic. Roberto Morales',
        email: 'roberto.morales@gobierno.cl',
        role: 'Administrador',
      },
      department: template.department || 'Dirección General',
      responseCount: 0,
      design: {
        primaryColor: '#1D4ED8',
        accentColor: '#10B981',
        fontFamily: 'sans',
        themeStyle: 'institutional',
      },
      settings: {
        limitOneResponsePerUser: false,
        allowEditResponses: false,
        collectEmails: true,
        confirmationMessage: 'Agradecemos su participación en este proceso institucional.',
        notifyEmailOnSubmit: false,
        notificationEmails: [],
        department: template.department || 'Dirección General',
      },
      fields: template.form.fields || [],
    };

    setForms(prev => [newForm, ...prev]);
    setActiveFormId(newId);
    setCurrentScreen('builder');
  };

  // Update existing form
  const handleUpdateForm = (updatedForm: Form) => {
    setForms(prev => prev.map(f => f.id === updatedForm.id ? updatedForm : f));
  };

  // Duplicate form
  const handleDuplicateForm = (formToDuplicate: Form, newTitle: string) => {
    const newId = `form_copy_${Date.now()}`;
    const clone: Form = {
      ...JSON.parse(JSON.stringify(formToDuplicate)),
      id: newId,
      title: newTitle,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responseCount: 0,
    };
    setForms(prev => [clone, ...prev]);
    showToast(`Formulario duplicado como "${newTitle}"`, 'success');
  };

  // Delete form
  const handleDeleteForm = (formId: string) => {
    setForms(prev => prev.filter(f => f.id !== formId));
    setResponses(prev => prev.filter(r => r.formId !== formId));
    showToast('Formulario y sus respuestas asociadas han sido eliminados', 'info');
  };

  // Change status (published / draft / closed)
  const handleChangeStatus = (status: 'draft' | 'published' | 'closed') => {
    if (!publishModalForm) return;
    setForms(prev => prev.map(f => {
      if (f.id === publishModalForm.id) {
        return { ...f, status, updatedAt: new Date().toISOString() };
      }
      return f;
    }));
    showToast(`Estado del formulario actualizado a "${status}"`, 'success');
  };

  // Toggle acceptance
  const handleToggleAcceptingResponses = (formId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'closed' : 'published';
    setForms(prev => prev.map(f => {
      if (f.id === formId) {
        return { ...f, status: newStatus as any, updatedAt: new Date().toISOString() };
      }
      return f;
    }));
  };

  // Submit public response
  const handleSubmitResponse = (newResponse: FormResponse) => {
    setResponses(prev => [newResponse, ...prev]);
    // increment form responseCount
    setForms(prev => prev.map(f => {
      if (f.id === newResponse.formId) {
        return { ...f, responseCount: (f.responseCount || 0) + 1 };
      }
      return f;
    }));
    showToast(`Respuesta guardada con folio ${newResponse.folio}`, 'success');
  };

  // Invite user
  const handleInviteUser = (data: { name: string; email: string; role: UserRole; department: string }) => {
    const initials = data.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'US';
    const newUser: UserAccount = {
      id: `usr_${Date.now()}`,
      name: data.name,
      email: data.email,
      role: data.role,
      department: data.department,
      status: 'Invitado',
      lastActive: 'Invitación enviada hoy',
      initials,
    };
    setUsers(prev => [newUser, ...prev]);
    showToast(`Invitación oficial enviada a ${data.email}`, 'success');
  };

  // Update user role
  const handleUpdateUserRole = (userId: string, newRole: UserRole) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  // If in public view mode, render full-screen respondent interface
  if (currentScreen === 'public_view' && activeForm) {
    return (
      <>
        <PublicFormView
          form={activeForm}
          onSubmitResponse={handleSubmitResponse}
          onExitToAdmin={() => setCurrentScreen('forms')}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Institutional Sidebar */}
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        formsCount={forms.length}
        openNewFormModal={() => setIsNewFormModalOpen(true)}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Header
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
          currentScreen={currentScreen}
          onOpenNewFormModal={() => setIsNewFormModalOpen(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          forms={forms}
          onSelectFormForBuilder={(id) => {
            setActiveFormId(id);
            setCurrentScreen('builder');
          }}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {currentScreen === 'home' && (
            <DashboardHome
              forms={forms}
              responses={responses}
              onNavigate={setCurrentScreen}
              onOpenNewFormModal={() => setIsNewFormModalOpen(true)}
              onSelectFormForBuilder={(id) => {
                setActiveFormId(id);
                setCurrentScreen('builder');
              }}
              onViewResponses={(id) => {
                setActiveFormId(id);
                setCurrentScreen('responses');
              }}
            />
          )}

          {currentScreen === 'forms' && (
            <FormsList
              forms={forms}
              onOpenNewFormModal={() => setIsNewFormModalOpen(true)}
              onEditForm={(id) => {
                setActiveFormId(id);
                setCurrentScreen('builder');
              }}
              onViewResponses={(id) => {
                setActiveFormId(id);
                setCurrentScreen('responses');
              }}
              onShowPublicView={(id) => {
                setActiveFormId(id);
                setCurrentScreen('public_view');
              }}
              onOpenShareModal={(form) => setShareModalForm(form)}
              onOpenPublishModal={(form) => setPublishModalForm(form)}
              onOpenDeleteModal={(form) => setDeleteModalForm(form)}
              onOpenDuplicateModal={(form) => setDuplicateModalForm(form)}
              searchQuery={searchQuery}
            />
          )}

          {currentScreen === 'builder' && activeForm && (
            <FormBuilder
              form={activeForm}
              onUpdateForm={handleUpdateForm}
              onBack={() => setCurrentScreen('forms')}
              onShowPublicView={(id) => {
                setActiveFormId(id);
                setCurrentScreen('public_view');
              }}
              onOpenShareModal={(form) => setShareModalForm(form)}
              onOpenPublishModal={(form) => setPublishModalForm(form)}
              showToast={showToast}
            />
          )}

          {currentScreen === 'responses' && (
            <ResponsesView
              forms={forms}
              selectedFormId={activeFormId}
              onSelectForm={setActiveFormId}
              responses={responses}
              onToggleAcceptingResponses={handleToggleAcceptingResponses}
              showToast={showToast}
            />
          )}

          {currentScreen === 'reports' && (
            <ReportsView
              forms={forms}
              responses={responses}
              onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentScreen === 'templates' && (
            <TemplatesView
              onUseTemplate={handleUseTemplate}
              showToast={showToast}
            />
          )}

          {currentScreen === 'users' && (
            <UsersView
              users={users}
              onOpenInviteModal={() => setIsInviteUserModalOpen(true)}
              onUpdateUserRole={handleUpdateUserRole}
              showToast={showToast}
            />
          )}

          {currentScreen === 'settings' && (
            <SettingsView showToast={showToast} />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <NewFormModal
        isOpen={isNewFormModalOpen}
        onClose={() => setIsNewFormModalOpen(false)}
        onCreateBlank={handleCreateBlankForm}
        onGoToTemplates={() => setCurrentScreen('templates')}
      />

      <ShareModal
        isOpen={!!shareModalForm}
        onClose={() => setShareModalForm(null)}
        form={shareModalForm}
        onShowPublicView={(id) => {
          setActiveFormId(id);
          setCurrentScreen('public_view');
        }}
        showToast={showToast}
      />

      <PublishModal
        isOpen={!!publishModalForm}
        onClose={() => setPublishModalForm(null)}
        form={publishModalForm}
        onConfirmStatus={handleChangeStatus}
      />

      <DeleteModal
        isOpen={!!deleteModalForm}
        onClose={() => setDeleteModalForm(null)}
        form={deleteModalForm}
        onConfirmDelete={handleDeleteForm}
      />

      <DuplicateModal
        isOpen={!!duplicateModalForm}
        onClose={() => setDuplicateModalForm(null)}
        form={duplicateModalForm}
        onConfirmDuplicate={handleDuplicateForm}
      />

      <InviteUserModal
        isOpen={isInviteUserModalOpen}
        onClose={() => setIsInviteUserModalOpen(false)}
        onInvite={handleInviteUser}
      />

      <ScheduleReportModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSchedule={(data) => {
          showToast(`Reporte programado con frecuencia ${data.frequency}`, 'success');
        }}
      />
    </div>
  );
}
