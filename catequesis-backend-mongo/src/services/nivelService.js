const Nivel = require('../models/Nivel');
const Grupo = require('../models/Grupo');
const Inscripcion = require('../models/Inscripcion');
const { AppError, ErrorBuilder } = require('../utils/errors');
const { buildPaginationQuery, buildSortQuery } = require('../utils/queryHelpers');

class NivelService {
  /**
   * Crear nuevo nivel
   */
  async createNivel(nivelData, currentUser) {
    try {
      // Solo admin puede crear niveles
      if (currentUser.tipoPerfil !== 'admin') {
        throw ErrorBuilder.forbidden('Solo los administradores pueden crear niveles');
      }

      const { nombre, orden, descripcion, edadMinima, edadMaxima, requisitos, activo = true } = nivelData;

      // Verificar que el nombre no exista
      const nombreExistente = await Nivel.findOne({
        nombre: { $regex: `^${nombre}$`, $options: 'i' }
      });

      if (nombreExistente) {
        throw ErrorBuilder.conflict('Ya existe un nivel con ese nombre');
      }

      // Verificar que el orden no exista
      const ordenExistente = await Nivel.findOne({ orden });
      if (ordenExistente) {
        throw ErrorBuilder.conflict('Ya existe un nivel con ese orden');
      }

      // Crear nivel
      const nuevoNivel = new Nivel({
        nombre,
        orden,
        descripcion,
        edadMinima,
        edadMaxima,
        requisitos,
        activo
      });

      await nuevoNivel.save();

      return {
        success: true,
        message: 'Nivel creado exitosamente',
        data: nuevoNivel
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de nivel inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al crear nivel');
    }
  }

  /**
   * Obtener niveles con filtros
   */
  async getNiveles(queryParams) {
    try {
      const { page = 1, limit = 10, search, activo, sort = 'orden' } = queryParams;

      let filtros = {};

      // Filtro de búsqueda
      if (search) {
        filtros.$or = [
          { nombre: { $regex: search, $options: 'i' } },
          { descripcion: { $regex: search, $options: 'i' } }
        ];
      }

      // Filtro por estado activo
      if (activo !== undefined) {
        filtros.activo = activo === 'true';
      }

      // Configurar paginación y ordenamiento
      const paginationQuery = buildPaginationQuery(page, limit);
      const sortQuery = buildSortQuery(sort);

      const [niveles, total] = await Promise.all([
        Nivel.find(filtros)
          .sort(sortQuery)
          .skip(paginationQuery.skip)
          .limit(paginationQuery.limit),
        Nivel.countDocuments(filtros)
      ]);

      // Agregar estadísticas de cada nivel
      const nivelesConEstadisticas = await Promise.all(
        niveles.map(async (nivel) => {
          const [gruposCount, inscripcionesCount] = await Promise.all([
            Grupo.countDocuments({ nivel: nivel._id, activo: true }),
            Inscripcion.countDocuments({ nivel: nivel._id, estado: 'activa' })
          ]);

          return {
            ...nivel.toObject(),
            estadisticas: {
              totalGrupos: gruposCount,
              totalInscritos: inscripcionesCount
            }
          };
        })
      );

      return {
        success: true,
        data: nivelesConEstadisticas,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / paginationQuery.limit),
          totalItems: total,
          itemsPerPage: paginationQuery.limit,
          hasNext: page < Math.ceil(total / paginationQuery.limit),
          hasPrev: page > 1
        }
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener niveles');
    }
  }

  /**
   * Obtener nivel por ID
   */
  async getNivelById(id) {
    try {
      const nivel = await Nivel.findById(id);

      if (!nivel) {
        throw ErrorBuilder.notFound('Nivel no encontrado');
      }

      // Obtener grupos del nivel
      const grupos = await Grupo.find({ nivel: id, activo: true })
        .populate('catequista', 'nombres apellidos')
        .populate('parroquia', 'nombre')
        .sort({ nombre: 1 });

      // Obtener estadísticas del nivel
      const estadisticas = await Promise.all([
        Grupo.countDocuments({ nivel: id, activo: true }),
        Inscripcion.countDocuments({ nivel: id, estado: 'activa' }),
        Inscripcion.aggregate([
          { $match: { nivel: id, estado: 'activa' } },
          {
            $lookup: {
              from: 'catequizandos',
              localField: 'catequizando',
              foreignField: '_id',
              as: 'catequizandoData'
            }
          },
          { $unwind: '$catequizandoData' },
          {
            $group: {
              _id: '$catequizandoData.genero',
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      const [totalGrupos, totalInscritos, distribucionGenero] = estadisticas;

      return {
        success: true,
        data: {
          nivel,
          grupos,
          estadisticas: {
            totalGrupos,
            totalInscritos,
            distribucionGenero
          }
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al obtener nivel');
    }
  }

  /**
   * Actualizar nivel
   */
  async updateNivel(id, updateData, currentUser) {
    try {
      // Solo admin puede actualizar niveles
      if (currentUser.tipoPerfil !== 'admin') {
        throw ErrorBuilder.forbidden('Solo los administradores pueden actualizar niveles');
      }

      const nivel = await Nivel.findById(id);
      if (!nivel) {
        throw ErrorBuilder.notFound('Nivel no encontrado');
      }

      // Verificar orden único si se está cambiando
      if (updateData.orden && updateData.orden !== nivel.orden) {
        const ordenExistente = await Nivel.findOne({
          orden: updateData.orden,
          _id: { $ne: id }
        });

        if (ordenExistente) {
          throw ErrorBuilder.conflict('Ya existe un nivel con ese orden');
        }
      }

      // Verificar nombre único si se está cambiando
      if (updateData.nombre && updateData.nombre !== nivel.nombre) {
        const nombreExistente = await Nivel.findOne({
          nombre: { $regex: `^${updateData.nombre}$`, $options: 'i' },
          _id: { $ne: id }
        });

        if (nombreExistente) {
          throw ErrorBuilder.conflict('Ya existe un nivel con ese nombre');
        }
      }

      // Actualizar nivel
      Object.assign(nivel, updateData);
      await nivel.save();

      return {
        success: true,
        message: 'Nivel actualizado exitosamente',
        data: nivel
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de nivel inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al actualizar nivel');
    }
  }

  /**
   * Eliminar nivel (soft delete)
   */
  async deleteNivel(id, currentUser) {
    try {
      // Solo admin puede eliminar niveles
      if (currentUser.tipoPerfil !== 'admin') {
        throw ErrorBuilder.forbidden('Solo los administradores pueden eliminar niveles');
      }

      const nivel = await Nivel.findById(id);
      if (!nivel) {
        throw ErrorBuilder.notFound('Nivel no encontrado');
      }

      // Verificar si tiene grupos activos
      const gruposActivos = await Grupo.countDocuments({
        nivel: id,
        activo: true
      });

      if (gruposActivos > 0) {
        throw ErrorBuilder.conflict('No se puede eliminar un nivel con grupos activos');
      }

      // Verificar si tiene inscripciones activas
      const inscripcionesActivas = await Inscripcion.countDocuments({
        nivel: id,
        estado: 'activa'
      });

      if (inscripcionesActivas > 0) {
        throw ErrorBuilder.conflict('No se puede eliminar un nivel con inscripciones activas');
      }

      // Soft delete
      nivel.activo = false;
      await nivel.save();

      return {
        success: true,
        message: 'Nivel eliminado exitosamente'
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al eliminar nivel');
    }
  }

  /**
   * Obtener niveles activos para formularios
   */
  async getNivelesActivos() {
    try {
      const niveles = await Nivel.find({ activo: true })
        .select('_id nombre orden descripcion edadMinima edadMaxima')
        .sort({ orden: 1 });

      return {
        success: true,
        data: niveles
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener niveles activos');
    }
  }

  /**
   * Reordenar niveles
   */
  async reordenarNiveles(nuevosOrdenes, currentUser) {
    try {
      // Solo admin puede reordenar niveles
      if (currentUser.tipoPerfil !== 'admin') {
        throw ErrorBuilder.forbidden('Solo los administradores pueden reordenar niveles');
      }

      // nuevosOrdenes debe ser un array de objetos { id, orden }
      if (!Array.isArray(nuevosOrdenes)) {
        throw ErrorBuilder.badRequest('Los nuevos órdenes deben ser un array');
      }

      // Verificar que no haya órdenes duplicados
      const ordenes = nuevosOrdenes.map(n => n.orden);
      const ordenesUnicos = [...new Set(ordenes)];
      
      if (ordenes.length !== ordenesUnicos.length) {
        throw ErrorBuilder.badRequest('No puede haber órdenes duplicados');
      }

      // Actualizar cada nivel
      const actualizaciones = nuevosOrdenes.map(async ({ id, orden }) => {
        const nivel = await Nivel.findById(id);
        if (!nivel) {
          throw ErrorBuilder.notFound(`Nivel con ID ${id} no encontrado`);
        }

        nivel.orden = orden;
        return nivel.save();
      });

      await Promise.all(actualizaciones);

      // Obtener niveles reordenados
      const nivelesActualizados = await Nivel.find({ activo: true })
        .sort({ orden: 1 });

      return {
        success: true,
        message: 'Niveles reordenados exitosamente',
        data: nivelesActualizados
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al reordenar niveles');
    }
  }

  /**
   * Obtener estadísticas generales de niveles
   */
  async getEstadisticasNiveles() {
    try {
      const estadisticas = await Promise.all([
        // Total de niveles activos
        Nivel.countDocuments({ activo: true }),
        
        // Niveles con más inscripciones
        Inscripcion.aggregate([
          { $match: { estado: 'activa' } },
          {
            $lookup: {
              from: 'niveles',
              localField: 'nivel',
              foreignField: '_id',
              as: 'nivelData'
            }
          },
          { $unwind: '$nivelData' },
          {
            $group: {
              _id: '$nivel',
              nombre: { $first: '$nivelData.nombre' },
              orden: { $first: '$nivelData.orden' },
              totalInscritos: { $sum: 1 }
            }
          },
          { $sort: { totalInscritos: -1 } },
          { $limit: 5 }
        ]),
        
        // Distribución por edades
        Nivel.aggregate([
          { $match: { activo: true } },
          {
            $group: {
              _id: {
                rangoEdad: {
                  $concat: [
                    { $toString: '$edadMinima' },
                    '-',
                    { $toString: '$edadMaxima' },
                    ' años'
                  ]
                }
              },
              niveles: { $push: '$nombre' },
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      return {
        success: true,
        data: {
          totalNiveles: estadisticas[0],
          nivelesPopulares: estadisticas[1],
          distribucionEdades: estadisticas[2]
        }
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener estadísticas de niveles');
    }
  }

  /**
   * Validar progresión de niveles
   */
  async validarProgresion(catequizandoId, nivelActualId, nuevoNivelId) {
    try {
      const [nivelActual, nuevoNivel] = await Promise.all([
        Nivel.findById(nivelActualId),
        Nivel.findById(nuevoNivelId)
      ]);

      if (!nivelActual || !nuevoNivel) {
        throw ErrorBuilder.notFound('Nivel no encontrado');
      }

      // Verificar que el nuevo nivel sea progresivo (orden mayor)
      if (nuevoNivel.orden <= nivelActual.orden) {
        return {
          esValido: false,
          razon: 'El nuevo nivel debe ser superior al nivel actual'
        };
      }

      // Verificar si hay niveles intermedios
      const nivelesIntermedios = await Nivel.find({
        orden: { $gt: nivelActual.orden, $lt: nuevoNivel.orden },
        activo: true
      });

      if (nivelesIntermedios.length > 0) {
        return {
          esValido: false,
          razon: 'Debe completar los niveles intermedios primero',
          nivelesIntermedios: nivelesIntermedios.map(n => ({ id: n._id, nombre: n.nombre }))
        };
      }

      return {
        esValido: true,
        razon: 'Progresión válida'
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al validar progresión');
    }
  }

  /**
   * Obtener reporte de niveles
   */
  async getReporteNiveles(filtros = {}) {
    try {
      const pipeline = [
        { $match: { activo: true } },
        {
          $lookup: {
            from: 'grupos',
            localField: '_id',
            foreignField: 'nivel',
            as: 'grupos'
          }
        },
        {
          $lookup: {
            from: 'inscripciones',
            localField: '_id',
            foreignField: 'nivel',
            as: 'inscripciones'
          }
        },
        {
          $addFields: {
            totalGrupos: { $size: '$grupos' },
            gruposActivos: {
              $size: {
                $filter: {
                  input: '$grupos',
                  cond: { $eq: ['$$this.activo', true] }
                }
              }
            },
            totalInscritos: {
              $size: {
                $filter: {
                  input: '$inscripciones',
                  cond: { $eq: ['$$this.estado', 'activa'] }
                }
              }
            }
          }
        },
        {
          $project: {
            grupos: 0,
            inscripciones: 0
          }
        },
        { $sort: { orden: 1 } }
      ];

      const reporte = await Nivel.aggregate(pipeline);

      return {
        success: true,
        data: reporte
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al generar reporte de niveles');
    }
  }
}

module.exports = new NivelService();