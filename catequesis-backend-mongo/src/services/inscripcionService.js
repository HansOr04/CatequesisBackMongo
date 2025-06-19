const Inscripcion = require('../models/Inscripcion');
const Catequizando = require('../models/Catequizando');
const Grupo = require('../models/Grupo');
const Nivel = require('../models/Nivel');
const { AppError, ErrorBuilder } = require('../utils/errors');
const { buildPaginationQuery, buildSortQuery } = require('../utils/queryHelpers');

class InscripcionService {
  /**
   * Crear nueva inscripción
   */
  async createInscripcion(inscripcionData, currentUser) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para crear inscripciones');
      }

      const { catequizando, nivel, grupo, anioLectivo, observaciones } = inscripcionData;

      // Verificar que el catequizando existe y pertenece a la parroquia correcta
      const catequizandoData = await Catequizando.findById(catequizando);
      if (!catequizandoData) {
        throw ErrorBuilder.notFound('Catequizando no encontrado');
      }

      if (currentUser.tipoPerfil !== 'admin' && 
          catequizandoData.parroquia.toString() !== currentUser.parroquia.toString()) {
        throw ErrorBuilder.forbidden('El catequizando no pertenece a tu parroquia');
      }

      // Verificar que el nivel existe
      const nivelData = await Nivel.findById(nivel);
      if (!nivelData) {
        throw ErrorBuilder.notFound('Nivel no encontrado');
      }

      // Verificar que el grupo existe y corresponde al nivel
      const grupoData = await Grupo.findById(grupo).populate('nivel');
      if (!grupoData) {
        throw ErrorBuilder.notFound('Grupo no encontrado');
      }

      if (grupoData.nivel._id.toString() !== nivel.toString()) {
        throw ErrorBuilder.badRequest('El grupo no corresponde al nivel seleccionado');
      }

      // Verificar capacidad del grupo
      const inscripcionesActuales = await Inscripcion.countDocuments({
        grupo,
        estado: 'activa'
      });

      if (inscripcionesActuales >= grupoData.capacidadMaxima) {
        throw ErrorBuilder.conflict('El grupo ha alcanzado su capacidad máxima');
      }

      // Verificar que el catequizando no tenga una inscripción activa en el mismo año lectivo
      const inscripcionExistente = await Inscripcion.findOne({
        catequizando,
        anioLectivo,
        estado: 'activa'
      });

      if (inscripcionExistente) {
        throw ErrorBuilder.conflict('El catequizando ya tiene una inscripción activa para este año lectivo');
      }

      // Crear inscripción
      const nuevaInscripcion = new Inscripcion({
        catequizando,
        nivel,
        grupo,
        anioLectivo,
        fechaInscripcion: new Date(),
        estado: 'activa',
        observaciones,
        usuarioRegistro: currentUser.id
      });

      await nuevaInscripcion.save();
      
      // Poblar datos para la respuesta
      await nuevaInscripcion.populate([
        { path: 'catequizando', select: 'nombres apellidos documento' },
        { path: 'nivel', select: 'nombre orden' },
        { path: 'grupo', select: 'nombre horarios' },
        { path: 'usuarioRegistro', select: 'nombres apellidos' }
      ]);

      return {
        success: true,
        message: 'Inscripción creada exitosamente',
        data: nuevaInscripcion
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de inscripción inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al crear inscripción');
    }
  }

  /**
   * Obtener inscripciones con filtros
   */
  async getInscripciones(queryParams, currentUser) {
    try {
      const { page = 1, limit = 10, search, nivel, grupo, estado, anioLectivo, sort = 'fechaInscripcion' } = queryParams;

      let filtros = {};

      // Filtro por parroquia según el rol del usuario
      if (currentUser.tipoPerfil !== 'admin') {
        // Obtener catequizandos de la parroquia del usuario
        const catequizandosParroquia = await Catequizando.find({ 
          parroquia: currentUser.parroquia 
        }).select('_id');
        
        filtros.catequizando = { $in: catequizandosParroquia.map(c => c._id) };
      }

      // Filtros específicos
      if (nivel) filtros.nivel = nivel;
      if (grupo) filtros.grupo = grupo;
      if (estado) filtros.estado = estado;
      if (anioLectivo) filtros.anioLectivo = anioLectivo;

      // Configurar paginación y ordenamiento
      const paginationQuery = buildPaginationQuery(page, limit);
      const sortQuery = buildSortQuery(sort);

      let query = Inscripcion.find(filtros)
        .populate('catequizando', 'nombres apellidos documento')
        .populate('nivel', 'nombre orden')
        .populate('grupo', 'nombre horarios')
        .populate('usuarioRegistro', 'nombres apellidos')
        .sort(sortQuery)
        .skip(paginationQuery.skip)
        .limit(paginationQuery.limit);

      // Filtro de búsqueda en campos populados
      if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        query = query.where({
          $or: [
            { 'catequizando.nombres': searchRegex },
            { 'catequizando.apellidos': searchRegex },
            { 'catequizando.documento': searchRegex }
          ]
        });
      }

      const [inscripciones, total] = await Promise.all([
        query,
        Inscripcion.countDocuments(filtros)
      ]);

      return {
        success: true,
        data: inscripciones,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / paginationQuery.limit),
          totalItems: total,
          itemsPerPage: paginationQuery.limit
        }
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener inscripciones');
    }
  }

  /**
   * Actualizar estado de inscripción
   */
  async updateEstadoInscripcion(id, nuevoEstado, observaciones, currentUser) {
    try {
      if (!['admin', 'parroco', 'secretaria'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para actualizar inscripciones');
      }

      const inscripcion = await Inscripcion.findById(id)
        .populate('catequizando', 'parroquia');

      if (!inscripcion) {
        throw ErrorBuilder.notFound('Inscripción no encontrada');
      }

      // Verificar permisos de parroquia
      if (currentUser.tipoPerfil !== 'admin' && 
          inscripcion.catequizando.parroquia.toString() !== currentUser.parroquia.toString()) {
        throw ErrorBuilder.forbidden('No tienes permisos para esta inscripción');
      }

      inscripcion.estado = nuevoEstado;
      if (observaciones) {
        inscripcion.observaciones = observaciones;
      }
      
      await inscripcion.save();

      return {
        success: true,
        message: 'Estado de inscripción actualizado exitosamente',
        data: inscripcion
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw ErrorBuilder.internal('Error interno al actualizar inscripción');
    }
  }

  /**
   * Transferir catequizando a otro grupo
   */
  async transferirGrupo(inscripcionId, nuevoGrupoId, observaciones, currentUser) {
    try {
      if (!['admin', 'parroco', 'secretaria'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para transferir inscripciones');
      }

      const inscripcion = await Inscripcion.findById(inscripcionId)
        .populate('catequizando', 'parroquia')
        .populate('nivel');

      if (!inscripcion) {
        throw ErrorBuilder.notFound('Inscripción no encontrada');
      }

      // Verificar nuevo grupo
      const nuevoGrupo = await Grupo.findById(nuevoGrupoId).populate('nivel');
      if (!nuevoGrupo) {
        throw ErrorBuilder.notFound('Nuevo grupo no encontrado');
      }

      // Verificar que el nuevo grupo sea del mismo nivel
      if (nuevoGrupo.nivel._id.toString() !== inscripcion.nivel._id.toString()) {
        throw ErrorBuilder.badRequest('El nuevo grupo debe ser del mismo nivel');
      }

      // Verificar capacidad del nuevo grupo
      const inscripcionesNuevoGrupo = await Inscripcion.countDocuments({
        grupo: nuevoGrupoId,
        estado: 'activa'
      });

      if (inscripcionesNuevoGrupo >= nuevoGrupo.capacidadMaxima) {
        throw ErrorBuilder.conflict('El nuevo grupo ha alcanzado su capacidad máxima');
      }

      // Actualizar inscripción
      inscripcion.grupo = nuevoGrupoId;
      if (observaciones) {
        inscripcion.observaciones = observaciones;
      }

      await inscripcion.save();

      return {
        success: true,
        message: 'Catequizando transferido exitosamente',
        data: inscripcion
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw ErrorBuilder.internal('Error interno al transferir inscripción');
    }
  }

  /**
   * Obtener estadísticas de inscripciones
   */
  async getEstadisticas(filtros, currentUser) {
    try {
      let baseFilter = {};

      // Filtrar por parroquia si no es admin
      if (currentUser.tipoPerfil !== 'admin') {
        const catequizandosParroquia = await Catequizando.find({ 
          parroquia: currentUser.parroquia 
        }).select('_id');
        baseFilter.catequizando = { $in: catequizandosParroquia.map(c => c._id) };
      }

      if (filtros.anioLectivo) {
        baseFilter.anioLectivo = filtros.anioLectivo;
      }

      const estadisticas = await Promise.all([
        // Total por estado
        Inscripcion.aggregate([
          { $match: baseFilter },
          { $group: { _id: '$estado', count: { $sum: 1 } } }
        ]),

        // Inscripciones por nivel
        Inscripcion.aggregate([
          { $match: baseFilter },
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

        // Inscripciones por mes
        Inscripcion.aggregate([
          { $match: baseFilter },
          {
            $group: {
              _id: {
                year: { $year: '$fechaInscripcion' },
                month: { $month: '$fechaInscripcion' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 12 }
        ])
      ]);

      return {
        success: true,
        data: {
          porEstado: estadisticas[0],
          porNivel: estadisticas[1],
          porMes: estadisticas[2]
        }
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener estadísticas');
    }
  }
}
module.exports = new InscripcionService();