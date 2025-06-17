const { Asistencia, Inscripcion, Grupo } = require('../models');

/**
 * Controlador de Asistencias
 */
class AsistenciaController {
  /**
   * Obtener asistencias con filtros
   * GET /api/asistencias
   */
  async getAllAsistencias(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        grupo, 
        inscripcion,
        fecha,
        fechaInicio,
        fechaFin,
        asistio = 'all'
      } = req.query;
      
      // Construir filtros
      const filtros = {};
      
      if (inscripcion) {
        filtros.inscripcion = inscripcion;
      }
      
      if (asistio !== 'all') {
        filtros.asistio = asistio === 'true';
      }
      
      // Filtros de fecha
      if (fecha) {
        const fechaObj = new Date(fecha);
        filtros.fecha = {
          $gte: new Date(fechaObj.setHours(0, 0, 0, 0)),
          $lt: new Date(fechaObj.setHours(23, 59, 59, 999))
        };
      } else if (fechaInicio || fechaFin) {
        filtros.fecha = {};
        if (fechaInicio) filtros.fecha.$gte = new Date(fechaInicio);
        if (fechaFin) filtros.fecha.$lte = new Date(fechaFin);
      }
      
      // Si se especifica grupo, filtrar por inscripciones de ese grupo
      if (grupo) {
        const inscripcionesGrupo = await Inscripcion.find({ grupo }).select('_id');
        filtros.inscripcion = { $in: inscripcionesGrupo.map(i => i._id) };
      }
      
      // Si es catequista, solo ver asistencias de sus grupos
      if (req.user.tipoPerfil === 'catequista') {
        const misGrupos = await Grupo.find({
          'catequistas.usuario': req.user.id,
          'catequistas.activo': true
        }).select('_id');
        
        const inscripcionesMisGrupos = await Inscripcion.find({
          grupo: { $in: misGrupos.map(g => g._id) }
        }).select('_id');
        
        filtros.inscripcion = { $in: inscripcionesMisGrupos.map(i => i._id) };
      }
      
      // Filtrar por parroquia si no es admin
      if (req.user.tipoPerfil !== 'admin') {
        const inscripcionesParroquia = await Inscripcion.find({
          parroquia: req.user.parroquia
        }).select('_id');
        
        if (filtros.inscripcion) {
          // Intersección de filtros
          const inscripcionesIds = filtros.inscripcion.$in || [filtros.inscripcion];
          filtros.inscripcion = {
            $in: inscripcionesIds.filter(id => 
              inscripcionesParroquia.some(ip => ip._id.toString() === id.toString())
            )
          };
        } else {
          filtros.inscripcion = { $in: inscripcionesParroquia.map(i => i._id) };
        }
      }

      // Paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [asistencias, total] = await Promise.all([
        Asistencia.find(filtros)
          .populate({
            path: 'inscripcion',
            populate: [
              { path: 'catequizando', select: 'nombres apellidos documentoIdentidad' },
              { path: 'grupo', select: 'nombre nivel' },
              { path: 'parroquia', select: 'nombre' }
            ]
          })
          .populate('registro.registradoPor', 'datosPersonales.nombres datosPersonales.apellidos')
          .sort({ fecha: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Asistencia.countDocuments(filtros)
      ]);

      return res.status(200).json({
        success: true,
        message: 'Asistencias obtenidas exitosamente',
        data: {
          asistencias,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error obteniendo asistencias:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener asistencia por ID
   * GET /api/asistencias/:id
   */
  async getAsistenciaById(req, res) {
    try {
      const { id } = req.params;

      const asistencia = await Asistencia.findById(id)
        .populate({
          path: 'inscripcion',
          populate: [
            { path: 'catequizando' },
            { path: 'grupo' },
            { path: 'parroquia' }
          ]
        })
        .populate('registro.registradoPor', 'datosPersonales username')
        .populate('observaciones.usuario', 'datosPersonales username');

      if (!asistencia) {
        return res.status(404).json({
          success: false,
          message: 'Asistencia no encontrada'
        });
      }

      // Verificar permisos
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== asistencia.inscripcion.parroquia._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver esta asistencia'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Asistencia obtenida exitosamente',
        data: asistencia
      });

    } catch (error) {
      console.error('Error obteniendo asistencia:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Registrar asistencia individual
   * POST /api/asistencias
   */
  async registrarAsistencia(req, res) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria', 'catequista'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para registrar asistencias'
        });
      }

      const asistenciaData = req.body;

      // Verificar que la inscripción existe
      const inscripcion = await Inscripcion.findById(asistenciaData.inscripcion)
        .populate('grupo')
        .populate('parroquia');

      if (!inscripcion) {
        return res.status(404).json({
          success: false,
          message: 'Inscripción no encontrada'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== inscripcion.parroquia._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para esta inscripción'
        });
      }

      // Si es catequista, verificar que esté asignado al grupo
      if (req.user.tipoPerfil === 'catequista') {
        const esAsignado = inscripcion.grupo.catequistas.some(cat => 
          cat.usuario.toString() === req.user.id && cat.activo
        );
        
        if (!esAsignado) {
          return res.status(403).json({
            success: false,
            message: 'No estás asignado a este grupo'
          });
        }
      }

      // Verificar que no exista asistencia para la misma fecha
      const fechaAsistencia = new Date(asistenciaData.fecha);
      const existeAsistencia = await Asistencia.findOne({
        inscripcion: asistenciaData.inscripcion,
        fecha: {
          $gte: new Date(fechaAsistencia.setHours(0, 0, 0, 0)),
          $lt: new Date(fechaAsistencia.setHours(23, 59, 59, 999))
        }
      });

      if (existeAsistencia) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un registro de asistencia para esta fecha'
        });
      }

      // Agregar información de registro
      asistenciaData.registro = {
        registradoPor: req.user.id,
        fechaRegistro: new Date(),
        metodoRegistro: asistenciaData.registro?.metodoRegistro || 'manual'
      };

      const nuevaAsistencia = new Asistencia(asistenciaData);
      await nuevaAsistencia.save();

      // Poblar datos para respuesta
      await nuevaAsistencia.populate([
        {
          path: 'inscripcion',
          populate: [
            { path: 'catequizando', select: 'nombres apellidos' },
            { path: 'grupo', select: 'nombre' }
          ]
        },
        { path: 'registro.registradoPor', select: 'datosPersonales.nombres datosPersonales.apellidos' }
      ]);

      return res.status(201).json({
        success: true,
        message: 'Asistencia registrada exitosamente',
        data: nuevaAsistencia
      });

    } catch (error) {
      console.error('Error registrando asistencia:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de asistencia inválidos',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Registrar asistencia masiva para un grupo
   * POST /api/asistencias/grupo/:grupoId
   */
  async registrarAsistenciaGrupo(req, res) {
    try {
      const { grupoId } = req.params;
      const { fecha, asistencias, tema, tipoClase = 'regular' } = req.body;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria', 'catequista'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para registrar asistencias'
        });
      }

      const grupo = await Grupo.findById(grupoId).populate('parroquia');
      if (!grupo) {
        return res.status(404).json({
          success: false,
          message: 'Grupo no encontrado'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== grupo.parroquia._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para este grupo'
        });
      }

      // Si es catequista, verificar que esté asignado al grupo
      if (req.user.tipoPerfil === 'catequista') {
        const esAsignado = grupo.catequistas.some(cat => 
          cat.usuario.toString() === req.user.id && cat.activo
        );
        
        if (!esAsignado) {
          return res.status(403).json({
            success: false,
            message: 'No estás asignado a este grupo'
          });
        }
      }

      // Verificar que no existan asistencias para esta fecha
      const fechaObj = new Date(fecha);
      const asistenciasExistentes = await Asistencia.find({
        fecha: {
          $gte: new Date(fechaObj.setHours(0, 0, 0, 0)),
          $lt: new Date(fechaObj.setHours(23, 59, 59, 999))
        },
        inscripcion: { $in: asistencias.map(a => a.inscripcion) }
      });

      if (asistenciasExistentes.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Ya existen registros de asistencia para algunos catequizandos en esta fecha'
        });
      }

      // Crear registros de asistencia
      const registrosAsistencia = asistencias.map(asistencia => ({
        ...asistencia,
        fecha: new Date(fecha),
        tema,
        tipoClase,
        registro: {
          registradoPor: req.user.id,
          fechaRegistro: new Date(),
          metodoRegistro: 'lista'
        }
      }));

      const nuevasAsistencias = await Asistencia.insertMany(registrosAsistencia);

      // Actualizar estadísticas del grupo
      await grupo.actualizarEstadisticas();

      return res.status(201).json({
        success: true,
        message: `${nuevasAsistencias.length} asistencias registradas exitosamente`,
        data: {
          total: nuevasAsistencias.length,
          fecha: fecha,
          grupo: grupo.nombre,
          asistencias: nuevasAsistencias
        }
      });

    } catch (error) {
      console.error('Error registrando asistencias grupales:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar asistencia
   * PUT /api/asistencias/:id
   */
  async updateAsistencia(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria', 'catequista'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar asistencias'
        });
      }

      const asistencia = await Asistencia.findById(id)
        .populate({
          path: 'inscripcion',
          populate: [
            { path: 'grupo' },
            { path: 'parroquia' }
          ]
        });

      if (!asistencia) {
        return res.status(404).json({
          success: false,
          message: 'Asistencia no encontrada'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== asistencia.inscripcion.parroquia._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para esta asistencia'
        });
      }

      // Si es catequista, verificar que esté asignado al grupo
      if (req.user.tipoPerfil === 'catequista') {
        const esAsignado = asistencia.inscripcion.grupo.catequistas.some(cat => 
          cat.usuario.toString() === req.user.id && cat.activo
        );
        
        if (!esAsignado) {
          return res.status(403).json({
            success: false,
            message: 'No estás asignado a este grupo'
          });
        }
      }

      // Actualizar asistencia
      Object.assign(asistencia, updateData);
      await asistencia.save();

      return res.status(200).json({
        success: true,
        message: 'Asistencia actualizada exitosamente',
        data: asistencia
      });

    } catch (error) {
      console.error('Error actualizando asistencia:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de asistencia inválidos',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener asistencias por grupo y fecha
   * GET /api/asistencias/grupo/:grupoId/fecha/:fecha
   */
  async getAsistenciasPorGrupoYFecha(req, res) {
    try {
      const { grupoId, fecha } = req.params;

      const grupo = await Grupo.findById(grupoId);
      if (!grupo) {
        return res.status(404).json({
          success: false,
          message: 'Grupo no encontrado'
        });
      }

      // Verificar permisos
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== grupo.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para este grupo'
        });
      }

      const asistencias = await Asistencia.obtenerPorGrupoYFecha(grupoId, fecha);

      return res.status(200).json({
        success: true,
        message: 'Asistencias obtenidas exitosamente',
        data: {
          grupo: grupo.nombre,
          fecha,
          asistencias
        }
      });

    } catch (error) {
      console.error('Error obteniendo asistencias por grupo y fecha:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas de asistencia por grupo
   * GET /api/asistencias/stats/grupo/:grupoId
   */
  async getStatsGrupo(req, res) {
    try {
      const { grupoId } = req.params;
      const { fechaInicio, fechaFin } = req.query;

      const grupo = await Grupo.findById(grupoId);
      if (!grupo) {
        return res.status(404).json({
          success: false,
          message: 'Grupo no encontrado'
        });
      }

      // Verificar permisos
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== grupo.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para este grupo'
        });
      }

      const stats = await Asistencia.obtenerEstadisticasPorGrupo(
        grupoId, 
        fechaInicio, 
        fechaFin
      );

      return res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: {
          grupo: grupo.nombre,
          periodo: { fechaInicio, fechaFin },
          estadisticas: stats[0] || {
            totalRegistros: 0,
            totalAsistencias: 0,
            totalAusencias: 0,
            ausenciasJustificadas: 0,
            llegadasTarde: 0,
            salidasTempranas: 0,
            totalFechas: 0,
            totalCatequizandos: 0,
            porcentajeAsistencia: 0,
            promedioAsistenciaPorFecha: 0
          }
        }
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener reporte de asistencia
   * GET /api/asistencias/reporte
   */
  async getReporteAsistencia(req, res) {
    try {
      const { parroquia, grupo, fechaInicio, fechaFin } = req.query;

      const filtros = {};

      // Filtrar por parroquia del usuario si no es admin
      if (req.user.tipoPerfil !== 'admin') {
        // Necesitamos hacer el filtro a través de inscripciones
        const inscripcionesParroquia = await Inscripcion.find({
          parroquia: req.user.parroquia
        }).select('_id');
        
        filtros['inscripcion.parroquia'] = req.user.parroquia;
      } else if (parroquia) {
        filtros['inscripcion.parroquia'] = parroquia;
      }

      if (grupo) {
        filtros['inscripcion.grupo'] = grupo;
      }

      if (fechaInicio || fechaFin) {
        filtros.fecha = {};
        if (fechaInicio) filtros.fecha.$gte = new Date(fechaInicio);
        if (fechaFin) filtros.fecha.$lte = new Date(fechaFin);
      }

      const reporte = await Asistencia.obtenerReporteAsistencia(filtros);

      return res.status(200).json({
        success: true,
        message: 'Reporte generado exitosamente',
        data: {
          periodo: { fechaInicio, fechaFin },
          totalCatequizandos: reporte.length,
          reporte
        }
      });

    } catch (error) {
      console.error('Error generando reporte:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Agregar observación a asistencia
   * POST /api/asistencias/:id/observaciones
   */
  async agregarObservacion(req, res) {
    try {
      const { id } = req.params;
      const { contenido, tipo = 'general' } = req.body;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria', 'catequista'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para agregar observaciones'
        });
      }

      const asistencia = await Asistencia.findById(id)
        .populate({
          path: 'inscripcion',
          populate: [
            { path: 'grupo' },
            { path: 'parroquia' }
          ]
        });

      if (!asistencia) {
        return res.status(404).json({
          success: false,
          message: 'Asistencia no encontrada'
        });
      }

      // Verificar permisos
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== asistencia.inscripcion.parroquia._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para esta asistencia'
        });
      }

      await asistencia.agregarObservacion(contenido, req.user.id, tipo);

      return res.status(200).json({
        success: true,
        message: 'Observación agregada exitosamente',
        data: {
          observacion: asistencia.observaciones[asistencia.observaciones.length - 1]
        }
      });

    } catch (error) {
      console.error('Error agregando observación:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Registrar tarea en asistencia
   * POST /api/asistencias/:id/tareas
   */
  async registrarTarea(req, res) {
    try {
      const { id } = req.params;
      const { descripcion, entregada = false, calificacion, observaciones } = req.body;

      // Solo catequistas y superiores pueden registrar tareas
      if (!['admin', 'parroco', 'secretaria', 'catequista'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para registrar tareas'
        });
      }

      const asistencia = await Asistencia.findById(id)
        .populate({
          path: 'inscripcion',
          populate: [
            { path: 'grupo' },
            { path: 'parroquia' }
          ]
        });

      if (!asistencia) {
        return res.status(404).json({
          success: false,
          message: 'Asistencia no encontrada'
        });
      }

      // Verificar permisos
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== asistencia.inscripcion.parroquia._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para esta asistencia'
        });
      }

      // Si es catequista, verificar que esté asignado al grupo
      if (req.user.tipoPerfil === 'catequista') {
        const esAsignado = asistencia.inscripcion.grupo.catequistas.some(cat => 
          cat.usuario.toString() === req.user.id && cat.activo
        );
        
        if (!esAsignado) {
          return res.status(403).json({
            success: false,
            message: 'No estás asignado a este grupo'
          });
        }
      }

      await asistencia.registrarTarea(descripcion, entregada, calificacion, observaciones);

      return res.status(200).json({
        success: true,
        message: 'Tarea registrada exitosamente',
        data: {
          tarea: asistencia.tareas[asistencia.tareas.length - 1]
        }
      });

    } catch (error) {
      console.error('Error registrando tarea:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener ausencias por notificar
   * GET /api/asistencias/ausencias-pendientes
   */
  async getAusenciasPendientes(req, res) {
    try {
      // Solo admin, párroco y secretaria pueden ver esto
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver ausencias pendientes'
        });
      }

      const ausencias = await Asistencia.obtenerAusenciasPorNotificar();

      // Filtrar por parroquia si no es admin
      const ausenciasFiltradas = req.user.tipoPerfil === 'admin' 
        ? ausencias 
        : ausencias.filter(a => 
            a.inscripcion.parroquia._id.toString() === req.user.parroquia.toString()
          );

      return res.status(200).json({
        success: true,
        message: 'Ausencias pendientes obtenidas exitosamente',
        data: ausenciasFiltradas
      });

    } catch (error) {
      console.error('Error obteniendo ausencias pendientes:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Marcar notificación como enviada
   * PUT /api/asistencias/:id/notificacion/:tipo
   */
  async marcarNotificacionEnviada(req, res) {
    try {
      const { id, tipo } = req.params;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para marcar notificaciones'
        });
      }

      const asistencia = await Asistencia.findById(id);
      if (!asistencia) {
        return res.status(404).json({
          success: false,
          message: 'Asistencia no encontrada'
        });
      }

      await asistencia.marcarNotificacionEnviada(tipo);

      return res.status(200).json({
        success: true,
        message: `Notificación de ${tipo} marcada como enviada`,
        data: {
          notificaciones: asistencia.notificaciones
        }
      });

    } catch (error) {
      console.error('Error marcando notificación:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new AsistenciaController();