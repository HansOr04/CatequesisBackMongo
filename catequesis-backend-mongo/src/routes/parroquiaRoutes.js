const express = require('express');
const parroquiaController = require('../controllers/parroquiaController');
const { 
  authenticateToken, 
  requireRole, 
  logActivity 
} = require('../middleware/auth');
const { 
  commonValidations 
} = require('../middleware/validation');
const { body } = require('express-validator');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * Validaciones específicas para parroquias
 */
const parroquiaValidations = {
  create: [
    body('nombre')
      .trim()
      .notEmpty()
      .withMessage('El nombre de la parroquia es requerido')
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    
    body('direccion')
      .trim()
      .notEmpty()
      .withMessage('La dirección es requerida')
      .isLength({ min: 5, max: 255 })
      .withMessage('La dirección debe tener entre 5 y 255 caracteres'),
    
    body('telefono')
      .trim()
      .notEmpty()
      .withMessage('El teléfono es requerido')
      .matches(/^[\d\-\s\+\(\)]+$/)
      .withMessage('Formato de teléfono inválido')
      .isLength({ min: 7, max: 20 })
      .withMessage('El teléfono debe tener entre 7 y 20 caracteres'),
    
    body('email')
      .optional()
      .isEmail()
      .withMessage('Email inválido'),
    
    body('ubicacion.coordenadas.latitud')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitud debe estar entre -90 y 90'),
    
    body('ubicacion.coordenadas.longitud')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitud debe estar entre -180 y 180')
  ],

  update: [
    body('nombre')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    
    body('direccion')
      .optional()
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage('La dirección debe tener entre 5 y 255 caracteres'),
    
    body('telefono')
      .optional()
      .trim()
      .matches(/^[\d\-\s\+\(\)]+$/)
      .withMessage('Formato de teléfono inválido')
      .isLength({ min: 7, max: 20 })
      .withMessage('El teléfono debe tener entre 7 y 20 caracteres'),
    
    body('email')
      .optional()
      .isEmail()
      .withMessage('Email inválido')
  ]
};

/**
 * @route GET /api/parroquias
 * @desc Obtener todas las parroquias
 * @access Private (Todos los usuarios autenticados)
 */
router.get('/',
  commonValidations.pagination,
  logActivity('GET_PARROQUIAS'),
  parroquiaController.getAllParroquias
);

/**
 * @route GET /api/parroquias/search
 * @desc Buscar parroquias
 * @access Private (Todos los usuarios autenticados)
 */
router.get('/search',
  logActivity('SEARCH_PARROQUIAS'),
  parroquiaController.searchParroquias
);

/**
 * @route GET /api/parroquias/stats/global
 * @desc Obtener estadísticas globales de parroquias
 * @access Private (Admin)
 */
router.get('/stats/global',
  requireRole('admin'),
  logActivity('GET_PARROQUIAS_GLOBAL_STATS'),
  parroquiaController.getGlobalStats
);

/**
 * @route GET /api/parroquias/:id
 * @desc Obtener parroquia por ID
 * @access Private (Todos los usuarios autenticados)
 */
router.get('/:id',
  commonValidations.objectId,
  logActivity('GET_PARROQUIA'),
  parroquiaController.getParroquiaById
);

/**
 * @route GET /api/parroquias/:id/stats
 * @desc Obtener estadísticas de una parroquia
 * @access Private (Admin, Párroco de la parroquia)
 */
router.get('/:id/stats',
  commonValidations.objectId,
  logActivity('GET_PARROQUIA_STATS'),
  parroquiaController.getParroquiaStats
);

/**
 * @route GET /api/parroquias/:id/horarios
 * @desc Obtener horarios de una parroquia
 * @access Private (Todos los usuarios autenticados)
 */
router.get('/:id/horarios',
  commonValidations.objectId,
  logActivity('GET_PARROQUIA_HORARIOS'),
  parroquiaController.getHorarios
);

/**
 * @route POST /api/parroquias
 * @desc Crear nueva parroquia
 * @access Private (Admin, Párroco)
 */
router.post('/',
  requireRole('admin', 'parroco'),
  parroquiaValidations.create,
  logActivity('CREATE_PARROQUIA'),
  parroquiaController.createParroquia
);

/**
 * @route PUT /api/parroquias/:id
 * @desc Actualizar parroquia
 * @access Private (Admin, Párroco de la parroquia)
 */
router.put('/:id',
  requireRole('admin', 'parroco'),
  commonValidations.objectId,
  parroquiaValidations.update,
  logActivity('UPDATE_PARROQUIA'),
  parroquiaController.updateParroquia
);

/**
 * @route DELETE /api/parroquias/:id
 * @desc Eliminar parroquia
 * @access Private (Admin)
 */
router.delete('/:id',
  requireRole('admin'),
  commonValidations.objectId,
  logActivity('DELETE_PARROQUIA'),
  parroquiaController.deleteParroquia
);

/**
 * @route PUT /api/parroquias/:id/toggle-status
 * @desc Activar/Desactivar parroquia
 * @access Private (Admin)
 */
router.put('/:id/toggle-status',
  requireRole('admin'),
  commonValidations.objectId,
  body('activa')
    .isBoolean()
    .withMessage('El estado debe ser verdadero o falso'),
  logActivity('TOGGLE_PARROQUIA_STATUS'),
  parroquiaController.toggleStatus
);

module.exports = router;