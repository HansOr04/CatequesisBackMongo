const mongoose = require('mongoose');

const catequizandoSchema = new mongoose.Schema({
  nombres: {
    type: String,
    required: [true, 'Los nombres son requeridos'],
    trim: true,
    maxlength: [50, 'Los nombres no pueden exceder 50 caracteres']
  },
  
  apellidos: {
    type: String,
    required: [true, 'Los apellidos son requeridos'],
    trim: true,
    maxlength: [50, 'Los apellidos no pueden exceder 50 caracteres']
  },
  
  fechaNacimiento: {
    type: Date,
    required: [true, 'La fecha de nacimiento es requerida'],
    validate: {
      validator: function(value) {
        return value < new Date();
      },
      message: 'La fecha de nacimiento no puede ser futura'
    }
  },
  
  documentoIdentidad: {
    type: String,
    required: [true, 'El documento de identidad es requerido'],
    unique: true,
    trim: true,
    minlength: [6, 'El documento debe tener al menos 6 caracteres'],
    maxlength: [20, 'El documento no puede exceder 20 caracteres']
  },
  
  tipoDocumento: {
    type: String,
    enum: ['cedula', 'pasaporte', 'tarjeta_identidad'],
    default: 'cedula'
  },
  
  genero: {
    type: String,
    enum: ['masculino', 'femenino'],
    required: [true, 'El género es requerido']
  },
  
  estadoCivil: {
    type: String,
    enum: ['soltero', 'casado', 'union_libre', 'divorciado', 'viudo'],
    default: 'soltero'
  },
  
  contacto: {
    direccion: {
      type: String,
      required: [true, 'La dirección es requerida'],
      trim: true,
      maxlength: [255, 'La dirección no puede exceder 255 caracteres']
    },
    telefono: {
      type: String,
      required: [true, 'El teléfono es requerido'],
      trim: true,
      validate: {
        validator: function(v) {
          return /^[\d\-\s\+\(\)]+$/.test(v);
        },
        message: 'Formato de teléfono inválido'
      }
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: 'Email inválido'
      }
    },
    ciudad: {
      type: String,
      required: [true, 'La ciudad es requerida'],
      trim: true,
      maxlength: [50, 'La ciudad no puede exceder 50 caracteres']
    }
  },
  
  responsable: {
    nombres: {
      type: String,
      trim: true,
      maxlength: [50, 'Los nombres del responsable no pueden exceder 50 caracteres']
    },
    apellidos: {
      type: String,
      trim: true,
      maxlength: [50, 'Los apellidos del responsable no pueden exceder 50 caracteres']
    },
    telefono: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^[\d\-\s\+\(\)]+$/.test(v);
        },
        message: 'Formato de teléfono del responsable inválido'
      }
    },
    relacion: {
      type: String,
      enum: ['padre', 'madre', 'tutor', 'abuelo', 'tio', 'hermano', 'otro'],
      default: 'padre'
    }
  },
  
  estado: {
    activo: {
      type: Boolean,
      default: true
    },
    fechaRegistro: {
      type: Date,
      default: Date.now
    },
    fechaEgreso: {
      type: Date
    },
    motivoEgreso: {
      type: String,
      enum: ['graduacion', 'retiro_voluntario', 'cambio_parroquia', 'suspension', 'otro']
    },
    casoEspecial: {
      type: Boolean,
      default: false
    },
    observaciones: {
      type: String,
      maxlength: [500, 'Las observaciones no pueden exceder 500 caracteres']
    }
  },
  
  sacramentos: {
    bautismo: {
      recibido: { type: Boolean, default: false },
      fecha: { type: Date },
      parroquia: { type: String, trim: true },
      certificado: { type: String, trim: true }
    },
    primeraComunion: {
      recibido: { type: Boolean, default: false },
      fecha: { type: Date },
      parroquia: { type: String, trim: true },
      certificado: { type: String, trim: true }
    },
    confirmacion: {
      recibido: { type: Boolean, default: false },
      fecha: { type: Date },
      parroquia: { type: String, trim: true },
      certificado: { type: String, trim: true }
    }
  },
  
  condicionesEspeciales: {
    discapacidad: {
      tiene: { type: Boolean, default: false },
      tipo: { type: String, trim: true },
      descripcion: { type: String, trim: true }
    },
    alergias: [{
      tipo: { type: String, trim: true },
      descripcion: { type: String, trim: true }
    }],
    medicamentos: [{
      nombre: { type: String, trim: true },
      dosis: { type: String, trim: true },
      frecuencia: { type: String, trim: true }
    }],
    contactoEmergencia: {
      nombre: { type: String, trim: true },
      telefono: { type: String, trim: true },
      relacion: { type: String, trim: true }
    }
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices
catequizandoSchema.index({ documentoIdentidad: 1 }, { unique: true });
catequizandoSchema.index({ nombres: 1, apellidos: 1 });
catequizandoSchema.index({ 'estado.activo': 1 });
catequizandoSchema.index({ genero: 1 });
catequizandoSchema.index({ fechaNacimiento: 1 });

// Métodos de instancia
catequizandoSchema.methods.calcularEdad = function() {
  if (!this.fechaNacimiento) return 0;
  
  const hoy = new Date();
  const nacimiento = new Date(this.fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  
  return Math.max(0, edad);
};

catequizandoSchema.methods.getNombreCompleto = function() {
  return `${this.nombres} ${this.apellidos}`.trim();
};

catequizandoSchema.methods.tieneCondicionesEspeciales = function() {
  return this.condicionesEspeciales?.discapacidad?.tiene || 
         (this.condicionesEspeciales?.alergias?.length > 0) ||
         (this.condicionesEspeciales?.medicamentos?.length > 0);
};

catequizandoSchema.methods.obtenerContactosEmergencia = function() {
  const contactos = [];
  
  // Responsable principal
  if (this.responsable?.nombres && this.responsable?.telefono) {
    contactos.push({
      nombre: `${this.responsable.nombres} ${this.responsable.apellidos || ''}`.trim(),
      telefono: this.responsable.telefono,
      relacion: this.responsable.relacion || 'responsable',
      tipo: 'responsable'
    });
  }
  
  // Contacto de emergencia
  if (this.condicionesEspeciales?.contactoEmergencia?.nombre) {
    contactos.push({
      nombre: this.condicionesEspeciales.contactoEmergencia.nombre,
      telefono: this.condicionesEspeciales.contactoEmergencia.telefono,
      relacion: this.condicionesEspeciales.contactoEmergencia.relacion,
      tipo: 'emergencia'
    });
  }
  
  return contactos;
};

catequizandoSchema.methods.marcarComoEgresado = function(motivo, fecha = new Date()) {
  this.estado.activo = false;
  this.estado.fechaEgreso = fecha;
  this.estado.motivoEgreso = motivo;
  return this.save();
};

catequizandoSchema.methods.reactivar = function() {
  this.estado.activo = true;
  this.estado.fechaEgreso = undefined;
  this.estado.motivoEgreso = undefined;
  return this.save();
};

// Métodos estáticos
catequizandoSchema.statics.buscarPorDocumento = function(documento) {
  return this.findOne({ documentoIdentidad: documento });
};

catequizandoSchema.statics.buscarPorTexto = function(texto) {
  const regex = { $regex: texto, $options: 'i' };
  return this.find({
    $or: [
      { nombres: regex },
      { apellidos: regex },
      { documentoIdentidad: regex }
    ]
  }).limit(20);
};

catequizandoSchema.statics.obtenerCumpleanosMes = function(mes) {
  return this.find({
    'estado.activo': true,
    $expr: {
      $eq: [{ $month: '$fechaNacimiento' }, mes]
    }
  }).sort({ fechaNacimiento: 1 });
};

catequizandoSchema.statics.obtenerEstadisticas = function(filtros = {}) {
  return this.aggregate([
    { $match: { 'estado.activo': true, ...filtros } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        masculinos: {
          $sum: { $cond: [{ $eq: ['$genero', 'masculino'] }, 1, 0] }
        },
        femeninos: {
          $sum: { $cond: [{ $eq: ['$genero', 'femenino'] }, 1, 0] }
        },
        conBautismo: {
          $sum: { $cond: ['$sacramentos.bautismo.recibido', 1, 0] }
        },
        conPrimeraComunion: {
          $sum: { $cond: ['$sacramentos.primeraComunion.recibido', 1, 0] }
        },
        conConfirmacion: {
          $sum: { $cond: ['$sacramentos.confirmacion.recibido', 1, 0] }
        },
        casosEspeciales: {
          $sum: { $cond: ['$estado.casoEspecial', 1, 0] }
        },
        edadPromedio: { $avg: { $subtract: [new Date(), '$fechaNacimiento'] } }
      }
    },
    {
      $addFields: {
        edadPromedio: {
          $divide: [
            { $divide: ['$edadPromedio', 1000 * 60 * 60 * 24 * 365.25] },
            1
          ]
        },
        porcentajeBautizados: {
          $multiply: [{ $divide: ['$conBautismo', '$total'] }, 100]
        }
      }
    }
  ]);
};

// Middleware pre-save
catequizandoSchema.pre('save', function(next) {
  // Normalizar nombres y apellidos
  if (this.nombres) {
    this.nombres = this.nombres.replace(/\s+/g, ' ').trim();
  }
  if (this.apellidos) {
    this.apellidos = this.apellidos.replace(/\s+/g, ' ').trim();
  }
  
  // Normalizar documento
  if (this.documentoIdentidad) {
    this.documentoIdentidad = this.documentoIdentidad.replace(/\s+/g, '').trim();
  }
  
  next();
});

// Exportar modelo
module.exports = mongoose.model('Catequizando', catequizandoSchema);