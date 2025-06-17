const mongoose = require('mongoose');

const nivelSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del nivel es requerido'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [50, 'El nombre no puede exceder 50 caracteres'],
    unique: true
  },

  descripcion: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true,
    minlength: [5, 'La descripción debe tener al menos 5 caracteres'],
    maxlength: [500, 'La descripción no puede exceder 500 caracteres']
  },

  orden: {
    type: Number,
    required: [true, 'El orden es requerido'],
    min: [1, 'El orden debe ser mayor a 0'],
    max: [20, 'El orden no puede ser mayor a 20'],
    unique: true
  },

  // Configuración del nivel
  configuracion: {
    // Edad recomendada
    edadMinima: {
      type: Number,
      min: [4, 'La edad mínima no puede ser menor a 4 años'],
      max: [99, 'La edad mínima no puede ser mayor a 99 años'],
      default: 6
    },

    edadMaxima: {
      type: Number,
      min: [4, 'La edad máxima no puede ser menor a 4 años'],
      max: [99, 'La edad máxima no puede ser mayor a 99 años'],
      default: 99
    },

    // Duración del nivel
    duracion: {
      meses: {
        type: Number,
        min: [1, 'La duración mínima es 1 mes'],
        max: [24, 'La duración máxima es 24 meses'],
        default: 12
      },
      sesiones: {
        type: Number,
        min: [4, 'Mínimo 4 sesiones'],
        max: [100, 'Máximo 100 sesiones'],
        default: 30
      }
    },

    // Requisitos previos
    requiereNivelAnterior: {
      type: Boolean,
      default: function() {
        return this.orden > 1;
      }
    },

    requiereBautismo: {
      type: Boolean,
      default: function() {
        return this.orden > 1;
      }
    },

    // Certificaciones que otorga
    otorgaCertificado: {
      type: Boolean,
      default: true
    },

    // Sacramento asociado (si aplica)
    sacramentoAsociado: {
      type: String,
      enum: ['', 'primera_comunion', 'confirmacion', 'matrimonio'],
      default: ''
    }
  },

  // Contenido curricular
  contenido: {
    objetivos: [{
      descripcion: {
        type: String,
        required: true,
        maxlength: [200, 'El objetivo no puede exceder 200 caracteres']
      },
      tipo: {
        type: String,
        enum: ['general', 'especifico'],
        default: 'especifico'
      }
    }],

    temas: [{
      nombre: {
        type: String,
        required: true,
        maxlength: [100, 'El nombre del tema no puede exceder 100 caracteres']
      },
      descripcion: {
        type: String,
        maxlength: [300, 'La descripción del tema no puede exceder 300 caracteres']
      },
      sesionesEstimadas: {
        type: Number,
        min: [1, 'Mínimo 1 sesión'],
        max: [10, 'Máximo 10 sesiones'],
        default: 1
      },
      orden: {
        type: Number,
        required: true
      }
    }],

    recursos: [{
      tipo: {
        type: String,
        enum: ['libro', 'video', 'audio', 'documento', 'actividad'],
        required: true
      },
      nombre: {
        type: String,
        required: true,
        maxlength: [100, 'El nombre del recurso no puede exceder 100 caracteres']
      },
      descripcion: {
        type: String,
        maxlength: [200, 'La descripción del recurso no puede exceder 200 caracteres']
      },
      url: {
        type: String,
        match: [/^https?:\/\/.+/, 'URL inválida']
      },
      obligatorio: {
        type: Boolean,
        default: false
      }
    }]
  },

  // Evaluación
  evaluacion: {
    tieneExamen: {
      type: Boolean,
      default: false
    },

    criterios: [{
      nombre: {
        type: String,
        required: true,
        maxlength: [100, 'El criterio no puede exceder 100 caracteres']
      },
      descripcion: {
        type: String,
        maxlength: [200, 'La descripción del criterio no puede exceder 200 caracteres']
      },
      peso: {
        type: Number,
        min: [0, 'El peso mínimo es 0'],
        max: [100, 'El peso máximo es 100'],
        default: 25
      }
    }],

    notaMinima: {
      type: Number,
      min: [0, 'La nota mínima es 0'],
      max: [100, 'La nota máxima es 100'],
      default: 70
    }
  },

  // Estado
  activo: {
    type: Boolean,
    default: true
  },

  // Estadísticas
  estadisticas: {
    totalGrupos: { type: Number, default: 0 },
    totalCatequizandos: { type: Number, default: 0 },
    promedioAprobacion: { type: Number, default: 0 },
    ultimaActualizacion: { type: Date, default: Date.now }
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices
nivelSchema.index({ orden: 1 }, { unique: true });
nivelSchema.index({ nombre: 1 }, { unique: true });
nivelSchema.index({ activo: 1 });
nivelSchema.index({ 'configuracion.sacramentoAsociado': 1 });

// Validación personalizada para edades
nivelSchema.pre('validate', function(next) {
  if (this.configuracion?.edadMaxima && this.configuracion?.edadMinima) {
    if (this.configuracion.edadMaxima < this.configuracion.edadMinima) {
      this.invalidate('configuracion.edadMaxima', 'La edad máxima debe ser mayor o igual a la edad mínima');
    }
  }
  next();
});

// Validación para temas ordenados correctamente
nivelSchema.pre('save', function(next) {
  if (this.contenido?.temas?.length > 0) {
    // Ordenar temas por orden
    this.contenido.temas.sort((a, b) => a.orden - b.orden);
    
    // Verificar que no haya órdenes duplicados
    const ordenes = this.contenido.temas.map(tema => tema.orden);
    const ordenesUnicos = [...new Set(ordenes)];
    
    if (ordenes.length !== ordenesUnicos.length) {
      return next(new Error('No puede haber temas con el mismo orden'));
    }
  }
  next();
});

// Validación para criterios de evaluación
nivelSchema.pre('save', function(next) {
  if (this.evaluacion?.criterios?.length > 0) {
    const pesoTotal = this.evaluacion.criterios.reduce((sum, criterio) => sum + criterio.peso, 0);
    
    if (pesoTotal !== 100) {
      return next(new Error('La suma de los pesos de los criterios debe ser 100'));
    }
  }
  next();
});

// Métodos de instancia
nivelSchema.methods.esAptoParaEdad = function(edad) {
  if (!this.configuracion) return true;
  
  const edadMinima = this.configuracion.edadMinima || 0;
  const edadMaxima = this.configuracion.edadMaxima || 999;
  
  return edad >= edadMinima && edad <= edadMaxima;
};

nivelSchema.methods.obtenerNivelAnterior = async function() {
  if (this.orden <= 1) return null;
  
  return await this.constructor.findOne({ 
    orden: this.orden - 1,
    activo: true 
  });
};

nivelSchema.methods.obtenerNivelSiguiente = async function() {
  return await this.constructor.findOne({ 
    orden: this.orden + 1,
    activo: true 
  });
};

nivelSchema.methods.actualizarEstadisticas = async function() {
  try {
    // Importar modelos solo cuando se necesiten
    const Grupo = mongoose.model('Grupo');
    
    const grupos = await Grupo.countDocuments({ nivel: this._id });
    
    // Contar catequizandos únicos a través de inscripciones
    let catequizandos = 0;
    let promedioAprobacion = 0;
    
    try {
      const Inscripcion = mongoose.model('Inscripcion');
      const gruposDelNivel = await Grupo.find({ nivel: this._id }).select('_id');
      const grupoIds = gruposDelNivel.map(g => g._id);
      
      const inscripciones = await Inscripcion.distinct('catequizando', { 
        grupo: { $in: grupoIds } 
      });
      catequizandos = inscripciones.length;
      
      // Calcular promedio de aprobación si existe modelo Certificado
      try {
        const Certificado = mongoose.model('Certificado');
        const certificados = await Certificado.aggregate([
          { $match: { nivel: this._id } },
          {
            $group: {
              _id: null,
              promedio: { $avg: { $cond: [{ $eq: ['$aprobado', true] }, 100, 0] } }
            }
          }
        ]);
        
        promedioAprobacion = certificados[0]?.promedio || 0;
      } catch (error) {
        // El modelo Certificado podría no existir aún
        promedioAprobacion = 0;
      }
    } catch (error) {
      // Los modelos podrían no existir aún
      catequizandos = 0;
    }

    this.estadisticas = {
      totalGrupos: grupos,
      totalCatequizandos: catequizandos,
      promedioAprobacion: Math.round(promedioAprobacion * 100) / 100,
      ultimaActualizacion: new Date()
    };

    return this.save();
  } catch (error) {
    console.error('Error actualizando estadísticas de nivel:', error);
    throw error;
  }
};

nivelSchema.methods.validarCompletitudContenido = function() {
  const errores = [];
  
  if (!this.contenido?.objetivos?.length) {
    errores.push('Debe tener al menos un objetivo');
  }
  
  if (!this.contenido?.temas?.length) {
    errores.push('Debe tener al menos un tema');
  }
  
  if (this.evaluacion?.tieneExamen && !this.evaluacion?.criterios?.length) {
    errores.push('Debe tener criterios de evaluación si tiene examen');
  }
  
  return {
    esCompleto: errores.length === 0,
    errores
  };
};

// Métodos estáticos
nivelSchema.statics.obtenerNivelesOrdenados = function() {
  return this.find({ activo: true }).sort({ orden: 1 });
};

nivelSchema.statics.obtenerPorSacramento = function(sacramento) {
  return this.find({ 
    'configuracion.sacramentoAsociado': sacramento,
    activo: true 
  }).sort({ orden: 1 });
};

nivelSchema.statics.reordenar = async function(nuevosOrdenes) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      for (const { _id, nuevoOrden } of nuevosOrdenes) {
        await this.findByIdAndUpdate(
          _id, 
          { orden: nuevoOrden },
          { session }
        );
      }
    });
    
    return true;
  } catch (error) {
    throw new Error('Error reordenando niveles: ' + error.message);
  } finally {
    await session.endSession();
  }
};

nivelSchema.statics.obtenerEstadisticas = function() {
  return this.aggregate([
    { $match: { activo: true } },
    {
      $group: {
        _id: null,
        totalNiveles: { $sum: 1 },
        totalGrupos: { $sum: '$estadisticas.totalGrupos' },
        totalCatequizandos: { $sum: '$estadisticas.totalCatequizandos' },
        promedioAprobacionGeneral: { $avg: '$estadisticas.promedioAprobacion' },
        nivelesConSacramento: {
          $sum: {
            $cond: [
              { $ne: ['$configuracion.sacramentoAsociado', ''] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalNiveles: 1,
        totalGrupos: 1,
        totalCatequizandos: 1,
        promedioAprobacionGeneral: { $round: ['$promedioAprobacionGeneral', 2] },
        nivelesConSacramento: 1
      }
    }
  ]);
};

// Virtual para duración total estimada
nivelSchema.virtual('duracionTotal').get(function() {
  if (!this.contenido?.temas?.length) return this.configuracion?.duracion?.sesiones || 0;
  
  return this.contenido.temas.reduce((total, tema) => {
    return total + (tema.sesionesEstimadas || 1);
  }, 0);
});

// Virtual para nivel anterior y siguiente
nivelSchema.virtual('navegacion', {
  ref: 'Nivel',
  localField: 'orden',
  foreignField: 'orden'
});

module.exports = mongoose.model('Nivel', nivelSchema);