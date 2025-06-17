const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');
const config = require('../config/environment');

/**
 * Controlador de autenticación
 */
class AuthController {
  /**
   * Iniciar sesión
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validar entrada
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username y password son requeridos'
        });
      }

      // Buscar usuario por username
      const usuario = await Usuario.buscarPorUsername(username);
      
      if (!usuario) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Verificar si el usuario está activo
      if (!usuario.estaActivo()) {
        // Registrar intento de login en usuario bloqueado
        await usuario.registrarLoginFallido();
        
        const mensaje = usuario.bloqueadoHasta 
          ? `Usuario bloqueado hasta ${usuario.bloqueadoHasta.toLocaleString()}`
          : 'Usuario inactivo';
          
        return res.status(401).json({
          success: false,
          message: mensaje
        });
      }

      // Verificar contraseña
      const passwordValida = await usuario.compararPassword(password);
      
      if (!passwordValida) {
        // Registrar intento fallido
        await usuario.registrarLoginFallido();
        
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas',
          intentosFallidos: usuario.intentosFallidos
        });
      }

      // Login exitoso - registrar
      await usuario.registrarLoginExitoso();

      // Generar token JWT
      const tokenPayload = {
        id: usuario._id,
        username: usuario.username,
        tipoPerfil: usuario.tipoPerfil,
        parroquia: usuario.parroquia,
        primerLogin: usuario.primerLogin
      };

      const token = jwt.sign(tokenPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
        algorithm: config.jwt.algorithm
      });

      // Preparar datos del usuario para respuesta
      const usuarioRespuesta = {
        id: usuario._id,
        username: usuario.username,
        tipoPerfil: usuario.tipoPerfil,
        parroquia: usuario.parroquia,
        datosPersonales: usuario.datosPersonales,
        configuraciones: usuario.configuraciones,
        primerLogin: usuario.primerLogin,
        ultimoLogin: usuario.ultimoLogin
      };

      // Poblar información de parroquia si existe
      if (usuario.parroquia) {
        await usuario.populate('parroquia', 'nombre direccion telefono');
        usuarioRespuesta.parroquiaInfo = usuario.parroquia;
      }

      return res.status(200).json({
        success: true,
        message: 'Login exitoso',
        data: {
          usuario: usuarioRespuesta,
          token,
          expiresIn: config.jwt.expiresIn
        }
      });

    } catch (error) {
      console.error('Error en login:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener perfil del usuario actual
   * GET /api/auth/profile
   */
  async getProfile(req, res) {
    try {
      const usuario = await Usuario.findById(req.user.id)
        .populate('parroquia', 'nombre direccion telefono email')
        .select('-password');

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Perfil obtenido exitosamente',
        data: usuario
      });

    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar perfil del usuario
   * PUT /api/auth/profile
   */
  async updateProfile(req, res) {
    try {
      const { datosPersonales, configuraciones } = req.body;
      
      const usuario = await Usuario.findById(req.user.id);
      
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Actualizar solo campos permitidos
      if (datosPersonales) {
        usuario.datosPersonales = {
          ...usuario.datosPersonales,
          ...datosPersonales
        };
      }

      if (configuraciones) {
        usuario.configuraciones = {
          ...usuario.configuraciones,
          ...configuraciones
        };
      }

      await usuario.save();

      return res.status(200).json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: {
          datosPersonales: usuario.datosPersonales,
          configuraciones: usuario.configuraciones
        }
      });

    } catch (error) {
      console.error('Error actualizando perfil:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Cambiar contraseña
   * PUT /api/auth/change-password
   */
  async changePassword(req, res) {
    try {
      const { passwordActual, passwordNueva } = req.body;

      if (!passwordActual || !passwordNueva) {
        return res.status(400).json({
          success: false,
          message: 'Contraseña actual y nueva son requeridas'
        });
      }

      if (passwordNueva.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      const usuario = await Usuario.findById(req.user.id).select('+password');
      
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar contraseña actual
      const passwordValida = await usuario.compararPassword(passwordActual);
      
      if (!passwordValida) {
        return res.status(401).json({
          success: false,
          message: 'Contraseña actual incorrecta'
        });
      }

      // Cambiar contraseña
      usuario.password = passwordNueva;
      usuario.primerLogin = false; // Marcar como que ya no es primer login
      await usuario.save();

      return res.status(200).json({
        success: true,
        message: 'Contraseña cambiada exitosamente'
      });

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Cerrar sesión
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      // En JWT, el logout se maneja del lado del cliente
      // Aquí podríamos agregar el token a una blacklist si fuera necesario
      
      return res.status(200).json({
        success: true,
        message: 'Sesión cerrada exitosamente'
      });

    } catch (error) {
      console.error('Error en logout:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Refrescar token
   * POST /api/auth/refresh
   */
  async refreshToken(req, res) {
    try {
      const usuario = await Usuario.findById(req.user.id)
        .populate('parroquia', 'nombre');

      if (!usuario || !usuario.estaActivo()) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no válido para renovar token'
        });
      }

      // Generar nuevo token
      const tokenPayload = {
        id: usuario._id,
        username: usuario.username,
        tipoPerfil: usuario.tipoPerfil,
        parroquia: usuario.parroquia?._id,
        primerLogin: usuario.primerLogin
      };

      const nuevoToken = jwt.sign(tokenPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
        algorithm: config.jwt.algorithm
      });

      return res.status(200).json({
        success: true,
        message: 'Token renovado exitosamente',
        data: {
          token: nuevoToken,
          expiresIn: config.jwt.expiresIn
        }
      });

    } catch (error) {
      console.error('Error renovando token:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Verificar token
   * GET /api/auth/verify
   */
  async verifyToken(req, res) {
    try {
      // Si llegamos aquí, el token es válido (verificado por middleware)
      const usuario = await Usuario.findById(req.user.id)
        .populate('parroquia', 'nombre')
        .select('-password');

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Token válido',
        data: {
          usuario,
          tokenInfo: {
            id: req.user.id,
            tipoPerfil: req.user.tipoPerfil,
            parroquia: req.user.parroquia
          }
        }
      });

    } catch (error) {
      console.error('Error verificando token:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Solicitar reseteo de contraseña (placeholder para futuro)
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req, res) {
    try {
      const { username, email } = req.body;

      // TODO: Implementar lógica de reseteo de contraseña
      // - Buscar usuario por username o email
      // - Generar token temporal
      // - Enviar email con enlace de reseteo
      
      return res.status(501).json({
        success: false,
        message: 'Funcionalidad de reseteo de contraseña en desarrollo'
      });

    } catch (error) {
      console.error('Error en forgot password:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Resetear contraseña (placeholder para futuro)
   * POST /api/auth/reset-password
   */
  async resetPassword(req, res) {
    try {
      const { token, passwordNueva } = req.body;

      // TODO: Implementar lógica de reseteo
      // - Verificar token temporal
      // - Cambiar contraseña
      // - Invalidar token
      
      return res.status(501).json({
        success: false,
        message: 'Funcionalidad de reseteo de contraseña en desarrollo'
      });

    } catch (error) {
      console.error('Error en reset password:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new AuthController();