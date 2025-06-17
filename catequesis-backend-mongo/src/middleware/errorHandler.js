const config = require('../config/environment');

/**
 * Middleware de manejo global de errores
 */
const globalErrorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Error interno del servidor';
  let details = null;

  // Log del error
  console.error('Error capturado:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user?.username || 'No autenticado',
    timestamp: new Date().toISOString()
  });

  // Manejar errores específicos de Mongoose
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Errores de validación';
    details = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
  }

  // Error de clave duplicada (código 11000)
  if (error.code === 11000) {
    statusCode = 409;
    message = 'Recurso duplicado';
    
    // Extraer el campo duplicado
    const field = Object.keys(error.keyPattern)[0];
    details = {
      field,
      message: `Ya existe un registro con este ${field}`
    };
  }

  // Error de Cast (ObjectId inválido)
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'ID de recurso inválido';
    details = {
      field: error.path,
      value: error.value,
      message: 'Formato de ID inválido'
    };
  }

  // Error de conexión a la base de datos
  if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
    statusCode = 503;
    message = 'Servicio temporalmente no disponible';
    details = {
      type: 'database_connection',
      message: 'Error de conexión a la base de datos'
    };
  }

  // Error de JWT
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token de autenticación inválido';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token de autenticación expirado';
  }

  // Error de límite de tamaño
  if (error.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Archivo o datos demasiado grandes';
  }

  // Error de sintaxis JSON
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    statusCode = 400;
    message = 'JSON malformado en el cuerpo de la solicitud';
  }

  // Construir respuesta de error
  const errorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // Agregar detalles si existen
  if (details) {
    errorResponse.details = details;
  }

  // En desarrollo, incluir stack trace
  if (config.server.nodeEnv === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.error = {
      name: error.name,
      code: error.code
    };
  }

  // Enviar respuesta
  res.status(statusCode).json(errorResponse);
};

/**
 * Middleware para manejar rutas no encontradas (404)
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} no encontrado`,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      auth: 'GET,POST /api/auth/*',
      usuarios: 'GET,POST,PUT,DELETE /api/usuarios/*',
      parroquias: 'GET,POST,PUT,DELETE /api/parroquias/*',
      niveles: 'GET,POST,PUT,DELETE /api/niveles/*',
      catequizandos: 'GET,POST,PUT,DELETE /api/catequizandos/*',
      grupos: 'GET,POST,PUT,DELETE /api/grupos/*',
      inscripciones: 'GET,POST,PUT,DELETE /api/inscripciones/*',
      asistencias: 'GET,POST,PUT,DELETE /api/asistencias/*'
    }
  });
};

/**
 * Wrapper para funciones async que maneja errores automáticamente
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Clase personalizada para errores de la aplicación
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Funciones helper para crear errores específicos
 */
const createError = {
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
      user: req.user?.username,
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body
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
        retryAfter: Math.ceil(WINDOW_MS / 1000)
      });
    }

    // Agregar error actual
    ipErrors.push(now);
    errorCounts.set(ip, ipErrors);

    next(error);
  };
};

/**
 * Middleware para sanitizar errores en producción
 */
const sanitizeErrors = (error, req, res, next) => {
  // En producción, no exponer información sensible
  if (config.server.nodeEnv === 'production') {
    // Errores de validación pueden mostrar detalles
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return next(error);
    }

    // Errores del servidor no deben mostrar detalles
    if (error.statusCode >= 500) {
      error.message = 'Error interno del servidor';
      error.details = null;
      delete error.stack;
    }
  }

  next(error);
};

/**
 * Configurar manejadores de eventos para errores no capturados
 */
const setupProcessErrorHandlers = () => {
  // Errores no capturados
  process.on('uncaughtException', (error) => {
    console.error('🚨 EXCEPCIÓN NO CAPTURADA:', error);
    
    // Log crítico
    console.error('Cerrando aplicación debido a excepción no capturada...');
    
    // Cerrar servidor gracefulmente
    process.exit(1);
  });

  // Promesas rechazadas no manejadas
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 PROMESA RECHAZADA NO MANEJADA:', reason);
    console.error('En promesa:', promise);
    
    // En desarrollo, solo log
    if (config.server.nodeEnv === 'development') {
      return;
    }
    
    // En producción, cerrar aplicación
    console.error('Cerrando aplicación debido a promesa rechazada...');
    process.exit(1);
  });

  // Advertencias
  process.on('warning', (warning) => {
    console.warn('⚠️ ADVERTENCIA:', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });
};

module.exports = {
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  createError,
  logCriticalErrors,
  errorRateLimit,
  sanitizeErrors,
  setupProcessErrorHandlers
};