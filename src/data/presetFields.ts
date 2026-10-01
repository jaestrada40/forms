// Catálogos de preguntas predefinidas de uso frecuente en formularios del sector público
// guatemalteco (censo/INE, identificación étnica y discapacidad - Grupo de Washington).

export interface PresetFieldDefinition {
  id: string;
  label: string;
  title: string;
  options: string[];
}

export const PRESET_FIELDS: PresetFieldDefinition[] = [
  {
    id: 'preset_autoidentificacion',
    label: 'Autoidentificación étnica',
    title: '¿Cómo se autoidentifica?',
    options: ['Maya', 'Garífuna', 'Xinka', 'Ladino/Mestizo', 'Afrodescendiente/creole', 'Otro', 'No sabe'],
  },
  {
    id: 'preset_comunidad_linguistica',
    label: 'Comunidad lingüística',
    title: 'Indique su Comunidad Lingüística',
    options: ['Achi', 'Akateka', 'Awakateka', "Ch'orti'", 'Chalchiteka', 'Chuj', "Itza'", 'Ixil', "Jakalteka (Popti')", "K'iche'", 'Kaqchikel', 'Mam', 'Mopan', 'Poqoman', "Q'anjob'al", "Q'eqchi'", 'Sakapulteka', 'Sipakapense', 'Tektiteka', "Tz'utujil", 'Uspanteka', 'Español', 'Garífuna', 'Xinka'],
  },
  {
    id: 'preset_sexo',
    label: 'Sexo',
    title: 'Sexo de la persona',
    options: ['Hombre', 'Mujer'],
  },
  {
    id: 'preset_discapacidad',
    label: 'Dificultad / discapacidad (Grupo de Washington)',
    title: '¿Tiene dificultad para?',
    options: [
      'Ver, incluso si usa lentes o anteojos',
      'Oír, incluso si usa un aparato auditivo',
      'Caminar o subir escaleras',
      'Recordar o concentrarse',
      'Cuidado personal o para vestirse',
      'Comunicarse, por ejemplo, atender lo que otros dicen o hacerse entender por otros',
    ],
  },
];
