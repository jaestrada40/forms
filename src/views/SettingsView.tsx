import React, { useState } from 'react';
import { 
  Settings, 
  Building2, 
  ShieldCheck, 
  Mail, 
  Key, 
  Save, 
  Database, 
  Check, 
  Globe 
} from 'lucide-react';

interface SettingsViewProps {
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ showToast }) => {
  const [institutionName, setInstitutionName] = useState('Servicio Nacional de Modernización Pública');
  const [allowedDomains, setAllowedDomains] = useState('@gobierno.cl, @institucion.org');
  const [retentionPeriod, setRetentionPeriod] = useState('5_years');
  const [enableAuditLog, setEnableAuditLog] = useState(true);
  const [requireTwoFactor, setRequireTwoFactor] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Configuraciones institucionales actualizadas correctamente', 'success');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
          Parámetros Globales
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Configuración del Sistema Institucional
        </h2>
        <p className="text-xs text-slate-500">
          Ajustes generales de seguridad, gobernanza de datos y personalización del organismo.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Organization identity */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-blue-700" />
            <h3 className="font-bold text-sm text-slate-900">Identidad del Organismo</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre Oficial de la Institución
            </label>
            <input
              type="text"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dominios de Correo Institucional Permitidos
            </label>
            <input
              type="text"
              value={allowedDomains}
              onChange={(e) => setAllowedDomains(e.target.value)}
              placeholder="@gobierno.cl, @ministerio.cl"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Solo cuentas con estos sufijos podrán acceder como creadores o administradores.
            </p>
          </div>
        </div>

        {/* Security & Data Retention */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <h3 className="font-bold text-sm text-slate-900">Seguridad y Resguardo de la Información</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Política de Retención de Respuestas y Folios
            </label>
            <select
              value={retentionPeriod}
              onChange={(e) => setRetentionPeriod(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="1_year">1 año (Ciclo operativo anual)</option>
              <option value="3_years">3 años (Normativa de auditoría ministerial)</option>
              <option value="5_years">5 años (Histórico permanente)</option>
              <option value="indefinite">Indefinido (Sin purga automática)</option>
            </select>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-900">Registro de Auditoría Integral (Audit Log)</div>
                <div className="text-[11px] text-slate-500">Registra modificaciones de formularios y descargas de respuestas</div>
              </div>
              <button
                type="button"
                onClick={() => setEnableAuditLog(!enableAuditLog)}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                  enableAuditLog ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-900">Exigir Autenticación de Dos Factores (2FA)</div>
                <div className="text-[11px] text-slate-500">Para usuarios con rol Administrador y Analista</div>
              </div>
              <button
                type="button"
                onClick={() => setRequireTwoFactor(!requireTwoFactor)}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                  requireTwoFactor ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
              </button>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Guardar cambios institucionales</span>
          </button>
        </div>
      </form>
    </div>
  );
};
