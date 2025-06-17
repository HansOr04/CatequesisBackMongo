const express = require('express');
const usuarioController = require('../controllers/usuarioController');
const { 
  authenticateToken, 
  requireRole, 
  requireSameParroquia,
  logActivity 
} = require('../middleware/auth');
const { 
  userValidations, 
  commonValidations 
} = require('../middleware/validation');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * @route GET /api/usuarios
 * @desc Obtener todos los usuarios
 * @access Private (Admin, Párroco, Secretaria)
 */
router.get('/',
  requireRole('admin', 'parroco', 'secretaria'),
  commonValidations.pagination,
  logActivity('GET_USUARIOS'),
  usuarioController.getAllUsuarios
);

/**
 * @route GET /api/usuarios/search
 * @desc Buscar usuarios
 * @access Private (Admin, Párroco, Secretaria)
 */
router.get('/search',
  requireRole('admin', 'parroco', 'secretaria'),
  logActivity('SEARCH_USUARIOS'),
  usuarioController.searchUsuarios
);

/**
 * @route GET /api/usuarios/stats
 * @desc Obtener estadísticas de usuarios
 * @access Private (Admin, Párroco)
 */
router.get('/stats',
  requireRole('admin', 'parroco'),
  logActivity('GET_USUARIOS_STATS'),
  usuarioController.getUsuariosStats
);

/**
 * @route GET /api/usuarios/catequistas
 * @desc Obtener catequistas disponibles
 * @access Private (Admin, Párroco, Secretaria)
 */
router.get('/catequistas',
  requireRole('admin', 'parroco', 'secretaria'),
  logActivity('GET_CATEQUISTAS'),
  usuarioController.getCatequistasDisponibles
);

/**
 * @route POST /api/usuarios/limpiar-bloqueos
 * @desc Limpiar bloqueos expirados
 * @access Private (Admin)
 */
router.post('/limpiar-bloqueos',
  requireRole('admin'),
  logActivity('LIMPIAR_BLOQUEOS'),
  usuarioController.limpiarBloqueos
);

/**
 * @route GET /api/usuarios/:id
 * @desc Obtener usuario por ID
 * @access Private (Admin, Párroco, Secretaria, propietario)
 */
router.get('/:id',
  commonValidations.objectId,
  logActivity('GET_USUARIO'),
  usuarioController.getUsuarioById
);

/**
 * @route POST /api/usuarios
 * @desc Crear nuevo usuario
 * @access Private (Admin, Párroco)
 */
router.post('/',
  requireRole('admin', 'parroco'),
  userValidations.create,
  logActivity('CREATE_USUARIO'),
  usuarioController.createUsuario
);

/**
 * @route PUT /api/usuarios/:id
 * @desc Actualizar usuario
 * @access Private (Admin, Párroco, Secretaria, propietario)
 */
router.put('/:id',
  userValidations.update,
  logActivity('UPDATE_USUARIO'),
  usuarioController.updateUsuario
);

/**
 * @route DELETE /api/usuarios/:id
 * @desc Eliminar usuario
 * @access Private (Admin)
 */
router.delete('/:id',
  requireRole('admin'),
  commonValidations.objectId,
  logActivity('DELETE_USUARIO'),
  usuarioController.deleteUsuario
);

/**
 * @route PUT /api/usuarios/:id/toggle-status
 * @desc Activar/Desactivar usuario
 * @access Private (Admin, Párroco)
 */
router.put('/:id/toggle-status',
  requireRole('admin', 'parroco'),
  commonValidations.objectId,
  logActivity('TOGGLE_USUARIO_STATUS'),
  usuarioController.toggleStatus
);

/**
 * @route PUT /api/usuarios/:id/desbloquear
 * @desc Desbloquear usuario
 * @access Private (Admin, Párroco)
 */
router.put('/:id/desbloquear',
  requireRole('admin', 'parroco'),
  commonValidations.objectId,
  logActivity('DESBLOQUEAR_USUARIO'),
  usuarioController.desbloquearUsuario
);

/**
 * @route PUT /api/usuarios/:id/reset-password
 * @desc Resetear contraseña de usuario
 * @access Private (Admin, Párroco)
 */
router.put('/:id/reset-password',
  requireRole('admin', 'parroco'),
  commonValidations.objectId,
  logActivity('RESET_PASSWORD_USUARIO'),
  usuarioController.resetPassword
);

module.exports = router;