const { Grupo, Usuario, Inscripcion } = require('../models');

/**
 * Controlador de Grupos
 */
class GrupoController {
  /**
   * Obtener todos los grupos
   * GET /api/grupos
   */
  async getAllGrupos(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        parroquia, 
        nivel, 
        periodo, 
        estado = 'all',
        catequista,
        diaSemana
      } = req.query;
      
      // Construir filtros
      const filtros = {};
      
      // Filtrar por parroquia (admin puede ver todas)
      if (req.user.tipoPerfil !== 'admin') {
        filtros.parroquia = req.user.parroquia;
      } else if (parroquia) {
        filtros.parroquia = parroquia;
      }
      
      if (nivel) filtros.nivel = nivel;
      if (periodo) filtros.periodo = periodo;
      if (diaSemana) filtros['horarios.diaSemana'] = diaSemana;
      
      if (estado !== 'all') {
        if (estado === 'activos') {
          filtros['estado.activo'] = true;
          filtros['estado.estadoClases'] = { $in: ['activo', 'planificacion'] };
        } else {
          filtros['estado.estadoClases'] = estado;
        }
      }
      
      // Filtrar por catequista
      if (catequista) {
        filtros['catequistas.usuario'] = catequista;
        filtros['catequistas.activo'] = true;
      }
      
      // Si es catequista, solo ver sus grupos
      if (req.user.tipoPerfil === 'catequista') {
        filtros['catequistas.usuario'] = req.user.id;
        filtros['catequistas.activo'] = true;
      }

      // Paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [grupos, total] = await Promise.all([
        Grupo.find(filtros)
          .populate('parroquia', 'nombre')
          .populate('nivel', 'nombre orden')
          .populate('catequistas.usuario', 'datosPersonales.nombres datosPersonales.apellidos username')
          .sort({ periodo: -1, 'nivel.orden': 1, nombre: 1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Grupo.countDocuments(filtros)
      ]);

      return res.status(200).json({
        success: true,
        message: 'Grupos obtenidos exitosamente',
        data: {
          grupos,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error obteniendo grupos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener grupo por ID
   * GET /api/grupos/:id
   */
  async getGrupoById(req, res) {
    try {
      const { id } = req.params;

      const grupo = await Grupo.findById(id)
        .populate('parroquia')
        .populate('nivel')
        .populate('catequistas.usuario', 'datosPersonales username tipoPerfil');

      if (!grupo) {
        return res.status(404).json({
          success: false,
          message: 'Grupo no encontrado'
        });
      }

      // Verificar permisos
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== grupo.parroquia._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver este grupo'
        });
      }

      // Si es catequista, verificar que esté asignado al grupo
      if (req.user.tipoPerfil === 'catequista') {
        const esAsignado = grupo.catequistas.some(cat => 
          cat.usuario._id.toString() === req.user.id && cat.activo
        );
        
        if (!esAsignado) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver este grupo'
          });
        }
      }

      // Obtener información adicional
      const [inscripcionesCount, proximaClase] = await Promise.all([
        Inscripcion.countDocuments({ grupo: id, activa: true }),
        Promise.resolve(grupo.obtenerProximaClase())
      ]);

      const grupoCompleto = {
        ...grupo.toObject(),
        inscripcionesActivas: inscripcionesCount,
        proximaClase,
        progreso: grupo.calcularProgresoClases()
      };

      return res.status(200).json({
        success: true,
        message: 'Grupo obtenido exitosamente',
        data: grupoCompleto
      });

    } catch (error) {
      console.error('Error obteniendo grupo:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Crear nuevo grupo
   * POST /api/grupos
   */
  async createGrupo(req, res) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para crear grupos'
        });
      }

      const grupoData = req.body;

      // Asignar parroquia del usuario si no es admin
      if (req.user.tipoPerfil !== 'admin') {
        grupoData.parroquia = req.user.parroquia;
      }

      // Verificar que no exista un grupo con el mismo nombre en la misma parroquia y periodo
      const grupoExistente = await Grupo.findOne({
        nombre: { $regex: `^${grupoData.nombre}$`, $options: 'i' },
        parroquia: grupoData.parroquia,
        periodo: grupoData.periodo || new Date().getFullYear().toString()
      });

      if (grupoExistente) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un grupo con ese nombre en esta parroquia para este periodo'
        });
      }

      // Verificar conflictos de horario
      const conflictos = await Grupo.obtenerConConflictoHorario(
        grupoData.parroquia,
        grupoData.horarios.diaSemana,
        grupoData.horarios.horaInicio,
        grupoData.horarios.horaFin
      );

      if (conflictos.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Existe un conflicto de horario con otro grupo',
          conflictos: conflictos.map(g => ({ id: g._id, nombre: g.nombre }))
        });
      }

      const nuevoGrupo = new Grupo(grupoData);
      await nuevoGrupo.save();

      // Poblar datos para respuesta
      await nuevoGrupo.populate([
        { path: 'parroquia', select: 'nombre' },
        { path: 'nivel', select: 'nombre orden' }
      ]);

      return res.status(201).json({
        success: true,
        message: 'Grupo creado exitosamente',
        data: nuevoGrupo
      });

    } catch (error) {
      console.error('Error creando grupo:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de grupo inválidos',
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
   * Actualizar grupo
   * PUT /api/grupos/:id
   */
  async updateGrupo(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar grupos'
        });
      }

      const grupo = await Grupo.findById(id);

      if (!grupo) {
        return res.status(404).json({
          success: false,
          message: 'Grupo no encontrado'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== grupo.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar este grupo'
        });
      }

      // Verificar nombre único si se está cambiando
      if (updateData.nombre && updateData.nombre !== grupo.nombre) {
        const nombreExistente = await Grupo.findOne({
          nombre: { $regex: `^${updateData.nombre}$`, $options: 'i' },
          parroquia: grupo.parroquia,
          periodo: grupo.periodo,
          _id: { $ne: id }
        });

        if (nombreExistente) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe un grupo con ese nombre en esta parroquia'
          });
        }
      }

      // Verificar conflictos de horario si se cambian
      if (updateData.horarios) {
        const { diaSemana, horaInicio, horaFin } = updateData.horarios;
        if (diaSemana && horaInicio && horaFin) {
          const conflictos = await Grupo.obtenerConConflictoHorario(
            grupo.parroquia,
            diaSemana,
            horaInicio,
            horaFin,
            id
          );

          if (conflictos.length > 0) {
            return res.status(409).json({
              success: false,
              message: 'Existe un conflicto de horario con otro grupo',
              conflictos: conflictos.map(g => ({ id: g._id, nombre: g.nombre }))
            });
          }
        }
      }

      // Actualizar grupo
      Object.assign(grupo, updateData);
      await grupo.save();

      // Poblar datos para respuesta
      await grupo.populate([
        { path: 'parroquia', select: 'nombre' },
        { path: 'nivel', select: 'nombre orden' },
        { path: 'catequistas.usuario', select: 'datosPersonales username' }
      ]);

      return res.status(200).json({
        success: true,
        message: 'Grupo actualizado exitosamente',
        data: grupo
      });

    } catch (error) {
      console.error('Error actualizando grupo:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de grupo inválidos',
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
   * Eliminar grupo
   * DELETE /api/grupos/:id
   */
  async deleteGrupo(req, res) {
    try {
      const { id } = req.params;

      // Solo admin puede eliminar grupos
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden eliminar grupos'
        });
      }

      const grupo = await Grupo.findById(id);

      if (!grupo) {
        return res.status(404).json({
          success: false,
          message: 'Grupo no encontrado'
        });
      }

      // Verificar dependencias
      const inscripcionesCount = await Inscripcion.countDocuments({ grupo: id });

      if (inscripcionesCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'No se puede eliminar el grupo porque tiene inscripciones asociadas',
          dependencies: {
            inscripciones: inscripcionesCount
          }
        });
      }

      await Grupo.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: 'Grupo eliminado exitosamente',
        data: grupo
      });

    } catch (error) {
      console.error('Error eliminando grupo:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Asignar catequista a grupo
   * POST /api/grupos/:id/catequistas
   */
  async asignarCatequista(req, res) {
    try {
      const { id } = req.params;
      const { usuarioId, rol = 'catequista' } = req.body;

      // Verificar permisos
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para asignar catequistas'
        });
      }

      const grupo = await Grupo.findById(id);
      if (!grupo) {
        return res.status(404).json({
          success: false,
          message: 'Grupo no encontrado'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== grupo.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para este grupo'
        });
      }

      // Verificar que el usuario existe y es catequista
      const usuario = await Usuario.findById(usuarioId);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      if (!['catequista', 'parroco', 'secretaria'].includes(usuario.tipoPerfil)) {
        return res.status(400).json({
          success: false,
          message: 'El usuario debe tener perfil de catequista, párroco o secretaria'
        });
      }

      // Verificar que pertenece a la misma parroquia
      if (usuario.parroquia?.toString() !== grupo.parroquia.toString()) {
        return res.status(400).json({
          success: false,
          message: 'El usuario debe pertenecer a la misma parroquia del grupo'
        });
      }

      await grupo.asignarCatequista(usuarioId, rol);

      await grupo.populate('catequistas.usuario', 'datosPersonales username tipoPerfil');

      return res.status(200).json({
        success: true,
        message: 'Catequista asignado exitosamente',
        data: {
          grupo: grupo._id,
          catequistas: grupo.catequistas.filter(cat => cat.activo)
        }
      });

    } catch (error) {
      console.error('Error asignando catequista:', error);
      
      if (error.message.includes('ya está asignado')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Remover catequista de grupo
   * DELETE /api/grupos/:id/catequistas/:usuarioId
   */
  async removerCatequista(req, res) {
    try {
      const { id, usuarioId } = req.params;

      // Verificar permisos
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para remover catequistas'
        });
      }

      const grupo = await Grupo.findById(id);
      if (!grupo) {
        return res.status(404).json({
          success: false,
          message: 'Grupo no encontrado'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== grupo.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para este grupo'
        });
      }

      await grupo.removerCatequista(usuarioId);

      await grupo.populate('catequistas.usuario', 'datosPersonales username tipoPerfil');

      return res.status(200).json({
        success: true,
        message: 'Catequista removido exitosamente',
        data: {
          grupo: grupo._id,
          catequistas: grupo.catequistas.filter(cat => cat.activo)
        }
      });

    } catch (error) {
      console.error('Error removiendo catequista:', error);
      
      if (error.message.includes('no está asignado')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener inscripciones de un grupo
   * GET /api/grupos/:id/inscripciones
   */
  async getGrupoInscripciones(req, res) {
    try {
      const { id } = req.params;
      const { activas = 'true' } = req.query;

      const grupo = await Grupo.findById(id);
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
          message: 'No tienes permisos para ver las inscripciones de este grupo'
        });
      }

      const activasFilter = activas === 'all' ? null : activas === 'true';
      const inscripciones = await Inscripcion.obtenerPorGrupo(id, activasFilter);

      return res.status(200).json({
        success: true,
        message: 'Inscripciones obtenidas exitosamente',
        data: inscripciones
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
   * Cambiar estado del grupo
   * PUT /api/grupos/:id/estado
   */
  async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, motivo } = req.body;

      // Verificar permisos
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para cambiar el estado del grupo'
        });
      }

      const grupo = await Grupo.findById(id);
      if (!grupo) {
        return res.status(404).json({
          success: false,
          message: 'Grupo no encontrado'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== grupo.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para este grupo'
        });
      }

      await grupo.cambiarEstado(estado, motivo);

      return res.status(200).json({
        success: true,
        message: `Estado del grupo cambiado a: ${estado}`,
        data: {
          id: grupo._id,
          estado: grupo.estado,
          fechaCambio: grupo.estado.fechaCambioEstado
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
   * Obtener estadísticas del grupo
   * GET /api/grupos/:id/stats
   */
  async getGrupoStats(req, res) {
    try {
      const { id } = req.params;

      const grupo = await Grupo.findById(id);
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
          message: 'No tienes permisos para ver las estadísticas de este grupo'
        });
      }

      await grupo.actualizarEstadisticas();

      return res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: grupo.estadisticas
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
   * Buscar grupos
   * GET /api/grupos/search
   */
  async searchGrupos(req, res) {
    try {
      const { q, parroquia, nivel } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El término de búsqueda debe tener al menos 2 caracteres'
        });
      }

      const filtros = {
        nombre: { $regex: q, $options: 'i' },
        'estado.activo': true
      };

      // Filtrar por parroquia del usuario si no es admin
      if (req.user.tipoPerfil !== 'admin') {
        filtros.parroquia = req.user.parroquia;
      } else if (parroquia) {
        filtros.parroquia = parroquia;
      }

      if (nivel) {
        filtros.nivel = nivel;
      }

      const grupos = await Grupo.find(filtros)
        .populate('parroquia', 'nombre')
        .populate('nivel', 'nombre orden')
        .populate('catequistas.usuario', 'datosPersonales username')
        .sort({ nombre: 1 })
        .limit(20);

      return res.status(200).json({
        success: true,
        message: `Se encontraron ${grupos.length} grupos`,
        data: grupos
      });

    } catch (error) {
      console.error('Error buscando grupos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener grupos por catequista
   * GET /api/grupos/mis-grupos
   */
  async getMisGrupos(req, res) {
    try {
      const grupos = await Grupo.obtenerPorCatequista(req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Grupos obtenidos exitosamente',
        data: grupos
      });

    } catch (error) {
      console.error('Error obteniendo mis grupos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Duplicar grupo (crear copia para nuevo periodo)
   * POST /api/grupos/:id/duplicar
   */
  async duplicarGrupo(req, res) {
    try {
      const { id } = req.params;
      const { nuevoPeriodo, nuevosHorarios } = req.body;

      // Verificar permisos
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para duplicar grupos'
        });
      }

      const grupoOriginal = await Grupo.findById(id);
      if (!grupoOriginal) {
        return res.status(404).json({
          success: false,
          message: 'Grupo original no encontrado'
        });
      }

      // Verificar permisos de parroquia
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== grupoOriginal.parroquia.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para este grupo'
        });
      }

      // Crear datos del nuevo grupo
      const nuevoGrupoData = {
        ...grupoOriginal.toObject(),
        _id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        periodo: nuevoPeriodo || (parseInt(grupoOriginal.periodo) + 1).toString(),
        estadisticas: {
          totalInscripciones: 0,
          inscripcionesActivas: 0,
          promedioAsistencia: 0,
          promedioEdad: 0,
          totalClasesImpartidas: 0,
          ultimaActualizacion: new Date()
        },
        estado: {
          activo: true,
          estadoClases: 'planificacion',
          fechaCambioEstado: new Date()
        }
      };

      // Actualizar horarios si se proporcionan
      if (nuevosHorarios) {
        nuevoGrupoData.horarios = { ...nuevoGrupoData.horarios, ...nuevosHorarios };
      }

      // Verificar que no exista conflicto con el nuevo nombre/periodo
      const conflictoNombre = await Grupo.findOne({
        nombre: nuevoGrupoData.nombre,
        parroquia: nuevoGrupoData.parroquia,
        periodo: nuevoGrupoData.periodo
      });

      if (conflictoNombre) {
        nuevoGrupoData.nombre = `${nuevoGrupoData.nombre} (${nuevoGrupoData.periodo})`;
      }

      const nuevoGrupo = new Grupo(nuevoGrupoData);
      await nuevoGrupo.save();

      await nuevoGrupo.populate([
        { path: 'parroquia', select: 'nombre' },
        { path: 'nivel', select: 'nombre orden' }
      ]);

      return res.status(201).json({
        success: true,
        message: 'Grupo duplicado exitosamente',
        data: nuevoGrupo
      });

    } catch (error) {
      console.error('Error duplicando grupo:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new GrupoController();