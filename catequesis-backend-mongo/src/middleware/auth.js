const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');
const config = require('../config/environment');

/**
 * Middleware de autenticación JWT
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }

    // Verificar el token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Buscar el usuario
    const usuario = await Usuario.findById(decoded.id)
      .populate('parroquia', 'nombre')
      .select('-password');

    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido - usuario no encontrado'
      });
    }

    // Verificar que el usuario esté activo
    if (!usuario.estaActivo()) {
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo o bloqueado'
      });
    }

    // Agregar usuario a la request
    req.user = {
      id: usuario._id.toString(),
      username: usuario.username,
      tipoPerfil: usuario.tipoPerfil,
      parroquia: usuario.parroquia?._id,
      datosPersonales: usuario.datosPersonales,
      primerLogin: usuario.primerLogin
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    console.error('Error en autenticación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Middleware para verificar permisos por tipo de perfil
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    if (!roles.includes(req.user.tipoPerfil)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a este recurso'
      });
    }

    next();
  };
};

/**
 * Middleware para verificar que el usuario pertenece a la parroquia
 */
const requireSameParroquia = (req, res, next) => {
  // Solo aplicar si no es admin
  if (req.user.tipoPerfil === 'admin') {
    return next();
  }

  // Verificar que el usuario tenga parroquia asignada
  if (!req.user.parroquia) {
    return res.status(403).json({
      success: false,
      message: 'Usuario sin parroquia asignada'
    });
  }

  next();
};

/**
 * Middleware para verificar permisos específicos
 */
const requirePermission = (recurso, accion) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Buscar usuario completo para verificar permisos
      const usuario = await Usuario.findById(req.user.id);
      
      if (!usuario || !usuario.tienePermiso(recurso, accion)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para realizar esta acción'
        });
      }

      next();
    } catch (error) {
      console.error('Error verificando permisos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
};

/**
 * Middleware opcional - no falla si no hay token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const usuario = await Usuario.findById(decoded.id)
      .populate('parroquia', 'nombre')
      .select('-password');

    if (usuario && usuario.estaActivo()) {
      req.user = {
        id: usuario._id.toString(),
        username: usuario.username,
        tipoPerfil: usuario.tipoPerfil,
        parroquia: usuario.parroquia?._id,
        datosPersonales: usuario.datosPersonales
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // En caso de error, continuar sin usuario
    req.user = null;
    next();
  }
};

/**
 * Middleware para verificar primer login
 */
const checkFirstLogin = (req, res, next) => {
  if (req.user && req.user.primerLogin) {
    // Permitir solo ciertos endpoints en primer login
    const allowedEndpoints = [
      '/api/auth/profile',
      '/api/auth/change-password',
      '/api/auth/logout'
    ];

    if (!allowedEndpoints.includes(req.path)) {
      return res.status(403).json({
        success: false,
        message: 'Debes cambiar tu contraseña antes de continuar',
        requirePasswordChange: true
      });
    }
  }

  next();
};

/**
 * Middleware para rate limiting por usuario
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Limpiar requests antiguos
    if (userRequests.has(userId)) {
      const requests = userRequests.get(userId).filter(time => time > windowStart);
      userRequests.set(userId, requests);
    }

    // Obtener requests del usuario en la ventana actual
    const userRequestTimes = userRequests.get(userId) || [];

    if (userRequestTimes.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Agregar request actual
    userRequestTimes.push(now);
    userRequests.set(userId, userRequestTimes);

    next();
  };
};

/**
 * Middleware para logging de actividad
 */
const logActivity = (accion) => {
  return (req, res, next) => {
    // Guardar información original de res.json
    const originalJson = res.json;

    res.json = function(data) {
      // Log solo si la operación fue exitosa
      if (data && data.success && req.user) {
        console.log(`[ACTIVITY] ${new Date().toISOString()} - ${req.user.username} (${req.user.tipoPerfil}) - ${accion} - ${req.method} ${req.originalUrl}`);
      }

      // Llamar al método original
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Middleware para verificar acceso a recursos por parroquia
 */
const checkParroquiaAccess = (getParroquiaFromReq) => {
  return async (req, res, next) => {
    try {
      // Admin tiene acceso a todo
      if (req.user.tipoPerfil === 'admin') {
        return next();
      }

      // Obtener ID de parroquia del recurso
      const parroquiaRecurso = await getParroquiaFromReq(req);

      if (!parroquiaRecurso) {
        return res.status(404).json({
          success: false,
          message: 'Recurso no encontrado'
        });
      }

      // Verificar que la parroquia del usuario coincida con la del recurso
      if (req.user.parroquia?.toString() !== parroquiaRecurso.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a recursos de esta parroquia'
        });
      }

      next();
    } catch (error) {
      console.error('Error verificando acceso por parroquia:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireSameParroquia,
  requirePermission,
  optionalAuth,
  checkFirstLogin,
  userRateLimit,
  logActivity,
  checkParroquiaAccess
};