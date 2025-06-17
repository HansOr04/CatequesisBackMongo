const mongoose = require('mongoose');

const catequizandoSchema = new mongoose.Schema({
  // Datos personales básicos
  nombres: {
    type: String,
    required: [true, 'Los nombres son requeridos'],
    trim: true,
    minlength: [2, 'Los nombres deben tener al menos 2 caracteres'],
    maxlength: [100, 'Los nombres no pueden exceder 100 caracteres'],
    match: [/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'Los nombres solo pueden contener letras y espacios']
  },

  apellidos: {
    type: String,
    required: [true, 'Los apellidos son requeridos'],
    trim: true,
    minlength: [2, 'Los apellidos deben tener al menos 2 caracteres'],
    maxlength: [100, 'Los apellidos no pueden exceder 100 caracteres'],
    match: [/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'Los apellidos solo pueden contener letras y espacios']
  },

  fechaNacimiento: {
    type: Date,
    required: [true, 'La fecha de nacimiento es requerida'],
    validate: {
      validator: function(fecha) {
        const hoy = new Date();
        const hace100Anos = new Date();
        hace100Anos.setFullYear(hoy.getFullYear() - 100);
        
        return fecha < hoy && fecha > hace100Anos;
      },
      message: 'La fecha de nacimiento debe ser válida (no futura y no mayor a 100 años)'
    }
  },

  documentoIdentidad: {
    type: String,
    required: [true, 'El documento de identidad es requerido'],
    unique: true,
    trim: true,
    minlength: [6, 'El documento debe tener al menos 6 caracteres'],
    maxlength: [20, 'El documento no puede exceder 20 caracteres'],
    match: [/^[a-zA-Z0-9\-]+$/, 'El documento solo puede contener letras, números y guiones']
  },

  tipoDocumento: {
    type: String,
    enum: ['cedula', 'pasaporte', 'registro_civil', 'otro'],
    default: 'cedula'
  },

  genero: {
    type: String,
    enum: ['masculino', 'femenino'],
    required: [true, 'El género es requerido']
  },

  // Información de contacto
  contacto: {
    direccion: {
      type: String,
      trim: true,
      maxlength: [255, 'La dirección no puede exceder 255 caracteres']
    },

    telefono: {
      type: String,
      trim: true,
      match: [/^[\d\-\s\+\(\)]+$/, 'Formato de teléfono inválido'],
      maxlength: [20, 'El teléfono no puede exceder 20 caracteres']
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido'],
      sparse: true // Permite múltiples documentos con email null/undefined
    },

    // Ubicación
    ciudad: {
      type: String,
      trim: true,
      maxlength: [50, 'La ciudad no puede exceder 50 caracteres']
    },

    sector: {
      type: String,
      trim: true,
      maxlength: [100, 'El sector no puede exceder 100 caracteres']
    }
  },

  // Información familiar
  familia: {
    // Padres/Representantes
    representantes: [{
      tipo: {
        type: String,
        enum: ['padre', 'madre', 'abuelo', 'abuela', 'tio', 'tia', 'hermano', 'hermana', 'tutor', 'otro'],
        required: true
      },
      nombres: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Los nombres no pueden exceder 100 caracteres']
      },
      apellidos: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Los apellidos no pueden exceder 100 caracteres']
      },
      documento: {
        type: String,
        trim: true,
        maxlength: [20, 'El documento no puede exceder 20 caracteres']
      },
      telefono: {
        type: String,
        trim: true,
        match: [/^[\d\-\s\+\(\)]+$/, 'Formato de teléfono inválido']
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido']
      },
      ocupacion: {
        type: String,
        trim: true,
        maxlength: [100, 'La ocupación no puede exceder 100 caracteres']
      },
      esPrincipal: {
        type: Boolean,
        default: false
      },
      viveConElCatequizando: {
        type: Boolean,
        default: true
      }
    }],

    // Hermanos (otros catequizandos)
    hermanos: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Catequizando'
    }],

    // Situación familiar
    situacionFamiliar: {
      type: String,
      enum: ['nuclear', 'monoparental', 'extendida', 'adoptiva', 'foster', 'otro'],
      default: 'nuclear'
    },

    // Observaciones familiares
    observaciones: {
      type: String,
      trim: true,
      maxlength: [500, 'Las observaciones no pueden exceder 500 caracteres']
    }
  },

  // Información sacramental
  sacramentos: {
    bautismo: {
      realizado: { type: Boolean, default: false },
      fecha: { type: Date },
      lugar: { type: String, trim: true, maxlength: [100] },
      parroco: { type: String, trim: true, maxlength: [100] },
      libroBautismo: { type: String, trim: true, maxlength: [50] },
      folioBautismo: { type: String, trim: true, maxlength: [20] },
      numeroBautismo: { type: String, trim: true, maxlength: [20] },
      padrinos: [{
        nombres: { type: String, required: true, trim: true, maxlength: [100] },
        apellidos: { type: String, required: true, trim: true, maxlength: [100] },
        documento: { type: String, trim: true, maxlength: [20] },
        telefono: { type: String, trim: true }
      }]
    },

    primeracomunion: {
      realizado: { type: Boolean, default: false },
      fecha: { type: Date },
      lugar: { type: String, trim: true, maxlength: [100] },
      parroco: { type: String, trim: true, maxlength: [100] }
    },

    confirmacion: {
      realizado: { type: Boolean, default: false },
      fecha: { type: Date },
      lugar: { type: String, trim: true, maxlength: [100] },
      obispo: { type: String, trim: true, maxlength: [100] },
      padrino: {
        nombres: { type: String, trim: true, maxlength: [100] },
        apellidos: { type: String, trim: true, maxlength: [100] },
        documento: { type: String, trim: true, maxlength: [20] }
      }
    }
  },

  // Información médica/especial
  informacionEspecial: {
    // Condiciones médicas o discapacidades
    condicionesMedicas: [{
      tipo: {
        type: String,
        enum: ['fisica', 'cognitiva', 'sensorial', 'conductual', 'otra'],
        required: true
      },
      descripcion: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'La descripción no puede exceder 200 caracteres']
      },
      requiereAtencionEspecial: {
        type: Boolean,
        default: false
      },
      medicamentos: {
        type: String,
        trim: true,
        maxlength: [200, 'Los medicamentos no pueden exceder 200 caracteres']
      }
    }],

    // Alergias
    alergias: [{
      tipo: {
        type: String,
        enum: ['alimentaria', 'medicamento', 'ambiental', 'otra'],
        required: true
      },
      descripcion: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'La descripción no puede exceder 100 caracteres']
      },
      severidad: {
        type: String,
        enum: ['leve', 'moderada', 'severa'],
        default: 'leve'
      }
    }],

    // Contacto de emergencia
    contactoEmergencia: {
      nombres: {
        type: String,
        trim: true,
        maxlength: [100, 'Los nombres no pueden exceder 100 caracteres']
      },
      telefono: {
        type: String,
        trim: true,
        match: [/^[\d\-\s\+\(\)]+$/, 'Formato de teléfono inválido']
      },
      relacion: {
        type: String,
        trim: true,
        maxlength: [50, 'La relación no puede exceder 50 caracteres']
      }
    }
  },

  // Estado del catequizando
  estado: {
    activo: {
      type: Boolean,
      default: true
    },

    casoEspecial: {
      type: Boolean,
      default: false
    },

    motivoCasoEspecial: {
      type: String,
      trim: true,
      maxlength: [200, 'El motivo no puede exceder 200 caracteres'],
      required: function() {
        return this.estado?.casoEspecial === true;
      }
    },

    fechaIngreso: {
      type: Date,
      default: Date.now
    },

    fechaEgreso: {
      type: Date
    },

    motivoEgreso: {
      type: String,
      enum: ['graduacion', 'retiro_voluntario', 'cambio_parroquia', 'suspension', 'otro'],
      required: function() {
        return !!this.estado?.fechaEgreso;
      }
    }
  },

  // Observaciones generales
  observaciones: {
    type: String,
    trim: true,
    maxlength: [1000, 'Las observaciones no pueden exceder 1000 caracteres']
  },

  // Fotografía (URL del archivo)
  fotografia: {
    type: String,
    match: [/^https?:\/\/.+\.(jpg|jpeg|png|gif)$/i, 'URL de fotografía inválida']
  },

  // Documentos adjuntos
  documentos: [{
    tipo: {
      type: String,
      enum: ['certificado_bautismo', 'cedula', 'foto', 'certificado_medico', 'otro'],
      required: true
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'El nombre del documento no puede exceder 100 caracteres']
    },
    url: {
      type: String,
      required: true,
      match: [/^https?:\/\/.+/, 'URL inválida']
    },
    fechaSubida: {
      type: Date,
      default: Date.now
    },
    tamaño: {
      type: Number,
      min: [0, 'El tamaño no puede ser negativo']
    }
  }]
}, {
  timestamps: true,
  versionKey: false
});

// Índices
catequizandoSchema.index({ documentoIdentidad: 1 }, { unique: true });
catequizandoSchema.index({ nombres: 1, apellidos: 1 });
catequizandoSchema.index({ fechaNacimiento: 1 });
catequizandoSchema.index({ 'estado.activo': 1 });
catequizandoSchema.index({ 'estado.casoEspecial': 1 });
catequizandoSchema.index({ 'contacto.ciudad': 1 });

// Índice de texto para búsquedas
catequizandoSchema.index({
  nombres: 'text',
  apellidos: 'text',
  documentoIdentidad: 'text'
});

// Middleware pre-save para formatear nombres
catequizandoSchema.pre('save', function(next) {
  // Capitalizar nombres y apellidos
  if (this.isModified('nombres')) {
    this.nombres = this.nombres
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  if (this.isModified('apellidos')) {
    this.apellidos = this.apellidos
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Formatear documento de identidad
  if (this.isModified('documentoIdentidad')) {
    this.documentoIdentidad = this.documentoIdentidad.toUpperCase().trim();
  }

  next();
});

// Validación para representante principal único
catequizandoSchema.pre('save', function(next) {
  if (this.familia?.representantes?.length > 0) {
    const principales = this.familia.representantes.filter(rep => rep.esPrincipal);
    
    if (principales.length > 1) {
      return next(new Error('Solo puede haber un representante principal'));
    }
    
    // Si no hay principal, marcar el primero como principal
    if (principales.length === 0) {
      this.familia.representantes[0].esPrincipal = true;
    }
  }
  next();
});

// Métodos de instancia
catequizandoSchema.methods.obtenerRepresentantePrincipal = function() {
  if (!this.familia?.representantes?.length) return null;
  
  return this.familia.representantes.find(rep => rep.esPrincipal) || 
         this.familia.representantes[0];
};

catequizandoSchema.methods.obtenerContactosEmergencia = function() {
  const contactos = [];
  
  // Representante principal
  const principal = this.obtenerRepresentantePrincipal();
  if (principal?.telefono) {
    contactos.push({
      tipo: 'representante',
      nombre: `${principal.nombres} ${principal.apellidos}`,
      telefono: principal.telefono,
      relacion: principal.tipo
    });
  }
  
  // Contacto de emergencia específico
  if (this.informacionEspecial?.contactoEmergencia?.telefono) {
    contactos.push({
      tipo: 'emergencia',
      nombre: this.informacionEspecial.contactoEmergencia.nombres,
      telefono: this.informacionEspecial.contactoEmergencia.telefono,
      relacion: this.informacionEspecial.contactoEmergencia.relacion
    });
  }
  
  return contactos;
};

catequizandoSchema.methods.tieneCondicionesEspeciales = function() {
  return this.informacionEspecial?.condicionesMedicas?.length > 0 ||
         this.informacionEspecial?.alergias?.length > 0 ||
         this.estado?.casoEspecial;
};

catequizandoSchema.methods.obtenerInscripcionActiva = async function() {
  try {
    const Inscripcion = mongoose.model('Inscripcion');
    const currentYear = new Date().getFullYear().toString();
    
    return await Inscripcion.findOne({
      catequizando: this._id,
      activa: true,
      'grupo.periodo': currentYear
    }).populate('grupo').populate('parroquia');
  } catch (error) {
    return null;
  }
};

catequizandoSchema.methods.obtenerHistorialInscripciones = async function() {
  try {
    const Inscripcion = mongoose.model('Inscripcion');
    
    return await Inscripcion.find({
      catequizando: this._id
    })
    .populate('grupo')
    .populate('parroquia')
    .sort({ fechaInscripcion: -1 });
  } catch (error) {
    return [];
  }
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
  return this.findOne({ 
    documentoIdentidad: documento.toUpperCase().trim() 
  });
};

catequizandoSchema.statics.buscarPorTexto = function(termino) {
  return this.find({
    $text: { $search: termino }
  }, {
    score: { $meta: 'textScore' }
  }).sort({
    score: { $meta: 'textScore' }
  });
};

catequizandoSchema.statics.obtenerPorEdad = function(edadMinima, edadMaxima) {
  const fechaMaxima = new Date();
  fechaMaxima.setFullYear(fechaMaxima.getFullYear() - edadMinima);
  
  const fechaMinima = new Date();
  fechaMinima.setFullYear(fechaMinima.getFullYear() - edadMaxima - 1);
  
  return this.find({
    fechaNacimiento: {
      $gte: fechaMinima,
      $lte: fechaMaxima
    },
    'estado.activo': true
  });
};

catequizandoSchema.statics.obtenerSinInscripcion = async function() {
  try {
    const Inscripcion = mongoose.model('Inscripcion');
    const currentYear = new Date().getFullYear().toString();
    
    // Obtener IDs de catequizandos con inscripción activa
    const conInscripcion = await Inscripcion.distinct('catequizando', {
      activa: true,
      'grupo.periodo': currentYear
    });
    
    return this.find({
      _id: { $nin: conInscripcion },
      'estado.activo': true
    });
  } catch (error) {
    return this.find({ 'estado.activo': true });
  }
};

catequizandoSchema.statics.obtenerEstadisticas = function(filtros = {}) {
  const pipeline = [
    { $match: { 'estado.activo': true, ...filtros } },
    {
      $addFields: {
        edad: {
          $floor: {
            $divide: [
              { $subtract: [new Date(), '$fechaNacimiento'] },
              365.25 * 24 * 60 * 60 * 1000
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        porGenero: {
          $push: {
            genero: '$genero',
            edad: '$edad'
          }
        },
        edadPromedio: { $avg: '$edad' },
        conBautismo: {
          $sum: { $cond: ['$sacramentos.bautismo.realizado', 1, 0] }
        },
        conPrimeraComunion: {
          $sum: { $cond: ['$sacramentos.primeracomunion.realizado', 1, 0] }
        },
        conConfirmacion: {
          $sum: { $cond: ['$sacramentos.confirmacion.realizado', 1, 0] }
        },
        casosEspeciales: {
          $sum: { $cond: ['$estado.casoEspecial', 1, 0] }
        },
        conCondicionesEspeciales: {
          $sum: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$informacionEspecial.condicionesMedicas', []] } }, 0] },
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
        total: 1,
        masculinos: {
          $size: {
            $filter: {
              input: '$porGenero',
              as: 'cat',
              cond: { $eq: ['$cat.genero', 'masculino'] }
            }
          }
        },
        femeninos: {
          $size: {
            $filter: {
              input: '$porGenero',
              as: 'cat',
              cond: { $eq: ['$cat.genero', 'femenino'] }
            }
          }
        },
        edadPromedio: { $round: ['$edadPromedio', 1] },
        ninos: {
          $size: {
            $filter: {
              input: '$porGenero',
              as: 'cat',
              cond: { $and: [{ $gte: ['$cat.edad', 4] }, { $lte: ['$cat.edad', 12] }] }
            }
          }
        },
        adolescentes: {
          $size: {
            $filter: {
              input: '$porGenero',
              as: 'cat',
              cond: { $and: [{ $gte: ['$cat.edad', 13] }, { $lte: ['$cat.edad', 17] }] }
            }
          }
        },
        adultos: {
          $size: {
            $filter: {
              input: '$porGenero',
              as: 'cat',
              cond: { $gte: ['$cat.edad', 18] }
            }
          }
        },
        conBautismo: 1,
        conPrimeraComunion: 1,
        conConfirmacion: 1,
        casosEspeciales: 1,
        conCondicionesEspeciales: 1,
        porcentajeBautizados: {
          $round: [{ $multiply: [{ $divide: ['$conBautismo', '$total'] }, 100] }, 1]
        }
      }
    }
  ];

  return this.aggregate(pipeline);
};

catequizandoSchema.statics.obtenerCumpleanosMes = function(mes = null) {
  if (!mes) mes = new Date().getMonth() + 1;
  
  return this.find({
    'estado.activo': true,
    $expr: {
      $eq: [{ $month: '$fechaNacimiento' }, mes]
    }
  }).sort({ 
    $expr: { $dayOfMonth: '$fechaNacimiento' }
  });
};

catequizandoSchema.statics.obtenerHermanos = function(catequizandoId) {
  return this.findById(catequizandoId)
    .populate('familia.hermanos')
    .then(catequizando => catequizando?.familia?.hermanos || []);
};

// Virtuals
catequizandoSchema.virtual('nombreCompleto').get(function() {
  return `${this.nombres} ${this.apellidos}`;
});

catequizandoSchema.virtual('edad').get(function() {
  return this.calcularEdad();
});

catequizandoSchema.virtual('iniciales').get(function() {
  const nombres = this.nombres.split(' ');
  const apellidos = this.apellidos.split(' ');
  
  return `${nombres[0]?.charAt(0) || ''}${apellidos[0]?.charAt(0) || ''}`.toUpperCase();
});

catequizandoSchema.virtual('resumenSacramentos').get(function() {
  const sacramentos = [];
  
  if (this.sacramentos?.bautismo?.realizado) {
    sacramentos.push('Bautismo');
  }
  if (this.sacramentos?.primeracomunion?.realizado) {
    sacramentos.push('Primera Comunión');
  }
  if (this.sacramentos?.confirmacion?.realizado) {
    sacramentos.push('Confirmación');
  }
  
  return sacramentos;
});

// Populate virtuals
catequizandoSchema.virtual('inscripciones', {
  ref: 'Inscripcion',
  localField: '_id',
  foreignField: 'catequizando'
});

catequizandoSchema.virtual('certificados', {
  ref: 'Certificado',
  localField: '_id',
  foreignField: 'catequizando'
});

module.exports = mongoose.model('Catequizando', catequizandoSchema);