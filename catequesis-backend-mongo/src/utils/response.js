const { HTTP_STATUS, MESSAGES } = require('./constants');

/**
 * Utilidades para formatear respuestas de la API
 */

/**
 * Crear respuesta exitosa estándar
 */
const successResponse = (res, data = null, message = MESSAGES.SUCCESS.RETRIEVED, statusCode = HTTP_STATUS.OK) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Crear respuesta de error estándar
 */
const errorResponse = (res, message = MESSAGES.ERROR.INTERNAL_ERROR, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, details = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

/**
 * Respuesta de validación con errores específicos
 */
const validationErrorResponse = (res, errors, message = MESSAGES.ERROR.VALIDATION_ERROR) => {
  return res.status(HTTP_STATUS.BAD_REQUEST).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
    errors: Array.isArray(errors) ? errors : [errors]
  });
};

/**
 * Respuesta paginada
 */
const paginatedResponse = (res, data, pagination, message = MESSAGES.SUCCESS.RETRIEVED) => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message,
    timestamp: new Date().toISOString(),
    data,
    pagination: {
      currentPage: pagination.currentPage || 1,
      totalPages: pagination.totalPages || 1,
      totalItems: pagination.totalItems || 0,
      itemsPerPage: pagination.itemsPerPage || 10,
      hasNext: pagination.currentPage < pagination.totalPages,
      hasPrev: pagination.currentPage > 1
    }
  });
};

/**
 * Respuesta de creación exitosa
 */
const createdResponse = (res, data, message = MESSAGES.SUCCESS.CREATED) => {
  return successResponse(res, data, message, HTTP_STATUS.CREATED);
};

/**
 * Respuesta de actualización exitosa
 */
const updatedResponse = (res, data, message = MESSAGES.SUCCESS.UPDATED) => {
  return successResponse(res, data, message, HTTP_STATUS.OK);
};

/**
 * Respuesta de eliminación exitosa
 */
const deletedResponse = (res, data = null, message = MESSAGES.SUCCESS.DELETED) => {
  return successResponse(res, data, message, HTTP_STATUS.OK);
};

/**
 * Respuesta de no autorizado
 */
const unauthorizedResponse = (res, message = MESSAGES.ERROR.UNAUTHORIZED) => {
  return errorResponse(res, message, HTTP_STATUS.UNAUTHORIZED);
};

/**
 * Respuesta de acceso denegado
 */
const forbiddenResponse = (res, message = MESSAGES.ERROR.FORBIDDEN) => {
  return errorResponse(res, message, HTTP_STATUS.FORBIDDEN);
};

/**
 * Respuesta de recurso no encontrado
 */
const notFoundResponse = (res, message = MESSAGES.ERROR.NOT_FOUND) => {
  return errorResponse(res, message, HTTP_STATUS.NOT_FOUND);
};

/**
 * Respuesta de conflicto (recurso duplicado)
 */
const conflictResponse = (res, message = MESSAGES.ERROR.DUPLICATE_ENTRY, details = null) => {
  return errorResponse(res, message, HTTP_STATUS.CONFLICT, details);
};

/**
 * Respuesta de demasiadas solicitudes
 */
const tooManyRequestsResponse = (res, message = 'Demasiadas solicitudes', retryAfter = 60) => {
  res.set('Retry-After', retryAfter);
  return errorResponse(res, message, HTTP_STATUS.TOO_MANY_REQUESTS, { retryAfter });
};

/**
 * Respuesta de servidor no disponible
 */
const serviceUnavailableResponse = (res, message = 'Servicio temporalmente no disponible') => {
  return errorResponse(res, message, HTTP_STATUS.SERVICE_UNAVAILABLE);
};

/**
 * Respuesta con estadísticas
 */
const statsResponse = (res, stats, message = 'Estadísticas obtenidas exitosamente') => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message,
    timestamp: new Date().toISOString(),
    data: stats,
    generatedAt: new Date().toISOString(),
    cacheExpiry: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutos
  });
};

/**
 * Respuesta de búsqueda
 */
const searchResponse = (res, results, query, message = null) => {
  const count = Array.isArray(results) ? results.length : 0;
  const autoMessage = message || `Se encontraron ${count} resultados`;

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message: autoMessage,
    timestamp: new Date().toISOString(),
    data: results,
    meta: {
      query,
      resultCount: count,
      searchTime: new Date().toISOString()
    }
  });
};

/**
 * Respuesta de login exitoso
 */
const loginResponse = (res, user, token, expiresIn = '24h') => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.LOGIN_SUCCESS,
    timestamp: new Date().toISOString(),
    data: {
      user,
      token,
      expiresIn,
      issuedAt: new Date().toISOString(),
      tokenType: 'Bearer'
    }
  });
};

/**
 * Respuesta de logout exitoso
 */
const logoutResponse = (res, message = MESSAGES.SUCCESS.LOGOUT_SUCCESS) => {
  return successResponse(res, null, message);
};

/**
 * Respuesta de reporte generado
 */
const reportResponse = (res, reportData, format = 'json', filename = null) => {
  const response = {
    success: true,
    message: 'Reporte generado exitosamente',
    timestamp: new Date().toISOString(),
    data: reportData,
    meta: {
      format,
      generatedAt: new Date().toISOString(),
      recordCount: Array.isArray(reportData) ? reportData.length : 1
    }
  };

  if (filename) {
    response.meta.filename = filename;
  }

  return res.status(HTTP_STATUS.OK).json(response);
};

/**
 * Respuesta de exportación
 */
const exportResponse = (res, data, format, filename) => {
  const mimeTypes = {
    json: 'application/json',
    csv: 'text/csv',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf'
  };

  res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  return res.send(data);
};

/**
 * Respuesta de proceso en lote
 */
const batchResponse = (res, results, message = 'Proceso en lote completado') => {
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message,
    timestamp: new Date().toISOString(),
    data: results,
    summary: {
      total: results.length,
      successful,
      failed,
      successRate: results.length > 0 ? Math.round((successful / results.length) * 100) : 0
    }
  });
};

/**
 * Respuesta de health check
 */
const healthResponse = (res, status = 'OK', details = {}) => {
  const isHealthy = status === 'OK';
  const statusCode = isHealthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;

  return res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    ...details
  });
};

/**
 * Wrapper para manejo de errores async
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware para logging de respuestas
 */
const logResponse = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log(`[RESPONSE] ${req.method} ${req.originalUrl} - ${res.statusCode}`);
      
      // Log de errores
      if (res.statusCode >= 400) {
        console.log(`[ERROR] ${data}`);
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Formatear datos para respuesta segura (remover campos sensibles)
 */
const sanitizeData = (data, fieldsToRemove = ['password', 'token', 'secret']) => {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, fieldsToRemove));
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    
    fieldsToRemove.forEach(field => {
      delete sanitized[field];
    });
    
    // Recursivo para objetos anidados
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeData(sanitized[key], fieldsToRemove);
      }
    });
    
    return sanitized;
  }
  
  return data;
};

/**
 * Crear respuesta con metadatos adicionales
 */
const responseWithMeta = (res, data, meta = {}, message = MESSAGES.SUCCESS.RETRIEVED) => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message,
    timestamp: new Date().toISOString(),
    data: sanitizeData(data),
    meta: {
      requestId: req.id || Math.random().toString(36).substr(2, 9),
      processingTime: Date.now() - (req.startTime || Date.now()),
      ...meta
    }
  });
};

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
  paginatedResponse,
  createdResponse,
  updatedResponse,
  deletedResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  tooManyRequestsResponse,
  serviceUnavailableResponse,
  statsResponse,
  searchResponse,
  loginResponse,
  logoutResponse,
  reportResponse,
  exportResponse,
  batchResponse,
  healthResponse,
  asyncHandler,
  logResponse,
  sanitizeData,
  responseWithMeta
};