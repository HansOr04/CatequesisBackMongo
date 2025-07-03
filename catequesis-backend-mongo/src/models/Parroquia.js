  const mongoose = require('mongoose');

  const parroquiaSchema = new mongoose.Schema({
    nombre: {
      type: String,
      required: [true, 'El nombre de la parroquia es requerido'],
      trim: true,
      minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
      maxlength: [100, 'El nombre no puede exceder 100 caracteres'],
      unique: true
    },

    direccion: {
      type: String,
      required: [true, 'La dirección es requerida'],
      trim: true,
      minlength: [5, 'La dirección debe tener al menos 5 caracteres'],
      maxlength: [255, 'La dirección no puede exceder 255 caracteres']
    },

    telefono: {
      type: String,
      required: [true, 'El teléfono es requerido'],
      trim: true,
      match: [/^[\d\-\s\+\(\)]+$/, 'Formato de teléfono inválido'],
      minlength: [7, 'El teléfono debe tener al menos 7 caracteres'],
      maxlength: [20, 'El teléfono no puede exceder 20 caracteres']
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido'],
      sparse: true // Permite múltiples documentos con email null/undefined
    },

    // Información adicional
    informacion: {
      fundacion: {
        type: Date
      },
      
      santo: {
        type: String,
        trim: true,
        maxlength: [100, 'El nombre del santo no puede exceder 100 caracteres']
      },

      festividad: {
        type: Date // Solo mes y día, ignorar año
      },

      diocesis: {
        type: String,
        trim: true,
        maxlength: [100, 'El nombre de la diócesis no puede exceder 100 caracteres']
      },

      zona: {
        type: String,
        trim: true,
        maxlength: [50, 'La zona no puede exceder 50 caracteres']
      }
    },

    // Ubicación geográfica
    ubicacion: {
      ciudad: {
        type: String,
        trim: true,
        maxlength: [50, 'La ciudad no puede exceder 50 caracteres']
      },

      provincia: {
        type: String,
        trim: true,
        maxlength: [50, 'La provincia no puede exceder 50 caracteres']
      },

      pais: {
        type: String,
        trim: true,
        maxlength: [50, 'El país no puede exceder 50 caracteres'],
        default: 'Ecuador'
      },

      coordenadas: {
        latitud: {
          type: Number,
          min: [-90, 'Latitud debe estar entre -90 y 90'],
          max: [90, 'Latitud debe estar entre -90 y 90']
        },
        longitud: {
          type: Number,
          min: [-180, 'Longitud debe estar entre -180 y 180'],
          max: [180, 'Longitud debe estar entre -180 y 180']
        }
      }
    },

    // Horarios de atención
    horarios: {
      oficina: {
        lunes: {
          abierto: { type: Boolean, default: true },
          inicio: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
          fin: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
        },
        martes: {
          abierto: { type: Boolean, default: true },
          inicio: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
          fin: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
        },
        miercoles: {
          abierto: { type: Boolean, default: true },
          inicio: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
          fin: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
        },
        jueves: {
          abierto: { type: Boolean, default: true },
          inicio: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
          fin: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
        },
        viernes: {
          abierto: { type: Boolean, default: true },
          inicio: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
          fin: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
        },
        sabado: {
          abierto: { type: Boolean, default: false },
          inicio: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
          fin: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
        },
        domingo: {
          abierto: { type: Boolean, default: false },
          inicio: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
          fin: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
        }
      },

      misas: [{
        dia: {
          type: String,
          enum: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
          required: true
        },
        hora: {
          type: String,
          required: true,
          match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
        },
        tipo: {
          type: String,
          enum: ['ordinaria', 'especial', 'funeral', 'boda'],
          default: 'ordinaria'
        }
      }]
    },

    // Estado y configuración
    activa: {
      type: Boolean,
      default: true
    },

    configuracion: {
      // Costos de servicios
      costos: {
        catequesis: {
          type: Number,
          min: [0, 'El costo no puede ser negativo'],
          default: 0
        },
        certificados: {
          type: Number,
          min: [0, 'El costo no puede ser negativo'],
          default: 0
        },
        sacramentos: {
          type: Number,
          min: [0, 'El costo no puede ser negativo'],
          default: 0
        }
      },

      // Configuraciones de notificaciones
      notificaciones: {
        recordatorios: { type: Boolean, default: true },
        ausencias: { type: Boolean, default: true },
        eventos: { type: Boolean, default: true }
      },

      // Año lectivo actual
      anoLectivo: {
        type: String,
        match: /^\d{4}(-\d{4})?$/,
        default: () => new Date().getFullYear().toString()
      }
    },

    // Estadísticas calculadas
    estadisticas: {
      totalGrupos: { type: Number, default: 0 },
      totalCatequizandos: { type: Number, default: 0 },
      totalUsuarios: { type: Number, default: 0 },
      ultimaActualizacion: { type: Date, default: Date.now }
    }
  }, {
    timestamps: true,
    versionKey: false
  });

  // Índices
  parroquiaSchema.index({ nombre: 1 }, { unique: true });
  parroquiaSchema.index({ activa: 1 });
  parroquiaSchema.index({ 'ubicacion.ciudad': 1 });
  parroquiaSchema.index({ 'ubicacion.provincia': 1 });
  parroquiaSchema.index({ 'configuracion.anoLectivo': 1 });

  // Middleware pre-save para limpiar datos
  parroquiaSchema.pre('save', function(next) {
    // Capitalizar nombre
    if (this.isModified('nombre')) {
      this.nombre = this.nombre
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    // Capitalizar ubicación
    if (this.ubicacion) {
      if (this.ubicacion.ciudad) {
        this.ubicacion.ciudad = this.ubicacion.ciudad
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      if (this.ubicacion.provincia) {
        this.ubicacion.provincia = this.ubicacion.provincia
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }

    next();
  });

  // Métodos de instancia
  parroquiaSchema.methods.actualizarEstadisticas = async function() {
    try {
      // Importar modelos solo cuando se necesiten para evitar dependencias circulares
      const Grupo = mongoose.model('Grupo');
      const Usuario = mongoose.model('Usuario');
      
      const [grupos, usuarios] = await Promise.all([
        Grupo.countDocuments({ parroquia: this._id }),
        Usuario.countDocuments({ parroquia: this._id, activo: true })
      ]);

      // Contar catequizandos únicos a través de inscripciones
      let catequizandos = 0;
      try {
        const Inscripcion = mongoose.model('Inscripcion');
        const inscripciones = await Inscripcion.distinct('catequizando', { parroquia: this._id });
        catequizandos = inscripciones.length;
      } catch (error) {
        // El modelo Inscripcion podría no existir aún
        catequizandos = 0;
      }

      this.estadisticas = {
        totalGrupos: grupos,
        totalCatequizandos: catequizandos,
        totalUsuarios: usuarios,
        ultimaActualizacion: new Date()
      };

      return this.save();
    } catch (error) {
      console.error('Error actualizando estadísticas de parroquia:', error);
      throw error;
    }
  };

  parroquiaSchema.methods.estaAbierta = function(dia = null, hora = null) {
    if (!dia) dia = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][new Date().getDay()];
    if (!hora) hora = new Date().toLocaleTimeString('es-ES', { hour12: false }).slice(0, 5);

    const horarioDia = this.horarios?.oficina?.[dia];
    if (!horarioDia || !horarioDia.abierto) return false;

    if (horarioDia.inicio && horarioDia.fin) {
      return hora >= horarioDia.inicio && hora <= horarioDia.fin;
    }

    return false;
  };

  parroquiaSchema.methods.obtenerMisasDelDia = function(dia = null) {
    if (!dia) dia = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][new Date().getDay()];
    
    return this.horarios?.misas?.filter(misa => misa.dia === dia) || [];
  };

  // Métodos estáticos
  parroquiaSchema.statics.buscarPorUbicacion = function(ciudad, provincia = null) {
    const filtro = { 'ubicacion.ciudad': new RegExp(ciudad, 'i') };
    if (provincia) {
      filtro['ubicacion.provincia'] = new RegExp(provincia, 'i');
    }
    return this.find(filtro);
  };

  parroquiaSchema.statics.obtenerEstadisticasGlobales = function() {
    return this.aggregate([
      { $match: { activa: true } },
      {
        $group: {
          _id: null,
          totalParroquias: { $sum: 1 },
          totalGrupos: { $sum: '$estadisticas.totalGrupos' },
          totalCatequizandos: { $sum: '$estadisticas.totalCatequizandos' },
          totalUsuarios: { $sum: '$estadisticas.totalUsuarios' },
          parroquiasPorProvincia: {
            $push: {
              provincia: '$ubicacion.provincia',
              ciudad: '$ubicacion.ciudad'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalParroquias: 1,
          totalGrupos: 1,
          totalCatequizandos: 1,
          totalUsuarios: 1,
          distribucian: {
            $reduce: {
              input: '$parroquiasPorProvincia',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [[{
                      k: '$$this.provincia',
                      v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.provincia', input: '$$value' } }, 0] }, 1] }
                    }]]
                  }
                ]
              }
            }
          }
        }
      }
    ]);
  };

  // Virtual para dirección completa
  parroquiaSchema.virtual('direccionCompleta').get(function() {
    let direccion = this.direccion;
    
    if (this.ubicacion?.ciudad) {
      direccion += `, ${this.ubicacion.ciudad}`;
    }
    
    if (this.ubicacion?.provincia) {
      direccion += `, ${this.ubicacion.provincia}`;
    }
    
    if (this.ubicacion?.pais) {
      direccion += `, ${this.ubicacion.pais}`;
    }
    
    return direccion;
  });

  // Virtual para información de contacto
  parroquiaSchema.virtual('contacto').get(function() {
    return {
      telefono: this.telefono,
      email: this.email,
      direccion: this.direccionCompleta
    };
  });

  module.exports = mongoose.model('Parroquia', parroquiaSchema);