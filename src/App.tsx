import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Form,
  FormResponse,
  UserAccount,
  ActiveScreen,
  Template,
  UserRole
} from './types';
import { api, session, SessionUser, BrandingInfo } from './services/api';
import { formRowToForm, formToPayload, responseRowToResponse, userRowToUser } from './services/mappers';
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
import { LoginView } from './views/LoginView';
import { PublicResponderPage } from './views/PublicResponderPage';
import { DashboardHome } from './views/DashboardHome';
import { FormsList } from './views/FormsList';
import { FormBuilder } from './views/FormBuilder';
import { PublicFormView } from './views/PublicFormView';
import { ResponsesView } from './views/ResponsesView';
import { ReportsView } from './views/ReportsView';
import { TemplatesView } from './views/TemplatesView';
import { UsersView } from './views/UsersView';
import { SettingsView } from './views/SettingsView';
import { AuditView } from './views/AuditView';

const PUBLIC_RESPONDER_PATH = /^\/responder\/([^/]+)\/?$/;

export default function App() {
  const publicFormId = PUBLIC_RESPONDER_PATH.exec(window.location.pathname)?.[1];
  if (publicFormId) {
    return <PublicResponderPage formId={publicFormId} />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [authUser, setAuthUser] = useState<SessionUser | null>(() => session.read()?.user ?? null);

  const [forms, setForms] = useState<Form[]>([]);
  const [formSaveStatus, setFormSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [branding, setBranding] = useState<BrandingInfo | null>(null);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  useEffect(() => {
    api.getBranding()
      .then(setBranding)
      .catch(() => { /* fall back to default branding */ })
      .finally(() => setBrandingLoaded(true));
  }, []);

  // Navigation State — restored from sessionStorage so a page reload keeps the user where they were.
  const NAV_STORAGE_KEY = 'formularios_last_screen';
  const restoredNav = (() => {
    try {
      const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { screen: ActiveScreen; formId: string };
      if (parsed.screen === 'public_view') return null; // never restore into the full-screen respondent mode
      return parsed;
    } catch { return null; }
  })();

  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>(restoredNav?.screen ?? 'forms');
  const [previousScreen, setPreviousScreen] = useState<ActiveScreen>('forms');
  const [activeFormId, setActiveFormId] = useState<string>(restoredNav?.formId ?? '');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    try {
      if (currentScreen === 'public_view') return; // keep whatever screen was active before the preview
      sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify({ screen: currentScreen, formId: activeFormId }));
    } catch { /* sessionStorage unavailable */ }
  }, [currentScreen, activeFormId]);

  const openPublicPreview = (id: string) => {
    setPreviousScreen(currentScreen);
    setActiveFormId(id);
    setCurrentScreen('public_view');
  };
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

  const reportError = (error: unknown, fallback: string) => {
    showToast(error instanceof Error ? error.message : fallback, 'error');
  };

  // Load forms + users from the real API once authenticated
  const loadForms = useCallback(async () => {
    setLoadingForms(true);
    try {
      const rows = await api.forms();
      const mapped = rows.map(formRowToForm);
      setForms(mapped);
      setActiveFormId(prev => prev || mapped[0]?.id || '');
    } catch (error) {
      reportError(error, 'No fue posible cargar los formularios.');
    } finally {
      setLoadingForms(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const rows = await api.users();
      setUsers(rows.map(userRowToUser));
    } catch {
      // Non-admin roles can't list users; ignore silently.
    }
  }, []);

  useEffect(() => {
    if (authUser) {
      loadForms();
      loadUsers();
      api.getDepartments().then(setDepartments).catch(() => {});
    }
  }, [authUser, loadForms, loadUsers]);

  // Fetch responses for the active form whenever the responses screen is used
  useEffect(() => {
    if (!authUser || currentScreen !== 'responses' || !activeFormId) return;
    api.getFormResponses(activeFormId)
      .then(rows => {
        const mapped = rows.map(responseRowToResponse);
        setResponses(prev => [...prev.filter(r => r.formId !== activeFormId), ...mapped]);
      })
      .catch(error => reportError(error, 'No fue posible cargar las respuestas.'));
  }, [authUser, currentScreen, activeFormId]);

  // Fetch all responses for the reports screen
  useEffect(() => {
    if (!authUser || currentScreen !== 'reports') return;
    api.allResponses()
      .then(rows => setResponses(rows.map(responseRowToResponse)))
      .catch(error => reportError(error, 'No fue posible cargar las respuestas.'));
  }, [authUser, currentScreen]);

  // Selected form object
  const activeForm = forms.find(f => f.id === activeFormId) || forms[0];

  // Guard against restoring onto a screen that needs a form that no longer exists (e.g. deleted elsewhere).
  useEffect(() => {
    if (loadingForms) return;
    if ((currentScreen === 'builder' || currentScreen === 'public_view') && forms.length > 0 && !activeForm) {
      setCurrentScreen('forms');
    }
  }, [loadingForms, forms, activeForm, currentScreen]);

  // Reset the save indicator whenever a different form is opened in the builder.
  useEffect(() => {
    if (currentScreen === 'builder') setFormSaveStatus('idle');
  }, [currentScreen, activeFormId]);

  // Debounced autosave for in-progress form builder edits
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const scheduleFormSave = (form: Form) => {
    setFormSaveStatus('saving');
    clearTimeout(saveTimers.current[form.id]);
    saveTimers.current[form.id] = setTimeout(async () => {
      try {
        const row = await api.updateForm(form.id, formToPayload(form));
        const saved = formRowToForm(row);
        setForms(prev => prev.map(f => (f.id === saved.id ? saved : f)));
        setFormSaveStatus('saved');
      } catch (error) {
        setFormSaveStatus('error');
        reportError(error, 'No fue posible guardar los cambios del formulario.');
      }
    }, 700);
  };

  // Actions: Create blank form
  const handleCreateBlankForm = async () => {
    const blank: Pick<Form, 'title' | 'description' | 'department' | 'fields' | 'design' | 'settings' | 'status'> = {
      title: 'Nuevo Formulario Institucional',
      description: 'Ingrese las instrucciones o propósito de este instrumento para los participantes.',
      department: authUser?.department || 'Dirección General',
      status: 'draft',
      design: {
        primaryColor: '#1D4ED8',
        accentColor: '#3B82F6',
        fontFamily: 'sans',
        themeStyle: 'institutional',
      },
      settings: {
        limitOneResponsePerUser: false,
        allowEditResponses: false,
        collectEmails: false,
        confirmationMessage: 'Su respuesta ha sido registrada exitosamente en los sistemas institucionales.',
        notifyEmailOnSubmit: false,
        notificationEmails: [],
        department: authUser?.department || 'Dirección General',
      },
      fields: [
        { id: `field_title_${Date.now()}`, type: 'short_text', title: 'Nombre y Apellido', placeholder: 'Ej: Juan Pérez Morales', required: true },
        { id: `field_email_${Date.now() + 1}`, type: 'email', title: 'Correo Institucional', placeholder: 'nombre@minfin.gob.gt', required: true },
      ],
    };

    try {
      const row = await api.createForm(formToPayload(blank));
      const created = formRowToForm(row);
      setForms(prev => [created, ...prev]);
      setActiveFormId(created.id);
      setCurrentScreen('builder');
      showToast('Nuevo formulario en blanco creado', 'success');
    } catch (error) {
      reportError(error, 'No fue posible crear el formulario.');
    }
  };

  // Actions: Use Template
  const handleUseTemplate = async (template: Template) => {
    const department = template.department || authUser?.department || 'Dirección General';
    const payload = {
      title: template.title,
      description: template.description,
      department,
      status: 'draft' as const,
      design: {
        primaryColor: '#1D4ED8',
        accentColor: '#10B981',
        fontFamily: 'sans' as const,
        themeStyle: 'institutional' as const,
      },
      settings: {
        limitOneResponsePerUser: false,
        allowEditResponses: false,
        collectEmails: false,
        confirmationMessage: 'Agradecemos su participación en este proceso institucional.',
        notifyEmailOnSubmit: false,
        notificationEmails: [],
        department,
      },
      fields: template.form.fields || [],
    };

    try {
      const row = await api.createForm(formToPayload(payload));
      const created = formRowToForm(row);
      setForms(prev => [created, ...prev]);
      setActiveFormId(created.id);
      setCurrentScreen('builder');
    } catch (error) {
      reportError(error, 'No fue posible crear el formulario a partir de la plantilla.');
    }
  };

  // Update existing form (optimistic local update + debounced save)
  const handleUpdateForm = (updatedForm: Form) => {
    setForms(prev => prev.map(f => (f.id === updatedForm.id ? updatedForm : f)));
    scheduleFormSave(updatedForm);
  };

  // Duplicate form
  const handleDuplicateForm = async (formToDuplicate: Form, newTitle: string) => {
    try {
      const row = await api.createForm(formToPayload({ ...formToDuplicate, title: newTitle, status: 'draft' }));
      const created = formRowToForm(row);
      setForms(prev => [created, ...prev]);
      showToast(`Formulario duplicado como "${newTitle}"`, 'success');
    } catch (error) {
      reportError(error, 'No fue posible duplicar el formulario.');
    }
  };

  // Delete form
  const handleDeleteForm = async (formId: string) => {
    try {
      await api.deleteForm(formId);
      setForms(prev => prev.filter(f => f.id !== formId));
      setResponses(prev => prev.filter(r => r.formId !== formId));
      showToast('Formulario y sus respuestas asociadas han sido eliminados', 'info');
    } catch (error) {
      reportError(error, 'No fue posible eliminar el formulario.');
    }
  };

  // Change status (published / draft / closed)
  const handleChangeStatus = async (status: 'draft' | 'published' | 'closed') => {
    if (!publishModalForm) return;
    try {
      const row = await api.updateForm(publishModalForm.id, { status });
      const updated = formRowToForm(row);
      setForms(prev => prev.map(f => (f.id === updated.id ? updated : f)));
      showToast(`Estado del formulario actualizado a "${status}"`, 'success');
    } catch (error) {
      reportError(error, 'No fue posible actualizar el estado del formulario.');
    }
  };

  // Toggle acceptance
  const handleToggleAcceptingResponses = async (formId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'closed' : 'published';
    try {
      const row = await api.updateForm(formId, { status: newStatus });
      const updated = formRowToForm(row);
      setForms(prev => prev.map(f => (f.id === updated.id ? updated : f)));
    } catch (error) {
      reportError(error, 'No fue posible actualizar el formulario.');
    }
  };

  // Submit public response
  const handleSubmitResponse = async (newResponse: FormResponse): Promise<{ folio: string; submittedAt: string }> => {
    const created = await api.submitResponse(newResponse.formId, {
      answers: newResponse.answers,
      respondentEmail: newResponse.respondentEmail || undefined,
      respondentName: newResponse.respondentName || undefined,
      respondentDepartment: newResponse.respondentDepartment || undefined,
      completionTimeSeconds: newResponse.completionTimeSeconds,
    });
    const saved: FormResponse = { ...newResponse, id: created.id, folio: created.folio, submittedAt: created.submitted_at };
    setResponses(prev => [saved, ...prev]);
    setForms(prev => prev.map(f => (f.id === newResponse.formId ? { ...f, responseCount: (f.responseCount || 0) + 1 } : f)));
    showToast(`Respuesta guardada con folio ${saved.folio}`, 'success');
    return { folio: saved.folio, submittedAt: saved.submittedAt };
  };

  // Invite user
  const handleInviteUser = async (data: { name: string; email: string; role: UserRole; department: string; password: string }) => {
    try {
      const row = await api.inviteUser(data);
      setUsers(prev => [userRowToUser(row), ...prev]);
      showToast(`Usuario ${data.email} creado correctamente`, 'success');
    } catch (error) {
      reportError(error, 'No fue posible crear el usuario.');
    }
  };

  // Update user role
  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const row = await api.updateUser(userId, { role: newRole });
      setUsers(prev => prev.map(u => (u.id === userId ? userRowToUser(row) : u)));
    } catch (error) {
      reportError(error, 'No fue posible actualizar el rol del usuario.');
    }
  };

  const handleEditUser = async (userId: string, data: { name: string; email: string; department: string }) => {
    try {
      const row = await api.updateUser(userId, data);
      setUsers(prev => prev.map(u => (u.id === userId ? userRowToUser(row) : u)));
      showToast('Datos del usuario actualizados', 'success');
    } catch (error) {
      reportError(error, 'No fue posible actualizar el usuario.');
    }
  };

  const handleChangeUserPassword = async (userId: string, password: string) => {
    try {
      await api.updateUser(userId, { password });
      showToast('Contraseña actualizada correctamente', 'success');
    } catch (error) {
      reportError(error, 'No fue posible cambiar la contraseña.');
    }
  };

  const handleResetUserMfa = async (userId: string) => {
    try {
      const row = await api.resetUserMfa(userId);
      setUsers(prev => prev.map(u => (u.id === userId ? userRowToUser(row) : u)));
      showToast(`MFA restablecido para ${row.name}. Deberá configurarlo nuevamente en su próximo inicio de sesión.`, 'success');
    } catch (error) {
      reportError(error, 'No fue posible restablecer el MFA del usuario.');
    }
  };

  const handleLogout = () => {
    session.clear();
    try { sessionStorage.removeItem(NAV_STORAGE_KEY); } catch { /* sessionStorage unavailable */ }
    setAuthUser(null);
    setForms([]);
    setResponses([]);
    setUsers([]);
    setCurrentScreen('forms');
  };

  if (!authUser) {
    return <LoginView onLoggedIn={setAuthUser} />;
  }

  // If in public view mode, render full-screen respondent interface
  if (currentScreen === 'public_view' && activeForm) {
    return (
      <>
        <PublicFormView
          form={activeForm}
          onSubmitResponse={handleSubmitResponse}
          onExitToAdmin={() => setCurrentScreen(previousScreen)}
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
        currentUser={authUser}
        onLogout={handleLogout}
        branding={branding}
        brandingLoaded={brandingLoaded}
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
          currentUser={authUser}
          onLogout={handleLogout}
          onNavigate={setCurrentScreen}
          onOpenFormResponses={(id) => { setActiveFormId(id); setCurrentScreen('responses'); }}
          onProfileUpdated={setAuthUser}
          showToast={showToast}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {loadingForms && forms.length === 0 ? (
            <div className="text-sm text-slate-500">Cargando formularios…</div>
          ) : (
            <>
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
                  onShowPublicView={openPublicPreview}
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
                  saveStatus={formSaveStatus}
                  departments={departments}
                  onBack={() => setCurrentScreen('forms')}
                  onShowPublicView={openPublicPreview}
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
                  institutionName={branding?.name || 'Formularios Institucionales'}
                  showToast={showToast}
                />
              )}

              {currentScreen === 'reports' && (
                <ReportsView
                  forms={forms}
                  responses={responses}
                  onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
                  institutionName={branding?.name || 'Formularios Institucionales'}
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
                  onResetUserMfa={handleResetUserMfa}
                  onChangeUserPassword={handleChangeUserPassword}
                  onEditUser={handleEditUser}
                  departments={departments}
                  showToast={showToast}
                />
              )}

              {currentScreen === 'audit' && authUser.role === 'Administrador' && <AuditView />}

              {currentScreen === 'settings' && (
                <SettingsView
                  showToast={showToast}
                  isSuperAdmin={authUser.role === 'Administrador'}
                  onBrandingUpdated={(b) => setBranding(b)}
                  departments={departments}
                  onDepartmentsChange={setDepartments}
                />
              )}
            </>
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
        onShowPublicView={openPublicPreview}
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
        departments={departments}
      />

      <ScheduleReportModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        showToast={showToast}
      />
    </div>
  );
}
