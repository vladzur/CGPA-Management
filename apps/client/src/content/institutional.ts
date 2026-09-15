/**
 * Fuente única de verdad del contenido institucional del CGPA Graham Bell.
 *
 * Los datos legales, la misión y la directiva viven en el repositorio y se editan
 * mediante Pull Request. Las noticias y avisos, en cambio, se gestionan desde el
 * panel de administración (colección `comunicados`).
 *
 * Los textos de misión, visión, objetivos, programas e historia fueron redactados
 * a partir de la descripción entregada por la directiva y deben ser revisados y
 * aprobados por ella antes de publicarse en producción.
 */

/** Etiqueta usada en la interfaz cuando un dato aún no ha sido definido por la directiva. */
export const PENDING_LABEL = 'Pendiente de definir';

/** Fecha de referencia del contenido legal publicado. */
export const CONTENT_LAST_REVIEW = '2026-09-15';

export interface LegalPersonality {
  /** Número de inscripción en el registro de personas jurídicas. */
  number: string;
  /** Fecha de concesión de la personalidad jurídica (dd-mm-aaaa). */
  grantDate: string;
  /** Decreto o resolución asociada a la concesión. */
  decree: string;
  /** Registro en el que se encuentra inscrita la organización. */
  registry: string;
  /** Estado actual de la personalidad jurídica. */
  status: string;
}

export interface PostalAddress {
  street: string;
  city: string;
  region: string;
  country: string;
  /** Código de país ISO 3166-1 alfa-2, requerido por los datos estructurados. */
  countryCode: string;
}

export interface PublicContact {
  /** Correo institucional. `null` mientras la directiva no lo defina. */
  email: string | null;
  /** Teléfono institucional. `null` mientras la directiva no lo defina. */
  phone: string | null;
  /** Horario o modalidad de atención presencial. */
  officeHours: string;
}

export interface Organization {
  legalName: string;
  acronym: string;
  shortName: string;
  /** Naturaleza jurídica declarada en el certificado de personalidad jurídica. */
  nature: string;
  legalPersonality: LegalPersonality;
  address: PostalAddress;
  contact: PublicContact;
  currentPeriod: string;
  siteUrl: string;
}

export const ORGANIZATION: Organization = {
  legalName: 'Centro General de Padres y Apoderados Liceo Alexander Graham Bell',
  acronym: 'CGPA',
  shortName: 'CGPA Graham Bell',
  nature: 'Organización funcional sin fines de lucro',
  legalPersonality: {
    number: '242029',
    grantDate: '31-05-2016',
    decree: '00000',
    registry: 'Registro de Personas Jurídicas sin Fines de Lucro',
    status: 'Vigente',
  },
  address: {
    street: 'San Ramón N° 2055',
    city: 'Villarrica',
    region: 'Región de La Araucanía',
    country: 'Chile',
    countryCode: 'CL',
  },
  contact: {
    email: null,
    phone: null,
    officeHours:
      'Atención de la directiva en dependencias del establecimiento, previa coordinación con la secretaría.',
  },
  currentPeriod: '2026',
  siteUrl: 'https://cgpagrahambell.cl',
};

/** Declaración de misión. */
export const MISSION =
  'El Centro General de Padres y Apoderados del Liceo Alexander Graham Bell reúne a las familias del establecimiento para apoyar la formación integral de los estudiantes, financiar proyectos de infraestructura y material educativo mediante cuotas y actividades, y administrar esos recursos con transparencia.';

/** Declaración de visión. */
export const VISION =
  'Ser una organización reconocida por su gestión transparente, por la participación de las familias y por el impacto real de sus proyectos en la comunidad educativa del Liceo Alexander Graham Bell.';

/** Objetivos permanentes de la organización. */
export const OBJECTIVES: readonly string[] = [
  'Colaborar con el establecimiento en la formación integral de los estudiantes y en el mejoramiento de sus condiciones de aprendizaje.',
  'Reunir y administrar los recursos aportados por las familias a través de cuotas, actividades y donaciones.',
  'Financiar proyectos de infraestructura, equipamiento y material educativo acordados con la comunidad escolar.',
  'Mantener informadas a las familias sobre el destino de los recursos, publicando ingresos, egresos y respaldos.',
  'Promover la participación y la convivencia entre apoderados, estudiantes y el equipo del establecimiento.',
  'Cumplir con las obligaciones legales y estatutarias propias de una organización funcional sin fines de lucro.',
];

export interface Program {
  /** Identificador usado como ancla en la interfaz. */
  id: string;
  title: string;
  description: string;
}

/** Programas y servicios que la organización entrega a la comunidad educativa. */
export const PROGRAMS: readonly Program[] = [
  {
    id: 'infraestructura',
    title: 'Infraestructura y equipamiento',
    description:
      'Financiamos mejoras en dependencias, mobiliario y equipamiento del establecimiento, definidas en conjunto con la dirección y la comunidad escolar.',
  },
  {
    id: 'material-educativo',
    title: 'Material educativo y actividades',
    description:
      'Aportamos material didáctico y apoyamos actividades extraprogramáticas, ceremonias, giras de estudio y celebraciones del calendario escolar.',
  },
  {
    id: 'gestion-transparente',
    title: 'Administración transparente de los recursos',
    description:
      'Recaudamos cuotas y organizamos actividades de financiamiento, y publicamos en este sitio el detalle de ingresos, egresos, respaldos y proyectos en ejecución.',
  },
];

/** Reseña institucional breve. */
export const HISTORY =
  'El Centro General de Padres y Apoderados del Liceo Alexander Graham Bell obtuvo su personalidad jurídica el 31 de mayo de 2016, quedando inscrito con el N° 242029 y la naturaleza de organización funcional. Desde entonces representa a las familias del establecimiento ante la dirección, administra los recursos que ellas aportan y rinde cuenta de su uso a la comunidad escolar del sector San Ramón, en Villarrica.';

export interface BoardMember {
  /** Cargo que ocupa según la última directiva electa. */
  role: string;
  /** Nombre completo. Los RUN no se publican por resguardo de datos personales. */
  name: string;
}

export interface BoardMetadata {
  /** Fecha de la última elección de directiva (dd-mm-aaaa). */
  lastElection: string;
  /** Duración del mandato. */
  term: string;
}

export const BOARD_METADATA: BoardMetadata = {
  lastElection: '29-04-2026',
  term: '3 años',
};

/** Integrantes de la directiva vigente, ordenados por jerarquía del cargo. */
export const BOARD_MEMBERS: readonly BoardMember[] = [
  { role: 'Presidente', name: 'Ingrid Jacqueline Sepúlveda Arias' },
  { role: 'Vice-Presidente', name: 'Cecilia Elizabeth Peña Reyes' },
  { role: 'Secretario', name: 'Elcira Evelyn Cuevas Espinoza' },
  { role: 'Tesorero', name: 'Vladimir Dante Zurita Manquian' },
  { role: 'Prosecretario', name: 'Fernanda Andrea Tapia Celis' },
  { role: 'Suplente', name: 'Francisca Alejandra Aedo Carrasco' },
  { role: 'Suplente', name: 'Luis Eduardo Monsalve Burgos' },
  { role: 'Suplente', name: 'Daniel Humberto Quilodrán Bascur' },
  { role: 'Suplente', name: 'Paula Monje de la Peña' },
  { role: 'Suplente', name: 'Belén Fernanda Acuña Montes' },
];

/** Dirección física en una sola línea, para el footer y los datos estructurados. */
export function formatAddress(): string {
  const { street, city, region, country } = ORGANIZATION.address;
  return `${street}, ${city}, ${region}, ${country}`;
}

/**
 * Declaración de identidad legal usada en el footer y en las páginas institucionales.
 * Es el texto que permite a un revisor asociar el dominio con la organización registrada.
 */
export function buildLegalIdentityStatement(): string {
  const { nature } = ORGANIZATION;
  const { number, grantDate, status } = ORGANIZATION.legalPersonality;
  return `${nature} — Personalidad Jurídica N° ${number} (${grantDate}) · Estado: ${status}`;
}

/** Indica si la directiva ya definió canales de contacto públicos. */
export function hasPublicContact(): boolean {
  return Boolean(ORGANIZATION.contact.email || ORGANIZATION.contact.phone);
}
