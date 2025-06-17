const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/environment');

const usuarioSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'El nombre de usuario es requerido'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'El username debe tener al menos 3 caracteres'],
    maxlength: [50, 'El username no puede exceder 50 caracteres'],
    match: [/^[a-zA-Z0-9._-]+$/, 'El username solo puede contener letras, números, puntos, guiones y guiones bajos']
  },

  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    maxlength: [100, 'La contraseña no puede exceder 100 caracteres'],
    select: false // No incluir en consultas por defecto
  },

  tipoPerfil: {
    type: String,
    required: [true, 'El tipo de perfil es requerido'],
    enum: {
      values: ['admin', 'parroco', 'secretaria', 'catequista', 'consulta'],
      message: 'Tipo de perfil no válido'
    },
    default: 'consulta'
  },

  parroquia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parroquia',
    required: function() {
      // Solo admin puede no tener parroquia
      return this.tipoPerfil !== 'admin';
    },
    validate: {
      validator: function(value) {
        // Admin no debe tener parroquia asignada
        if (this.tipoPerfil === 'admin') {
          return !value;
        }
        // Otros perfiles deben tener parroquia
        return !!value;
      },
      message: 'Configuración de parroquia inválida para este tipo de perfil'
    }
  },

  activo: {
    type: Boolean,
    default: true
  },

  primerLogin: {
    type: Boolean,
    default: true
  },

  ultimoLogin: {
    type: Date,
    default: null
  },

  intentosFallidos: {
    type: Number,
    default: 0,
    max: 5
  },

  bloqueadoHasta: {
    type: Date,
    default: null
  },

  // Datos personales opcionales
  datosPersonales: {
    nombres: {
      type: String,
      trim: true,
      maxlength: [100, 'Los nombres no pueden exceder 100 caracteres']
    },
    apellidos: {
      type: String,
      trim: true,
      maxlength: [100, 'Los apellidos no pueden exceder 100 caracteres']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido']
    },
    telefono: {
      type: String,
      trim: true,
      match: [/^[\d\-\s\+\(\)]+$/, 'Formato de teléfono inválido']
    }
  },

  // Configuraciones del usuario
  configuraciones: {
    idioma: {
      type: String,
      enum: ['es', 'en'],
      default: 'es'
    },
    tema: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    notificaciones: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: function(doc, ret) {
      // Remover campos sensibles en la respuesta JSON
      delete ret.password;
      delete ret.intentosFallidos;
      delete ret.bloqueadoHasta;
      return ret;
    }
  }
});

// Índices
usuarioSchema.index({ username: 1 }, { unique: true });
usuarioSchema.index({ parroquia: 1 });
usuarioSchema.index({ tipoPerfil: 1 });
usuarioSchema.index({ activo: 1 });
usuarioSchema.index({ ultimoLogin: -1 });

// Middleware pre-save para hashear contraseña
usuarioSchema.pre('save', async function(next) {
  // Solo hashear si la contraseña fue modificada
  if (!this.isModified('password')) return next();
  
  try {
    // Hashear contraseña
    this.password = await bcrypt.hash(this.password, config.bcrypt.rounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Validación personalizada para párroco único por parroquia
usuarioSchema.pre('save', async function(next) {
  if (this.tipoPerfil === 'parroco' && this.parroquia) {
    try {
      const existingParroco = await this.constructor.findOne({
        tipoPerfil: 'parroco',
        parroquia: this.parroquia,
        _id: { $ne: this._id }, // Excluir el documento actual
        activo: true
      });

      if (existingParroco) {
        const error = new Error('Ya existe un párroco activo en esta parroquia');
        error.code = 'PARROCO_ALREADY_EXISTS';
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Métodos de instancia
usuarioSchema.methods.compararPassword = async function(password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    throw new Error('Error comparando contraseñas');
  }
};

usuarioSchema.methods.estaActivo = function() {
  return this.activo && (!this.bloqueadoHasta || this.bloqueadoHasta < new Date());
};

usuarioSchema.methods.bloquear = function(minutos = 30) {
  this.bloqueadoHasta = new Date(Date.now() + minutos * 60 * 1000);
  this.intentosFallidos = 0;
  return this.save();
};

usuarioSchema.methods.desbloquear = function() {
  this.bloqueadoHasta = null;
  this.intentosFallidos = 0;
  return this.save();
};

usuarioSchema.methods.registrarLoginExitoso = function() {
  this.ultimoLogin = new Date();
  this.intentosFallidos = 0;
  this.bloqueadoHasta = null;
  this.primerLogin = false;
  return this.save();
};

usuarioSchema.methods.registrarLoginFallido = function() {
  this.intentosFallidos += 1;
  
  // Bloquear después de 5 intentos fallidos
  if (this.intentosFallidos >= 5) {
    this.bloqueadoHasta = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
  }
  
  return this.save();
};

usuarioSchema.methods.tienePermiso = function(recurso, accion) {
  const permisos = {
    admin: ['*'], // Todos los permisos
    parroco: ['create', 'read', 'update', 'delete', 'approve'],
    secretaria: ['create', 'read', 'update'],
    catequista: ['read', 'update_attendance'],
    consulta: ['read']
  };

  const permisosUsuario = permisos[this.tipoPerfil] || [];
  return permisosUsuario.includes('*') || permisosUsuario.includes(accion);
};

// Métodos estáticos
usuarioSchema.statics.buscarPorUsername = function(username) {
  return this.findOne({ username: username.toLowerCase().trim() })
    .populate('parroquia', 'nombre')
    .select('+password');
};

usuarioSchema.statics.obtenerEstadisticas = function(filtros = {}) {
  const pipeline = [
    { $match: filtros },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        activos: { $sum: { $cond: ['$activo', 1, 0] } },
        inactivos: { $sum: { $cond: ['$activo', 0, 1] } },
        porTipo: {
          $push: {
            tipo: '$tipoPerfil',
            activo: '$activo'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        activos: 1,
        inactivos: 1,
        admins: {
          $size: {
            $filter: {
              input: '$porTipo',
              as: 'user',
              cond: { $eq: ['$$user.tipo', 'admin'] }
            }
          }
        },
        parrocos: {
          $size: {
            $filter: {
              input: '$porTipo',
              as: 'user',
              cond: { $eq: ['$$user.tipo', 'parroco'] }
            }
          }
        },
        secretarias: {
          $size: {
            $filter: {
              input: '$porTipo',
              as: 'user',
              cond: { $eq: ['$$user.tipo', 'secretaria'] }
            }
          }
        },
        catequistas: {
          $size: {
            $filter: {
              input: '$porTipo',
              as: 'user',
              cond: { $eq: ['$$user.tipo', 'catequista'] }
            }
          }
        },
        consultas: {
          $size: {
            $filter: {
              input: '$porTipo',
              as: 'user',
              cond: { $eq: ['$$user.tipo', 'consulta'] }
            }
          }
        }
      }
    }
  ];

  return this.aggregate(pipeline);
};

usuarioSchema.statics.limpiarBloqueosExpirados = function() {
  return this.updateMany(
    { 
      bloqueadoHasta: { $lt: new Date() },
      bloqueadoHasta: { $ne: null }
    },
    { 
      $unset: { bloqueadoHasta: 1 },
      $set: { intentosFallidos: 0 }
    }
  );
};

// Virtual para nombre completo
usuarioSchema.virtual('nombreCompleto').get(function() {
  if (this.datosPersonales.nombres && this.datosPersonales.apellidos) {
    return `${this.datosPersonales.nombres} ${this.datosPersonales.apellidos}`;
  }
  return this.username;
});

module.exports = mongoose.model('Usuario', usuarioSchema);