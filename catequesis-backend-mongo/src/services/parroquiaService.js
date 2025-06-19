const Parroquia = require('../models/Parroquia');
const Usuario = require('../models/Usuario');
const Catequizando = require('../models/Catequizando');
const Grupo = require('../models/Grupo');
const Inscripcion = require('../models/Inscripcion');
const { AppError, ErrorBuilder } = require('../utils/errors');
const { buildPaginationQuery, buildSortQuery } = require('../utils/queryhelpers');

class ParroquiaService {
  /**
   * Crear nueva parroquia
   */
  async createParroquia(parroquiaData, currentUser) {
    try {
      // Solo admin puede crear parroquias
      if (currentUser.tipoPerfil !== 'admin') {
        throw ErrorBuilder.forbidden('Solo los administradores pueden crear parroquias');
      }

      const { nombre, direccion, telefono, email, parroco, descripcion, activa = true } = parroquiaData;

      // Verificar que el nombre no exista
      const nombreExistente = await Parroquia.findOne({
        nombre: { $regex: `^${nombre}$`, $options: 'i' }
      });

      if (nombreExistente) {
        throw ErrorBuilder.conflict('Ya existe una parroquia con ese nombre');
      }

      // Crear parroquia
      const nuevaParroquia = new Parroquia({
        nombre,
        direccion,
        telefono,
        email,
        parroco,
        descripcion,
        activa
      });

      await nuevaParroquia.save();

      return {
        success: true,
        message: 'Parroquia creada exitosamente',
        data: nuevaParroquia
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de parroquia inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al crear parroquia');
    }
  }

  /**
   * Obtener parroquias con filtros
   */
  async getParroquias(queryParams, currentUser) {
    try {
      const { page = 1, limit = 10, search, activa, sort = 'nombre' } = queryParams;

      let filtros = {};

      // Si no es admin, solo puede ver su propia parroquia
      if (currentUser.tipoPerfil !== 'admin') {
        filtros._id = currentUser.parroquia;
      }

      // Filtro de búsqueda
      if (search) {
        filtros.$or = [
          { nombre: { $regex: search, $options: 'i' } },
          { direccion: { $regex: search, $options: 'i' } },
          { parroco: { $regex: search, $options: 'i' } }
        ];
      }

      // Filtro por estado activo
      if (activa !== undefined) {
        filtros.activa = activa === 'true';
      }

      // Configurar paginación y ordenamiento
      const paginationQuery = buildPaginationQuery(page, limit);
      const sortQuery = buildSortQuery(sort);

      const [parroquias, total] = await Promise.all([
        Parroquia.find(filtros)
          .sort(sortQuery)
          .skip(paginationQuery.skip)
          .limit(paginationQuery.limit),
        Parroquia.countDocuments(filtros)
      ]);

      // Agregar estadísticas para cada parroquia (solo si es admin)
      let parroquiasConEstadisticas = parroquias;
      
      if (currentUser.tipoPerfil === 'admin') {
        parroquiasConEstadisticas = await Promise.all(
          parroquias.map(async (parroquia) => {
            const [usuariosCount, catequizandosCount, gruposCount, inscripcionesCount] = await Promise.all([
              Usuario.countDocuments({ parroquia: parroquia._id, activo: true }),
              Catequizando.countDocuments({ parroquia: parroquia._id, activo: true }),
              Grupo.countDocuments({ parroquia: parroquia._id, activo: true }),
              Inscripcion.countDocuments({ 
                $lookup: {
                  from: 'catequizandos',
                  localField: 'catequizando',
                  foreignField: '_id',
                  as: 'catequizandoData'
                }
              }).match({
                'catequizandoData.parroquia': parroquia._id,
                estado: 'activa'
              })
            ]);

            return {
              ...parroquia.toObject(),
              estadisticas: {
                totalUsuarios: usuariosCount,
                totalCatequizandos: catequizandosCount,
                totalGrupos: gruposCount,
                totalInscritos: inscripcionesCount
              }
            };
          })
        );
      }

      return {
        success: true,
        data: parroquiasConEstadisticas,
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
      throw ErrorBuilder.internal('Error interno al obtener parroquias');
    }
  }

  /**
   * Obtener parroquia por ID
   */
  async getParroquiaById(id, currentUser) {
    try {
      // Verificar permisos
      if (currentUser.tipoPerfil !== 'admin' && currentUser.parroquia.toString() !== id) {
        throw ErrorBuilder.forbidden('No tienes acceso a esta parroquia');
      }

      const parroquia = await Parroquia.findById(id);

      if (!parroquia) {
        throw ErrorBuilder.notFound('Parroquia no encontrada');
      }

      // Obtener estadísticas detalladas
      const estadisticas = await Promise.all([
        // Usuarios por tipo de perfil
        Usuario.aggregate([
          { $match: { parroquia: parroquia._id, activo: true } },
          { $group: { _id: '$tipoPerfil', count: { $sum: 1 } } }
        ]),
        
        // Catequizandos por género
        Catequizando.aggregate([
          { $match: { parroquia: parroquia._id, activo: true } },
          { $group: { _id: '$genero', count: { $sum: 1 } } }
        ]),
        
        // Grupos por nivel
        Grupo.aggregate([
          { $match: { parroquia: parroquia._id, activo: true } },
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
              count: { $sum: 1 }
            }
          },
          { $sort: { 'nivelData.orden': 1 } }
        ]),
        
        // Inscripciones recientes (últimos 30 días)
        Inscripcion.aggregate([
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
            $match: {
              'catequizandoData.parroquia': parroquia._id,
              estado: 'activa',
              fechaInscripcion: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
          },
          { $count: 'total' }
        ])
      ]);

      const [usuariosPorTipo, catequizandosPorGenero, gruposPorNivel, inscripcionesRecientes] = estadisticas;

      return {
        success: true,
        data: {
          parroquia,
          estadisticas: {
            usuariosPorTipo,
            catequizandosPorGenero,
            gruposPorNivel,
            inscripcionesRecientes: inscripcionesRecientes[0]?.total || 0
          }
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al obtener parroquia');
    }
  }

  /**
   * Actualizar parroquia
   */
  async updateParroquia(id, updateData, currentUser) {
    try {
      // Verificar permisos
      if (currentUser.tipoPerfil !== 'admin') {
        if (currentUser.parroquia.toString() !== id) {
          throw ErrorBuilder.forbidden('No tienes acceso a esta parroquia');
        }
        
        // Los no-admin no pueden cambiar ciertos campos
        const camposRestringidos = ['activa'];
        const intentaCambiarRestringidos = camposRestringidos.some(campo => 
          updateData.hasOwnProperty(campo)
        );

        if (intentaCambiarRestringidos) {
          throw ErrorBuilder.forbidden('No tienes permisos para modificar estos campos');
        }
      }

      const parroquia = await Parroquia.findById(id);
      if (!parroquia) {
        throw ErrorBuilder.notFound('Parroquia no encontrada');
      }

      // Verificar nombre único si se está cambiando
      if (updateData.nombre && updateData.nombre !== parroquia.nombre) {
        const nombreExistente = await Parroquia.findOne({
          nombre: { $regex: `^${updateData.nombre}$`, $options: 'i' },
          _id: { $ne: id }
        });

        if (nombreExistente) {
          throw ErrorBuilder.conflict('Ya existe una parroquia con ese nombre');
        }
      }

      // Actualizar parroquia
      Object.assign(parroquia, updateData);
      await parroquia.save();

      return {
        success: true,
        message: 'Parroquia actualizada exitosamente',
        data: parroquia
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de parroquia inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al actualizar parroquia');
    }
  }

  /**
   * Eliminar parroquia (soft delete)
   */
  async deleteParroquia(id, currentUser) {
    try {
      // Solo admin puede eliminar parroquias
      if (currentUser.tipoPerfil !== 'admin') {
        throw ErrorBuilder.forbidden('Solo los administradores pueden eliminar parroquias');
      }

      const parroquia = await Parroquia.findById(id);
      if (!parroquia) {
        throw ErrorBuilder.notFound('Parroquia no encontrada');
      }

      // Verificar si tiene usuarios activos
      const usuariosActivos = await Usuario.countDocuments({
        parroquia: id,
        activo: true
      });

      if (usuariosActivos > 0) {
        throw ErrorBuilder.conflict('No se puede eliminar una parroquia con usuarios activos');
      }

      // Verificar si tiene catequizandos activos
      const catequizandosActivos = await Catequizando.countDocuments({
        parroquia: id,
        activo: true
      });

      if (catequizandosActivos > 0) {
        throw ErrorBuilder.conflict('No se puede eliminar una parroquia con catequizandos activos');
      }

      // Verificar si tiene grupos activos
      const gruposActivos = await Grupo.countDocuments({
        parroquia: id,
        activo: true
      });

      if (gruposActivos > 0) {
        throw ErrorBuilder.conflict('No se puede eliminar una parroquia con grupos activos');
      }

      // Soft delete
      parroquia.activa = false;
      await parroquia.save();

      return {
        success: true,
        message: 'Parroquia eliminada exitosamente'
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al eliminar parroquia');
    }
  }

  /**
   * Obtener parroquias activas para formularios
   */
  async getParroquiasActivas(currentUser) {
    try {
      let filtros = { activa: true };

      // Si no es admin, solo puede ver su propia parroquia
      if (currentUser.tipoPerfil !== 'admin') {
        filtros._id = currentUser.parroquia;
      }

      const parroquias = await Parroquia.find(filtros)
        .select('_id nombre direccion telefono')
        .sort({ nombre: 1 });

      return {
        success: true,
        data: parroquias
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener parroquias activas');
    }
  }

  /**
   * Obtener dashboard de parroquia
   */
  async getDashboardParroquia(parroquiaId, currentUser) {
    try {
      // Verificar permisos
      if (currentUser.tipoPerfil !== 'admin' && currentUser.parroquia.toString() !== parroquiaId) {
        throw ErrorBuilder.forbidden('No tienes acceso a esta parroquia');
      }

      const parroquia = await Parroquia.findById(parroquiaId);
      if (!parroquia) {
        throw ErrorBuilder.notFound('Parroquia no encontrada');
      }

      // Obtener métricas del dashboard
      const dashboard = await Promise.all([
        // Resumen general
        Promise.all([
          Usuario.countDocuments({ parroquia: parroquiaId, activo: true }),
          Catequizando.countDocuments({ parroquia: parroquiaId, activo: true }),
          Grupo.countDocuments({ parroquia: parroquiaId, activo: true }),
          Inscripcion.aggregate([
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
              $match: {
                'catequizandoData.parroquia': parroquia._id,
                estado: 'activa'
              }
            },
            { $count: 'total' }
          ])
        ]),

        // Evolución mensual de inscripciones
        Inscripcion.aggregate([
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
            $match: {
              'catequizandoData.parroquia': parroquia._id,
              fechaInscripcion: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$fechaInscripcion' },
                month: { $month: '$fechaInscripcion' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]),

        // Distribución por niveles
        Grupo.aggregate([
          { $match: { parroquia: parroquia._id, activo: true } },
          {
            $lookup: {
              from: 'inscripciones',
              localField: '_id',
              foreignField: 'grupo',
              as: 'inscripciones'
            }
          },
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
              totalGrupos: { $sum: 1 },
              totalInscritos: {
                $sum: {
                  $size: {
                    $filter: {
                      input: '$inscripciones',
                      cond: { $eq: ['$$this.estado', 'activa'] }
                    }
                  }
                }
              }
            }
          },
          { $sort: { orden: 1 } }
        ]),

        // Actividad reciente
        Promise.all([
          // Nuevos catequizandos (últimos 7 días)
          Catequizando.find({
            parroquia: parroquiaId,
            fechaCreacion: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          })
          .select('nombres apellidos fechaCreacion')
          .sort({ fechaCreacion: -1 })
          .limit(5),

          // Nuevas inscripciones (últimos 7 días)
          Inscripcion.find({
            fechaInscripcion: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          })
          .populate({
            path: 'catequizando',
            match: { parroquia: parroquiaId },
            select: 'nombres apellidos'
          })
          .populate('nivel', 'nombre')
          .populate('grupo', 'nombre')
          .sort({ fechaInscripcion: -1 })
          .limit(5)
        ])
      ]);

      const [resumenGeneral, evolucionMensual, distribucionNiveles, actividadReciente] = dashboard;
      const [totalUsuarios, totalCatequizandos, totalGrupos, inscripcionesActivas] = resumenGeneral;
      const [nuevosCatequizandos, nuevasInscripciones] = actividadReciente;

      return {
        success: true,
        data: {
          parroquia: {
            _id: parroquia._id,
            nombre: parroquia.nombre,
            parroco: parroquia.parroco
          },
          resumen: {
            totalUsuarios,
            totalCatequizandos,
            totalGrupos,
            totalInscritos: inscripcionesActivas[0]?.total || 0
          },
          evolucionMensual,
          distribucionNiveles,
          actividadReciente: {
            nuevosCatequizandos,
            nuevasInscripciones: nuevasInscripciones.filter(i => i.catequizando)
          }
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al obtener dashboard de parroquia');
    }
  }

  /**
   * Transferir datos entre parroquias (solo admin)
   */
  async transferirDatos(origenId, destinoId, tipoTransferencia, currentUser) {
    try {
      // Solo admin puede realizar transferencias
      if (currentUser.tipoPerfil !== 'admin') {
        throw ErrorBuilder.forbidden('Solo los administradores pueden transferir datos entre parroquias');
      }

      const [parroquiaOrigen, parroquiaDestino] = await Promise.all([
        Parroquia.findById(origenId),
        Parroquia.findById(destinoId)
      ]);

      if (!parroquiaOrigen || !parroquiaDestino) {
        throw ErrorBuilder.notFound('Una de las parroquias no existe');
      }

      let resultados = {};

      switch (tipoTransferencia) {
        case 'usuarios':
          const usuariosTransferidos = await Usuario.updateMany(
            { parroquia: origenId },
            { parroquia: destinoId }
          );
          resultados.usuariosTransferidos = usuariosTransferidos.modifiedCount;
          break;

        case 'catequizandos':
          const catequizandosTransferidos = await Catequizando.updateMany(
            { parroquia: origenId },
            { parroquia: destinoId }
          );
          resultados.catequizandosTransferidos = catequizandosTransferidos.modifiedCount;
          break;

        case 'grupos':
          const gruposTransferidos = await Grupo.updateMany(
            { parroquia: origenId },
            { parroquia: destinoId }
          );
          resultados.gruposTransferidos = gruposTransferidos.modifiedCount;
          break;

        case 'todo':
          const [usuarios, catequizandos, grupos] = await Promise.all([
            Usuario.updateMany({ parroquia: origenId }, { parroquia: destinoId }),
            Catequizando.updateMany({ parroquia: origenId }, { parroquia: destinoId }),
            Grupo.updateMany({ parroquia: origenId }, { parroquia: destinoId })
          ]);
          
          resultados = {
            usuariosTransferidos: usuarios.modifiedCount,
            catequizandosTransferidos: catequizandos.modifiedCount,
            gruposTransferidos: grupos.modifiedCount
          };
          break;

        default:
          throw ErrorBuilder.badRequest('Tipo de transferencia inválido');
      }

      return {
        success: true,
        message: 'Transferencia completada exitosamente',
        data: {
          parroquiaOrigen: parroquiaOrigen.nombre,
          parroquiaDestino: parroquiaDestino.nombre,
          tipoTransferencia,
          resultados
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al transferir datos');
    }
  }
}

module.exports = new ParroquiaService();