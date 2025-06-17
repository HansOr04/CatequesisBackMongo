/**
 * Constantes del Sistema de Catequesis
 */

// Tipos de perfil de usuario
const TIPOS_PERFIL = {
  ADMIN: 'admin',
  PARROCO: 'parroco',
  SECRETARIA: 'secretaria',
  CATEQUISTA: 'catequista',
  CONSULTA: 'consulta'
};

// Estados de inscripción
const ESTADOS_INSCRIPCION = {
  PENDIENTE: 'pendiente',
  ACTIVA: 'activa',
  SUSPENDIDA: 'suspendida',
  COMPLETADA: 'completada',
  RETIRADA: 'retirada'
};

// Estados de clase en grupos
const ESTADOS_CLASE = {
  PLANIFICACION: 'planificacion',
  ACTIVO: 'activo',
  SUSPENDIDO: 'suspendido',
  FINALIZADO: 'finalizado'
};

// Tipos de documento de identidad
const TIPOS_DOCUMENTO = {
  CEDULA: 'cedula',
  PASAPORTE: 'pasaporte',
  REGISTRO_CIVIL: 'registro_civil',
  OTRO: 'otro'
};

// Géneros
const GENEROS = {
  MASCULINO: 'masculino',
  FEMENINO: 'femenino'
};

// Días de la semana
const DIAS_SEMANA = {
  LUNES: 'lunes',
  MARTES: 'martes',
  MIERCOLES: 'miercoles',
  JUEVES: 'jueves',
  VIERNES: 'viernes',
  SABADO: 'sabado',
  DOMINGO: 'domingo'
};

// Tipos de asistencia
const TIPOS_CLASE = {
  REGULAR: 'regular',
  EXTRAORDINARIA: 'extraordinaria',
  EXAMEN: 'examen',
  RETIRO: 'retiro',
  CELEBRACION: 'celebracion',
  EVENTO: 'evento'
};

// Motivos de ausencia
const MOTIVOS_AUSENCIA = {
  ENFERMEDAD: 'enfermedad',
  VIAJE: 'viaje',
  COMPROMISO_FAMILIAR: 'compromiso_familiar',
  CLIMA: 'clima',
  TRANSPORTE: 'transporte',
  OTRO: 'otro',
  NO_JUSTIFICADA: 'no_justificada'
};

// Métodos de pago
const METODOS_PAGO = {
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
  CHEQUE: 'cheque',
  TARJETA: 'tarjeta',
  OTRO: 'otro'
};

// Sacramentos
const SACRAMENTOS = {
  BAUTISMO: 'bautismo',
  PRIMERA_COMUNION: 'primera_comunion',
  CONFIRMACION: 'confirmacion',
  MATRIMONIO: 'matrimonio'
};

// Roles en grupos
const ROLES_GRUPO = {
  COORDINADOR: 'coordinador',
  CATEQUISTA: 'catequista',
  AUXILIAR: 'auxiliar'
};

// Tipos de observación
const TIPOS_OBSERVACION = {
  GENERAL: 'general',
  ACADEMICA: 'academica',
  CONDUCTUAL: 'conductual',
  ADMINISTRATIVA: 'administrativa',
  SALUD: 'salud'
};

// Motivos de egreso
const MOTIVOS_EGRESO = {
  GRADUACION: 'graduacion',
  RETIRO_VOLUNTARIO: 'retiro_voluntario',
  CAMBIO_PARROQUIA: 'cambio_parroquia',
  SUSPENSION: 'suspension',
  OTRO: 'otro'
};

// Niveles de participación
const NIVELES_PARTICIPACION = {
  EXCELENTE: 'excelente',
  BUENA: 'buena',
  REGULAR: 'regular',
  DEFICIENTE: 'deficiente'
};

// Comportamientos
const COMPORTAMIENTOS = {
  EXCELENTE: 'excelente',
  BUENO: 'bueno',
  REGULAR: 'regular',
  NECESITA_MEJORA: 'necesita_mejora'
};

// Tipos de familia
const TIPOS_FAMILIA = {
  NUCLEAR: 'nuclear',
  MONOPARENTAL: 'monoparental',
  EXTENDIDA: 'extendida',
  ADOPTIVA: 'adoptiva',
  FOSTER: 'foster',
  OTRO: 'otro'
};

// Tipos de representante
const TIPOS_REPRESENTANTE = {
  PADRE: 'padre',
  MADRE: 'madre',
  ABUELO: 'abuelo',
  ABUELA: 'abuela',
  TIO: 'tia',
  TIA: 'tia',
  HERMANO: 'hermano',
  HERMANA: 'hermana',
  TUTOR: 'tutor',
  OTRO: 'otro'
};

// Códigos de respuesta HTTP
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Mensajes de respuesta estándar
const MESSAGES = {
  SUCCESS: {
    CREATED: 'Creado exitosamente',
    UPDATED: 'Actualizado exitosamente',
    DELETED: 'Eliminado exitosamente',
    RETRIEVED: 'Obtenido exitosamente',
    LOGIN_SUCCESS: 'Inicio de sesión exitoso',
    LOGOUT_SUCCESS: 'Sesión cerrada exitosamente',
    PASSWORD_CHANGED: 'Contraseña cambiada exitosamente',
    PAYMENT_REGISTERED: 'Pago registrado exitosamente'
  },
  ERROR: {
    INVALID_CREDENTIALS: 'Credenciales inválidas',
    UNAUTHORIZED: 'No autorizado',
    FORBIDDEN: 'Acceso denegado',
    NOT_FOUND: 'Recurso no encontrado',
    VALIDATION_ERROR: 'Error de validación',
    DUPLICATE_ENTRY: 'El recurso ya existe',
    INTERNAL_ERROR: 'Error interno del servidor',
    INVALID_TOKEN: 'Token inválido',
    EXPIRED_TOKEN: 'Token expirado',
    USER_BLOCKED: 'Usuario bloqueado',
    INSUFFICIENT_PERMISSIONS: 'Permisos insuficientes'
  }
};

// Configuraciones por defecto
const DEFAULTS = {
  PAGINATION: {
    PAGE: 1,
    LIMIT: 10,
    MAX_LIMIT: 100
  },
  GRUPO: {
    CAPACIDAD_MAXIMA: 25,
    ASISTENCIA_MINIMA: 80,
    DURACION_CLASE: 90 // minutos
  },
  INSCRIPCION: {
    NOTA_MINIMA: 70,
    ASISTENCIA_MINIMA: 80
  },
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 100,
    BCRYPT_ROUNDS: 12
  },
  JWT: {
    EXPIRES_IN: '24h',
    ALGORITHM: 'HS256'
  },
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
    MAX_REQUESTS: 100,
    LOGIN_ATTEMPTS: 10
  }
};

// Configuraciones de edades
const EDAD_CONFIG = {
  MINIMA: 4,
  MAXIMA: 99,
  GRUPOS: {
    NINOS: { min: 4, max: 12 },
    ADOLESCENTES: { min: 13, max: 17 },
    ADULTOS: { min: 18, max: 99 }
  }
};

// Expresiones regulares útiles
const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  TELEFONO: /^[\d\-\s\+\(\)]+$/,
  USERNAME: /^[a-zA-Z0-9._-]+$/,
  DOCUMENTO: /^[a-zA-Z0-9\-]+$/,
  NOMBRES: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
  TIEMPO: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  PERIODO: /^\d{4}(-\d{4})?$/
};

// Formatos de fecha
const DATE_FORMATS = {
  ISO: 'YYYY-MM-DD',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  DISPLAY: 'DD/MM/YYYY',
  DISPLAY_DATETIME: 'DD/MM/YYYY HH:mm'
};

// Tipos de archivo permitidos
const ALLOWED_FILE_TYPES = {
  IMAGES: ['.jpg', '.jpeg', '.png', '.gif'],
  DOCUMENTS: ['.pdf', '.doc', '.docx'],
  ALL: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx']
};

// Tamaños máximos de archivo (en bytes)
const MAX_FILE_SIZES = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  GENERAL: 2 * 1024 * 1024 // 2MB
};

// Colores para estados (para UI)
const STATUS_COLORS = {
  SUCCESS: '#4CAF50',
  WARNING: '#FF9800',
  ERROR: '#F44336',
  INFO: '#2196F3',
  ACTIVE: '#4CAF50',
  INACTIVE: '#9E9E9E',
  PENDING: '#FF9800',
  COMPLETED: '#4CAF50'
};

// Configuración de notificaciones
const NOTIFICATION_CONFIG = {
  EMAIL: {
    REMINDER_HOURS: 24, // Horas antes de clase
    ABSENCE_HOURS: 2, // Horas después de clase para notificar ausencia
    BATCH_SIZE: 50 // Emails por lote
  },
  SMS: {
    ENABLED: false, // Activar cuando se implemente
    PROVIDER: 'twilio'
  }
};

// Configuración de reportes
const REPORT_CONFIG = {
  FORMATS: ['pdf', 'excel', 'csv'],
  MAX_RECORDS: 10000,
  CACHE_DURATION: 5 * 60 * 1000 // 5 minutos
};

// Configuración de backup
const BACKUP_CONFIG = {
  FREQUENCY: 'daily',
  RETENTION_DAYS: 30,
  COLLECTIONS: [
    'usuarios',
    'parroquias', 
    'niveles',
    'catequizandos',
    'grupos',
    'inscripciones',
    'asistencias'
  ]
};

// URLs y endpoints importantes
const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    PROFILE: '/auth/profile',
    REFRESH: '/auth/refresh'
  },
  API_BASE: '/api',
  HEALTH: '/health',
  DOCS: '/api-docs'
};

// Eventos del sistema para logging
const SYSTEM_EVENTS = {
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  CATEQUIZANDO_CREATED: 'catequizando_created',
  CATEQUIZANDO_UPDATED: 'catequizando_updated',
  INSCRIPCION_CREATED: 'inscripcion_created',
  INSCRIPCION_APPROVED: 'inscripcion_approved',
  ASISTENCIA_REGISTERED: 'asistencia_registered',
  PAYMENT_REGISTERED: 'payment_registered',
  GRADE_ASSIGNED: 'grade_assigned'
};

// Permisos del sistema
const PERMISSIONS = {
  ADMIN: ['*'], // Todos los permisos
  PARROCO: [
    'create_user',
    'read_user',
    'update_user', 
    'delete_user',
    'create_catequizando',
    'read_catequizando',
    'update_catequizando',
    'delete_catequizando',
    'create_grupo',
    'read_grupo',
    'update_grupo',
    'delete_grupo',
    'manage_inscripciones',
    'manage_asistencias',
    'view_reports',
    'approve_inscripciones'
  ],
  SECRETARIA: [
    'create_catequizando',
    'read_catequizando',
    'update_catequizando',
    'create_inscripcion',
    'read_inscripcion',
    'update_inscripcion',
    'manage_payments',
    'view_basic_reports'
  ],
  CATEQUISTA: [
    'read_catequizando',
    'read_inscripcion',
    'manage_asistencias',
    'add_grades',
    'view_own_groups'
  ],
  CONSULTA: [
    'read_catequizando',
    'read_inscripcion',
    'view_basic_info'
  ]
};

// Configuración de validaciones
const VALIDATION_RULES = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: REGEX.USERNAME
  },
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 100,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true
  },
  NAMES: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
    PATTERN: REGEX.NOMBRES
  },
  DOCUMENT: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 20,
    PATTERN: REGEX.DOCUMENTO
  },
  PHONE: {
    MIN_LENGTH: 7,
    MAX_LENGTH: 20,
    PATTERN: REGEX.TELEFONO
  },
  AGE: {
    MIN: EDAD_CONFIG.MINIMA,
    MAX: EDAD_CONFIG.MAXIMA
  }
};

// Configuración de sesiones
const SESSION_CONFIG = {
  MAX_CONCURRENT: 3, // Máximo de sesiones concurrentes por usuario
  INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutos
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutos
  PASSWORD_RESET_EXPIRY: 60 * 60 * 1000 // 1 hora
};

// Configuración de cache
const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5 minutos por defecto
  MAX_SIZE: 1000, // Máximo de elementos en cache
  KEYS: {
    USER_PERMISSIONS: 'user_permissions_',
    PARROQUIA_STATS: 'parroquia_stats_',
    NIVEL_LIST: 'nivel_list',
    GRUPO_STATS: 'grupo_stats_'
  }
};

// Configuración de logging
const LOG_CONFIG = {
  LEVELS: ['error', 'warn', 'info', 'debug'],
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES: 5,
  ROTATE: true,
  CONSOLE: true,
  FILE: true
};

module.exports = {
  TIPOS_PERFIL,
  ESTADOS_INSCRIPCION,
  ESTADOS_CLASE,
  TIPOS_DOCUMENTO,
  GENEROS,
  DIAS_SEMANA,
  TIPOS_CLASE,
  MOTIVOS_AUSENCIA,
  METODOS_PAGO,
  SACRAMENTOS,
  ROLES_GRUPO,
  TIPOS_OBSERVACION,
  MOTIVOS_EGRESO,
  NIVELES_PARTICIPACION,
  COMPORTAMIENTOS,
  TIPOS_FAMILIA,
  TIPOS_REPRESENTANTE,
  HTTP_STATUS,
  MESSAGES,
  DEFAULTS,
  EDAD_CONFIG,
  REGEX,
  DATE_FORMATS,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZES,
  STATUS_COLORS,
  NOTIFICATION_CONFIG,
  REPORT_CONFIG,
  BACKUP_CONFIG,
  ENDPOINTS,
  SYSTEM_EVENTS,
  PERMISSIONS,
  VALIDATION_RULES,
  SESSION_CONFIG,
  CACHE_CONFIG,
  LOG_CONFIG
};