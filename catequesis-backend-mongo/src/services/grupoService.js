const Grupo = require('../models/Grupo');
const Inscripcion = require('../models/Inscripcion');
const Usuario = require('../models/Usuario');
const { AppError, ErrorBuilder } = require('../utils/errors');
const { buildPaginationQuery, buildSortQuery } = require('../utils/queryHelpers');

class GrupoService {
  /**
   * Crear nuevo grupo
   */
  async createGrupo(grupoData, currentUser) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para crear grupos');
      }

      const { nombre, nivel, catequista, horarios, capacidadMaxima, descripcion, parroquia } = grupoData;

      // Verificar que el catequista existe y es válido
      if (catequista) {
        const catequistaData = await Usuario.findById(catequista);
        if (!catequistaData || !['catequista', 'coordinador'].includes(catequistaData.tipoPerfil)) {
          throw ErrorBuilder.badRequest('El catequista seleccionado no es válido');
        }

        // Verificar que el catequista pertenece a la parroquia correcta
        if (currentUser.tipoPerfil !== 'admin' && 
            catequistaData.parroquia.toString() !== currentUser.parroquia.toString()) {
          throw ErrorBuilder.forbidden('El catequista debe pertenecer a tu parroquia');
        }
      }

      // Verificar nombre único en la parroquia
      const nombreExistente = await Grupo.findOne({
        nombre: { $regex: `^${nombre}$`, $options: 'i' },
        parroquia: parroquia || currentUser.parroquia
      });

      if (nombreExistente) {
        throw ErrorBuilder.conflict('Ya existe un grupo con ese nombre en la parroquia');
      }

      // Crear grupo
      const nuevoGrupo = new Grupo({
        nombre,
        nivel,
        catequista,
        horarios,
        capacidadMaxima,
        descripcion,
        parroquia: parroquia || currentUser.parroquia,
        activo: true
      });

      await nuevoGrupo.save();
      
      // Poblar datos para la respuesta
      await nuevoGrupo.populate([
        { path: 'nivel', select: 'nombre orden' },
        { path: 'catequista', select: 'nombres apellidos' },
        { path: 'parroquia', select: 'nombre' }
      ]);

      return {
        success: true,
        message: 'Grupo creado exitosamente',
        data: nuevoGrupo
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de grupo inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al crear grupo');
    }
  }

  /**
   * Obtener grupos con filtros
   */
  async getGrupos(queryParams, currentUser) {
    try {
      const { page = 1, limit = 10, search, nivel, catequista, activo, sort = 'nombre' } = queryParams;

      let filtros = {};

      // Filtro por parroquia según el rol del usuario
      if (currentUser.tipoPerfil === 'admin') {
        if (queryParams.parroquia) {
          filtros.parroquia = queryParams.parroquia;
        }
      } else {
        filtros.parroquia = currentUser.parroquia;
      }

      // Filtros específicos
      if (nivel) filtros.nivel = nivel;
      if (catequista) filtros.catequista = catequista;
      if (activo !== undefined) filtros.activo = activo === 'true';

      // Filtro de búsqueda
      if (search) {
        filtros.nombre = { $regex: search, $options: 'i' };
      }

      // Configurar paginación y ordenamiento
      const paginationQuery = buildPaginationQuery(page, limit);
      const sortQuery = buildSortQuery(sort);

      const [grupos, total] = await Promise.all([
        Grupo.find(filtros)
          .populate('nivel', 'nombre orden')
          .populate('catequista', 'nombres apellidos')
          .populate('parroquia', 'nombre')
          .sort(sortQuery)
          .skip(paginationQuery.skip)
          .limit(paginationQuery.limit),
        Grupo.countDocuments(filtros)
      ]);

      // Agregar conteo de inscripciones activas para cada grupo
      const gruposConConteo = await Promise.all(
        grupos.map(async (grupo) => {
          const inscripcionesActivas = await Inscripcion.countDocuments({
            grupo: grupo._id,
            estado: 'activa'
          });

          return {
            ...grupo.toObject(),
            inscripcionesActivas,
            disponibilidad: grupo.capacidadMaxima - inscripcionesActivas
          };
        })
      );

      return {
        success: true,
        data: gruposConConteo,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / paginationQuery.limit),
          totalItems: total,
          itemsPerPage: paginationQuery.limit
        }
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener grupos');
    }
  }

  /**
   * Obtener grupo por ID con detalles
   */
  async getGrupoById(id, currentUser) {
    try {
      let query = Grupo.findById(id)
        .populate('nivel', 'nombre orden descripcion')
        .populate('catequista', 'nombres apellidos telefono email')
        .populate('parroquia', 'nombre direccion telefono');

      // Verificar permisos de parroquia si no es admin
      if (currentUser.tipoPerfil !== 'admin') {
        query = query.where('parroquia').equals(currentUser.parroquia);
      }

      const grupo = await query;

      if (!grupo) {
        throw ErrorBuilder.notFound('Grupo no encontrado');
      }

      // Obtener inscripciones del grupo
      const inscripciones = await Inscripcion.find({ grupo: id })
        .populate('catequizando', 'nombres apellidos documento fechaNacimiento')
        .sort({ 'catequizando.apellidos': 1 });

      // Estadísticas del grupo
      const estadisticas = {
        totalInscritos: inscripciones.filter(i => i.estado === 'activa').length,
        disponibilidad: grupo.capacidadMaxima - inscripciones.filter(i => i.estado === 'activa').length,
        porcentajeOcupacion: Math.round((inscripciones.filter(i => i.estado === 'activa').length / grupo.capacidadMaxima) * 100)
      };

      return {
        success: true,
        data: {
          grupo,
          inscripciones,
          estadisticas
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al obtener grupo');
    }
  }

  /**
   * Actualizar grupo
   */
  async updateGrupo(id, updateData, currentUser) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para actualizar grupos');
      }

      let query = Grupo.findById(id);

      // Verificar permisos de parroquia si no es admin
      if (currentUser.tipoPerfil !== 'admin') {
        query = query.where('parroquia').equals(currentUser.parroquia);
      }

      const grupo = await query;

      if (!grupo) {
        throw ErrorBuilder.notFound('Grupo no encontrado');
      }

      // Verificar catequista si se está cambiando
      if (updateData.catequista && updateData.catequista !== grupo.catequista?.toString()) {
        const catequistaData = await Usuario.findById(updateData.catequista);
        if (!catequistaData || !['catequista', 'coordinador'].includes(catequistaData.tipoPerfil)) {
          throw ErrorBuilder.badRequest('El catequista seleccionado no es válido');
        }

        if (currentUser.tipoPerfil !== 'admin' && 
            catequistaData.parroquia.toString() !== currentUser.parroquia.toString()) {
          throw ErrorBuilder.forbidden('El catequista debe pertenecer a tu parroquia');
        }
      }

      // Verificar nombre único si se está cambiando
      if (updateData.nombre && updateData.nombre !== grupo.nombre) {
        const nombreExistente = await Grupo.findOne({
          nombre: { $regex: `^${updateData.nombre}$`, $options: 'i' },
          parroquia: grupo.parroquia,
          _id: { $ne: id }
        });

        if (nombreExistente) {
          throw ErrorBuilder.conflict('Ya existe un grupo con ese nombre en la parroquia');
        }
      }

      // Verificar capacidad si se está reduciendo
      if (updateData.capacidadMaxima && updateData.capacidadMaxima < grupo.capacidadMaxima) {
        const inscripcionesActivas = await Inscripcion.countDocuments({
          grupo: id,
          estado: 'activa'
        });

        if (updateData.capacidadMaxima < inscripcionesActivas) {
          throw ErrorBuilder.conflict(`No se puede reducir la capacidad por debajo de ${inscripcionesActivas} (inscripciones activas)`);
        }
      }

      // Actualizar grupo
      Object.assign(grupo, updateData);
      await grupo.save();

      await grupo.populate([
        { path: 'nivel', select: 'nombre orden' },
        { path: 'catequista', select: 'nombres apellidos' },
        { path: 'parroquia', select: 'nombre' }
      ]);

      return {
        success: true,
        message: 'Grupo actualizado exitosamente',
        data: grupo
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de grupo inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al actualizar grupo');
    }
  }

  /**
   * Eliminar grupo (soft delete)
   */
  async deleteGrupo(id, currentUser) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para eliminar grupos');
      }

      let query = Grupo.findById(id);

      if (currentUser.tipoPerfil !== 'admin') {
        query = query.where('parroquia').equals(currentUser.parroquia);
      }

      const grupo = await query;

      if (!grupo) {
        throw ErrorBuilder.notFound('Grupo no encontrado');
      }

      // Verificar si tiene inscripciones activas
      const inscripcionesActivas = await Inscripcion.countDocuments({
        grupo: id,
        estado: 'activa'
      });

      if (inscripcionesActivas > 0) {
        throw ErrorBuilder.conflict('No se puede eliminar un grupo con inscripciones activas');
      }

      // Soft delete
      grupo.activo = false;
      await grupo.save();

      return {
        success: true,
        message: 'Grupo eliminado exitosamente'
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al eliminar grupo');
    }
  }

  /**
   * Asignar catequista a grupo
   */
  async asignarCatequista(grupoId, catequistaId, currentUser) {
    try {
      if (!['admin', 'parroco'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para asignar catequistas');
      }

      const [grupo, catequista] = await Promise.all([
        Grupo.findById(grupoId),
        Usuario.findById(catequistaId)
      ]);

      if (!grupo) {
        throw ErrorBuilder.notFound('Grupo no encontrado');
      }

      if (!catequista || !['catequista', 'coordinador'].includes(catequista.tipoPerfil)) {
        throw ErrorBuilder.badRequest('Catequista no válido');
      }

      // Verificar permisos de parroquia
      if (currentUser.tipoPerfil !== 'admin') {
        if (grupo.parroquia.toString() !== currentUser.parroquia.toString() ||
            catequista.parroquia.toString() !== currentUser.parroquia.toString()) {
          throw ErrorBuilder.forbidden('El grupo y catequista deben pertenecer a tu parroquia');
        }
      }

      grupo.catequista = catequistaId;
      await grupo.save();

      await grupo.populate('catequista', 'nombres apellidos');

      return {
        success: true,
        message: 'Catequista asignado exitosamente',
        data: grupo
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al asignar catequista');
    }
  }

  /**
   * Obtener grupos disponibles para un nivel
   */
  async getGruposDisponibles(nivelId, currentUser) {
    try {
      let filtros = {
        nivel: nivelId,
        activo: true
      };

      // Filtrar por parroquia si no es admin
      if (currentUser.tipoPerfil !== 'admin') {
        filtros.parroquia = currentUser.parroquia;
      }

      const grupos = await Grupo.find(filtros)
        .populate('catequista', 'nombres apellidos')
        .sort({ nombre: 1 });

      // Agregar información de disponibilidad
      const gruposConDisponibilidad = await Promise.all(
        grupos.map(async (grupo) => {
          const inscripcionesActivas = await Inscripcion.countDocuments({
            grupo: grupo._id,
            estado: 'activa'
          });

          const disponible = inscripcionesActivas < grupo.capacidadMaxima;

          return {
            _id: grupo._id,
            nombre: grupo.nombre,
            catequista: grupo.catequista,
            horarios: grupo.horarios,
            capacidadMaxima: grupo.capacidadMaxima,
            inscripcionesActivas,
            disponibilidad: grupo.capacidadMaxima - inscripcionesActivas,
            disponible
          };
        })
      );

      return {
        success: true,
        data: gruposConDisponibilidad.filter(g => g.disponible)
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener grupos disponibles');
    }
  }

  /**
   * Obtener estadísticas de grupos
   */
  async getEstadisticas(currentUser) {
    try {
      let filtroBase = {};

      // Filtrar por parroquia si no es admin
      if (currentUser.tipoPerfil !== 'admin') {
        filtroBase.parroquia = currentUser.parroquia;
      }

      const estadisticas = await Promise.all([
        // Total de grupos activos
        Grupo.countDocuments({ ...filtroBase, activo: true }),

        // Grupos por nivel
        Grupo.aggregate([
          { $match: { ...filtroBase, activo: true } },
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

        // Ocupación promedio
        Grupo.aggregate([
          { $match: { ...filtroBase, activo: true } },
          {
            $lookup: {
              from: 'inscripciones',
              let: { grupoId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$grupo', '$$grupoId'] },
                        { $eq: ['$estado', 'activa'] }
                      ]
                    }
                  }
                }
              ],
              as: 'inscripciones'
            }
          },
          {
            $addFields: {
              inscripcionesActivas: { $size: '$inscripciones' },
              porcentajeOcupacion: {
                $multiply: [
                  { $divide: [{ $size: '$inscripciones' }, '$capacidadMaxima'] },
                  100
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              ocupacionPromedio: { $avg: '$porcentajeOcupacion' },
              totalCapacidad: { $sum: '$capacidadMaxima' },
              totalInscritos: { $sum: '$inscripcionesActivas' }
            }
          }
        ])
      ]);

      return {
        success: true,
        data: {
          totalGrupos: estadisticas[0],
          gruposPorNivel: estadisticas[1],
          ocupacion: estadisticas[2][0] || {
            ocupacionPromedio: 0,
            totalCapacidad: 0,
            totalInscritos: 0
          }
        }
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener estadísticas');
    }
  }
}

module.exports = new GrupoService();