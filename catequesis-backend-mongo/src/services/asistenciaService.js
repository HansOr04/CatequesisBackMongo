const Asistencia = require('../models/Asistencia');
const Inscripcion = require('../models/Inscripcion');
const Grupo = require('../models/Grupo');
const { AppError, ErrorBuilder } = require('../utils/errors');
const { buildPaginationQuery, buildSortQuery } = require('../utils/queryHelpers');

class AsistenciaService {
  /**
   * Registrar asistencia para una clase
   */
  async registrarAsistencia(asistenciaData, currentUser) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco', 'catequista', 'coordinador'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para registrar asistencias');
      }

      const { grupo, fecha, asistencias, observaciones } = asistenciaData;

      // Verificar que el grupo existe y el usuario tiene acceso
      const grupoData = await Grupo.findById(grupo)
        .populate('catequista', '_id')
        .populate('parroquia', '_id');

      if (!grupoData) {
        throw ErrorBuilder.notFound('Grupo no encontrado');
      }

      // Verificar permisos específicos
      if (currentUser.tipoPerfil === 'catequista') {
        if (grupoData.catequista?._id.toString() !== currentUser.id) {
          throw ErrorBuilder.forbidden('Solo puedes registrar asistencia en tus grupos asignados');
        }
      } else if (!['admin', 'parroco', 'coordinador'].includes(currentUser.tipoPerfil)) {
        if (grupoData.parroquia._id.toString() !== currentUser.parroquia.toString()) {
          throw ErrorBuilder.forbidden('No tienes acceso a este grupo');
        }
      }

      // Verificar que no existe ya un registro de asistencia para esta fecha y grupo
      const fechaObj = new Date(fecha);
      const inicioDelDia = new Date(fechaObj.getFullYear(), fechaObj.getMonth(), fechaObj.getDate());
      const finDelDia = new Date(inicioDelDia.getTime() + 24 * 60 * 60 * 1000);

      const asistenciaExistente = await Asistencia.findOne({
        grupo,
        fecha: {
          $gte: inicioDelDia,
          $lt: finDelDia
        }
      });

      if (asistenciaExistente) {
        throw ErrorBuilder.conflict('Ya existe un registro de asistencia para esta fecha y grupo');
      }

      // Validar que todas las inscripciones pertenezcan al grupo
      const inscripcionesGrupo = await Inscripcion.find({
        grupo,
        estado: 'activa'
      }).select('_id catequizando');

      const inscripcionesIds = inscripcionesGrupo.map(i => i._id.toString());
      const asistenciasInvalidas = asistencias.filter(a => !inscripcionesIds.includes(a.inscripcion));

      if (asistenciasInvalidas.length > 0) {
        throw ErrorBuilder.badRequest('Algunas inscripciones no pertenecen al grupo especificado');
      }

      // Crear registro de asistencia
      const nuevaAsistencia = new Asistencia({
        grupo,
        fecha: fechaObj,
        asistencias,
        observaciones,
        registradoPor: currentUser.id
      });

      await nuevaAsistencia.save();

      // Poblar datos para la respuesta
      await nuevaAsistencia.populate([
        { path: 'grupo', select: 'nombre', populate: { path: 'nivel', select: 'nombre' } },
        { 
          path: 'asistencias.inscripcion', 
          select: 'catequizando',
          populate: { path: 'catequizando', select: 'nombres apellidos documento' }
        },
        { path: 'registradoPor', select: 'nombres apellidos' }
      ]);

      return {
        success: true,
        message: 'Asistencia registrada exitosamente',
        data: nuevaAsistencia
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de asistencia inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al registrar asistencia');
    }
  }

  /**
   * Obtener asistencias con filtros
   */
  async getAsistencias(queryParams, currentUser) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        grupo, 
        fechaInicio, 
        fechaFin, 
        sort = '-fecha' 
      } = queryParams;

      let filtros = {};

      // Filtrar por grupo
      if (grupo) {
        filtros.grupo = grupo;
        
        // Verificar permisos para el grupo específico
        const grupoData = await Grupo.findById(grupo)
          .populate('catequista', '_id')
          .populate('parroquia', '_id');

        if (!grupoData) {
          throw ErrorBuilder.notFound('Grupo no encontrado');
        }

        if (currentUser.tipoPerfil === 'catequista') {
          if (grupoData.catequista?._id.toString() !== currentUser.id) {
            throw ErrorBuilder.forbidden('No tienes acceso a este grupo');
          }
        } else if (!['admin'].includes(currentUser.tipoPerfil)) {
          if (grupoData.parroquia._id.toString() !== currentUser.parroquia.toString()) {
            throw ErrorBuilder.forbidden('No tienes acceso a este grupo');
          }
        }
      } else {
        // Si no se especifica grupo, filtrar por permisos del usuario
        if (currentUser.tipoPerfil === 'catequista') {
          // Obtener grupos del catequista
          const gruposDelCatequista = await Grupo.find({ 
            catequista: currentUser.id,
            activo: true 
          }).select('_id');
          
          filtros.grupo = { $in: gruposDelCatequista.map(g => g._id) };
        } else if (!['admin'].includes(currentUser.tipoPerfil)) {
          // Obtener grupos de la parroquia
          const gruposDeParroquia = await Grupo.find({ 
            parroquia: currentUser.parroquia,
            activo: true 
          }).select('_id');
          
          filtros.grupo = { $in: gruposDeParroquia.map(g => g._id) };
        }
      }

      // Filtros de fecha
      if (fechaInicio || fechaFin) {
        filtros.fecha = {};
        if (fechaInicio) filtros.fecha.$gte = new Date(fechaInicio);
        if (fechaFin) filtros.fecha.$lte = new Date(fechaFin);
      }

      // Configurar paginación y ordenamiento
      const paginationQuery = buildPaginationQuery(page, limit);
      const sortQuery = buildSortQuery(sort);

      const [asistencias, total] = await Promise.all([
        Asistencia.find(filtros)
          .populate('grupo', 'nombre')
          .populate('grupo.nivel', 'nombre')
          .populate('asistencias.inscripcion', 'catequizando')
          .populate('asistencias.inscripcion.catequizando', 'nombres apellidos')
          .populate('registradoPor', 'nombres apellidos')
          .sort(sortQuery)
          .skip(paginationQuery.skip)
          .limit(paginationQuery.limit),
        Asistencia.countDocuments(filtros)
      ]);

      return {
        success: true,
        data: asistencias,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / paginationQuery.limit),
          totalItems: total,
          itemsPerPage: paginationQuery.limit
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al obtener asistencias');
    }
  }

  /**
   * Actualizar asistencia existente
   */
  async updateAsistencia(id, updateData, currentUser) {
    try {
      const asistencia = await Asistencia.findById(id)
        .populate('grupo', 'catequista parroquia');

      if (!asistencia) {
        throw ErrorBuilder.notFound('Registro de asistencia no encontrado');
      }

      // Verificar permisos
      if (currentUser.tipoPerfil === 'catequista') {
        if (asistencia.grupo.catequista?.toString() !== currentUser.id) {
          throw ErrorBuilder.forbidden('Solo puedes actualizar asistencias de tus grupos');
        }
      } else if (!['admin', 'parroco', 'coordinador'].includes(currentUser.tipoPerfil)) {
        if (asistencia.grupo.parroquia.toString() !== currentUser.parroquia.toString()) {
          throw ErrorBuilder.forbidden('No tienes acceso a esta asistencia');
        }
      }

      // Actualizar campos permitidos
      const { asistencias, observaciones } = updateData;
      
      if (asistencias) {
        // Validar que las inscripciones pertenezcan al grupo
        const inscripcionesGrupo = await Inscripcion.find({
          grupo: asistencia.grupo._id,
          estado: 'activa'
        }).select('_id');

        const inscripcionesIds = inscripcionesGrupo.map(i => i._id.toString());
        const asistenciasInvalidas = asistencias.filter(a => !inscripcionesIds.includes(a.inscripcion));

        if (asistenciasInvalidas.length > 0) {
          throw ErrorBuilder.badRequest('Algunas inscripciones no pertenecen al grupo');
        }

        asistencia.asistencias = asistencias;
      }

      if (observaciones !== undefined) {
        asistencia.observaciones = observaciones;
      }

      await asistencia.save();

      // Poblar datos para la respuesta
      await asistencia.populate([
        { path: 'grupo', select: 'nombre', populate: { path: 'nivel', select: 'nombre' } },
        { 
          path: 'asistencias.inscripcion', 
          select: 'catequizando',
          populate: { path: 'catequizando', select: 'nombres apellidos documento' }
        },
        { path: 'registradoPor', select: 'nombres apellidos' }
      ]);

      return {
        success: true,
        message: 'Asistencia actualizada exitosamente',
        data: asistencia
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de asistencia inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al actualizar asistencia');
    }
  }

  /**
   * Obtener resumen de asistencias por grupo
   */
  async getResumenAsistencias(grupoId, fechaInicio, fechaFin, currentUser) {
    try {
      // Verificar acceso al grupo
      const grupo = await Grupo.findById(grupoId)
        .populate('catequista', '_id')
        .populate('parroquia', '_id');

      if (!grupo) {
        throw ErrorBuilder.notFound('Grupo no encontrado');
      }

      // Verificar permisos
      if (currentUser.tipoPerfil === 'catequista') {
        if (grupo.catequista?._id.toString() !== currentUser.id) {
          throw ErrorBuilder.forbidden('No tienes acceso a este grupo');
        }
      } else if (!['admin', 'parroco', 'coordinador'].includes(currentUser.tipoPerfil)) {
        if (grupo.parroquia._id.toString() !== currentUser.parroquia.toString()) {
          throw ErrorBuilder.forbidden('No tienes acceso a este grupo');
        }
      }

      // Construir filtros de fecha
      let filtroFecha = {};
      if (fechaInicio || fechaFin) {
        filtroFecha.fecha = {};
        if (fechaInicio) filtroFecha.fecha.$gte = new Date(fechaInicio);
        if (fechaFin) filtroFecha.fecha.$lte = new Date(fechaFin);
      }

      // Obtener inscripciones activas del grupo
      const inscripcionesActivas = await Inscripcion.find({
        grupo: grupoId,
        estado: 'activa'
      }).populate('catequizando', 'nombres apellidos documento');

      // Obtener asistencias del período
      const asistencias = await Asistencia.find({
        grupo: grupoId,
        ...filtroFecha
      }).sort({ fecha: 1 });

      // Calcular estadísticas por catequizando
      const estadisticasPorCatequizando = inscripcionesActivas.map(inscripcion => {
        const asistenciasDelCatequizando = [];
        let totalPresente = 0;
        let totalAusente = 0;
        let totalJustificado = 0;

        asistencias.forEach(asistencia => {
          const registroAsistencia = asistencia.asistencias.find(
            a => a.inscripcion.toString() === inscripcion._id.toString()
          );

          if (registroAsistencia) {
            asistenciasDelCatequizando.push({
              fecha: asistencia.fecha,
              estado: registroAsistencia.estado,
              observaciones: registroAsistencia.observaciones
            });

            switch (registroAsistencia.estado) {
              case 'presente': totalPresente++; break;
              case 'ausente': totalAusente++; break;
              case 'justificado': totalJustificado++; break;
            }
          }
        });

        const totalClases = asistencias.length;
        const porcentajeAsistencia = totalClases > 0 ? 
          Math.round((totalPresente / totalClases) * 100) : 0;

        return {
          catequizando: inscripcion.catequizando,
          inscripcionId: inscripcion._id,
          estadisticas: {
            totalClases,
            totalPresente,
            totalAusente,
            totalJustificado,
            porcentajeAsistencia
          },
          detalleAsistencias: asistenciasDelCatequizando
        };
      });

      // Estadísticas generales del grupo
      const estadisticasGenerales = {
        totalCatequizandos: inscripcionesActivas.length,
        totalClases: asistencias.length,
        promedioAsistencia: estadisticasPorCatequizando.length > 0 ?
          Math.round(estadisticasPorCatequizando.reduce((sum, est) => 
            sum + est.estadisticas.porcentajeAsistencia, 0) / estadisticasPorCatequizando.length) : 0
      };

      return {
        success: true,
        data: {
          grupo: {
            _id: grupo._id,
            nombre: grupo.nombre,
            nivel: grupo.nivel
          },
          periodo: {
            fechaInicio,
            fechaFin
          },
          estadisticasGenerales,
          estadisticasPorCatequizando
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al obtener resumen de asistencias');
    }
  }

  /**
   * Obtener plantilla de asistencia para una fecha
   */
  async getPlantillaAsistencia(grupoId, fecha, currentUser) {
    try {
      // Verificar acceso al grupo
      const grupo = await Grupo.findById(grupoId)
        .populate('catequista', '_id nombres apellidos')
        .populate('parroquia', '_id')
        .populate('nivel', 'nombre');

      if (!grupo) {
        throw ErrorBuilder.notFound('Grupo no encontrado');
      }

      // Verificar permisos
      if (currentUser.tipoPerfil === 'catequista') {
        if (grupo.catequista?._id.toString() !== currentUser.id) {
          throw ErrorBuilder.forbidden('No tienes acceso a este grupo');
        }
      } else if (!['admin', 'parroco', 'coordinador'].includes(currentUser.tipoPerfil)) {
        if (grupo.parroquia._id.toString() !== currentUser.parroquia.toString()) {
          throw ErrorBuilder.forbidden('No tienes acceso a este grupo');
        }
      }

      // Verificar si ya existe asistencia para esta fecha
      const fechaObj = new Date(fecha);
      const inicioDelDia = new Date(fechaObj.getFullYear(), fechaObj.getMonth(), fechaObj.getDate());
      const finDelDia = new Date(inicioDelDia.getTime() + 24 * 60 * 60 * 1000);

      const asistenciaExistente = await Asistencia.findOne({
        grupo: grupoId,
        fecha: {
          $gte: inicioDelDia,
          $lt: finDelDia
        }
      }).populate('asistencias.inscripcion', 'catequizando')
        .populate('asistencias.inscripcion.catequizando', 'nombres apellidos documento');

      if (asistenciaExistente) {
        return {
          success: true,
          data: {
            existeRegistro: true,
            asistencia: asistenciaExistente
          }
        };
      }

      // Obtener inscripciones activas del grupo
      const inscripciones = await Inscripcion.find({
        grupo: grupoId,
        estado: 'activa'
      }).populate('catequizando', 'nombres apellidos documento')
        .sort({ 'catequizando.apellidos': 1, 'catequizando.nombres': 1 });

      // Crear plantilla de asistencia
      const plantilla = inscripciones.map(inscripcion => ({
        inscripcion: inscripcion._id,
        catequizando: inscripcion.catequizando,
        estado: 'presente', // Estado por defecto
        observaciones: ''
      }));

      return {
        success: true,
        data: {
          existeRegistro: false,
          grupo: {
            _id: grupo._id,
            nombre: grupo.nombre,
            nivel: grupo.nivel,
            catequista: grupo.catequista
          },
          fecha: fechaObj,
          plantillaAsistencia: plantilla
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al obtener plantilla de asistencia');
    }
  }

  /**
   * Eliminar registro de asistencia
   */
  async deleteAsistencia(id, currentUser) {
    try {
      const asistencia = await Asistencia.findById(id)
        .populate('grupo', 'catequista parroquia');

      if (!asistencia) {
        throw ErrorBuilder.notFound('Registro de asistencia no encontrado');
      }

      // Verificar permisos (solo admin, parroco o el catequista que registró)
      if (currentUser.tipoPerfil === 'catequista') {
        if (asistencia.grupo.catequista?.toString() !== currentUser.id) {
          throw ErrorBuilder.forbidden('Solo puedes eliminar asistencias de tus grupos');
        }
      } else if (!['admin', 'parroco'].includes(currentUser.tipoPerfil)) {
        if (asistencia.grupo.parroquia.toString() !== currentUser.parroquia.toString()) {
          throw ErrorBuilder.forbidden('No tienes acceso a esta asistencia');
        }
      }

      await Asistencia.findByIdAndDelete(id);

      return {
        success: true,
        message: 'Registro de asistencia eliminado exitosamente'
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al eliminar asistencia');
    }
  }

  /**
   * Obtener estadísticas de asistencia generales
   */
  async getEstadisticasAsistencia(filtros, currentUser) {
    try {
      let baseFilter = {};

      // Aplicar filtros según permisos del usuario
      if (currentUser.tipoPerfil === 'catequista') {
        const gruposDelCatequista = await Grupo.find({ 
          catequista: currentUser.id,
          activo: true 
        }).select('_id');
        baseFilter.grupo = { $in: gruposDelCatequista.map(g => g._id) };
      } else if (!['admin'].includes(currentUser.tipoPerfil)) {
        const gruposDeParroquia = await Grupo.find({ 
          parroquia: currentUser.parroquia,
          activo: true 
        }).select('_id');
        baseFilter.grupo = { $in: gruposDeParroquia.map(g => g._id) };
      }

      // Aplicar filtros adicionales
      if (filtros.grupo) baseFilter.grupo = filtros.grupo;
      if (filtros.fechaInicio || filtros.fechaFin) {
        baseFilter.fecha = {};
        if (filtros.fechaInicio) baseFilter.fecha.$gte = new Date(filtros.fechaInicio);
        if (filtros.fechaFin) baseFilter.fecha.$lte = new Date(filtros.fechaFin);
      }

      const estadisticas = await Asistencia.aggregate([
        { $match: baseFilter },
        { $unwind: '$asistencias' },
        {
          $group: {
            _id: '$asistencias.estado',
            count: { $sum: 1 }
          }
        }
      ]);

      // Calcular totales
      const totales = estadisticas.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        acc.total += stat.count;
        return acc;
      }, { presente: 0, ausente: 0, justificado: 0, total: 0 });

      // Calcular porcentajes
      const porcentajes = {
        presente: totales.total > 0 ? Math.round((totales.presente / totales.total) * 100) : 0,
        ausente: totales.total > 0 ? Math.round((totales.ausente / totales.total) * 100) : 0,
        justificado: totales.total > 0 ? Math.round((totales.justificado / totales.total) * 100) : 0
      };

      return {
        success: true,
        data: {
          totales,
          porcentajes,
          periodo: {
            fechaInicio: filtros.fechaInicio,
            fechaFin: filtros.fechaFin
          }
        }
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener estadísticas de asistencia');
    }
  }
}

module.exports = new AsistenciaService();