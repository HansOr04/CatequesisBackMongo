const mongoose = require('mongoose');

const inscripcionSchema = new mongoose.Schema({
  catequizando: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Catequizando',
    required: [true, 'El catequizando es requerido']
  },

  grupo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grupo',
    required: [true, 'El grupo es requerido']
  },

  parroquia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parroquia',
    required: [true, 'La parroquia es requerida']
  },

  // Fechas importantes
  fechaInscripcion: {
    type: Date,
    required: [true, 'La fecha de inscripción es requerida'],
    default: Date.now
  },

  fechaInicio: {
    type: Date,
    required: function() {
      return this.activa;
    }
  },

  fechaFin: {
    type: Date,
    validate: {
      validator: function(fecha) {
        return !this.fechaInicio || !fecha || fecha > this.fechaInicio;
      },
      message: 'La fecha de fin debe ser posterior a la fecha de inicio'
    }
  },

  // Estado de la inscripción
  activa: {
    type: Boolean,
    default: true
  },

  estado: {
    type: String,
    enum: ['pendiente', 'activa', 'suspendida', 'completada', 'retirada'],
    default: 'pendiente'
  },

  motivoEstado: {
    type: String,
    trim: true,
    maxlength: [200, 'El motivo no puede exceder 200 caracteres'],
    required: function() {
      return ['suspendida', 'retirada'].includes(this.estado);
    }
  },

  // Información de pagos
  pagos: {
    inscripcion: {
      monto: {
        type: Number,
        min: [0, 'El monto no puede ser negativo'],
        default: 0
      },
      pagado: {
        type: Boolean,
        default: false
      },
      fechaPago: {
        type: Date
      },
      metodoPago: {
        type: String,
        enum: ['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro']
      },
      comprobante: {
        type: String,
        trim: true
      }
    },

    materiales: {
      monto: {
        type: Number,
        min: [0, 'El monto no puede ser negativo'],
        default: 0
      },
      pagado: {
        type: Boolean,
        default: false
      },
      fechaPago: {
        type: Date
      },
      metodoPago: {
        type: String,
        enum: ['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro']
      },
      comprobante: {
        type: String,
        trim: true
      }
    },

    otros: [{
      concepto: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'El concepto no puede exceder 100 caracteres']
      },
      monto: {
        type: Number,
        required: true,
        min: [0, 'El monto no puede ser negativo']
      },
      pagado: {
        type: Boolean,
        default: false
      },
      fechaPago: {
        type: Date
      },
      metodoPago: {
        type: String,
        enum: ['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro']
      },
      comprobante: {
        type: String,
        trim: true
      }
    }]
  },

  // Evaluación y progreso
  evaluacion: {
    // Asistencia
    asistencia: {
      totalClases: { type: Number, default: 0 },
      clasesAsistidas: { type: Number, default: 0 },
      porcentajeAsistencia: { type: Number, default: 0 }
    },

    // Calificaciones
    calificaciones: [{
      concepto: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'El concepto no puede exceder 100 caracteres']
      },
      calificacion: {
        type: Number,
        required: true,
        min: [0, 'La calificación mínima es 0'],
        max: [100, 'La calificación máxima es 100']
      },
      fecha: {
        type: Date,
        required: true
      },
      observaciones: {
        type: String,
        trim: true,
        maxlength: [200, 'Las observaciones no pueden exceder 200 caracteres']
      }
    }],

    // Nota final
    notaFinal: {
      type: Number,
      min: [0, 'La nota final mínima es 0'],
      max: [100, 'La nota final máxima es 100']
    },

    aprobado: {
      type: Boolean,
      default: null // null = no evaluado, true = aprobado, false = reprobado
    },

    fechaEvaluacion: {
      type: Date
    }
  },

  // Documentos y certificaciones
  documentos: [{
    tipo: {
      type: String,
      enum: ['comprobante_pago', 'certificado_bautismo', 'autorizacion', 'evaluacion', 'otro'],
      required: true
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'El nombre no puede exceder 100 caracteres']
    },
    url: {
      type: String,
      required: true,
      match: [/^https?:\/\/.+/, 'URL inválida']
    },
    fechaSubida: {
      type: Date,
      default: Date.now
    }
  }],

  // Observaciones y notas
  observaciones: [{
    fecha: {
      type: Date,
      default: Date.now
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    tipo: {
      type: String,
      enum: ['general', 'academica', 'conductual', 'administrativa'],
      default: 'general'
    },
    contenido: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'El contenido no puede exceder 500 caracteres']
    },
    privada: {
      type: Boolean,
      default: false // Si es privada, solo la ven catequistas y administradores
    }
  }],

  // Seguimiento especial
  seguimiento: {
    requiereAtencionEspecial: {
      type: Boolean,
      default: false
    },

    motivoAtencion: {
      type: String,
      trim: true,
      maxlength: [200, 'El motivo no puede exceder 200 caracteres'],
      required: function() {
        return this.seguimiento?.requiereAtencionEspecial;
      }
    },

    responsable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },

    ultimaRevision: {
      type: Date
    }
  },

  // Información del proceso de inscripción
  proceso: {
    // Usuario que registró la inscripción
    registradoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },

    // Documentos presentados al momento de inscripción
    documentosPresentados: [{
      tipo: {
        type: String,
        enum: ['certificado_bautismo', 'cedula_representante', 'foto_catequizando', 'autorizacion_medica'],
        required: true
      },
      presentado: {
        type: Boolean,
        default: false
      },
      observaciones: {
        type: String,
        trim: true,
        maxlength: [100, 'Las observaciones no pueden exceder 100 caracteres']
      }
    }],

    // Validaciones realizadas
    validaciones: {
      edad: { realizada: { type: Boolean, default: false }, aprobada: { type: Boolean } },
      documentos: { realizada: { type: Boolean, default: false }, aprobada: { type: Boolean } },
      bautismo: { realizada: { type: Boolean, default: false }, aprobada: { type: Boolean } },
      nivelAnterior: { realizada: { type: Boolean, default: false }, aprobada: { type: Boolean } }
    },

    // Aprobación final
    aprobacionFinal: {
      aprobada: { type: Boolean, default: false },
      fechaAprobacion: { type: Date },
      aprobadaPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
      }
    }
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices
inscripcionSchema.index({ catequizando: 1, grupo: 1 }, { unique: true });
inscripcionSchema.index({ grupo: 1, activa: 1 });
inscripcionSchema.index({ parroquia: 1, activa: 1 });
inscripcionSchema.index({ estado: 1 });
inscripcionSchema.index({ fechaInscripcion: -1 });
inscripcionSchema.index({ 'pagos.inscripcion.pagado': 1 });
inscripcionSchema.index({ 'evaluacion.aprobado': 1 });

// Middleware pre-save
inscripcionSchema.pre('save', function(next) {
  // Calcular porcentaje de asistencia
  if (this.evaluacion?.asistencia?.totalClases > 0) {
    const porcentaje = (this.evaluacion.asistencia.clasesAsistidas / this.evaluacion.asistencia.totalClases) * 100;
    this.evaluacion.asistencia.porcentajeAsistencia = Math.round(porcentaje * 100) / 100;
  }

  // Determinar aprobación basada en criterios
  if (this.evaluacion?.notaFinal !== undefined && this.evaluacion?.notaFinal !== null) {
    const notaMinima = 70; // Configurable por nivel
    const asistenciaMinima = 80; // Configurable por grupo
    
    const aproboNota = this.evaluacion.notaFinal >= notaMinima;
    const aproboAsistencia = this.evaluacion.asistencia.porcentajeAsistencia >= asistenciaMinima;
    
    this.evaluacion.aprobado = aproboNota && aproboAsistencia;
    
    if (!this.evaluacion.fechaEvaluacion) {
      this.evaluacion.fechaEvaluacion = new Date();
    }
  }

  next();
});

// Métodos de instancia
inscripcionSchema.methods.calcularMontoTotal = function() {
  let total = 0;
  
  if (this.pagos?.inscripcion?.monto) {
    total += this.pagos.inscripcion.monto;
  }
  
  if (this.pagos?.materiales?.monto) {
    total += this.pagos.materiales.monto;
  }
  
  if (this.pagos?.otros?.length > 0) {
    total += this.pagos.otros.reduce((sum, pago) => sum + pago.monto, 0);
  }
  
  return total;
};

inscripcionSchema.methods.calcularMontoPagado = function() {
  let pagado = 0;
  
  if (this.pagos?.inscripcion?.pagado && this.pagos.inscripcion.monto) {
    pagado += this.pagos.inscripcion.monto;
  }
  
  if (this.pagos?.materiales?.pagado && this.pagos.materiales.monto) {
    pagado += this.pagos.materiales.monto;
  }
  
  if (this.pagos?.otros?.length > 0) {
    pagado += this.pagos.otros
      .filter(pago => pago.pagado)
      .reduce((sum, pago) => sum + pago.monto, 0);
  }
  
  return pagado;
};

inscripcionSchema.methods.estaPagadaCompleta = function() {
  const total = this.calcularMontoTotal();
  const pagado = this.calcularMontoPagado();
  return total === 0 || pagado >= total;
};

inscripcionSchema.methods.registrarPago = function(tipo, monto, metodoPago, comprobante = null) {
  const fecha = new Date();
  
  switch (tipo) {
    case 'inscripcion':
      this.pagos.inscripcion = {
        monto,
        pagado: true,
        fechaPago: fecha,
        metodoPago,
        comprobante
      };
      break;
      
    case 'materiales':
      this.pagos.materiales = {
        monto,
        pagado: true,
        fechaPago: fecha,
        metodoPago,
        comprobante
      };
      break;
      
    default:
      // Para otros conceptos
      if (!this.pagos.otros) this.pagos.otros = [];
      this.pagos.otros.push({
        concepto: tipo,
        monto,
        pagado: true,
        fechaPago: fecha,
        metodoPago,
        comprobante
      });
  }
  
  return this.save();
};

inscripcionSchema.methods.agregarObservacion = function(contenido, usuario, tipo = 'general', privada = false) {
  if (!this.observaciones) this.observaciones = [];
  
  this.observaciones.push({
    fecha: new Date(),
    usuario,
    tipo,
    contenido,
    privada
  });
  
  return this.save();
};

inscripcionSchema.methods.actualizarAsistencia = async function() {
  try {
    const Asistencia = mongoose.model('Asistencia');
    
    const asistencias = await Asistencia.find({ inscripcion: this._id });
    
    const totalClases = asistencias.length;
    const clasesAsistidas = asistencias.filter(a => a.asistio).length;
    
    this.evaluacion.asistencia = {
      totalClases,
      clasesAsistidas,
      porcentajeAsistencia: totalClases > 0 ? Math.round((clasesAsistidas / totalClases) * 10000) / 100 : 0
    };
    
    return this.save();
  } catch (error) {
    console.error('Error actualizando asistencia:', error);
    throw error;
  }
};

inscripcionSchema.methods.calcularNotaFinal = function() {
  if (!this.evaluacion?.calificaciones?.length) return null;
  
  const suma = this.evaluacion.calificaciones.reduce((total, cal) => total + cal.calificacion, 0);
  const promedio = suma / this.evaluacion.calificaciones.length;
  
  this.evaluacion.notaFinal = Math.round(promedio * 100) / 100;
  return this.evaluacion.notaFinal;
};

inscripcionSchema.methods.cambiarEstado = function(nuevoEstado, motivo = null, usuario = null) {
  this.estado = nuevoEstado;
  
  if (motivo) {
    this.motivoEstado = motivo;
  }
  
  if (['suspendida', 'retirada', 'completada'].includes(nuevoEstado)) {
    this.activa = false;
    this.fechaFin = new Date();
  }
  
  // Agregar observación del cambio de estado
  if (usuario) {
    this.agregarObservacion(
      `Estado cambiado a: ${nuevoEstado}${motivo ? `. Motivo: ${motivo}` : ''}`,
      usuario,
      'administrativa',
      false
    );
  }
  
  return this.save();
};

// Métodos estáticos
inscripcionSchema.statics.obtenerPorGrupo = function(grupoId, activas = null) {
  const filtro = { grupo: grupoId };
  
  if (activas !== null) {
    filtro.activa = activas;
  }
  
  return this.find(filtro)
    .populate('catequizando', 'nombres apellidos documentoIdentidad fechaNacimiento')
    .sort({ 'catequizando.apellidos': 1, 'catequizando.nombres': 1 });
};

inscripcionSchema.statics.obtenerPorCatequizando = function(catequizandoId) {
  return this.find({ catequizando: catequizandoId })
    .populate('grupo', 'nombre periodo')
    .populate('parroquia', 'nombre')
    .sort({ fechaInscripcion: -1 });
};

inscripcionSchema.statics.obtenerPendientesDePago = function(filtros = {}) {
  const pipeline = [
    {
      $match: {
        activa: true,
        ...filtros,
        $or: [
          { 'pagos.inscripcion.pagado': false, 'pagos.inscripcion.monto': { $gt: 0 } },
          { 'pagos.materiales.pagado': false, 'pagos.materiales.monto': { $gt: 0 } },
          { 'pagos.otros': { $elemMatch: { pagado: false, monto: { $gt: 0 } } } }
        ]
      }
    },
    {
      $lookup: {
        from: 'catequizandos',
        localField: 'catequizando',
        foreignField: '_id',
        as: 'catequizando'
      }
    },
    {
      $lookup: {
        from: 'grupos',
        localField: 'grupo',
        foreignField: '_id',
        as: 'grupo'
      }
    },
    {
      $lookup: {
        from: 'parroquias',
        localField: 'parroquia',
        foreignField: '_id',
        as: 'parroquia'
      }
    },
    {
      $unwind: '$catequizando'
    },
    {
      $unwind: '$grupo'
    },
    {
      $unwind: '$parroquia'
    },
    {
      $sort: {
        fechaInscripcion: 1
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

inscripcionSchema.statics.obtenerEstadisticas = function(filtros = {}) {
  const pipeline = [
    { $match: filtros },
    {
      $group: {
        _id: null,
        totalInscripciones: { $sum: 1 },
        activas: { $sum: { $cond: ['$activa', 1, 0] } },
        pendientes: { $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, 1, 0] } },
        suspendidas: { $sum: { $cond: [{ $eq: ['$estado', 'suspendida'] }, 1, 0] } },
        completadas: { $sum: { $cond: [{ $eq: ['$estado', 'completada'] }, 1, 0] } },
        retiradas: { $sum: { $cond: [{ $eq: ['$estado', 'retirada'] }, 1, 0] } },
        aprobados: { $sum: { $cond: ['$evaluacion.aprobado', 1, 0] } },
        reprobados: { $sum: { $cond: [{ $eq: ['$evaluacion.aprobado', false] }, 1, 0] } },
        pagosPendientes: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $and: [{ $gt: ['$pagos.inscripcion.monto', 0] }, { $eq: ['$pagos.inscripcion.pagado', false] }] },
                  { $and: [{ $gt: ['$pagos.materiales.monto', 0] }, { $eq: ['$pagos.materiales.pagado', false] }] }
                ]
              },
              1,
              0
            ]
          }
        },
        promedioAsistencia: { $avg: '$evaluacion.asistencia.porcentajeAsistencia' },
        promedioNota: { $avg: '$evaluacion.notaFinal' }
      }
    },
    {
      $project: {
        _id: 0,
        totalInscripciones: 1,
        activas: 1,
        pendientes: 1,
        suspendidas: 1,
        completadas: 1,
        retiradas: 1,
        aprobados: 1,
        reprobados: 1,
        pagosPendientes: 1,
        promedioAsistencia: { $round: ['$promedioAsistencia', 2] },
        promedioNota: { $round: ['$promedioNota', 2] },
        tasaAprobacion: {
          $round: [
            { $multiply: [{ $divide: ['$aprobados', { $add: ['$aprobados', '$reprobados'] }] }, 100] },
            2
          ]
        }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Virtuals
inscripcionSchema.virtual('montoTotal').get(function() {
  return this.calcularMontoTotal();
});

inscripcionSchema.virtual('montoPagado').get(function() {
  return this.calcularMontoPagado();
});

inscripcionSchema.virtual('montoPendiente').get(function() {
  return this.calcularMontoTotal() - this.calcularMontoPagado();
});

inscripcionSchema.virtual('diasInscritos').get(function() {
  const inicio = this.fechaInicio || this.fechaInscripcion;
  const fin = this.fechaFin || new Date();
  
  return Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));
});

// Populate virtuals
inscripcionSchema.virtual('asistencias', {
  ref: 'Asistencia',
  localField: '_id',
  foreignField: 'inscripcion'
});

module.exports = mongoose.model('Inscripcion', inscripcionSchema);