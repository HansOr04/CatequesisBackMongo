    const mongoose = require('mongoose');

const grupoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del grupo es requerido'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [50, 'El nombre no puede exceder 50 caracteres']
  },

  parroquia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parroquia',
    required: [true, 'La parroquia es requerida']
  },

  nivel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Nivel',
    required: [true, 'El nivel es requerido']
  },

  periodo: {
    type: String,
    required: [true, 'El periodo es requerido'],
    match: [/^\d{4}(-\d{4})?$/, 'El periodo debe tener formato YYYY o YYYY-YYYY'],
    default: () => new Date().getFullYear().toString()
  },

  // Información del grupo
  informacion: {
    descripcion: {
      type: String,
      trim: true,
      maxlength: [500, 'La descripción no puede exceder 500 caracteres']
    },

    objetivos: [{
      descripcion: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'El objetivo no puede exceder 200 caracteres']
      },
      cumplido: {
        type: Boolean,
        default: false
      }
    }],

    capacidadMaxima: {
      type: Number,
      min: [5, 'La capacidad mínima es 5 catequizandos'],
      max: [50, 'La capacidad máxima es 50 catequizandos'],
      default: 25
    },

    edadMinima: {
      type: Number,
      min: [4, 'La edad mínima es 4 años'],
      max: [99, 'La edad máxima es 99 años']
    },

    edadMaxima: {
      type: Number,
      min: [4, 'La edad mínima es 4 años'],
      max: [99, 'La edad máxima es 99 años']
    }
  },

  // Horarios y ubicación
  horarios: {
    diaSemana: {
      type: String,
      enum: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
      required: [true, 'El día de la semana es requerido']
    },

    horaInicio: {
      type: String,
      required: [true, 'La hora de inicio es requerida'],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
    },

    horaFin: {
      type: String,
      required: [true, 'La hora de fin es requerida'],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
    },

    salon: {
      nombre: {
        type: String,
        trim: true,
        maxlength: [50, 'El nombre del salón no puede exceder 50 caracteres']
      },
      ubicacion: {
        type: String,
        trim: true,
        maxlength: [100, 'La ubicación no puede exceder 100 caracteres']
      },
      capacidad: {
        type: Number,
        min: [1, 'La capacidad mínima es 1'],
        max: [100, 'La capacidad máxima es 100']
      }
    }
  },

  // Catequistas asignados
  catequistas: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    rol: {
      type: String,
      enum: ['coordinador', 'catequista', 'auxiliar'],
      default: 'catequista'
    },
    fechaAsignacion: {
      type: Date,
      default: Date.now
    },
    activo: {
      type: Boolean,
      default: true
    }
  }],

  // Fechas importantes
  fechas: {
    inicioClases: {
      type: Date,
      required: [true, 'La fecha de inicio es requerida']
    },

    finClases: {
      type: Date,
      required: [true, 'La fecha de fin es requerida'],
      validate: {
        validator: function(fecha) {
          return !this.fechas?.inicioClases || fecha > this.fechas.inicioClases;
        },
        message: 'La fecha de fin debe ser posterior a la fecha de inicio'
      }
    },

    fechasEspeciales: [{
      tipo: {
        type: String,
        enum: ['suspension', 'evento', 'examen', 'retiro', 'celebracion'],
        required: true
      },
      fecha: {
        type: Date,
        required: true
      },
      descripcion: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'La descripción no puede exceder 200 caracteres']
      },
      todoElDia: {
        type: Boolean,
        default: false
      },
      horaInicio: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido']
      },
      horaFin: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido']
      }
    }],

    vacaciones: [{
      fechaInicio: {
        type: Date,
        required: true
      },
      fechaFin: {
        type: Date,
        required: true
      },
      motivo: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'El motivo no puede exceder 100 caracteres']
      }
    }]
  },

  // Configuración del grupo
  configuracion: {
    // Costos específicos del grupo
    costoInscripcion: {
      type: Number,
      min: [0, 'El costo no puede ser negativo'],
      default: 0
    },

    costoMateriales: {
      type: Number,
      min: [0, 'El costo no puede ser negativo'],
      default: 0
    },

    // Requisitos de asistencia
    asistenciaMinima: {
      type: Number,
      min: [50, 'La asistencia mínima es 50%'],
      max: [100, 'La asistencia máxima es 100%'],
      default: 80
    },

    // Notificaciones
    notificaciones: {
      recordatorioClases: { type: Boolean, default: true },
      notificarAusencias: { type: Boolean, default: true },
      notificarEventos: { type: Boolean, default: true }
    },

    // Permisos especiales
    permiteInscripcionesTardias: {
      type: Boolean,
      default: false
    },

    fechaLimiteInscripcion: {
      type: Date
    }
  },

  // Estado del grupo
  estado: {
    activo: {
      type: Boolean,
      default: true
    },

    estadoClases: {
      type: String,
      enum: ['planificacion', 'activo', 'suspendido', 'finalizado'],
      default: 'planificacion'
    },

    fechaCambioEstado: {
      type: Date,
      default: Date.now
    },

    motivoSuspension: {
      type: String,
      trim: true,
      maxlength: [200, 'El motivo no puede exceder 200 caracteres'],
      required: function() {
        return this.estado?.estadoClases === 'suspendido';
      }
    }
  },

  // Estadísticas del grupo
  estadisticas: {
    totalInscripciones: { type: Number, default: 0 },
    inscripcionesActivas: { type: Number, default: 0 },
    promedioAsistencia: { type: Number, default: 0 },
    promedioEdad: { type: Number, default: 0 },
    totalClasesImpartidas: { type: Number, default: 0 },
    ultimaActualizacion: { type: Date, default: Date.now }
  },

  // Recursos y materiales
  recursos: [{
    tipo: {
      type: String,
      enum: ['libro', 'manual', 'video', 'audio', 'imagen', 'documento', 'link'],
      required: true
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'El nombre no puede exceder 100 caracteres']
    },
    descripcion: {
      type: String,
      trim: true,
      maxlength: [200, 'La descripción no puede exceder 200 caracteres']
    },
    url: {
      type: String,
      match: [/^https?:\/\/.+/, 'URL inválida']
    },
    obligatorio: {
      type: Boolean,
      default: false
    },
    fechaAñadido: {
      type: Date,
      default: Date.now
    }
  }],

  // Observaciones y notas
  observaciones: {
    type: String,
    trim: true,
    maxlength: [1000, 'Las observaciones no pueden exceder 1000 caracteres']
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices
grupoSchema.index({ parroquia: 1, nivel: 1, periodo: 1 });
grupoSchema.index({ parroquia: 1, nombre: 1, periodo: 1 }, { unique: true });
grupoSchema.index({ 'estado.activo': 1 });
grupoSchema.index({ 'estado.estadoClases': 1 });
grupoSchema.index({ 'horarios.diaSemana': 1 });
grupoSchema.index({ periodo: 1 });

// Validaciones personalizadas
grupoSchema.pre('validate', function(next) {
  // Validar que hora fin sea mayor que hora inicio
  if (this.horarios?.horaInicio && this.horarios?.horaFin) {
    const inicio = this.horarios.horaInicio.split(':').map(Number);
    const fin = this.horarios.horaFin.split(':').map(Number);
    
    const minutosInicio = inicio[0] * 60 + inicio[1];
    const minutosFin = fin[0] * 60 + fin[1];
    
    if (minutosFin <= minutosInicio) {
      this.invalidate('horarios.horaFin', 'La hora de fin debe ser posterior a la hora de inicio');
    }
  }
  
  // Validar edades si están definidas
  if (this.informacion?.edadMinima && this.informacion?.edadMaxima) {
    if (this.informacion.edadMaxima < this.informacion.edadMinima) {
      this.invalidate('informacion.edadMaxima', 'La edad máxima debe ser mayor o igual a la edad mínima');
    }
  }
  
  next();
});

// Middleware para verificar coordinador único
grupoSchema.pre('save', function(next) {
  if (this.catequistas?.length > 0) {
    const coordinadores = this.catequistas.filter(cat => cat.rol === 'coordinador' && cat.activo);
    
    if (coordinadores.length > 1) {
      return next(new Error('Solo puede haber un coordinador activo por grupo'));
    }
  }
  next();
});

// Métodos de instancia
grupoSchema.methods.obtenerCoordinador = function() {
  return this.catequistas?.find(cat => cat.rol === 'coordinador' && cat.activo);
};

grupoSchema.methods.obtenerCatequistasActivos = function() {
  return this.catequistas?.filter(cat => cat.activo) || [];
};

grupoSchema.methods.asignarCatequista = function(usuarioId, rol = 'catequista') {
  // Verificar si ya está asignado
  const existente = this.catequistas.find(cat => 
    cat.usuario.toString() === usuarioId.toString() && cat.activo
  );
  
  if (existente) {
    throw new Error('El usuario ya está asignado a este grupo');
  }
  
  // Si es coordinador, desactivar coordinador actual
  if (rol === 'coordinador') {
    const coordinadorActual = this.obtenerCoordinador();
    if (coordinadorActual) {
      coordinadorActual.activo = false;
    }
  }
  
  this.catequistas.push({
    usuario: usuarioId,
    rol: rol,
    fechaAsignacion: new Date(),
    activo: true
  });
  
  return this.save();
};

grupoSchema.methods.removerCatequista = function(usuarioId) {
  const catequista = this.catequistas.find(cat => 
    cat.usuario.toString() === usuarioId.toString() && cat.activo
  );
  
  if (!catequista) {
    throw new Error('El catequista no está asignado a este grupo');
  }
  
  catequista.activo = false;
  return this.save();
};

grupoSchema.methods.estaEnHorario = function(fecha = new Date()) {
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaActual = diasSemana[fecha.getDay()];
  
  if (diaActual !== this.horarios?.diaSemana) {
    return false;
  }
  
  const horaActual = fecha.toTimeString().slice(0, 5); // HH:MM
  return horaActual >= this.horarios.horaInicio && horaActual <= this.horarios.horaFin;
};

grupoSchema.methods.tieneCapacidadDisponible = async function() {
  try {
    const Inscripcion = mongoose.model('Inscripcion');
    const inscripcionesActivas = await Inscripcion.countDocuments({
      grupo: this._id,
      activa: true
    });
    
    return inscripcionesActivas < (this.informacion?.capacidadMaxima || 25);
  } catch (error) {
    return true; // Si no se puede verificar, asumir que hay capacidad
  }
};

grupoSchema.methods.calcularProgresoClases = function() {
  const ahora = new Date();
  const inicio = new Date(this.fechas.inicioClases);
  const fin = new Date(this.fechas.finClases);
  
  if (ahora < inicio) {
    return { progreso: 0, estado: 'no_iniciado' };
  }
  
  if (ahora > fin) {
    return { progreso: 100, estado: 'finalizado' };
  }
  
  const duracionTotal = fin.getTime() - inicio.getTime();
  const transcurrido = ahora.getTime() - inicio.getTime();
  const progreso = Math.round((transcurrido / duracionTotal) * 100);
  
  return { progreso, estado: 'en_curso' };
};

grupoSchema.methods.obtenerProximaClase = function() {
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaObjetivo = diasSemana.indexOf(this.horarios.diaSemana);
  
  const ahora = new Date();
  const proximaClase = new Date(ahora);
  
  // Calcular días hasta el próximo día de clase
  let diasHasta = diaObjetivo - ahora.getDay();
  if (diasHasta <= 0) {
    diasHasta += 7; // Próxima semana
  }
  
  proximaClase.setDate(ahora.getDate() + diasHasta);
  
  // Establecer la hora
  const [hora, minuto] = this.horarios.horaInicio.split(':').map(Number);
  proximaClase.setHours(hora, minuto, 0, 0);
  
  return proximaClase;
};

grupoSchema.methods.actualizarEstadisticas = async function() {
  try {
    const Inscripcion = mongoose.model('Inscripcion');
    
    // Contar inscripciones
    const [totalInscripciones, inscripcionesActivas] = await Promise.all([
      Inscripcion.countDocuments({ grupo: this._id }),
      Inscripcion.countDocuments({ grupo: this._id, activa: true })
    ]);
    
    // Calcular promedio de edad
    let promedioEdad = 0;
    try {
      const inscripciones = await Inscripcion.find({ grupo: this._id, activa: true })
        .populate('catequizando', 'fechaNacimiento');
      
      if (inscripciones.length > 0) {
        const edades = inscripciones.map(ins => {
          const nacimiento = new Date(ins.catequizando.fechaNacimiento);
          const ahora = new Date();
          return ahora.getFullYear() - nacimiento.getFullYear();
        });
        
        promedioEdad = edades.reduce((sum, edad) => sum + edad, 0) / edades.length;
      }
    } catch (error) {
      promedioEdad = 0;
    }
    
    // Calcular promedio de asistencia
    let promedioAsistencia = 0;
    try {
      const Asistencia = mongoose.model('Asistencia');
      const asistencias = await Asistencia.aggregate([
        {
          $lookup: {
            from: 'inscripciones',
            localField: 'inscripcion',
            foreignField: '_id',
            as: 'inscripcion'
          }
        },
        {
          $match: {
            'inscripcion.grupo': this._id
          }
        },
        {
          $group: {
            _id: null,
            promedio: { $avg: { $cond: ['$asistio', 1, 0] } }
          }
        }
      ]);
      
      promedioAsistencia = asistencias[0]?.promedio * 100 || 0;
    } catch (error) {
      promedioAsistencia = 0;
    }
    
    this.estadisticas = {
      totalInscripciones,
      inscripcionesActivas,
      promedioAsistencia: Math.round(promedioAsistencia * 100) / 100,
      promedioEdad: Math.round(promedioEdad * 100) / 100,
      totalClasesImpartidas: this.estadisticas?.totalClasesImpartidas || 0,
      ultimaActualizacion: new Date()
    };
    
    return this.save();
  } catch (error) {
    console.error('Error actualizando estadísticas del grupo:', error);
    throw error;
  }
};

grupoSchema.methods.cambiarEstado = function(nuevoEstado, motivo = null) {
  this.estado.estadoClases = nuevoEstado;
  this.estado.fechaCambioEstado = new Date();
  
  if (nuevoEstado === 'suspendido' && motivo) {
    this.estado.motivoSuspension = motivo;
  } else {
    this.estado.motivoSuspension = undefined;
  }
  
  return this.save();
};

// Métodos estáticos
grupoSchema.statics.obtenerPorParroquia = function(parroquiaId, periodo = null) {
  const filtro = { parroquia: parroquiaId, 'estado.activo': true };
  
  if (periodo) {
    filtro.periodo = periodo;
  }
  
  return this.find(filtro)
    .populate('nivel', 'nombre orden')
    .populate('parroquia', 'nombre')
    .sort({ 'nivel.orden': 1, nombre: 1 });
};

grupoSchema.statics.obtenerPorNivel = function(nivelId, filtros = {}) {
  return this.find({ 
    nivel: nivelId, 
    'estado.activo': true,
    ...filtros 
  })
    .populate('parroquia', 'nombre')
    .populate('nivel', 'nombre orden')
    .sort({ periodo: -1, 'parroquia.nombre': 1, nombre: 1 });
};

grupoSchema.statics.obtenerActivos = function(filtros = {}) {
  return this.find({
    'estado.activo': true,
    'estado.estadoClases': { $in: ['activo', 'planificacion'] },
    ...filtros
  })
    .populate('parroquia', 'nombre')
    .populate('nivel', 'nombre orden')
    .sort({ periodo: -1, 'nivel.orden': 1, nombre: 1 });
};

grupoSchema.statics.buscarPorHorario = function(diaSemana, horaInicio = null, horaFin = null) {
  const filtro = { 
    'horarios.diaSemana': diaSemana,
    'estado.activo': true 
  };
  
  if (horaInicio && horaFin) {
    filtro.$or = [
      {
        'horarios.horaInicio': { $gte: horaInicio, $lte: horaFin }
      },
      {
        'horarios.horaFin': { $gte: horaInicio, $lte: horaFin }
      },
      {
        $and: [
          { 'horarios.horaInicio': { $lte: horaInicio } },
          { 'horarios.horaFin': { $gte: horaFin } }
        ]
      }
    ];
  }
  
  return this.find(filtro)
    .populate('parroquia', 'nombre')
    .populate('nivel', 'nombre orden')
    .sort({ 'horarios.horaInicio': 1 });
};

grupoSchema.statics.obtenerConConflictoHorario = function(parroquiaId, diaSemana, horaInicio, horaFin, excluirGrupoId = null) {
  const filtro = {
    parroquia: parroquiaId,
    'horarios.diaSemana': diaSemana,
    'estado.activo': true,
    $or: [
      {
        $and: [
          { 'horarios.horaInicio': { $lt: horaFin } },
          { 'horarios.horaFin': { $gt: horaInicio } }
        ]
      }
    ]
  };
  
  if (excluirGrupoId) {
    filtro._id = { $ne: excluirGrupoId };
  }
  
  return this.find(filtro);
};

grupoSchema.statics.obtenerEstadisticas = function(filtros = {}) {
  const pipeline = [
    { $match: { 'estado.activo': true, ...filtros } },
    {
      $group: {
        _id: null,
        totalGrupos: { $sum: 1 },
        gruposActivos: {
          $sum: { $cond: [{ $eq: ['$estado.estadoClases', 'activo'] }, 1, 0] }
        },
        gruposPlanificacion: {
          $sum: { $cond: [{ $eq: ['$estado.estadoClases', 'planificacion'] }, 1, 0] }
        },
        gruposSuspendidos: {
          $sum: { $cond: [{ $eq: ['$estado.estadoClases', 'suspendido'] }, 1, 0] }
        },
        gruposFinalizados: {
          $sum: { $cond: [{ $eq: ['$estado.estadoClases', 'finalizado'] }, 1, 0] }
        },
        totalInscripciones: { $sum: '$estadisticas.totalInscripciones' },
        inscripcionesActivas: { $sum: '$estadisticas.inscripcionesActivas' },
        promedioAsistenciaGeneral: { $avg: '$estadisticas.promedioAsistencia' },
        capacidadTotal: { $sum: '$informacion.capacidadMaxima' },
        distribucionPorDia: {
          $push: '$horarios.diaSemana'
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalGrupos: 1,
        gruposActivos: 1,
        gruposPlanificacion: 1,
        gruposSuspendidos: 1,
        gruposFinalizados: 1,
        totalInscripciones: 1,
        inscripcionesActivas: 1,
        promedioAsistenciaGeneral: { $round: ['$promedioAsistenciaGeneral', 2] },
        capacidadTotal: 1,
        ocupacion: {
          $round: [
            { $multiply: [{ $divide: ['$inscripcionesActivas', '$capacidadTotal'] }, 100] },
            2
          ]
        },
        diasMasPopulares: {
          $reduce: {
            input: '$distribucionPorDia',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$value',
                {
                  $arrayToObject: [[{
                    k: '$this',
                    v: { $add: [{ $ifNull: [{ $getField: { field: '$this', input: '$value' } }, 0] }, 1] }
                  }]]
                }
              ]
            }
          }
        }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

grupoSchema.statics.obtenerPorCatequista = function(usuarioId) {
  return this.find({
    'catequistas.usuario': usuarioId,
    'catequistas.activo': true,
    'estado.activo': true
  })
    .populate('parroquia', 'nombre')
    .populate('nivel', 'nombre orden')
    .sort({ periodo: -1, 'nivel.orden': 1, nombre: 1 });
};

grupoSchema.statics.obtenerProximasClases = function(dias = 7) {
  const ahora = new Date();
  const limite = new Date();
  limite.setDate(ahora.getDate() + dias);
  
  return this.find({
    'estado.estadoClases': 'activo',
    'fechas.inicioClases': { $lte: limite },
    'fechas.finClases': { $gte: ahora }
  })
    .populate('parroquia', 'nombre')
    .populate('nivel', 'nombre')
    .populate('catequistas.usuario', 'datosPersonales.nombres datosPersonales.apellidos');
};

// Virtuals
grupoSchema.virtual('nombreCompleto').get(function() {
  return `${this.nombre} - ${this.nivel?.nombre || 'Sin Nivel'} (${this.periodo})`;
});

grupoSchema.virtual('duracionClase').get(function() {
  if (!this.horarios?.horaInicio || !this.horarios?.horaFin) return 0;
  
  const inicio = this.horarios.horaInicio.split(':').map(Number);
  const fin = this.horarios.horaFin.split(':').map(Number);
  
  const minutosInicio = inicio[0] * 60 + inicio[1];
  const minutosFin = fin[0] * 60 + fin[1];
  
  return minutosFin - minutosInicio; // Duración en minutos
});

grupoSchema.virtual('horarioCompleto').get(function() {
  if (!this.horarios) return '';
  
  const dias = {
    'lunes': 'Lunes',
    'martes': 'Martes', 
    'miercoles': 'Miércoles',
    'jueves': 'Jueves',
    'viernes': 'Viernes',
    'sabado': 'Sábado',
    'domingo': 'Domingo'
  };
  
  const dia = dias[this.horarios.diaSemana] || this.horarios.diaSemana;
  return `${dia} ${this.horarios.horaInicio} - ${this.horarios.horaFin}`;
});

grupoSchema.virtual('porcentajeOcupacion').get(function() {
  const capacidad = this.informacion?.capacidadMaxima || 1;
  const inscripciones = this.estadisticas?.inscripcionesActivas || 0;
  return Math.round((inscripciones / capacidad) * 100);
});

// Populate virtuals
grupoSchema.virtual('inscripciones', {
  ref: 'Inscripcion',
  localField: '_id',
  foreignField: 'grupo'
});

grupoSchema.virtual('asistencias', {
  ref: 'Asistencia',
  localField: '_id',
  foreignField: 'grupo',
  options: { sort: { fecha: -1 } }
});

module.exports = mongoose.model('Grupo', grupoSchema);