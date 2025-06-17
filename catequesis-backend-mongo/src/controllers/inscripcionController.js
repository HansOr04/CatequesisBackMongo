const { Inscripcion, Catequizando, Grupo, Parroquia } = require('../models');

/**
 * Controlador de Inscripciones
 */
class InscripcionController {
  /**
   * Obtener todas las inscripciones
   * GET /api/inscripciones
   */
  async getAllInscripciones(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        grupo, 
        parroquia, 
        estado = 'all',
        activas = 'all',
        pagosPendientes = 'false'
      } = req.query;
      
      // Construir filtros
      const filtros = {};
      
      // Filtrar por parroquia (admin puede ver todas)
      if (req.user.tipoPerfil !== 'admin') {
        filtros.parroquia = req.user.parroquia;
      } else if (parroquia) {
        filtros.parroquia = parroquia;
      }
      
      if (grupo) filtros.grupo = grupo;
      
      if (estado !== 'all') {
        filtros.estado = estado;
      }
      
      if (activas !== 'all') {
        filtros.activa = activas === 'true';
      }
      
      if (pagosPendientes === 'true') {
        filtros.$or = [
          { 'pagos.inscripcion.pagado': false, 'pagos.inscripcion.monto': { $gt: 0 } },
          { 'pagos.materiales.pagado': false, 'pagos.materiales.monto': { $gt: 0 } },
          { 'pagos.otros': { $elemMatch: { pagado: false, monto: { $gt: 0 } } } }
        ];
      }
      
      // Si es catequista, solo ver inscripciones de sus grupos
      if (req.user.tipoPerfil === 'catequista') {
        const { Grupo } = require('../models');
        const misGrupos = await Grupo.find({
          'catequistas.usuario': req.user.id,
          'catequistas.activo': true
        }).select('_id');
        
        filtros.grupo = { $in: misGrupos.map(g => g._id) };
      }

      // Paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [inscripciones, total] = await Promise.all([
        Inscripcion.find(filtros)
          .populate('catequizando', 'nombres apellidos documentoIdentidad fechaNacimiento')
          .populate('grupo', 'nombre nivel periodo')
          .populate('parroquia', 'nombre')
          .populate('proceso.registradoPor', 'datosPersonales.nombres datosPersonales.apellidos')
          .sort({ fechaInscripcion: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Inscripcion.countDocuments(filtros)
      ]);

      return res.status(200).json({
        success: true,
        message: 'Inscripciones obtenidas exitosamente',
        data: {
          inscripciones,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error obteniendo inscripciones:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener inscripción por ID
   * GET /api/inscripciones/:id
   */
  async getInscripcionById(req, res) {
    try {
      const { id } = req.params;

      const inscripcion = await Inscripcion.findById(id)
        .populate('catequizando')
        .populate('grupo')
        .populate('parroquia')
        .populate('proceso.registradoPor', 'datosPersonales username')
        .populate('observaciones.usuario', 'datosPersonales username');

      if (!inscripcion) {
        return res.status(404).json({
          success: false,
          message: 'Inscripción no encontrada'
        });
      }

      // Verificar permisos
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== inscripcion.parroquia._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver esta inscripción'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Inscripción obtenida exitosamente',
        data: inscripcion
      });

    } catch (error) {
      console.error('Error obteniendo inscripción:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Crear nueva inscripción
   * POST /api/inscripciones
   */
  async createInscripcion(req, res) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para crear inscripciones'
        });
      }

      const inscripcionData = req.body;

      // Verificar que el catequizando existe
      const catequizando = await Catequizando.findById(inscripcionData.catequizando);
      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'Catequizando no encontrado'
        });
      }

      // Verificar que el grupo existe y tiene capacidad
      const grupo = await Grupo.findById(inscripcionData.grupo);
      if (!grupo) {
        return res.status(404).json({
          success: false,
          message: 'Grupo no encontrado'
        });
      }

      if (!grupo.estado.activo) {
        return res.status(400).json({
          success: false,
          message: 'No se puede inscribir en un grupo inactivo'
        });
      }

      const tieneCapacidad = await grupo.tieneCapacidadDisponible();
      if (!tieneCapacidad) {
        return res.status(400).json({
          success: false,
          message: 'El grupo ha alcanzado su capacidad máxima'
        });
      }

      // Verificar que no existe inscripción previa activa
      const inscripcionExistente = await Inscripcion.findOne({
        catequizando: inscripcionData.catequizando,
        grupo: inscripcionData.grupo,
        activa: true
      });

      if (inscripcionExistente) {
        return res.status(409).json({
          success: false,
          message: 'El catequizando ya está inscrito en este grupo'
        });
      }

      // Asignar parroquia del grupo
      inscripcionData.parroquia = grupo.parroquia;
      inscripcionData.proceso = {
        registradoPor: req.user.id,
        documentosPresentados: [],
        validaciones: {
          edad: { realizada: false },
          documentos: { realizada: false },
          bautismo: { realizada: false },
          nivelAnterior: { realizada: false }
        },
        aprobacionFinal: {
          aprobada: false
        }
      };

      const nuevaInscripcion = new Inscripcion(inscripcionData);
      await nuevaInscripcion.save();

      // Poblar datos para respuesta
      await nuevaInscripcion.populate([
        { path: 'catequizando', select: 'nombres apellidos documentoIdentidad' },
        { path: 'grupo', select: 'nombre nivel periodo' },
        { path: 'parroquia', select: 'nombre' }
      ]);

      // Actualizar estadísticas del grupo
      await grupo.actualizarEstadisticas();

      return res.status(201).json({
        success: true,
        message: 'Inscripción creada exitosamente',
        data: nuevaInscripcion
      });

    } catch (error) {
      console.error('Error creando inscripción:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de inscripción inválidos',
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
   * Actualizar inscripción
   * PUT /api/inscripciones/:id
   */
  async updateInscripcion(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar inscripciones'
        });
      }

      const inscripcion = await Inscripcion.findById(id);
      if (!inscripcion) {
        return res.status(404).json({
          success: false,
          message: 'Inscripción no encontrada'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== inscripcion.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar esta inscripción'
        });
      }

      // Actualizar inscripción
      Object.assign(inscripcion, updateData);
      await inscripcion.save();

      // Poblar datos para respuesta
      await inscripcion.populate([
        { path: 'catequizando', select: 'nombres apellidos documentoIdentidad' },
        { path: 'grupo', select: 'nombre nivel periodo' },
        { path: 'parroquia', select: 'nombre' }
      ]);

      return res.status(200).json({
        success: true,
        message: 'Inscripción actualizada exitosamente',
        data: inscripcion
      });

    } catch (error) {
      console.error('Error actualizando inscripción:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de inscripción inválidos',
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
   * Cambiar estado de inscripción
   * PUT /api/inscripciones/:id/estado
   */
  async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, motivo } = req.body;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para cambiar el estado de inscripciones'
        });
      }

      const inscripcion = await Inscripcion.findById(id);
      if (!inscripcion) {
        return res.status(404).json({
          success: false,
          message: 'Inscripción no encontrada'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== inscripcion.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para esta inscripción'
        });
      }

      await inscripcion.cambiarEstado(estado, motivo, req.user.id);

      return res.status(200).json({
        success: true,
        message: `Estado de inscripción cambiado a: ${estado}`,
        data: {
          id: inscripcion._id,
          estado: inscripcion.estado,
          activa: inscripcion.activa
        }
      });

    } catch (error) {
      console.error('Error cambiando estado:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Registrar pago
   * POST /api/inscripciones/:id/pagos
   */
  async registrarPago(req, res) {
    try {
      const { id } = req.params;
      const { tipo, monto, metodoPago, comprobante } = req.body;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para registrar pagos'
        });
      }

      const inscripcion = await Inscripcion.findById(id);
      if (!inscripcion) {
        return res.status(404).json({
          success: false,
          message: 'Inscripción no encontrada'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== inscripcion.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para esta inscripción'
        });
      }

      await inscripcion.registrarPago(tipo, monto, metodoPago, comprobante);

      // Agregar observación del pago
      await inscripcion.agregarObservacion(
        `Pago registrado: ${tipo} - ${monto} (${metodoPago})`,
        req.user.id,
        'administrativa'
      );

      return res.status(200).json({
        success: true,
        message: 'Pago registrado exitosamente',
        data: {
          pagos: inscripcion.pagos,
          montoTotal: inscripcion.calcularMontoTotal(),
          montoPagado: inscripcion.calcularMontoPagado(),
          montoPendiente: inscripcion.montoPendiente
        }
      });

    } catch (error) {
      console.error('Error registrando pago:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Agregar observación
   * POST /api/inscripciones/:id/observaciones
   */
  async agregarObservacion(req, res) {
    try {
      const { id } = req.params;
      const { contenido, tipo = 'general', privada = false } = req.body;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria', 'catequista'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para agregar observaciones'
        });
      }

      const inscripcion = await Inscripcion.findById(id);
      if (!inscripcion) {
        return res.status(404).json({
          success: false,
          message: 'Inscripción no encontrada'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== inscripcion.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para esta inscripción'
        });
      }

      await inscripcion.agregarObservacion(contenido, req.user.id, tipo, privada);

      return res.status(200).json({
        success: true,
        message: 'Observación agregada exitosamente',
        data: {
          observacion: inscripcion.observaciones[inscripcion.observaciones.length - 1]
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
   * Registrar calificación
   * POST /api/inscripciones/:id/calificaciones
   */
  async registrarCalificacion(req, res) {
    try {
      const { id } = req.params;
      const { concepto, calificacion, observaciones } = req.body;

      // Solo catequistas y superiores pueden calificar
      if (!['admin', 'parroco', 'secretaria', 'catequista'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para registrar calificaciones'
        });
      }

      const inscripcion = await Inscripcion.findById(id);
      if (!inscripcion) {
        return res.status(404).json({
          success: false,
          message: 'Inscripción no encontrada'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== inscripcion.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para esta inscripción'
        });
      }

      // Si es catequista, verificar que esté asignado al grupo
      if (req.user.tipoPerfil === 'catequista') {
        const grupo = await Grupo.findById(inscripcion.grupo);
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

      // Agregar calificación
      if (!inscripcion.evaluacion.calificaciones) {
        inscripcion.evaluacion.calificaciones = [];
      }

      inscripcion.evaluacion.calificaciones.push({
        concepto,
        calificacion,
        fecha: new Date(),
        observaciones
      });

      // Recalcular nota final
      inscripcion.calcularNotaFinal();
      await inscripcion.save();

      return res.status(200).json({
        success: true,
        message: 'Calificación registrada exitosamente',
        data: {
          calificaciones: inscripcion.evaluacion.calificaciones,
          notaFinal: inscripcion.evaluacion.notaFinal,
          aprobado: inscripcion.evaluacion.aprobado
        }
      });

    } catch (error) {
      console.error('Error registrando calificación:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener inscripciones por catequizando
   * GET /api/inscripciones/catequizando/:catequizandoId
   */
  async getInscripcionesPorCatequizando(req, res) {
    try {
      const { catequizandoId } = req.params;

      const inscripciones = await Inscripcion.obtenerPorCatequizando(catequizandoId);

      // Verificar permisos (al menos una inscripción debe ser de su parroquia)
      if (req.user.tipoPerfil !== 'admin') {
        const tienePermiso = inscripciones.some(ins => 
          ins.parroquia._id.toString() === req.user.parroquia?.toString()
        );
        
        if (!tienePermiso) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver estas inscripciones'
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Inscripciones obtenidas exitosamente',
        data: inscripciones
      });

    } catch (error) {
      console.error('Error obteniendo inscripciones por catequizando:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener inscripciones pendientes de pago
   * GET /api/inscripciones/pagos-pendientes
   */
  async getPagosPendientes(req, res) {
    try {
      const { parroquia } = req.query;
      
      const filtros = {};
      
      // Filtrar por parroquia del usuario si no es admin
      if (req.user.tipoPerfil !== 'admin') {
        filtros.parroquia = req.user.parroquia;
      } else if (parroquia) {
        filtros.parroquia = parroquia;
      }

      const pagosPendientes = await Inscripcion.obtenerPendientesDePago(filtros);

      return res.status(200).json({
        success: true,
        message: 'Pagos pendientes obtenidos exitosamente',
        data: pagosPendientes
      });

    } catch (error) {
      console.error('Error obteniendo pagos pendientes:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas de inscripciones
   * GET /api/inscripciones/stats
   */
  async getInscripcionesStats(req, res) {
    try {
      const { parroquia, grupo, periodo } = req.query;
      
      const filtros = {};
      
      // Filtrar por parroquia del usuario si no es admin
      if (req.user.tipoPerfil !== 'admin') {
        filtros.parroquia = req.user.parroquia;
      } else if (parroquia) {
        filtros.parroquia = parroquia;
      }
      
      if (grupo) filtros.grupo = grupo;
      
      // Filtrar por periodo si se especifica
      if (periodo) {
        const gruposPeriodo = await Grupo.find({ periodo }).select('_id');
        filtros.grupo = { $in: gruposPeriodo.map(g => g._id) };
      }

      const stats = await Inscripcion.obtenerEstadisticas(filtros);

      return res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats[0] || {
          totalInscripciones: 0,
          activas: 0,
          pendientes: 0,
          suspendidas: 0,
          completadas: 0,
          retiradas: 0,
          aprobados: 0,
          reprobados: 0,
          pagosPendientes: 0,
          promedioAsistencia: 0,
          promedioNota: 0,
          tasaAprobacion: 0
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
   * Aprobar inscripción
   * PUT /api/inscripciones/:id/aprobar
   */
  async aprobarInscripcion(req, res) {
    try {
      const { id } = req.params;

      // Solo párroco y admin pueden aprobar
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para aprobar inscripciones'
        });
      }

      const inscripcion = await Inscripcion.findById(id);
      if (!inscripcion) {
        return res.status(404).json({
          success: false,
          message: 'Inscripción no encontrada'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== inscripcion.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para esta inscripción'
        });
      }

      // Aprobar inscripción
      inscripcion.proceso.aprobacionFinal = {
        aprobada: true,
        fechaAprobacion: new Date(),
        aprobadaPor: req.user.id
      };
      
      inscripcion.estado = 'activa';
      inscripcion.fechaInicio = new Date();
      
      await inscripcion.save();

      // Agregar observación
      await inscripcion.agregarObservacion(
        'Inscripción aprobada y activada',
        req.user.id,
        'administrativa'
      );

      return res.status(200).json({
        success: true,
        message: 'Inscripción aprobada exitosamente',
        data: {
          id: inscripcion._id,
          estado: inscripcion.estado,
          fechaAprobacion: inscripcion.proceso.aprobacionFinal.fechaAprobacion
        }
      });

    } catch (error) {
      console.error('Error aprobando inscripción:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new InscripcionController();