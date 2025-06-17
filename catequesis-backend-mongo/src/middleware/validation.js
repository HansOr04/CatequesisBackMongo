const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Middleware para manejar errores de validación
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

/**
 * Validadores personalizados
 */
const customValidators = {
  // Validar ObjectId de MongoDB
  isValidObjectId: (value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('ID inválido');
    }
    return true;
  },

  // Validar fecha no futura
  isNotFutureDate: (value) => {
    const date = new Date(value);
    if (date > new Date()) {
      throw new Error('La fecha no puede ser futura');
    }
    return true;
  },

  // Validar edad mínima
  isValidAge: (value, { req }) => {
    const birthDate = new Date(value);
    const today = new Date();
    const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    
    if (age < 4) {
      throw new Error('La edad mínima es 4 años');
    }
    if (age > 100) {
      throw new Error('La edad máxima es 100 años');
    }
    return true;
  },

  // Validar formato de tiempo (HH:MM)
  isValidTime: (value) => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(value)) {
      throw new Error('Formato de hora inválido (HH:MM)');
    }
    return true;
  },

  // Validar que la hora de fin sea mayor que la de inicio
  isEndTimeAfterStart: (value, { req }) => {
    if (!req.body.horaInicio) return true;
    
    const start = req.body.horaInicio.split(':').map(Number);
    const end = value.split(':').map(Number);
    
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    
    if (endMinutes <= startMinutes) {
      throw new Error('La hora de fin debe ser posterior a la hora de inicio');
    }
    return true;
  },

  // Validar username único (se usa en rutas)
  isUniqueUsername: async (value, { req }) => {
    const { Usuario } = require('../models');
    const existingUser = await Usuario.findOne({
      username: value.toLowerCase(),
      _id: { $ne: req.params.id } // Excluir el usuario actual en updates
    });
    
    if (existingUser) {
      throw new Error('Este nombre de usuario ya está en uso');
    }
    return true;
  },

  // Validar documento único
  isUniqueDocument: async (value, { req }) => {
    const { Catequizando } = require('../models');
    const existing = await Catequizando.findOne({
      documentoIdentidad: value.toUpperCase(),
      _id: { $ne: req.params.id }
    });
    
    if (existing) {
      throw new Error('Este documento de identidad ya está registrado');
    }
    return true;
  }
};

/**
 * Validaciones para autenticación
 */
const authValidations = {
  login: [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('El nombre de usuario es requerido')
      .isLength({ min: 3, max: 50 })
      .withMessage('El username debe tener entre 3 y 50 caracteres'),
    
    body('password')
      .notEmpty()
      .withMessage('La contraseña es requerida')
      .isLength({ min: 6 })
      .withMessage('La contraseña debe tener al menos 6 caracteres'),
    
    handleValidationErrors
  ],

  changePassword: [
    body('passwordActual')
      .notEmpty()
      .withMessage('La contraseña actual es requerida'),
    
    body('passwordNueva')
      .isLength({ min: 6, max: 100 })
      .withMessage('La nueva contraseña debe tener entre 6 y 100 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
      .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
    
    handleValidationErrors
  ]
};

/**
 * Validaciones para usuarios
 */
const userValidations = {
  create: [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('El nombre de usuario es requerido')
      .isLength({ min: 3, max: 50 })
      .withMessage('El username debe tener entre 3 y 50 caracteres')
      .matches(/^[a-zA-Z0-9._-]+$/)
      .withMessage('El username solo puede contener letras, números, puntos, guiones y guiones bajos')
      .custom(customValidators.isUniqueUsername),
    
    body('password')
      .isLength({ min: 6, max: 100 })
      .withMessage('La contraseña debe tener entre 6 y 100 caracteres'),
    
    body('tipoPerfil')
      .isIn(['admin', 'parroco', 'secretaria', 'catequista', 'consulta'])
      .withMessage('Tipo de perfil no válido'),
    
    body('parroquia')
      .if(body('tipoPerfil').not().equals('admin'))
      .custom(customValidators.isValidObjectId)
      .withMessage('Parroquia inválida'),
    
    body('datosPersonales.email')
      .optional()
      .isEmail()
      .withMessage('Email inválido'),
    
    body('datosPersonales.telefono')
      .optional()
      .matches(/^[\d\-\s\+\(\)]+$/)
      .withMessage('Formato de teléfono inválido'),
    
    handleValidationErrors
  ],

  update: [
    param('id')
      .custom(customValidators.isValidObjectId),
    
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('El username debe tener entre 3 y 50 caracteres')
      .matches(/^[a-zA-Z0-9._-]+$/)
      .withMessage('El username solo puede contener letras, números, puntos, guiones y guiones bajos'),
    
    body('tipoPerfil')
      .optional()
      .isIn(['admin', 'parroco', 'secretaria', 'catequista', 'consulta'])
      .withMessage('Tipo de perfil no válido'),
    
    body('datosPersonales.email')
      .optional()
      .isEmail()
      .withMessage('Email inválido'),
    
    handleValidationErrors
  ]
};

/**
 * Validaciones para catequizandos
 */
const catequizandoValidations = {
  create: [
    body('nombres')
      .trim()
      .notEmpty()
      .withMessage('Los nombres son requeridos')
      .isLength({ min: 2, max: 100 })
      .withMessage('Los nombres deben tener entre 2 y 100 caracteres')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
      .withMessage('Los nombres solo pueden contener letras y espacios'),
    
    body('apellidos')
      .trim()
      .notEmpty()
      .withMessage('Los apellidos son requeridos')
      .isLength({ min: 2, max: 100 })
      .withMessage('Los apellidos deben tener entre 2 y 100 caracteres')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
      .withMessage('Los apellidos solo pueden contener letras y espacios'),
    
    body('fechaNacimiento')
      .isISO8601()
      .withMessage('Fecha de nacimiento inválida')
      .custom(customValidators.isValidAge),
    
    body('documentoIdentidad')
      .trim()
      .notEmpty()
      .withMessage('El documento de identidad es requerido')
      .isLength({ min: 6, max: 20 })
      .withMessage('El documento debe tener entre 6 y 20 caracteres')
      .matches(/^[a-zA-Z0-9\-]+$/)
      .withMessage('El documento solo puede contener letras, números y guiones')
      .custom(customValidators.isUniqueDocument),
    
    body('genero')
      .isIn(['masculino', 'femenino'])
      .withMessage('Género debe ser masculino o femenino'),
    
    body('contacto.email')
      .optional()
      .isEmail()
      .withMessage('Email inválido'),
    
    body('contacto.telefono')
      .optional()
      .matches(/^[\d\-\s\+\(\)]+$/)
      .withMessage('Formato de teléfono inválido'),
    
    handleValidationErrors
  ],

  update: [
    param('id')
      .custom(customValidators.isValidObjectId),
    
    body('nombres')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Los nombres deben tener entre 2 y 100 caracteres')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
      .withMessage('Los nombres solo pueden contener letras y espacios'),
    
    body('apellidos')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Los apellidos deben tener entre 2 y 100 caracteres')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
      .withMessage('Los apellidos solo pueden contener letras y espacios'),
    
    handleValidationErrors
  ]
};

/**
 * Validaciones para grupos
 */
const grupoValidations = {
  create: [
    body('nombre')
      .trim()
      .notEmpty()
      .withMessage('El nombre del grupo es requerido')
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    
    body('nivel')
      .custom(customValidators.isValidObjectId)
      .withMessage('Nivel inválido'),
    
    body('parroquia')
      .optional()
      .custom(customValidators.isValidObjectId)
      .withMessage('Parroquia inválida'),
    
    body('horarios.diaSemana')
      .isIn(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'])
      .withMessage('Día de la semana inválido'),
    
    body('horarios.horaInicio')
      .custom(customValidators.isValidTime),
    
    body('horarios.horaFin')
      .custom(customValidators.isValidTime)
      .custom(customValidators.isEndTimeAfterStart),
    
    body('fechas.inicioClases')
      .isISO8601()
      .withMessage('Fecha de inicio inválida'),
    
    body('fechas.finClases')
      .isISO8601()
      .withMessage('Fecha de fin inválida')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.fechas?.inicioClases)) {
          throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        }
        return true;
      }),
    
    handleValidationErrors
  ],

  update: [
    param('id')
      .custom(customValidators.isValidObjectId),
    
    body('nombre')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    
    body('horarios.horaInicio')
      .optional()
      .custom(customValidators.isValidTime),
    
    body('horarios.horaFin')
      .optional()
      .custom(customValidators.isValidTime),
    
    handleValidationErrors
  ],

  asignarCatequista: [
    param('id')
      .custom(customValidators.isValidObjectId),
    
    body('usuarioId')
      .custom(customValidators.isValidObjectId)
      .withMessage('Usuario inválido'),
    
    body('rol')
      .optional()
      .isIn(['coordinador', 'catequista', 'auxiliar'])
      .withMessage('Rol inválido'),
    
    handleValidationErrors
  ]
};

/**
 * Validaciones para inscripciones
 */
const inscripcionValidations = {
  create: [
    body('catequizando')
      .custom(customValidators.isValidObjectId)
      .withMessage('Catequizando inválido'),
    
    body('grupo')
      .custom(customValidators.isValidObjectId)
      .withMessage('Grupo inválido'),
    
    handleValidationErrors
  ],

  registrarPago: [
    param('id')
      .custom(customValidators.isValidObjectId),
    
    body('tipo')
      .isIn(['inscripcion', 'materiales', 'otro'])
      .withMessage('Tipo de pago inválido'),
    
    body('monto')
      .isFloat({ min: 0 })
      .withMessage('El monto debe ser un número positivo'),
    
    body('metodoPago')
      .isIn(['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'])
      .withMessage('Método de pago inválido'),
    
    handleValidationErrors
  ]
};

/**
 * Validaciones para asistencias
 */
const asistenciaValidations = {
  create: [
    body('inscripcion')
      .custom(customValidators.isValidObjectId)
      .withMessage('Inscripción inválida'),
    
    body('fecha')
      .isISO8601()
      .withMessage('Fecha inválida')
      .custom(customValidators.isNotFutureDate),
    
    body('asistio')
      .isBoolean()
      .withMessage('El estado de asistencia debe ser verdadero o falso'),
    
    body('detalles.horaLlegada')
      .optional()
      .custom(customValidators.isValidTime),
    
    body('detalles.horaSalida')
      .optional()
      .custom(customValidators.isValidTime),
    
    handleValidationErrors
  ],

  registrarGrupo: [
    param('grupoId')
      .custom(customValidators.isValidObjectId),
    
    body('fecha')
      .isISO8601()
      .withMessage('Fecha inválida')
      .custom(customValidators.isNotFutureDate),
    
    body('asistencias')
      .isArray({ min: 1 })
      .withMessage('Debe proporcionar al menos una asistencia'),
    
    body('asistencias.*.inscripcion')
      .custom(customValidators.isValidObjectId)
      .withMessage('Inscripción inválida'),
    
    body('asistencias.*.asistio')
      .isBoolean()
      .withMessage('El estado de asistencia debe ser verdadero o falso'),
    
    handleValidationErrors
  ]
};

/**
 * Validaciones para parámetros comunes
 */
const commonValidations = {
  objectId: [
    param('id')
      .custom(customValidators.isValidObjectId)
      .withMessage('ID inválido'),
    
    handleValidationErrors
  ],

  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('La página debe ser un número entero mayor a 0'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('El límite debe ser un número entre 1 y 100'),
    
    handleValidationErrors
  ],

  dateRange: [
    query('fechaInicio')
      .optional()
      .isISO8601()
      .withMessage('Fecha de inicio inválida'),
    
    query('fechaFin')
      .optional()
      .isISO8601()
      .withMessage('Fecha de fin inválida')
      .custom((value, { req }) => {
        if (req.query.fechaInicio && new Date(value) <= new Date(req.query.fechaInicio)) {
          throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        }
        return true;
      }),
    
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  customValidators,
  authValidations,
  userValidations,
  catequizandoValidations,
  grupoValidations,
  inscripcionValidations,
  asistenciaValidations,
  commonValidations
};