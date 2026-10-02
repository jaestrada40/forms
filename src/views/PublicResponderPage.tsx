import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { publicFormRowToForm } from '../services/mappers';
import { Form, FormResponse } from '../types';
import { PublicFormView } from './PublicFormView';

interface PublicResponderPageProps {
  formId: string;
}

export const PublicResponderPage: React.FC<PublicResponderPageProps> = ({ formId }) => {
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getPublicForm(formId)
      .then(row => { if (!cancelled) setForm(publicFormRowToForm(row)); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'No fue posible cargar el formulario.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [formId]);

  const handleSubmitResponse = async (newResponse: FormResponse) => {
    const created = await api.submitResponse(newResponse.formId, {
      answers: newResponse.answers,
      respondentEmail: newResponse.respondentEmail || undefined,
      respondentName: newResponse.respondentName || undefined,
      respondentDepartment: newResponse.respondentDepartment || undefined,
      completionTimeSeconds: newResponse.completionTimeSeconds,
    });
    return { folio: created.folio, submittedAt: created.submitted_at };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h1 className="text-base font-semibold text-slate-900 mb-1">Formulario no disponible</h1>
          <p className="text-sm text-slate-500">{error || 'Este formulario no existe o ya no acepta respuestas.'}</p>
        </div>
      </div>
    );
  }

  return (
    <PublicFormView
      form={form}
      onSubmitResponse={handleSubmitResponse}
    />
  );
};
