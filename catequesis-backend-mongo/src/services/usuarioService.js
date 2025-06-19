const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const Grupo = require('../models/Grupo');
const { AppError, ErrorBuilder } = require('../utils/errors');
const { buildPaginationQuery, buildSortQuery, applyParroquiaFilter } = require('../utils/queryhelpers');
const config = require('../config/environment');

class UsuarioService {
  /**
   * Crear nuevo usuario
   */
  async createUsuario(usuarioData, currentUser) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para crear usuarios');
      }

      const { 
        username, email, password, nombres, apellidos, documento, 
        telefono, tipoPerfil, parroquia, activo = true 
      } = usuarioData;

      // Verificar permisos específicos para crear ciertos tipos de perfil
      if (currentUser.tipoPerfil === 'parroco') {
        if (tipoPerfil === 'admin') {
          throw ErrorBuilder.forbidden('Los párrocos no pueden crear administradores');
        }
        
        // El párroco solo puede crear usuarios en su parroquia
        if (parroquia && parroquia.toString() !== currentUser.parroquia.toString()) {
          throw ErrorBuilder.forbidden('Solo puedes crear usuarios en tu parroquia');
        }
      }

      // Verificar que no exista un usuario con el mismo username, email o documento
      const usuarioExistente = await Usuario.findOne({
        $or: [
          { username },
          { email },
          { documento }
        ]
      });

      if (usuarioExistente) {
        if (usuarioExistente.username === username) {
          throw ErrorBuilder.conflict('El nombre de usuario ya está en uso');
        }
        if (usuarioExistente.email === email) {
          throw ErrorBuilder.conflict('El email ya está registrado');
        }
        if (usuarioExistente.documento === documento) {
          throw ErrorBuilder.conflict('El documento ya está registrado');
        }
      }

      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(password, config.bcrypt.rounds);

      // Crear usuario
      const nuevoUsuario = new Usuario({
        username,
        email,
        password: hashedPassword,
        nombres,
        apellidos,
        documento,
        telefono,
        tipoPerfil: tipoPerfil || 'catequista',
        parroquia: parroquia || currentUser.parroquia,
        activo
      });

      await nuevoUsuario.save();
      
      // Poblar datos para la respuesta
      await nuevoUsuario.populate('parroquia', 'nombre');

      // Remover password del response
      const usuarioResponse = nuevoUsuario.toObject();
      delete usuarioResponse.password;

      return {
        success: true,
        message: 'Usuario creado exitosamente',
        data: usuarioResponse
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de usuario inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al crear usuario');
    }
  }

  /**
   * Obtener usuarios con filtros
   */
  async getUsuarios(queryParams, currentUser) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        tipoPerfil, 
        activo, 
        parroquia,
        sort = 'apellidos' 
      } = queryParams;

      let filtros = {};

      // Aplicar filtro de parroquia según permisos
      filtros = applyParroquiaFilter(filtros, currentUser, 'parroquia');

      // Filtro de búsqueda
      if (search) {
        filtros.$or = [
          { nombres: { $regex: search, $options: 'i' } },
          { apellidos: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { documento: { $regex: search, $options: 'i' } }
        ];
      }

      // Filtros específicos
      if (tipoPerfil) filtros.tipoPerfil = tipoPerfil;
      if (activo !== undefined) filtros.activo = activo === 'true';
      if (parroquia && currentUser.tipoPerfil === 'admin') filtros.parroquia = parroquia;

      // Configurar paginación y ordenamiento
      const paginationQuery = buildPaginationQuery(page, limit);
      const sortQuery = buildSortQuery(sort);

      const [usuarios, total] = await Promise.all([
        Usuario.find(filtros)
          .populate('parroquia', 'nombre')
          .select('-password')
          .sort(sortQuery)
          .skip(paginationQuery.skip)
          .limit(paginationQuery.limit),
        Usuario.countDocuments(filtros)
      ]);

      return {
        success: true,
        data: usuarios,
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
      throw ErrorBuilder.internal('Error interno al obtener usuarios');
    }
  }

  /**
   * Obtener usuario por ID
   */
  async getUsuarioById(id, currentUser) {
    try {
      let query = Usuario.findById(id)
        .populate('parroquia', 'nombre direccion telefono')
        .select('-password');

      // Verificar permisos de acceso
      if (currentUser.tipoPerfil !== 'admin') {
        // No admin solo pueden ver usuarios de su parroquia o su propio perfil
        if (currentUser.id !== id) {
          query = query.where('parroquia').equals(currentUser.parroquia);
        }
      }

      const usuario = await query;

      if (!usuario) {
        throw ErrorBuilder.notFound('Usuario no encontrado');
      }

      // Obtener información adicional si es catequista
      let gruposAsignados = [];
      if (usuario.tipoPerfil === 'catequista' || usuario.tipoPerfil === 'coordinador') {
        gruposAsignados = await Grupo.find({ 
          catequista: id, 
          activo: true 
        })
        .populate('nivel', 'nombre orden')
        .populate('parroquia', 'nombre')
        .select('nombre nivel horarios capacidadMaxima');
      }

      return {
        success: true,
        data: {
          usuario,
          gruposAsignados
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al obtener usuario');
    }
  }

  /**
   * Actualizar usuario
   */
  async updateUsuario(id, updateData, currentUser) {
    try {
      // Verificar permisos básicos
      if (!['admin', 'parroco', 'secretaria'].includes(currentUser.tipoPerfil) && 
          currentUser.id !== id) {
        throw ErrorBuilder.forbidden('No tienes permisos para actualizar usuarios');
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        throw ErrorBuilder.notFound('Usuario no encontrado');
      }

      // Verificar permisos específicos
      if (currentUser.tipoPerfil !== 'admin') {
        // No puede modificar otros usuarios si no es de su parroquia
        if (currentUser.id !== id && 
            usuario.parroquia?.toString() !== currentUser.parroquia?.toString()) {
          throw ErrorBuilder.forbidden('No puedes modificar usuarios de otras parroquias');
        }

        // No puede cambiar ciertos campos si no es admin
        const camposRestringidos = ['tipoPerfil', 'parroquia', 'activo'];
        const intentaCambiarRestringidos = camposRestringidos.some(campo => 
          updateData.hasOwnProperty(campo) && updateData[campo] !== usuario[campo]
        );

        if (intentaCambiarRestringidos && currentUser.tipoPerfil !== 'parroco') {
          throw ErrorBuilder.forbidden('No tienes permisos para modificar estos campos');
        }

        // Párroco no puede crear admin
        if (currentUser.tipoPerfil === 'parroco' && updateData.tipoPerfil === 'admin') {
          throw ErrorBuilder.forbidden('Los párrocos no pueden asignar el rol de administrador');
        }
      }

      // Verificar campos únicos si se están cambiando
      const camposUnicos = ['username', 'email', 'documento'];
      for (const campo of camposUnicos) {
        if (updateData[campo] && updateData[campo] !== usuario[campo]) {
          const existente = await Usuario.findOne({
            [campo]: updateData[campo],
            _id: { $ne: id }
          });

          if (existente) {
            throw ErrorBuilder.conflict(`Ya existe un usuario con este ${campo}`);
          }
        }
      }

      // Actualizar campos permitidos
      const camposPermitidos = [
        'nombres', 'apellidos', 'email', 'telefono', 'documento', 
        'tipoPerfil', 'parroquia', 'activo'
      ];

      // Si no es admin, filtrar campos restringidos
      const camposAActualizar = currentUser.tipoPerfil === 'admin' 
        ? camposPermitidos 
        : ['nombres', 'apellidos', 'email', 'telefono'];

      camposAActualizar.forEach(campo => {
        if (updateData.hasOwnProperty(campo)) {
          usuario[campo] = updateData[campo];
        }
      });

      await usuario.save();
      await usuario.populate('parroquia', 'nombre');

      // Remover password del response
      const usuarioResponse = usuario.toObject();
      delete usuarioResponse.password;

      return {
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: usuarioResponse
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de usuario inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al actualizar usuario');
    }
  }

  /**
   * Eliminar usuario (soft delete)
   */
  async deleteUsuario(id, currentUser) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para eliminar usuarios');
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        throw ErrorBuilder.notFound('Usuario no encontrado');
      }

      // Verificar permisos de parroquia
      if (currentUser.tipoPerfil !== 'admin' && 
          usuario.parroquia?.toString() !== currentUser.parroquia?.toString()) {
        throw ErrorBuilder.forbidden('No puedes eliminar usuarios de otras parroquias');
      }

      // No se puede eliminar a sí mismo
      if (currentUser.id === id) {
        throw ErrorBuilder.conflict('No puedes eliminar tu propio usuario');
      }

      // Verificar si el usuario tiene grupos asignados
      if (['catequista', 'coordinador'].includes(usuario.tipoPerfil)) {
        const gruposAsignados = await Grupo.countDocuments({
          catequista: id,
          activo: true
        });

        if (gruposAsignados > 0) {
          throw ErrorBuilder.conflict('No se puede eliminar un usuario con grupos asignados');
        }
      }

      // Soft delete
      usuario.activo = false;
      await usuario.save();

      return {
        success: true,
        message: 'Usuario eliminado exitosamente'
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al eliminar usuario');
    }
  }

  /**
   * Cambiar contraseña de usuario
   */
  async cambiarPassword(id, passwordData, currentUser) {
    try {
      const { newPassword, currentPassword } = passwordData;

      // Solo puede cambiar su propia contraseña o admin puede cambiar cualquiera
      if (currentUser.tipoPerfil !== 'admin' && currentUser.id !== id) {
        throw ErrorBuilder.forbidden('Solo puedes cambiar tu propia contraseña');
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        throw ErrorBuilder.notFound('Usuario no encontrado');
      }

      // Si no es admin, verificar contraseña actual
      if (currentUser.tipoPerfil !== 'admin') {
        const isValidPassword = await bcrypt.compare(currentPassword, usuario.password);
        if (!isValidPassword) {
          throw ErrorBuilder.unauthorized('Contraseña actual incorrecta');
        }
      }

      // Encriptar nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.rounds);

      // Actualizar contraseña
      usuario.password = hashedPassword;
      await usuario.save();

      return {
        success: true,
        message: 'Contraseña actualizada exitosamente'
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al cambiar contraseña');
    }
  }

  /**
   * Obtener catequistas disponibles
   */
  async getCatequistasDisponibles(currentUser) {
    try {
      let filtros = {
        tipoPerfil: { $in: ['catequista', 'coordinador'] },
        activo: true
      };

      // Aplicar filtro de parroquia
      filtros = applyParroquiaFilter(filtros, currentUser, 'parroquia');

      const catequistas = await Usuario.find(filtros)
        .populate('parroquia', 'nombre')
        .select('nombres apellidos telefono email tipoPerfil')
        .sort({ apellidos: 1, nombres: 1 });

      // Agregar información de grupos asignados
      const catequistasConGrupos = await Promise.all(
        catequistas.map(async (catequista) => {
          const gruposAsignados = await Grupo.countDocuments({
            catequista: catequista._id,
            activo: true
          });

          return {
            ...catequista.toObject(),
            gruposAsignados
          };
        })
      );

      return {
        success: true,
        data: catequistasConGrupos
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener catequistas disponibles');
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  async getEstadisticasUsuarios(currentUser) {
    try {
      let filtroBase = {};

      // Aplicar filtro de parroquia
      filtroBase = applyParroquiaFilter(filtroBase, currentUser, 'parroquia');

      const estadisticas = await Promise.all([
        // Total por tipo de perfil
        Usuario.aggregate([
          { $match: { ...filtroBase, activo: true } },
          { $group: { _id: '$tipoPerfil', count: { $sum: 1 } } }
        ]),

        // Usuarios activos vs inactivos
        Usuario.aggregate([
          { $match: filtroBase },
          { $group: { _id: '$activo', count: { $sum: 1 } } }
        ]),

        // Actividad reciente (últimos 30 días)
        Usuario.aggregate([
          { 
            $match: { 
              ...filtroBase, 
              ultimoAcceso: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            } 
          },
          { $group: { _id: '$tipoPerfil', count: { $sum: 1 } } }
        ]),

        // Usuarios por parroquia (solo para admin)
        ...(currentUser.tipoPerfil === 'admin' ? [
          Usuario.aggregate([
            { $match: { activo: true } },
            {
              $lookup: {
                from: 'parroquias',
                localField: 'parroquia',
                foreignField: '_id',
                as: 'parroquiaData'
              }
            },
            { $unwind: '$parroquiaData' },
            {
              $group: {
                _id: '$parroquia',
                nombre: { $first: '$parroquiaData.nombre' },
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } }
          ])
        ] : [])
      ]);

      const resultado = {
        porTipoPerfil: estadisticas[0],
        porEstado: estadisticas[1],
        actividadReciente: estadisticas[2]
      };

      if (currentUser.tipoPerfil === 'admin') {
        resultado.porParroquia = estadisticas[3];
      }

      return {
        success: true,
        data: resultado
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener estadísticas de usuarios');
    }
  }

  /**
   * Buscar usuarios por criterios específicos
   */
  async buscarUsuarios(criterios, currentUser) {
    try {
      const { nombres, apellidos, documento, email, tipoPerfil } = criterios;

      let filtros = {};

      // Aplicar filtro de parroquia
      filtros = applyParroquiaFilter(filtros, currentUser, 'parroquia');

      // Aplicar criterios de búsqueda
      if (nombres) {
        filtros.nombres = { $regex: nombres, $options: 'i' };
      }

      if (apellidos) {
        filtros.apellidos = { $regex: apellidos, $options: 'i' };
      }

      if (documento) {
        filtros.documento = { $regex: documento, $options: 'i' };
      }

      if (email) {
        filtros.email = { $regex: email, $options: 'i' };
      }

      if (tipoPerfil) {
        filtros.tipoPerfil = tipoPerfil;
      }

      const usuarios = await Usuario.find(filtros)
        .populate('parroquia', 'nombre')
        .select('-password')
        .sort({ apellidos: 1, nombres: 1 })
        .limit(20);

      return {
        success: true,
        data: usuarios
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al buscar usuarios');
    }
  }

  /**
   * Resetear contraseña (solo admin)
   */
  async resetearPassword(id, nuevaPassword, currentUser) {
    try {
      // Solo admin puede resetear contraseñas
      if (currentUser.tipoPerfil !== 'admin') {
        throw ErrorBuilder.forbidden('Solo los administradores pueden resetear contraseñas');
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        throw ErrorBuilder.notFound('Usuario no encontrado');
      }

      // Encriptar nueva contraseña
      const hashedPassword = await bcrypt.hash(nuevaPassword, config.bcrypt.rounds);

      // Actualizar contraseña
      usuario.password = hashedPassword;
      await usuario.save();

      return {
        success: true,
        message: 'Contraseña reseteada exitosamente'
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al resetear contraseña');
    }
  }

  /**
   * Activar/Desactivar usuario
   */
  async toggleUsuarioActivo(id, currentUser) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para activar/desactivar usuarios');
      }

      const usuario = await Usuario.findById(id);
      if (!usuario) {
        throw ErrorBuilder.notFound('Usuario no encontrado');
      }

      // Verificar permisos de parroquia
      if (currentUser.tipoPerfil !== 'admin' && 
          usuario.parroquia?.toString() !== currentUser.parroquia?.toString()) {
        throw ErrorBuilder.forbidden('No puedes modificar usuarios de otras parroquias');
      }

      // No se puede desactivar a sí mismo
      if (currentUser.id === id) {
        throw ErrorBuilder.conflict('No puedes desactivar tu propio usuario');
      }

      // Cambiar estado
      usuario.activo = !usuario.activo;
      await usuario.save();

      return {
        success: true,
        message: `Usuario ${usuario.activo ? 'activado' : 'desactivado'} exitosamente`,
        data: {
          id: usuario._id,
          activo: usuario.activo
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al cambiar estado del usuario');
    }
  }

  /**
   * Exportar usuarios para reportes
   */
  async exportarUsuarios(filtros, currentUser) {
    try {
      let query = {};

      // Aplicar filtro de parroquia
      query = applyParroquiaFilter(query, currentUser, 'parroquia');

      // Aplicar filtros adicionales
      if (filtros.tipoPerfil) query.tipoPerfil = filtros.tipoPerfil;
      if (filtros.activo !== undefined) query.activo = filtros.activo;
      if (filtros.parroquia && currentUser.tipoPerfil === 'admin') {
        query.parroquia = filtros.parroquia;
      }

      const usuarios = await Usuario.find(query)
        .populate('parroquia', 'nombre')
        .select('-password')
        .sort({ apellidos: 1, nombres: 1 });

      return {
        success: true,
        data: usuarios
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al exportar usuarios');
    }
  }
}

module.exports = new UsuarioService();