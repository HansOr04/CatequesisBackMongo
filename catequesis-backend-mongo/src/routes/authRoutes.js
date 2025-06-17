const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken, userRateLimit, logActivity } = require('../middleware/auth');
const { authValidations } = require('../middleware/validation');

const router = express.Router();

/**
 * @route POST /api/auth/login
 * @desc Iniciar sesión
 * @access Public
 */
router.post('/login', 
  userRateLimit(10, 15 * 60 * 1000), // 10 intentos por 15 minutos
  authValidations.login,
  logActivity('LOGIN'),
  authController.login
);

/**
 * @route GET /api/auth/profile
 * @desc Obtener perfil del usuario actual
 * @access Private
 */
router.get('/profile',
  authenticateToken,
  logActivity('GET_PROFILE'),
  authController.getProfile
);

/**
 * @route PUT /api/auth/profile
 * @desc Actualizar perfil del usuario
 * @access Private
 */
router.put('/profile',
  authenticateToken,
  logActivity('UPDATE_PROFILE'),
  authController.updateProfile
);

/**
 * @route PUT /api/auth/change-password
 * @desc Cambiar contraseña
 * @access Private
 */
router.put('/change-password',
  authenticateToken,
  authValidations.changePassword,
  logActivity('CHANGE_PASSWORD'),
  authController.changePassword
);

/**
 * @route POST /api/auth/logout
 * @desc Cerrar sesión
 * @access Private
 */
router.post('/logout',
  authenticateToken,
  logActivity('LOGOUT'),
  authController.logout
);

/**
 * @route POST /api/auth/refresh
 * @desc Refrescar token
 * @access Private
 */
router.post('/refresh',
  authenticateToken,
  logActivity('REFRESH_TOKEN'),
  authController.refreshToken
);

/**
 * @route GET /api/auth/verify
 * @desc Verificar token
 * @access Private
 */
router.get('/verify',
  authenticateToken,
  authController.verifyToken
);

/**
 * @route POST /api/auth/forgot-password
 * @desc Solicitar reseteo de contraseña
 * @access Public
 */
router.post('/forgot-password',
  userRateLimit(5, 60 * 60 * 1000), // 5 intentos por hora
  logActivity('FORGOT_PASSWORD'),
  authController.forgotPassword
);

/**
 * @route POST /api/auth/reset-password
 * @desc Resetear contraseña
 * @access Public
 */
router.post('/reset-password',
  userRateLimit(5, 60 * 60 * 1000), // 5 intentos por hora
  logActivity('RESET_PASSWORD'),
  authController.resetPassword
);

module.exports = router;