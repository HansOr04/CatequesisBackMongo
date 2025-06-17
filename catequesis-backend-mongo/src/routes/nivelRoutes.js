const express = require('express');
const nivelController = require('../controllers/nivelController');
const { 
  authenticateToken, 
  requireRole, 
  logActivity 
} = require('../middleware/auth');
const { 
  commonValidations 
} = require('../middleware/validation');
const { body, param } = require('express-validator');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * Validaciones específicas para niveles
 */
const nivelValidations = {
  create: [
    body('nombre')
      .trim()
      .notEmpty()
      .withMessage('El nombre del nivel es requerido')
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    
    body('descripcion')
      .trim()
      .notEmpty()
      .withMessage('La descripción es requerida')
      .isLength({ min: 5, max: 500 })
      .withMessage('La descripción debe tener entre 5 y 500 caracteres'),
    
    body('orden')
      .isInt({ min: 1, max: 20 })
      .withMessage('El orden debe ser un número entre 1 y 20'),
    
    body('configuracion.edadMinima')
      .optional()
      .isInt({ min: 4, max: 99 })
      .withMessage('La edad mínima debe ser entre 4 y 99 años'),
    
    body('configuracion.edadMaxima')
      .optional()
      .isInt({ min: 4, max: 99 })
      .withMessage('La edad máxima debe ser entre 4 y 99 años')
      .custom((value, { req }) => {
        if (req.body.configuracion?.edadMinima && value < req.body.configuracion.edadMinima) {
          throw new Error('La edad máxima debe ser mayor o igual a la edad mínima');
        }
        return true;
      }),
    
    body('configuracion.sacramentoAsociado')
      .optional()
      .isIn(['', 'primera_comunion', 'confirmacion', 'matrimonio'])
      .withMessage('Sacramento asociado no válido'),
    
    body('contenido.objetivos')
      .optional()
      .isArray()
      .withMessage('Los objetivos deben ser un array'),
    
    body('contenido.objetivos.*.descripcion')
      .if(body('contenido.objetivos').exists())
      .trim()
      .notEmpty()
      .withMessage('La descripción del objetivo es requerida')
      .isLength({ max: 200 })
      .withMessage('La descripción del objetivo no puede exceder 200 caracteres'),
    
    body('contenido.temas')
      .optional()
      .isArray()
      .withMessage('Los temas deben ser un array'),
    
    body('contenido.temas.*.nombre')
      .if(body('contenido.temas').exists())
      .trim()
      .notEmpty()
      .withMessage('El nombre del tema es requerido')
      .isLength({ max: 100 })
      .withMessage('El nombre del tema no puede exceder 100 caracteres'),
    
    body('evaluacion.notaMinima')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('La nota mínima debe ser entre 0 y 100')
  ],

  update: [
    body('nombre')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    
    body('descripcion')
      .optional()
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('La descripción debe tener entre 5 y 500 caracteres'),
    
    body('orden')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('El orden debe ser un número entre 1 y 20'),
    
    body('configuracion.edadMinima')
      .optional()
      .isInt({ min: 4, max: 99 })
      .withMessage('La edad mínima debe ser entre 4 y 99 años'),
    
    body('configuracion.edadMaxima')
      .optional()
      .isInt({ min: 4, max: 99 })
      .withMessage('La edad máxima debe ser entre 4 y 99 años')
  ],

  reorder: [
    body('ordenData')
      .isArray({ min: 1 })
      .withMessage('Debe proporcionar al menos un elemento para reordenar'),
    
    body('ordenData.*.id')
      .custom((value) => {
        if (!require('mongoose').Types.ObjectId.isValid(value)) {
          throw new Error('ID de nivel inválido');
        }
        return true;
      }),
    
    body('ordenData.*.nuevoOrden')
      .isInt({ min: 1, max: 20 })
      .withMessage('El nuevo orden debe ser entre 1 y 20')
  ]
};

/**
 * @route GET /api/niveles
 * @desc Obtener todos los niveles
 * @access Private (Todos los usuarios autenticados)
 */
router.get('/',
  logActivity('GET_NIVELES'),
  nivelController.getAllNiveles
);

/**
 * @route GET /api/niveles/ordenados
 * @desc Obtener niveles ordenados
 * @access Private (Todos los usuarios autenticados)
 */
router.get('/ordenados',
  logActivity('GET_NIVELES_ORDENADOS'),
  nivelController.getNivelesOrdenados
);

/**
 * @route GET /api/niveles/search
 * @desc Buscar niveles
 * @access Private (Todos los usuarios autenticados)
 */
router.get('/search',
  logActivity('SEARCH_NIVELES'),
  nivelController.searchNiveles
);

/**
 * @route GET /api/niveles/stats/global
 * @desc Obtener estadísticas globales de niveles
 * @access Private (Admin, Párroco)
 */
router.get('/stats/global',
  requireRole('admin', 'parroco'),
  logActivity('GET_NIVELES_GLOBAL_STATS'),
  nivelController.getGlobalStats
);

/**
 * @route GET /api/niveles/plantilla/:tipo
 * @desc Obtener plantilla de contenido para un tipo de nivel
 * @access Private (Admin)
 */
router.get('/plantilla/:tipo',
  requireRole('admin'),
  param('tipo')
    .isIn(['infantil', 'juvenil', 'adulto'])
    .withMessage('Tipo de plantilla no válido'),
  logActivity('GET_PLANTILLA_NIVEL'),
  nivelController.getPlantillaContenido
);

/**
 * @route GET /api/niveles/progresion/:idCatequizando
 * @desc Obtener progresión de niveles para un catequizando
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/progresion/:idCatequizando',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  param('idCatequizando')
    .custom((value) => {
      if (!require('mongoose').Types.ObjectId.isValid(value)) {
        throw new Error('ID de catequizando inválido');
      }
      return true;
    }),
  logActivity('GET_PROGRESION_NIVELES'),
  nivelController.getProgresionNiveles
);

/**
 * @route GET /api/niveles/sacramento/:sacramento
 * @desc Obtener niveles por sacramento
 * @access Private (Todos los usuarios autenticados)
 */
router.get('/sacramento/:sacramento',
  param('sacramento')
    .isIn(['primera_comunion', 'confirmacion', 'matrimonio'])
    .withMessage('Sacramento no válido'),
  logActivity('GET_NIVELES_POR_SACRAMENTO'),
  nivelController.getNivelesPorSacramento
);

/**
 * @route PUT /api/niveles/reorder
 * @desc Reordenar niveles
 * @access Private (Admin)
 */
router.put('/reorder',
  requireRole('admin'),
  nivelValidations.reorder,
  logActivity('REORDER_NIVELES'),
  nivelController.reorderNiveles
);

/**
 * @route GET /api/niveles/:id
 * @desc Obtener nivel por ID
 * @access Private (Todos los usuarios autenticados)
 */
router.get('/:id',
  commonValidations.objectId,
  logActivity('GET_NIVEL'),
  nivelController.getNivelById
);

/**
 * @route GET /api/niveles/:id/stats
 * @desc Obtener estadísticas de un nivel
 * @access Private (Admin, Párroco)
 */
router.get('/:id/stats',
  requireRole('admin', 'parroco'),
  commonValidations.objectId,
  logActivity('GET_NIVEL_STATS'),
  nivelController.getNivelStats
);

/**
 * @route POST /api/niveles/:id/validar-contenido
 * @desc Validar completitud del contenido de un nivel
 * @access Private (Admin, Párroco)
 */
router.post('/:id/validar-contenido',
  requireRole('admin', 'parroco'),
  commonValidations.objectId,
  logActivity('VALIDAR_CONTENIDO_NIVEL'),
  nivelController.validarContenido
);

/**
 * @route POST /api/niveles
 * @desc Crear nuevo nivel
 * @access Private (Admin)
 */
router.post('/',
  requireRole('admin'),
  nivelValidations.create,
  logActivity('CREATE_NIVEL'),
  nivelController.createNivel
);

/**
 * @route PUT /api/niveles/:id
 * @desc Actualizar nivel
 * @access Private (Admin)
 */
router.put('/:id',
  requireRole('admin'),
  commonValidations.objectId,
  nivelValidations.update,
  logActivity('UPDATE_NIVEL'),
  nivelController.updateNivel
);

/**
 * @route DELETE /api/niveles/:id
 * @desc Eliminar nivel
 * @access Private (Admin)
 */
router.delete('/:id',
  requireRole('admin'),
  commonValidations.objectId,
  logActivity('DELETE_NIVEL'),
  nivelController.deleteNivel
);

module.exports = router;