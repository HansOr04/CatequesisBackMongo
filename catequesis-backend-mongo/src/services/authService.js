const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const Usuario = require('../models/Usuario');
const { AppError, ErrorBuilder } = require('../utils/errors');

class AuthService {
  /**
   * Registrar nuevo usuario
   */
  async register(userData) {
    try {
      const { username, email, password, nombres, apellidos, documento, telefono, tipoPerfil, parroquia } = userData;

      // Verificar si el usuario ya existe
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
        parroquia,
        activo: true
      });

      await nuevoUsuario.save();

      // Generar token
      const token = this.generateToken(nuevoUsuario);

      // Remover password del response
      const usuarioResponse = nuevoUsuario.toObject();
      delete usuarioResponse.password;

      return {
        success: true,
        message: 'Usuario registrado exitosamente',
        data: {
          usuario: usuarioResponse,
          token
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de usuario inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al registrar usuario');
    }
  }

  /**
   * Iniciar sesión
   */
  async login(credentials) {
    try {
      const { username, password } = credentials;

      // Buscar usuario (puede ser username o email)
      const usuario = await Usuario.findOne({
        $or: [
          { username },
          { email: username }
        ]
      }).populate('parroquia', 'nombre');

      if (!usuario) {
        throw ErrorBuilder.unauthorized('Credenciales inválidas');
      }

      // Verificar si el usuario está activo
      if (!usuario.activo) {
        throw ErrorBuilder.forbidden('Usuario inactivo. Contacta al administrador');
      }

      // Verificar contraseña
      const isValidPassword = await bcrypt.compare(password, usuario.password);
      if (!isValidPassword) {
        throw ErrorBuilder.unauthorized('Credenciales inválidas');
      }

      // Actualizar último acceso
      usuario.ultimoAcceso = new Date();
      await usuario.save();

      // Generar token
      const token = this.generateToken(usuario);

      // Remover password del response
      const usuarioResponse = usuario.toObject();
      delete usuarioResponse.password;

      return {
        success: true,
        message: 'Inicio de sesión exitoso',
        data: {
          usuario: usuarioResponse,
          token
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al iniciar sesión');
    }
  }

  /**
   * Verificar token JWT
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      const usuario = await Usuario.findById(decoded.userId)
        .populate('parroquia', 'nombre')
        .select('-password');

      if (!usuario) {
        throw ErrorBuilder.unauthorized('Token inválido');
      }

      if (!usuario.activo) {
        throw ErrorBuilder.forbidden('Usuario inactivo');
      }

      return usuario;

    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw ErrorBuilder.unauthorized('Token inválido');
      }
      
      if (error.name === 'TokenExpiredError') {
        throw ErrorBuilder.unauthorized('Token expirado');
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al verificar token');
    }
  }

  /**
   * Renovar token
   */
  async refreshToken(currentToken) {
    try {
      const usuario = await this.verifyToken(currentToken);
      const newToken = this.generateToken(usuario);

      return {
        success: true,
        message: 'Token renovado exitosamente',
        data: {
          token: newToken,
          usuario
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Cambiar contraseña
   */
  async changePassword(userId, passwordData) {
    try {
      const { currentPassword, newPassword } = passwordData;

      const usuario = await Usuario.findById(userId);
      if (!usuario) {
        throw ErrorBuilder.notFound('Usuario no encontrado');
      }

      // Verificar contraseña actual
      const isValidPassword = await bcrypt.compare(currentPassword, usuario.password);
      if (!isValidPassword) {
        throw ErrorBuilder.unauthorized('Contraseña actual incorrecta');
      }

      // Encriptar nueva contraseña
      const hashedNewPassword = await bcrypt.hash(newPassword, config.bcrypt.rounds);

      // Actualizar contraseña
      usuario.password = hashedNewPassword;
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
   * Resetear contraseña (solo admin)
   */
  async resetPassword(userId, newPassword, adminUser) {
    try {
      if (adminUser.tipoPerfil !== 'admin') {
        throw ErrorBuilder.forbidden('Solo los administradores pueden resetear contraseñas');
      }

      const usuario = await Usuario.findById(userId);
      if (!usuario) {
        throw ErrorBuilder.notFound('Usuario no encontrado');
      }

      // Encriptar nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.rounds);

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
   * Generar token JWT
   */
  generateToken(usuario) {
    const payload = {
      userId: usuario._id,
      username: usuario.username,
      tipoPerfil: usuario.tipoPerfil,
      parroquia: usuario.parroquia
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      algorithm: config.jwt.algorithm
    });
  }

  /**
   * Obtener perfil de usuario
   */
  async getProfile(userId) {
    try {
      const usuario = await Usuario.findById(userId)
        .populate('parroquia', 'nombre direccion telefono')
        .select('-password');

      if (!usuario) {
        throw ErrorBuilder.notFound('Usuario no encontrado');
      }

      return {
        success: true,
        data: usuario
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al obtener perfil');
    }
  }

  /**
   * Actualizar perfil
   */
  async updateProfile(userId, updateData) {
    try {
      const { nombres, apellidos, telefono, email } = updateData;

      // Verificar si el email ya existe (si se está cambiando)
      if (email) {
        const emailExists = await Usuario.findOne({
          email,
          _id: { $ne: userId }
        });

        if (emailExists) {
          throw ErrorBuilder.conflict('El email ya está en uso por otro usuario');
        }
      }

      const usuario = await Usuario.findByIdAndUpdate(
        userId,
        { nombres, apellidos, telefono, email },
        { new: true, runValidators: true }
      ).populate('parroquia', 'nombre').select('-password');

      if (!usuario) {
        throw ErrorBuilder.notFound('Usuario no encontrado');
      }

      return {
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: usuario
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al actualizar perfil');
    }
  }
}

module.exports = new AuthService();