const { Parroquia } = require('../models');

/**
 * Controlador de Parroquias
 */
class ParroquiaController {
  /**
   * Obtener todas las parroquias
   * GET /api/parroquias
   */
  async getAllParroquias(req, res) {
    try {
      const { page = 1, limit = 10, search = '', activas = 'true' } = req.query;
      
      // Construir filtros
      const filtros = {};
      
      if (activas !== 'all') {
        filtros.activa = activas === 'true';
      }
      
      if (search) {
        filtros.$or = [
          { nombre: { $regex: search, $options: 'i' } },
          { 'ubicacion.ciudad': { $regex: search, $options: 'i' } },
          { 'ubicacion.provincia': { $regex: search, $options: 'i' } }
        ];
      }

      // Paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [parroquias, total] = await Promise.all([
        Parroquia.find(filtros)
          .sort({ nombre: 1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Parroquia.countDocuments(filtros)
      ]);

      return res.status(200).json({
        success: true,
        message: 'Parroquias obtenidas exitosamente',
        data: {
          parroquias,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error obteniendo parroquias:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener parroquia por ID
   * GET /api/parroquias/:id
   */
  async getParroquiaById(req, res) {
    try {
      const { id } = req.params;

      const parroquia = await Parroquia.findById(id);

      if (!parroquia) {
        return res.status(404).json({
          success: false,
          message: 'Parroquia no encontrada'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Parroquia obtenida exitosamente',
        data: parroquia
      });

    } catch (error) {
      console.error('Error obteniendo parroquia:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Crear nueva parroquia
   * POST /api/parroquias
   */
  async createParroquia(req, res) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para crear parroquias'
        });
      }

      const parroquiaData = req.body;

      // Verificar que no exista una parroquia con el mismo nombre
      const parroquiaExistente = await Parroquia.findOne({ 
        nombre: { $regex: `^${parroquiaData.nombre}$`, $options: 'i' }
      });

      if (parroquiaExistente) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe una parroquia con ese nombre'
        });
      }

      const nuevaParroquia = new Parroquia(parroquiaData);
      await nuevaParroquia.save();

      return res.status(201).json({
        success: true,
        message: 'Parroquia creada exitosamente',
        data: nuevaParroquia
      });

    } catch (error) {
      console.error('Error creando parroquia:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de parroquia inválidos',
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
   * Actualizar parroquia
   * PUT /api/parroquias/:id
   */
  async updateParroquia(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Verificar permisos
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar parroquias'
        });
      }

      // Si es párroco, solo puede actualizar su propia parroquia
      if (req.user.tipoPerfil === 'parroco' && req.user.parroquia?.toString() !== id) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes actualizar tu propia parroquia'
        });
      }

      const parroquia = await Parroquia.findById(id);

      if (!parroquia) {
        return res.status(404).json({
          success: false,
          message: 'Parroquia no encontrada'
        });
      }

      // Verificar nombre único si se está cambiando
      if (updateData.nombre && updateData.nombre !== parroquia.nombre) {
        const nombreExistente = await Parroquia.findOne({ 
          nombre: { $regex: `^${updateData.nombre}$`, $options: 'i' },
          _id: { $ne: id }
        });

        if (nombreExistente) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe una parroquia con ese nombre'
          });
        }
      }

      // Actualizar parroquia
      Object.assign(parroquia, updateData);
      await parroquia.save();

      return res.status(200).json({
        success: true,
        message: 'Parroquia actualizada exitosamente',
        data: parroquia
      });

    } catch (error) {
      console.error('Error actualizando parroquia:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de parroquia inválidos',
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
   * Eliminar parroquia
   * DELETE /api/parroquias/:id
   */
  async deleteParroquia(req, res) {
    try {
      const { id } = req.params;

      // Solo admin puede eliminar parroquias
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden eliminar parroquias'
        });
      }

      const parroquia = await Parroquia.findById(id);

      if (!parroquia) {
        return res.status(404).json({
          success: false,
          message: 'Parroquia no encontrada'
        });
      }

      // Verificar dependencias (grupos, usuarios)
      const { Grupo, Usuario } = require('../models');
      
      const [gruposCount, usuariosCount] = await Promise.all([
        Grupo.countDocuments({ parroquia: id }),
        Usuario.countDocuments({ parroquia: id })
      ]);

      if (gruposCount > 0 || usuariosCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'No se puede eliminar la parroquia porque tiene grupos o usuarios asociados',
          dependencies: {
            grupos: gruposCount,
            usuarios: usuariosCount
          }
        });
      }

      await Parroquia.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: 'Parroquia eliminada exitosamente',
        data: parroquia
      });

    } catch (error) {
      console.error('Error eliminando parroquia:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas de una parroquia
   * GET /api/parroquias/:id/stats
   */
  async getParroquiaStats(req, res) {
    try {
      const { id } = req.params;

      // Verificar acceso
      if (req.user.tipoPerfil !== 'admin' && req.user.parroquia?.toString() !== id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver las estadísticas de esta parroquia'
        });
      }

      const parroquia = await Parroquia.findById(id);

      if (!parroquia) {
        return res.status(404).json({
          success: false,
          message: 'Parroquia no encontrada'
        });
      }

      // Actualizar estadísticas
      await parroquia.actualizarEstadisticas();

      return res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: parroquia.estadisticas
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
   * Buscar parroquias
   * GET /api/parroquias/search
   */
  async searchParroquias(req, res) {
    try {
      const { q, ciudad, provincia } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El término de búsqueda debe tener al menos 2 caracteres'
        });
      }

      const filtros = {
        $or: [
          { nombre: { $regex: q, $options: 'i' } },
          { direccion: { $regex: q, $options: 'i' } }
        ],
        activa: true
      };

      if (ciudad) {
        filtros['ubicacion.ciudad'] = { $regex: ciudad, $options: 'i' };
      }

      if (provincia) {
        filtros['ubicacion.provincia'] = { $regex: provincia, $options: 'i' };
      }

      const parroquias = await Parroquia.find(filtros)
        .sort({ nombre: 1 })
        .limit(20);

      return res.status(200).json({
        success: true,
        message: `Se encontraron ${parroquias.length} parroquias`,
        data: parroquias
      });

    } catch (error) {
      console.error('Error buscando parroquias:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas globales de parroquias
   * GET /api/parroquias/stats/global
   */
  async getGlobalStats(req, res) {
    try {
      // Solo admin puede ver estadísticas globales
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver estadísticas globales'
        });
      }

      const stats = await Parroquia.obtenerEstadisticasGlobales();

      return res.status(200).json({
        success: true,
        message: 'Estadísticas globales obtenidas exitosamente',
        data: stats[0] || {
          totalParroquias: 0,
          totalGrupos: 0,
          totalCatequizandos: 0,
          totalUsuarios: 0
        }
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas globales:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Activar/Desactivar parroquia
   * PUT /api/parroquias/:id/toggle-status
   */
  async toggleStatus(req, res) {
    try {
      const { id } = req.params;
      const { activa } = req.body;

      // Solo admin puede cambiar el estado
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden cambiar el estado de las parroquias'
        });
      }

      const parroquia = await Parroquia.findById(id);

      if (!parroquia) {
        return res.status(404).json({
          success: false,
          message: 'Parroquia no encontrada'
        });
      }

      parroquia.activa = activa;
      await parroquia.save();

      const mensaje = activa ? 'Parroquia activada exitosamente' : 'Parroquia desactivada exitosamente';

      return res.status(200).json({
        success: true,
        message: mensaje,
        data: parroquia
      });

    } catch (error) {
      console.error('Error cambiando estado de parroquia:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener horarios de una parroquia
   * GET /api/parroquias/:id/horarios
   */
  async getHorarios(req, res) {
    try {
      const { id } = req.params;

      const parroquia = await Parroquia.findById(id).select('horarios nombre');

      if (!parroquia) {
        return res.status(404).json({
          success: false,
          message: 'Parroquia no encontrada'
        });
      }

      // Obtener información adicional sobre estado actual
      const ahora = new Date();
      const abierta = parroquia.estaAbierta();
      const misasHoy = parroquia.obtenerMisasDelDia();

      return res.status(200).json({
        success: true,
        message: 'Horarios obtenidos exitosamente',
        data: {
          horarios: parroquia.horarios,
          estado: {
            abierta,
            misasHoy,
            consultadoEn: ahora
          }
        }
      });

    } catch (error) {
      console.error('Error obteniendo horarios:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new ParroquiaController();