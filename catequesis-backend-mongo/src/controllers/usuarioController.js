const { Usuario, Parroquia } = require('../models');
const bcrypt = require('bcryptjs');

/**
 * Controlador de Usuarios
 */
class UsuarioController {
  /**
   * Obtener todos los usuarios
   * GET /api/usuarios
   */
  async getAllUsuarios(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        tipoPerfil = 'all',
        activos = 'true',
        parroquia
      } = req.query;
      
      // Construir filtros
      const filtros = {};
      
      // Solo admin puede ver todos los usuarios
      if (req.user.tipoPerfil !== 'admin') {
        // Otros solo ven usuarios de su parroquia
        filtros.parroquia = req.user.parroquia;
      } else if (parroquia) {
        filtros.parroquia = parroquia;
      }
      
      if (tipoPerfil !== 'all') {
        filtros.tipoPerfil = tipoPerfil;
      }
      
      if (activos !== 'all') {
        filtros.activo = activos === 'true';
      }
      
      // Filtro de búsqueda por texto
      if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        filtros.$or = [
          { username: searchRegex },
          { 'datosPersonales.nombres': searchRegex },
          { 'datosPersonales.apellidos': searchRegex },
          { 'datosPersonales.email': searchRegex }
        ];
      }

      // Paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [usuarios, total] = await Promise.all([
        Usuario.find(filtros)
          .populate('parroquia', 'nombre')
          .sort({ 'datosPersonales.apellidos': 1, 'datosPersonales.nombres': 1, username: 1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Usuario.countDocuments(filtros)
      ]);

      return res.status(200).json({
        success: true,
        message: 'Usuarios obtenidos exitosamente',
        data: {
          usuarios,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener usuario por ID
   * GET /api/usuarios/:id
   */
  async getUsuarioById(req, res) {
    try {
      const { id } = req.params;

      const usuario = await Usuario.findById(id)
        .populate('parroquia');

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar permisos
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.id !== id &&
          req.user.parroquia?.toString() !== usuario.parroquia?._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver este usuario'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Usuario obtenido exitosamente',
        data: usuario
      });

    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Crear nuevo usuario
   * POST /api/usuarios
   */
  async createUsuario(req, res) {
    try {
      // Solo admin y párroco pueden crear usuarios
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para crear usuarios'
        });
      }

      const usuarioData = req.body;

      // Verificar que no exista el username
      const usernameExistente = await Usuario.findOne({ 
        username: usuarioData.username 
      });

      if (usernameExistente) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un usuario con ese nombre de usuario'
        });
      }

      // Si no es admin, solo puede crear usuarios en su parroquia
      if (req.user.tipoPerfil !== 'admin') {
        usuarioData.parroquia = req.user.parroquia;
        
        // No puede crear admin ni párroco
        if (['admin', 'parroco'].includes(usuarioData.tipoPerfil)) {
          return res.status(403).json({
            success: false,
            message: 'No puedes crear usuarios con ese tipo de perfil'
          });
        }
      }

      // Validar que la parroquia existe (si no es admin)
      if (usuarioData.tipoPerfil !== 'admin' && usuarioData.parroquia) {
        const parroquia = await Parroquia.findById(usuarioData.parroquia);
        if (!parroquia) {
          return res.status(404).json({
            success: false,
            message: 'Parroquia no encontrada'
          });
        }
      }

      // Verificar que no exista otro párroco en la misma parroquia
      if (usuarioData.tipoPerfil === 'parroco' && usuarioData.parroquia) {
        const parrocoExistente = await Usuario.findOne({
          tipoPerfil: 'parroco',
          parroquia: usuarioData.parroquia,
          activo: true
        });

        if (parrocoExistente) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe un párroco activo en esta parroquia'
          });
        }
      }

      const nuevoUsuario = new Usuario(usuarioData);
      await nuevoUsuario.save();

      // Poblar datos para respuesta
      await nuevoUsuario.populate('parroquia', 'nombre');

      return res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: nuevoUsuario
      });

    } catch (error) {
      console.error('Error creando usuario:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de usuario inválidos',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un usuario con ese nombre de usuario'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar usuario
   * PUT /api/usuarios/:id
   */
  async updateUsuario(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Verificar permisos básicos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil) && 
          req.user.id !== id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar usuarios'
        });
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar permisos específicos
      if (req.user.tipoPerfil !== 'admin') {
        // Si no es admin, verificar restricciones
        
        // No puede modificar otros usuarios si no es de su parroquia
        if (req.user.id !== id && 
            req.user.parroquia?.toString() !== usuario.parroquia?.toString()) {
          return res.status(403).json({
            success: false,
            message: 'No puedes modificar usuarios de otras parroquias'
          });
        }

        // No puede cambiar ciertos campos si no es admin
        const camposRestringidos = ['tipoPerfil', 'parroquia', 'activo'];
        const intentaCambiarRestringidos = camposRestringidos.some(campo => 
          updateData.hasOwnProperty(campo) && updateData[campo] !== usuario[campo]
        );

        if (intentaCambiarRestringidos && req.user.tipoPerfil !== 'parroco') {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar estos campos'
          });
        }

        // Párroco no puede crear admin
        if (req.user.tipoPerfil === 'parroco' && updateData.tipoPerfil === 'admin') {
          return res.status(403).json({
            success: false,
            message: 'No puedes asignar el perfil de administrador'
          });
        }
      }

      // Verificar username único si se está cambiando
      if (updateData.username && updateData.username !== usuario.username) {
        const usernameExistente = await Usuario.findOne({
          username: updateData.username,
          _id: { $ne: id }
        });

        if (usernameExistente) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe un usuario con ese nombre de usuario'
          });
        }
      }

      // Verificar párroco único si se está cambiando a párroco
      if (updateData.tipoPerfil === 'parroco' && 
          usuario.tipoPerfil !== 'parroco' && 
          updateData.parroquia) {
        const parrocoExistente = await Usuario.findOne({
          tipoPerfil: 'parroco',
          parroquia: updateData.parroquia,
          activo: true,
          _id: { $ne: id }
        });

        if (parrocoExistente) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe un párroco activo en esta parroquia'
          });
        }
      }

      // Hashear contraseña si se proporciona
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 12);
        updateData.primerLogin = true; // Forzar cambio en próximo login
      }

      // Actualizar usuario
      Object.assign(usuario, updateData);
      await usuario.save();

      // Poblar datos para respuesta
      await usuario.populate('parroquia', 'nombre');

      return res.status(200).json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: usuario
      });

    } catch (error) {
      console.error('Error actualizando usuario:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de usuario inválidos',
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
   * Eliminar usuario
   * DELETE /api/usuarios/:id
   */
  async deleteUsuario(req, res) {
    try {
      const { id } = req.params;

      // Solo admin puede eliminar usuarios
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden eliminar usuarios'
        });
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // No puede eliminar su propio usuario
      if (req.user.id === id) {
        return res.status(400).json({
          success: false,
          message: 'No puedes eliminar tu propio usuario'
        });
      }

      // Verificar dependencias (grupos como catequista, registros, etc.)
      const { Grupo, Inscripcion, Asistencia } = require('../models');
      
      const [gruposCount, inscripcionesCount, asistenciasCount] = await Promise.all([
        Grupo.countDocuments({ 'catequistas.usuario': id }),
        Inscripcion.countDocuments({ 'proceso.registradoPor': id }),
        Asistencia.countDocuments({ 'registro.registradoPor': id })
      ]);

      if (gruposCount > 0 || inscripcionesCount > 0 || asistenciasCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'No se puede eliminar el usuario porque tiene registros asociados',
          dependencies: {
            grupos: gruposCount,
            inscripciones: inscripcionesCount,
            asistencias: asistenciasCount
          }
        });
      }

      await Usuario.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: 'Usuario eliminado exitosamente',
        data: usuario
      });

    } catch (error) {
      console.error('Error eliminando usuario:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Cambiar estado de usuario (activar/desactivar)
   * PUT /api/usuarios/:id/toggle-status
   */
  async toggleStatus(req, res) {
    try {
      const { id } = req.params;
      const { activo } = req.body;

      // Solo admin y párroco pueden cambiar estado
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para cambiar el estado de usuarios'
        });
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar permisos de parroquia si no es admin
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== usuario.parroquia?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No puedes cambiar el estado de usuarios de otras parroquias'
        });
      }

      // No puede desactivar su propio usuario
      if (req.user.id === id && !activo) {
        return res.status(400).json({
          success: false,
          message: 'No puedes desactivar tu propio usuario'
        });
      }

      usuario.activo = activo;
      await usuario.save();

      const mensaje = activo ? 'Usuario activado exitosamente' : 'Usuario desactivado exitosamente';

      return res.status(200).json({
        success: true,
        message: mensaje,
        data: {
          id: usuario._id,
          username: usuario.username,
          activo: usuario.activo
        }
      });

    } catch (error) {
      console.error('Error cambiando estado de usuario:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Desbloquear usuario
   * PUT /api/usuarios/:id/desbloquear
   */
  async desbloquearUsuario(req, res) {
    try {
      const { id } = req.params;

      // Solo admin y párroco pueden desbloquear
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para desbloquear usuarios'
        });
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar permisos de parroquia si no es admin
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== usuario.parroquia?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No puedes desbloquear usuarios de otras parroquias'
        });
      }

      await usuario.desbloquear();

      return res.status(200).json({
        success: true,
        message: 'Usuario desbloqueado exitosamente',
        data: {
          id: usuario._id,
          username: usuario.username,
          bloqueadoHasta: usuario.bloqueadoHasta,
          intentosFallidos: usuario.intentosFallidos
        }
      });

    } catch (error) {
      console.error('Error desbloqueando usuario:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Resetear contraseña
   * PUT /api/usuarios/:id/reset-password
   */
  async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { nuevaPassword } = req.body;

      // Solo admin y párroco pueden resetear contraseñas
      if (!['admin', 'parroco'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para resetear contraseñas'
        });
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar permisos de parroquia si no es admin
      if (req.user.tipoPerfil !== 'admin' && 
          req.user.parroquia?.toString() !== usuario.parroquia?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No puedes resetear contraseñas de usuarios de otras parroquias'
        });
      }

      // Validar nueva contraseña
      if (!nuevaPassword || nuevaPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      // Cambiar contraseña
      usuario.password = nuevaPassword;
      usuario.primerLogin = true; // Forzar cambio en próximo login
      usuario.intentosFallidos = 0;
      usuario.bloqueadoHasta = null;
      
      await usuario.save();

      return res.status(200).json({
        success: true,
        message: 'Contraseña reseteada exitosamente',
        data: {
          id: usuario._id,
          username: usuario.username,
          primerLogin: usuario.primerLogin
        }
      });

    } catch (error) {
      console.error('Error reseteando contraseña:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Buscar usuarios
   * GET /api/usuarios/search
   */
  async searchUsuarios(req, res) {
    try {
      const { q, tipoPerfil, parroquia } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El término de búsqueda debe tener al menos 2 caracteres'
        });
      }

      const filtros = {
        activo: true,
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { 'datosPersonales.nombres': { $regex: q, $options: 'i' } },
          { 'datosPersonales.apellidos': { $regex: q, $options: 'i' } },
          { 'datosPersonales.email': { $regex: q, $options: 'i' } }
        ]
      };

      // Filtrar por parroquia del usuario si no es admin
      if (req.user.tipoPerfil !== 'admin') {
        filtros.parroquia = req.user.parroquia;
      } else if (parroquia) {
        filtros.parroquia = parroquia;
      }

      if (tipoPerfil) {
        filtros.tipoPerfil = tipoPerfil;
      }

      const usuarios = await Usuario.find(filtros)
        .populate('parroquia', 'nombre')
        .select('username datosPersonales tipoPerfil parroquia activo')
        .sort({ 'datosPersonales.apellidos': 1, 'datosPersonales.nombres': 1 })
        .limit(20);

      return res.status(200).json({
        success: true,
        message: `Se encontraron ${usuarios.length} usuarios`,
        data: usuarios
      });

    } catch (error) {
      console.error('Error buscando usuarios:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas de usuarios
   * GET /api/usuarios/stats
   */
  async getUsuariosStats(req, res) {
    try {
      const { parroquia } = req.query;
      
      const filtros = {};
      
      // Filtrar por parroquia del usuario si no es admin
      if (req.user.tipoPerfil !== 'admin') {
        filtros.parroquia = req.user.parroquia;
      } else if (parroquia) {
        filtros.parroquia = parroquia;
      }

      const stats = await Usuario.obtenerEstadisticas(filtros);

      return res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats[0] || {
          total: 0,
          activos: 0,
          inactivos: 0,
          admins: 0,
          parrocos: 0,
          secretarias: 0,
          catequistas: 0,
          consultas: 0
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
   * Obtener catequistas disponibles
   * GET /api/usuarios/catequistas
   */
  async getCatequistasDisponibles(req, res) {
    try {
      const { parroquia } = req.query;
      
      const filtros = {
        tipoPerfil: { $in: ['catequista', 'parroco', 'secretaria'] },
        activo: true
      };
      
      // Filtrar por parroquia del usuario si no es admin
      if (req.user.tipoPerfil !== 'admin') {
        filtros.parroquia = req.user.parroquia;
      } else if (parroquia) {
        filtros.parroquia = parroquia;
      }

      const catequistas = await Usuario.find(filtros)
        .populate('parroquia', 'nombre')
        .select('username datosPersonales tipoPerfil parroquia')
        .sort({ 'datosPersonales.apellidos': 1, 'datosPersonales.nombres': 1 });

      return res.status(200).json({
        success: true,
        message: 'Catequistas obtenidos exitosamente',
        data: catequistas
      });

    } catch (error) {
      console.error('Error obteniendo catequistas:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Limpiar bloqueos expirados
   * POST /api/usuarios/limpiar-bloqueos
   */
  async limpiarBloqueos(req, res) {
    try {
      // Solo admin puede ejecutar esta acción
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden limpiar bloqueos'
        });
      }

      const resultado = await Usuario.limpiarBloqueosExpirados();

      return res.status(200).json({
        success: true,
        message: `${resultado.modifiedCount} usuarios desbloqueados`,
        data: {
          usuariosDesbloqueados: resultado.modifiedCount
        }
      });

    } catch (error) {
      console.error('Error limpiando bloqueos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new UsuarioController();