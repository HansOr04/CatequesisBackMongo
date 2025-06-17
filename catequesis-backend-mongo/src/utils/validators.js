const mongoose = require('mongoose');
const { REGEX, VALIDATION_RULES, EDAD_CONFIG } = require('./constants');

/**
 * Validadores personalizados para el sistema
 */

/**
 * Validar ObjectId de MongoDB
 */
const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

/**
 * Validar email
 */
const isValidEmail = (email) => {
  if (!email) return false;
  return REGEX.EMAIL.test(email.toLowerCase());
};

/**
 * Validar teléfono
 */
const isValidPhone = (phone) => {
  if (!phone) return false;
  const cleanPhone = phone.replace(/\s/g, '');
  return REGEX.TELEFONO.test(cleanPhone) && 
         cleanPhone.length >= VALIDATION_RULES.PHONE.MIN_LENGTH && 
         cleanPhone.length <= VALIDATION_RULES.PHONE.MAX_LENGTH;
};

/**
 * Validar documento de identidad
 */
const isValidDocument = (document) => {
  if (!document) return false;
  return REGEX.DOCUMENTO.test(document) &&
         document.length >= VALIDATION_RULES.DOCUMENT.MIN_LENGTH &&
         document.length <= VALIDATION_RULES.DOCUMENT.MAX_LENGTH;
};

/**
 * Validar nombres/apellidos
 */
const isValidName = (name) => {
  if (!name) return false;
  return REGEX.NOMBRES.test(name) &&
         name.trim().length >= VALIDATION_RULES.NAMES.MIN_LENGTH &&
         name.trim().length <= VALIDATION_RULES.NAMES.MAX_LENGTH;
};

/**
 * Validar username
 */
const isValidUsername = (username) => {
  if (!username) return false;
  return REGEX.USERNAME.test(username) &&
         username.length >= VALIDATION_RULES.USERNAME.MIN_LENGTH &&
         username.length <= VALIDATION_RULES.USERNAME.MAX_LENGTH;
};

/**
 * Validar contraseña
 */
const isValidPassword = (password) => {
  if (!password) return false;
  
  const rules = VALIDATION_RULES.PASSWORD;
  
  // Longitud
  if (password.length < rules.MIN_LENGTH || password.length > rules.MAX_LENGTH) {
    return false;
  }
  
  // Mayúscula
  if (rules.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    return false;
  }
  
  // Minúscula
  if (rules.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    return false;
  }
  
  // Número
  if (rules.REQUIRE_NUMBER && !/\d/.test(password)) {
    return false;
  }
  
  return true;
};

/**
 * Validar edad basada en fecha de nacimiento
 */
const isValidAge = (fechaNacimiento) => {
  if (!fechaNacimiento) return false;
  
  const birthDate = new Date(fechaNacimiento);
  const today = new Date();
  
  // Verificar que la fecha no sea futura
  if (birthDate > today) return false;
  
  // Calcular edad
  const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
  
  return age >= EDAD_CONFIG.MINIMA && age <= EDAD_CONFIG.MAXIMA;
};

/**
 * Validar formato de tiempo (HH:MM)
 */
const isValidTime = (time) => {
  if (!time) return false;
  return REGEX.TIEMPO.test(time);
};

/**
 * Validar que hora fin sea mayor que hora inicio
 */
const isEndTimeAfterStart = (startTime, endTime) => {
  if (!startTime || !endTime) return false;
  
  const start = startTime.split(':').map(Number);
  const end = endTime.split(':').map(Number);
  
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  
  return endMinutes > startMinutes;
};

/**
 * Validar periodo (formato YYYY o YYYY-YYYY)
 */
const isValidPeriod = (period) => {
  if (!period) return false;
  return REGEX.PERIODO.test(period);
};

/**
 * Validar URL
 */
const isValidUrl = (url) => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validar coordenadas geográficas
 */
const isValidCoordinates = (lat, lng) => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  
  return !isNaN(latitude) && !isNaN(longitude) &&
         latitude >= -90 && latitude <= 90 &&
         longitude >= -180 && longitude <= 180;
};

/**
 * Validar rango de fechas
 */
const isValidDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return false;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return start < end;
};

/**
 * Validar que una fecha no sea futura
 */
const isNotFutureDate = (date) => {
  if (!date) return false;
  return new Date(date) <= new Date();
};

/**
 * Validar calificación (0-100)
 */
const isValidGrade = (grade) => {
  const num = parseFloat(grade);
  return !isNaN(num) && num >= 0 && num <= 100;
};

/**
 * Validar porcentaje (0-100)
 */
const isValidPercentage = (percentage) => {
  const num = parseFloat(percentage);
  return !isNaN(num) && num >= 0 && num <= 100;
};

/**
 * Validar número de teléfono ecuatoriano
 */
const isValidEcuadorianPhone = (phone) => {
  if (!phone) return false;
  
  // Remover espacios y caracteres especiales
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Teléfonos fijos: 7 dígitos (02 + 7 dígitos)
  // Celulares: 10 dígitos (09 + 8 dígitos)
  // Con código de país: +593 + número
  
  if (cleanPhone.startsWith('593')) {
    // Con código de país
    return cleanPhone.length === 12 || cleanPhone.length === 13;
  }
  
  // Sin código de país
  return cleanPhone.length === 9 || cleanPhone.length === 10;
};

/**
 * Validar cédula ecuatoriana
 */
const isValidEcuadorianId = (cedula) => {
  if (!cedula || cedula.length !== 10) return false;
  
  // Verificar que todos sean dígitos
  if (!/^\d{10}$/.test(cedula)) return false;
  
  // Algoritmo de validación de cédula ecuatoriana
  const provincia = parseInt(cedula.substring(0, 2));
  
  // Verificar código de provincia (01-24)
  if (provincia < 1 || provincia > 24) return false;
  
  // Último dígito es el verificador
  const verificador = parseInt(cedula.charAt(9));
  
  // Calcular dígito verificador
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let digito = parseInt(cedula.charAt(i));
    
    if (i % 2 === 0) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    
    suma += digito;
  }
  
  const digitoCalculado = (10 - (suma % 10)) % 10;
  
  return digitoCalculado === verificador;
};

/**
 * Validar capacidad de grupo
 */
const isValidGroupCapacity = (capacity) => {
  const num = parseInt(capacity);
  return !isNaN(num) && num >= 5 && num <= 50;
};

/**
 * Validar edad para nivel
 */
const isValidAgeForLevel = (age, nivel) => {
  if (!nivel.configuracion) return true;
  
  const { edadMinima, edadMaxima } = nivel.configuracion;
  
  if (edadMinima && age < edadMinima) return false;
  if (edadMaxima && age > edadMaxima) return false;
  
  return true;
};

/**
 * Validar estructura de horario
 */
const isValidSchedule = (horario) => {
  if (!horario) return false;
  
  const { diaSemana, horaInicio, horaFin } = horario;
  
  const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  
  return diasValidos.includes(diaSemana) &&
         isValidTime(horaInicio) &&
         isValidTime(horaFin) &&
         isEndTimeAfterStart(horaInicio, horaFin);
};

/**
 * Validar configuración de pago
 */
const isValidPayment = (pago) => {
  if (!pago) return false;
  
  const { monto, metodoPago } = pago;
  const metodosValidos = ['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'];
  
  const montoNum = parseFloat(monto);
  
  return !isNaN(montoNum) && 
         montoNum >= 0 && 
         metodosValidos.includes(metodoPago);
};

/**
 * Validar estructura de representante
 */
const isValidRepresentante = (representante) => {
  if (!representante) return false;
  
  const { tipo, nombres, apellidos } = representante;
  const tiposValidos = ['padre', 'madre', 'abuelo', 'abuela', 'tio', 'tia', 'hermano', 'hermana', 'tutor', 'otro'];
  
  return tiposValidos.includes(tipo) &&
         isValidName(nombres) &&
         isValidName(apellidos);
};

/**
 * Validar archivo subido
 */
const isValidFile = (file, allowedTypes = [], maxSize = null) => {
  if (!file) return false;
  
  // Verificar tipo de archivo
  if (allowedTypes.length > 0) {
    const extension = '.' + file.originalname.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(extension)) return false;
  }
  
  // Verificar tamaño
  if (maxSize && file.size > maxSize) return false;
  
  return true;
};

/**
 * Validar configuración de notificaciones
 */
const isValidNotificationConfig = (config) => {
  if (!config || typeof config !== 'object') return false;
  
  const validKeys = ['email', 'push', 'sms'];
  
  return Object.keys(config).every(key => 
    validKeys.includes(key) && typeof config[key] === 'boolean'
  );
};

/**
 * Validar datos de ubicación
 */
const isValidLocation = (ubicacion) => {
  if (!ubicacion) return true; // Ubicación es opcional
  
  const { coordenadas } = ubicacion;
  
  if (coordenadas) {
    const { latitud, longitud } = coordenadas;
    if (latitud !== undefined || longitud !== undefined) {
      return isValidCoordinates(latitud, longitud);
    }
  }
  
  return true;
};

/**
 * Validar configuración de evaluación
 */
const isValidEvaluationConfig = (evaluacion) => {
  if (!evaluacion) return true;
  
  const { notaMinima, criterios } = evaluacion;
  
  // Validar nota mínima
  if (notaMinima !== undefined && !isValidGrade(notaMinima)) {
    return false;
  }
  
  // Validar criterios
  if (criterios && Array.isArray(criterios)) {
    const pesoTotal = criterios.reduce((sum, criterio) => sum + (criterio.peso || 0), 0);
    if (Math.abs(pesoTotal - 100) > 0.01) { // Permitir pequeñas diferencias de punto flotante
      return false;
    }
  }
  
  return true;
};

/**
 * Sanitizar entrada de texto
 */
const sanitizeText = (text) => {
  if (!text) return text;
  
  return text
    .trim()
    .replace(/\s+/g, ' ') // Reemplazar múltiples espacios con uno solo
    .replace(/[<>]/g, ''); // Remover caracteres HTML básicos
};

/**
 * Validar y sanitizar datos de entrada
 */
const validateAndSanitize = (data, schema) => {
  const errors = [];
  const sanitized = {};
  
  Object.keys(schema).forEach(key => {
    const rule = schema[key];
    const value = data[key];
    
    // Verificar si es requerido
    if (rule.required && (!value || value.toString().trim() === '')) {
      errors.push({
        field: key,
        message: `${key} es requerido`
      });
      return;
    }
    
    // Si no es requerido y está vacío, continuar
    if (!value && !rule.required) {
      sanitized[key] = value;
      return;
    }
    
    // Aplicar validación específica
    if (rule.validator && !rule.validator(value)) {
      errors.push({
        field: key,
        message: rule.message || `${key} no es válido`
      });
      return;
    }
    
    // Sanitizar si es texto
    if (rule.sanitize && typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else {
      sanitized[key] = value;
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    data: sanitized
  };
};

/**
 * Esquemas de validación comunes
 */
const commonSchemas = {
  usuario: {
    username: {
      required: true,
      validator: isValidUsername,
      message: 'Username debe tener entre 3-50 caracteres y solo contener letras, números, puntos, guiones',
      sanitize: true
    },
    password: {
      required: true,
      validator: isValidPassword,
      message: 'Password debe tener al menos 6 caracteres, una mayúscula, una minúscula y un número'
    },
    email: {
      required: false,
      validator: isValidEmail,
      message: 'Email no válido',
      sanitize: true
    }
  },
  
  catequizando: {
    nombres: {
      required: true,
      validator: isValidName,
      message: 'Nombres debe tener entre 2-100 caracteres y solo contener letras',
      sanitize: true
    },
    apellidos: {
      required: true,
      validator: isValidName,
      message: 'Apellidos debe tener entre 2-100 caracteres y solo contener letras',
      sanitize: true
    },
    documentoIdentidad: {
      required: true,
      validator: isValidDocument,
      message: 'Documento debe tener entre 6-20 caracteres',
      sanitize: true
    },
    fechaNacimiento: {
      required: true,
      validator: isValidAge,
      message: 'Fecha de nacimiento debe corresponder a una edad entre 4-99 años'
    }
  },
  
  grupo: {
    nombre: {
      required: true,
      validator: (value) => value && value.trim().length >= 2 && value.trim().length <= 50,
      message: 'Nombre debe tener entre 2-50 caracteres',
      sanitize: true
    },
    capacidadMaxima: {
      required: false,
      validator: isValidGroupCapacity,
      message: 'Capacidad debe estar entre 5-50 catequizandos'
    }
  }
};

/**
 * Validador de batch para múltiples registros
 */
const validateBatch = (records, schema) => {
  const results = [];
  
  records.forEach((record, index) => {
    const validation = validateAndSanitize(record, schema);
    results.push({
      index,
      isValid: validation.isValid,
      errors: validation.errors,
      data: validation.data
    });
  });
  
  return {
    allValid: results.every(r => r.isValid),
    results,
    validCount: results.filter(r => r.isValid).length,
    invalidCount: results.filter(r => !r.isValid).length
  };
};

/**
 * Middleware de validación express
 */
const createValidationMiddleware = (schema) => {
  return (req, res, next) => {
    const validation = validateAndSanitize(req.body, schema);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: validation.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    // Reemplazar req.body con datos sanitizados
    req.body = validation.data;
    next();
  };
};

module.exports = {
  // Validadores básicos
  isValidObjectId,
  isValidEmail,
  isValidPhone,
  isValidDocument,
  isValidName,
  isValidUsername,
  isValidPassword,
  isValidAge,
  isValidTime,
  isEndTimeAfterStart,
  isValidPeriod,
  isValidUrl,
  isValidCoordinates,
  isValidDateRange,
  isNotFutureDate,
  isValidGrade,
  isValidPercentage,
  
  // Validadores específicos de Ecuador
  isValidEcuadorianPhone,
  isValidEcuadorianId,
  
  // Validadores de estructuras complejas
  isValidGroupCapacity,
  isValidAgeForLevel,
  isValidSchedule,
  isValidPayment,
  isValidRepresentante,
  isValidFile,
  isValidNotificationConfig,
  isValidLocation,
  isValidEvaluationConfig,
  
  // Utilidades
  sanitizeText,
  validateAndSanitize,
  validateBatch,
  createValidationMiddleware,
  
  // Esquemas predefinidos
  commonSchemas
};