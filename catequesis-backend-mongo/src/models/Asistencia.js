const mongoose = require('mongoose');

const asistenciaSchema = new mongoose.Schema({
  inscripcion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inscripcion',
    required: [true, 'La inscripción es requerida']
  },

  fecha: {
    type: Date,
    required: [true, 'La fecha es requerida'],
    default: Date.now
  },

  asistio: {
    type: Boolean,
    required: [true, 'El estado de asistencia es requerido']
  },

  // Información adicional de la clase
  tipoClase: {
    type: String,
    enum: ['regular', 'extraordinaria', 'examen', 'retiro', 'celebracion', 'evento'],
    default: 'regular'
  },

  tema: {
    type: String,
    trim: true,
    maxlength: [200, 'El tema no puede exceder 200 caracteres']
  },

  // Detalles de la asistencia
  detalles: {
    horaLlegada: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
    },

    horaSalida: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
    },

    llegadaTarde: {
      type: Boolean,
      default: false
    },

    salidaTemprana: {
      type: Boolean,
      default: false
    },

    // Motivo de ausencia (si no asistió)
    motivoAusencia: {
      type: String,
      enum: ['enfermedad', 'viaje', 'compromiso_familiar', 'clima', 'transporte', 'otro', 'no_justificada'],
      required: function() {
        return !this.asistio;
      }
    },

    // Justificación de la ausencia
    ausenciaJustificada: {
      type: Boolean,
      default: function() {
        return this.asistio || ['enfermedad', 'viaje', 'compromiso_familiar'].includes(this.detalles?.motivoAusencia);
      }
    }
  },

  // Participación en clase
  participacion: {
    participoEnClase: {
      type: Boolean,
      default: null // null = no evaluado, true = participó, false = no participó
    },

    nivelParticipacion: {
      type: String,
      enum: ['excelente', 'buena', 'regular', 'deficiente'],
      required: function() {
        return this.participacion?.participoEnClase === true;
      }
    },

    // Actividades realizadas
    actividades: [{
      nombre: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'El nombre de la actividad no puede exceder 100 caracteres']
      },
      completada: {
        type: Boolean,
        default: false
      },
      calificacion: {
        type: Number,
        min: [0, 'La calificación mínima es 0'],
        max: [100, 'La calificación máxima es 100']
      }
    }],

    // Comportamiento
    comportamiento: {
      type: String,
      enum: ['excelente', 'bueno', 'regular', 'necesita_mejora'],
      default: 'bueno'
    }
  },

  // Información del registro
  registro: {
    // Usuario que registró la asistencia
    registradoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El usuario que registra es requerido']
    },

    fechaRegistro: {
      type: Date,
      default: Date.now
    },

    // Método de registro
    metodoRegistro: {
      type: String,
      enum: ['manual', 'qr', 'lista', 'app'],
      default: 'manual'
    },

    // Geolocalización (opcional)
    ubicacion: {
      latitud: {
        type: Number,
        min: [-90, 'Latitud inválida'],
        max: [90, 'Latitud inválida']
      },
      longitud: {
        type: Number,
        min: [-180, 'Longitud inválida'],
        max: [180, 'Longitud inválida']
      }
    }
  },

  // Observaciones
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
    contenido: {
      type: String,
      required: true,
      trim: true,
      maxlength: [300, 'Las observaciones no pueden exceder 300 caracteres']
    },
    tipo: {
      type: String,
      enum: ['general', 'academica', 'conductual', 'salud'],
      default: 'general'
    }
  }],

  // Tareas y seguimiento
  tareas: [{
    descripcion: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'La descripción no puede exceder 200 caracteres']
    },
    entregada: {
      type: Boolean,
      default: false
    },
    fechaEntrega: {
      type: Date
    },
    calificacion: {
      type: Number,
      min: [0, 'La calificación mínima es 0'],
      max: [100, 'La calificación máxima es 100']
    },
    observaciones: {
      type: String,
      trim: true,
      maxlength: [200, 'Las observaciones no pueden exceder 200 caracteres']
    }
  }],

  // Notificaciones enviadas
  notificaciones: {
    ausenciaNotificada: {
      type: Boolean,
      default: false
    },
    fechaNotificacionAusencia: {
      type: Date
    },
    recordatorioEnviado: {
      type: Boolean,
      default: false
    },
    fechaRecordatorio: {
      type: Date
    }
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices
asistenciaSchema.index({ inscripcion: 1, fecha: 1 }, { unique: true });
asistenciaSchema.index({ fecha: 1 });
asistenciaSchema.index({ asistio: 1 });
asistenciaSchema.index({ tipoClase: 1 });
asistenciaSchema.index({ 'registro.registradoPor': 1 });

// Índice compuesto para reportes
asistenciaSchema.index({ inscripcion: 1, fecha: -1, asistio: 1 });

// Middleware pre-save
asistenciaSchema.pre('save', function(next) {
  // Validar que no se registre asistencia en fechas futuras (excepto para planificación)
  if (this.fecha > new Date() && this.tipoClase === 'regular') {
    return next(new Error('No se puede registrar asistencia en fechas futuras para clases regulares'));
  }

  // Validar horarios si asistió
  if (this.asistio && this.detalles?.horaLlegada && this.detalles?.horaSalida) {
    const llegada = this.detalles.horaLlegada.split(':').map(Number);
    const salida = this.detalles.horaSalida.split(':').map(Number);
    
    const minutosLlegada = llegada[0] * 60 + llegada[1];
    const minutosSalida = salida[0] * 60 + salida[1];
    
    if (minutosSalida <= minutosLlegada) {
      return next(new Error('La hora de salida debe ser posterior a la hora de llegada'));
    }
  }

  // Auto-determinar si llegó tarde o salió temprano (requiere obtener horarios del grupo)
  // Esto se puede implementar con populate en el middleware post
  
  next();
});

// Middleware post-save para actualizar estadísticas de inscripción
asistenciaSchema.post('save', async function(doc) {
  try {
    const Inscripcion = mongoose.model('Inscripcion');
    const inscripcion = await Inscripcion.findById(doc.inscripcion);
    
    if (inscripcion) {
      await inscripcion.actualizarAsistencia();
    }
  } catch (error) {
    console.error('Error actualizando estadísticas de inscripción:', error);
  }
});

// Middleware post-remove para actualizar estadísticas de inscripción
asistenciaSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const Inscripcion = mongoose.model('Inscripcion');
      const inscripcion = await Inscripcion.findById(doc.inscripcion);
      
      if (inscripcion) {
        await inscripcion.actualizarAsistencia();
      }
    } catch (error) {
      console.error('Error actualizando estadísticas tras eliminación:', error);
    }
  }
});

// Métodos de instancia
asistenciaSchema.methods.calcularDuracionPresencia = function() {
  if (!this.asistio || !this.detalles?.horaLlegada || !this.detalles?.horaSalida) {
    return 0;
  }
  
  const llegada = this.detalles.horaLlegada.split(':').map(Number);
  const salida = this.detalles.horaSalida.split(':').map(Number);
  
  const minutosLlegada = llegada[0] * 60 + llegada[1];
  const minutosSalida = salida[0] * 60 + salida[1];
  
  return minutosSalida - minutosLlegada; // Duración en minutos
};

asistenciaSchema.methods.agregarObservacion = function(contenido, usuario, tipo = 'general') {
  if (!this.observaciones) this.observaciones = [];
  
  this.observaciones.push({
    fecha: new Date(),
    usuario,
    contenido,
    tipo
  });
  
  return this.save();
};

asistenciaSchema.methods.registrarTarea = function(descripcion, entregada = false, calificacion = null, observaciones = null) {
  if (!this.tareas) this.tareas = [];
  
  const tarea = {
    descripcion,
    entregada,
    observaciones
  };
  
  if (entregada) {
    tarea.fechaEntrega = new Date();
    if (calificacion !== null) {
      tarea.calificacion = calificacion;
    }
  }
  
  this.tareas.push(tarea);
  return this.save();
};

asistenciaSchema.methods.marcarNotificacionEnviada = function(tipo) {
  if (!this.notificaciones) this.notificaciones = {};
  
  switch (tipo) {
    case 'ausencia':
      this.notificaciones.ausenciaNotificada = true;
      this.notificaciones.fechaNotificacionAusencia = new Date();
      break;
    case 'recordatorio':
      this.notificaciones.recordatorioEnviado = true;
      this.notificaciones.fechaRecordatorio = new Date();
      break;
  }
  
  return this.save();
};

// Métodos estáticos
asistenciaSchema.statics.obtenerPorInscripcion = function(inscripcionId, fechaInicio = null, fechaFin = null) {
  const filtro = { inscripcion: inscripcionId };
  
  if (fechaInicio || fechaFin) {
    filtro.fecha = {};
    if (fechaInicio) filtro.fecha.$gte = new Date(fechaInicio);
    if (fechaFin) filtro.fecha.$lte = new Date(fechaFin);
  }
  
  return this.find(filtro)
    .populate('registro.registradoPor', 'datosPersonales.nombres datosPersonales.apellidos')
    .sort({ fecha: -1 });
};

asistenciaSchema.statics.obtenerPorGrupoYFecha = function(grupoId, fecha) {
  return this.aggregate([
    {
      $lookup: {
        from: 'inscripciones',
        localField: 'inscripcion',
        foreignField: '_id',
        as: 'inscripcionData'
      }
    },
    {
      $unwind: '$inscripcionData'
    },
    {
      $match: {
        'inscripcionData.grupo': new mongoose.Types.ObjectId(grupoId),
        fecha: {
          $gte: new Date(fecha + 'T00:00:00.000Z'),
          $lt: new Date(fecha + 'T23:59:59.999Z')
        }
      }
    },
    {
      $lookup: {
        from: 'catequizandos',
        localField: 'inscripcionData.catequizando',
        foreignField: '_id',
        as: 'catequizando'
      }
    },
    {
      $unwind: '$catequizando'
    },
    {
      $sort: {
        'catequizando.apellidos': 1,
        'catequizando.nombres': 1
      }
    }
  ]);
};

asistenciaSchema.statics.obtenerEstadisticasPorGrupo = function(grupoId, fechaInicio = null, fechaFin = null) {
  const matchStage = {
    $lookup: {
      from: 'inscripciones',
      localField: 'inscripcion',
      foreignField: '_id',
      as: 'inscripcionData'
    }
  };
  
  const pipeline = [
    matchStage,
    {
      $unwind: '$inscripcionData'
    },
    {
      $match: {
        'inscripcionData.grupo': new mongoose.Types.ObjectId(grupoId)
      }
    }
  ];
  
  // Agregar filtro de fechas si se especifica
  if (fechaInicio || fechaFin) {
    const fechaMatch = {};
    if (fechaInicio) fechaMatch.$gte = new Date(fechaInicio);
    if (fechaFin) fechaMatch.$lte = new Date(fechaFin);
    
    pipeline.push({
      $match: { fecha: fechaMatch }
    });
  }
  
  pipeline.push(
    {
      $group: {
        _id: null,
        totalRegistros: { $sum: 1 },
        totalAsistencias: { $sum: { $cond: ['$asistio', 1, 0] } },
        totalAusencias: { $sum: { $cond: ['$asistio', 0, 1] } },
        ausenciasJustificadas: { $sum: { $cond: ['$detalles.ausenciaJustificada', 1, 0] } },
        llegadasTarde: { $sum: { $cond: ['$detalles.llegadaTarde', 1, 0] } },
        salidasTempranas: { $sum: { $cond: ['$detalles.salidaTemprana', 1, 0] } },
        fechas: { $addToSet: '$fecha' },
        catequizandos: { $addToSet: '$inscripcionData.catequizando' }
      }
    },
    {
      $project: {
        _id: 0,
        totalRegistros: 1,
        totalAsistencias: 1,
        totalAusencias: 1,
        ausenciasJustificadas: 1,
        llegadasTarde: 1,
        salidasTempranas: 1,
        totalFechas: { $size: '$fechas' },
        totalCatequizandos: { $size: '$catequizandos' },
        porcentajeAsistencia: {
          $round: [
            { $multiply: [{ $divide: ['$totalAsistencias', '$totalRegistros'] }, 100] },
            2
          ]
        },
        promedioAsistenciaPorFecha: {
          $round: [
            { $divide: ['$totalAsistencias', { $size: '$fechas' }] },
            2
          ]
        }
      }
    }
  );
  
  return this.aggregate(pipeline);
};

asistenciaSchema.statics.obtenerReporteAsistencia = function(filtros = {}) {
  const pipeline = [
    {
      $lookup: {
        from: 'inscripciones',
        localField: 'inscripcion',
        foreignField: '_id',
        as: 'inscripcionData'
      }
    },
    {
      $unwind: '$inscripcionData'
    },
    {
      $lookup: {
        from: 'catequizandos',
        localField: 'inscripcionData.catequizando',
        foreignField: '_id',
        as: 'catequizando'
      }
    },
    {
      $unwind: '$catequizando'
    },
    {
      $lookup: {
        from: 'grupos',
        localField: 'inscripcionData.grupo',
        foreignField: '_id',
        as: 'grupo'
      }
    },
    {
      $unwind: '$grupo'
    },
    {
      $lookup: {
        from: 'parroquias',
        localField: 'inscripcionData.parroquia',
        foreignField: '_id',
        as: 'parroquia'
      }
    },
    {
      $unwind: '$parroquia'
    }
  ];
  
  // Aplicar filtros
  if (Object.keys(filtros).length > 0) {
    pipeline.push({ $match: filtros });
  }
  
  pipeline.push(
    {
      $group: {
        _id: {
          catequizando: '$inscripcionData.catequizando',
          grupo: '$inscripcionData.grupo',
          parroquia: '$inscripcionData.parroquia'
        },
        nombreCatequizando: { $first: { $concat: ['$catequizando.nombres', ' ', '$catequizando.apellidos'] } },
        documentoIdentidad: { $first: '$catequizando.documentoIdentidad' },
        nombreGrupo: { $first: '$grupo.nombre' },
        nombreParroquia: { $first: '$parroquia.nombre' },
        totalClases: { $sum: 1 },
        clasesAsistidas: { $sum: { $cond: ['$asistio', 1, 0] } },
        ausenciasJustificadas: { $sum: { $cond: [{ $and: [{ $eq: ['$asistio', false] }, '$detalles.ausenciaJustificada'] }, 1, 0] } },
        llegadasTarde: { $sum: { $cond: ['$detalles.llegadaTarde', 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        catequizandoId: '$_id.catequizando',
        grupoId: '$_id.grupo',
        parroquiaId: '$_id.parroquia',
        nombreCatequizando: 1,
        documentoIdentidad: 1,
        nombreGrupo: 1,
        nombreParroquia: 1,
        totalClases: 1,
        clasesAsistidas: 1,
        ausenciasJustificadas: 1,
        llegadasTarde: 1,
        porcentajeAsistencia: {
          $round: [
            { $multiply: [{ $divide: ['$clasesAsistidas', '$totalClases'] }, 100] },
            2
          ]
        }
      }
    },
    {
      $sort: {
        nombreParroquia: 1,
        nombreGrupo: 1,
        nombreCatequizando: 1
      }
    }
  );
  
  return this.aggregate(pipeline);
};

asistenciaSchema.statics.obtenerAusenciasPorNotificar = function() {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(0, 0, 0, 0);
  
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  
  return this.find({
    fecha: { $gte: ayer, $lte: hoy },
    asistio: false,
    'notificaciones.ausenciaNotificada': { $ne: true }
  })
    .populate({
      path: 'inscripcion',
      populate: [
        { path: 'catequizando', select: 'nombres apellidos familia.representantes' },
        { path: 'grupo', select: 'nombre' },
        { path: 'parroquia', select: 'nombre' }
      ]
    });
};

// Virtuals
asistenciaSchema.virtual('duracionPresencia').get(function() {
  return this.calcularDuracionPresencia();
});

asistenciaSchema.virtual('esAusenciaJustificada').get(function() {
  return !this.asistio && this.detalles?.ausenciaJustificada;
});

asistenciaSchema.virtual('resumenParticipacion').get(function() {
  if (!this.asistio) return 'Ausente';
  
  const partes = [];
  
  if (this.participacion?.nivelParticipacion) {
    partes.push(`Participación: ${this.participacion.nivelParticipacion}`);
  }
  
  if (this.participacion?.comportamiento) {
    partes.push(`Comportamiento: ${this.participacion.comportamiento}`);
  }
  
  return partes.length > 0 ? partes.join(', ') : 'Presente';
});

module.exports = mongoose.model('Asistencia', asistenciaSchema);