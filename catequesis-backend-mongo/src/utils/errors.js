/**
 * Clase personalizada para errores de la aplicación
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      message: this.message,
      statusCode: this.statusCode,
      status: this.status,
      details: this.details,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

/**
 * Constructor de errores específicos
 */
const ErrorBuilder = {
  notFound: (resource = 'Recurso') => {
    return new AppError(`${resource} no encontrado`, 404);
  },

  unauthorized: (message = 'No autorizado') => {
    return new AppError(message, 401);
  },

  forbidden: (message = 'Acceso denegado') => {
    return new AppError(message, 403);
  },

  badRequest: (message = 'Solicitud inválida', details = null) => {
    return new AppError(message, 400, details);
  },

  conflict: (message = 'Conflicto con el estado actual del recurso') => {
    return new AppError(message, 409);
  },

  tooManyRequests: (message = 'Demasiadas solicitudes') => {
    return new AppError(message, 429);
  },

  internal: (message = 'Error interno del servidor') => {
    return new AppError(message, 500);
  },

  serviceUnavailable: (message = 'Servicio no disponible') => {
    return new AppError(message, 503);
  },

  validation: (message = 'Error de validación', details = null) => {
    return new AppError(message, 422, details);
  },

  timeout: (message = 'Tiempo de espera agotado') => {
    return new AppError(message, 408);
  },

  payloadTooLarge: (message = 'Payload demasiado grande') => {
    return new AppError(message, 413);
  },

  unsupportedMediaType: (message = 'Tipo de media no soportado') => {
    return new AppError(message, 415);
  }
};

/**
 * Middleware para logging de errores críticos
 */
const logCriticalErrors = (error, req, res, next) => {
  // Log errores críticos para monitoreo
  if (error.statusCode >= 500) {
    console.error('🚨 ERROR CRÍTICO:', {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      user: req.user?.username || 'Anónimo',
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    });

    // Aquí se podría integrar con servicios de monitoreo como Sentry
    // Sentry.captureException(error);
  }

  next(error);
};

/**
 * Middleware para rate limiting de errores por IP
 */
const errorRateLimit = () => {
  const errorCounts = new Map();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
  const MAX_ERRORS = 50; // Máximo 50 errores por IP en 15 minutos

  return (error, req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    // Limpiar errores antiguos
    if (errorCounts.has(ip)) {
      const errors = errorCounts.get(ip).filter(time => now - time < WINDOW_MS);
      errorCounts.set(ip, errors);
    }

    // Obtener errores de esta IP
    const ipErrors = errorCounts.get(ip) || [];
    
    if (ipErrors.length >= MAX_ERRORS) {
      return res.status(429).json({
        success: false,
        message: 'Demasiados errores desde esta IP. Acceso temporalmente bloqueado.',
        code: 'ERROR_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(WINDOW_MS / 1000),
        timestamp: new Date().toISOString()
      });
    }

    // Registrar nuevo error
    ipErrors.push(now);
    errorCounts.set(ip, ipErrors);

    next(error);
  };
};

/**
 * Middleware global de manejo de errores
 */
const globalErrorHandler = (error, req, res, next) => {
  // Si ya se envió una respuesta, delegar al manejo por defecto de Express
  if (res.headersSent) {
    return next(error);
  }

  let appError = error;

  // Convertir errores específicos a AppError
  if (!(error instanceof AppError)) {
    // Error de validación de Mongoose
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      
      appError = ErrorBuilder.validation('Error de validación de datos', validationErrors);
    }
    
    // Error de cast de Mongoose (ID inválido)
    else if (error.name === 'CastError') {
      appError = ErrorBuilder.badRequest(`ID inválido: ${error.value}`);
    }
    
    // Error de clave duplicada de MongoDB
    else if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      appError = ErrorBuilder.conflict(`Ya existe un registro con ${field}: ${value}`);
    }
    
    // Error de JWT
    else if (error.name === 'JsonWebTokenError') {
      appError = ErrorBuilder.unauthorized('Token inválido');
    }
    
    // Token expirado
    else if (error.name === 'TokenExpiredError') {
      appError = ErrorBuilder.unauthorized('Token expirado');
    }
    
    // Error de conexión a base de datos
    else if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      appError = ErrorBuilder.serviceUnavailable('Error de conexión a la base de datos');
    }
    
    // Error de CORS
    else if (error.message && error.message.includes('CORS')) {
      appError = ErrorBuilder.forbidden('Origen no permitido por política CORS');
    }
    
    // Error de payload demasiado grande
    else if (error.type === 'entity.too.large') {
      appError = ErrorBuilder.payloadTooLarge('El archivo o datos enviados son demasiado grandes');
    }
    
    // Error de JSON malformado
    else if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      appError = ErrorBuilder.badRequest('JSON malformado en el cuerpo de la solicitud');
    }
    
    // Error genérico no identificado
    else {
      appError = ErrorBuilder.internal(
        process.env.NODE_ENV === 'production' 
          ? 'Error interno del servidor' 
          : error.message
      );
    }
  }

  // Construir respuesta de error
  const errorResponse = {
    success: false,
    message: appError.message,
    code: appError.code || 'INTERNAL_ERROR',
    timestamp: appError.timestamp
  };

  // Agregar detalles adicionales según el entorno
  if (appError.details) {
    errorResponse.details = appError.details;
  }

  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = appError.stack;
    errorResponse.originalError = error.message;
  }

  // Logging según el nivel de error
  const logLevel = appError.statusCode >= 500 ? 'error' : 'warn';
  
  if (logLevel === 'error') {
    console.error('🚨 Error del servidor:', {
      message: appError.message,
      statusCode: appError.statusCode,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: appError.timestamp
    });
  } else {
    console.warn('⚠️ Error de cliente:', {
      message: appError.message,
      statusCode: appError.statusCode,
      url: req.originalUrl,
      method: req.method,
      timestamp: appError.timestamp
    });
  }

  // Enviar respuesta
  res.status(appError.statusCode).json(errorResponse);
};

/**
 * Wrapper para funciones async que maneja automáticamente los errores
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validar errores operacionales vs errores de programación
 */
const isOperationalError = (error) => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  
  // Lista de errores que consideramos operacionales
  const operationalErrors = [
    'ValidationError',
    'CastError',
    'JsonWebTokenError',
    'TokenExpiredError',
    'MongoNetworkError',
    'MongoTimeoutError'
  ];
  
  return operationalErrors.includes(error.name);
};

/**
 * Crear error de validación desde errores de express-validator
 */
const createValidationError = (validationResult) => {
  const errors = validationResult.array().map(error => ({
    field: error.path || error.param,
    message: error.msg,
    value: error.value,
    location: error.location
  }));

  return ErrorBuilder.validation('Errores de validación en los datos enviados', errors);
};

/**
 * Manejar errores de base de datos específicos
 */
const handleDatabaseError = (error) => {
  // Error de conexión
  if (error.name === 'MongoNetworkError') {
    return ErrorBuilder.serviceUnavailable('No se pudo conectar a la base de datos');
  }
  
  // Timeout de operación
  if (error.name === 'MongoTimeoutError') {
    return ErrorBuilder.timeout('La operación en la base de datos tardó demasiado');
  }
  
  // Espacio insuficiente
  if (error.code === 14) {
    return ErrorBuilder.serviceUnavailable('Espacio insuficiente en la base de datos');
  }
  
  // Índice duplicado
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return ErrorBuilder.conflict(`El valor para ${field} ya existe`);
  }
  
  return ErrorBuilder.internal('Error de base de datos');
};

/**
 * Crear respuesta de error estándar
 */
const createErrorResponse = (message, statusCode = 500, details = null) => {
  return {
    success: false,
    message,
    statusCode,
    status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
    details,
    timestamp: new Date().toISOString()
  };
};

/**
 * Middleware para capturar errores 404
 */
const notFoundHandler = (req, res, next) => {
  const error = ErrorBuilder.notFound(`Ruta ${req.originalUrl} no encontrada`);
  next(error);
};

/**
 * Funciones de utilidad para logging específico
 */
const logSecurityEvent = (event, details, req = null) => {
  console.warn('🔒 EVENTO DE SEGURIDAD:', {
    event,
    details,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
    url: req?.originalUrl,
    method: req?.method,
    timestamp: new Date().toISOString()
  });
};

const logPerformanceIssue = (operation, duration, threshold = 1000) => {
  if (duration > threshold) {
    console.warn('🐌 PROBLEMA DE RENDIMIENTO:', {
      operation,
      duration: `${duration}ms`,
      threshold: `${threshold}ms`,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  AppError,
  ErrorBuilder,
  logCriticalErrors,
  errorRateLimit,
  globalErrorHandler,
  asyncHandler,
  isOperationalError,
  createValidationError,
  handleDatabaseError,
  createErrorResponse,
  notFoundHandler,
  logSecurityEvent,
  logPerformanceIssue
};