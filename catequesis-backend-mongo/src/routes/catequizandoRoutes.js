const express = require('express');
const catequizandoController = require('../controllers/catequizandoController');
const { 
  authenticateToken, 
  requireRole, 
  logActivity 
} = require('../middleware/auth');
const { 
  catequizandoValidations,
  commonValidations 
} = require('../middleware/validation');
const { body, param } = require('express-validator');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * @route GET /api/catequizandos
 * @desc Obtener todos los catequizandos
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.pagination,
  logActivity('GET_CATEQUIZANDOS'),
  catequizandoController.getAllCatequizandos
);

/**
 * @route GET /api/catequizandos/search
 * @desc Buscar catequizandos
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/search',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  logActivity('SEARCH_CATEQUIZANDOS'),
  catequizandoController.searchCatequizandos
);

/**
 * @route GET /api/catequizandos/stats
 * @desc Obtener estadísticas de catequizandos
 * @access Private (Admin, Párroco, Secretaria)
 */
router.get('/stats',
  requireRole('admin', 'parroco', 'secretaria'),
  logActivity('GET_CATEQUIZANDOS_STATS'),
  catequizandoController.getCatequizandosStats
);

/**
 * @route GET /api/catequizandos/cumpleanos
 * @desc Obtener cumpleañeros del mes
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/cumpleanos',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  logActivity('GET_CUMPLEANOS'),
  catequizandoController.getCumpleanosMes
);

/**
 * @route GET /api/catequizandos/documento/:documento
 * @desc Buscar catequizando por documento
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/documento/:documento',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  param('documento')
    .trim()
    .isLength({ min: 6, max: 20 })
    .withMessage('El documento debe tener entre 6 y 20 caracteres'),
  logActivity('GET_CATEQUIZANDO_BY_DOCUMENTO'),
  catequizandoController.getCatequizandoByDocumento
);

/**
 * @route GET /api/catequizandos/:id
 * @desc Obtener catequizando por ID
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/:id',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('GET_CATEQUIZANDO'),
  catequizandoController.getCatequizandoById
);

/**
 * @route GET /api/catequizandos/:id/inscripciones
 * @desc Obtener inscripciones de un catequizando
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/:id/inscripciones',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('GET_CATEQUIZANDO_INSCRIPCIONES'),
  catequizandoController.getCatequizandoInscripciones
);

/**
 * @route GET /api/catequizandos/:id/certificados
 * @desc Obtener certificados de un catequizando
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/:id/certificados',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('GET_CATEQUIZANDO_CERTIFICADOS'),
  catequizandoController.getCatequizandoCertificados
);

/**
 * @route POST /api/catequizandos/:id/validar-inscripcion
 * @desc Validar elegibilidad para inscripción
 * @access Private (Admin, Párroco, Secretaria)
 */
router.post('/:id/validar-inscripcion',
  requireRole('admin', 'parroco', 'secretaria'),
  commonValidations.objectId,
  body('id_nivel')
    .custom((value) => {
      if (!require('mongoose').Types.ObjectId.isValid(value)) {
        throw new Error('ID de nivel inválido');
      }
      return true;
    }),
  logActivity('VALIDAR_INSCRIPCION_CATEQUIZANDO'),
  catequizandoController.validarInscripcion
);

/**
 * @route POST /api/catequizandos
 * @desc Crear nuevo catequizando
 * @access Private (Admin, Párroco, Secretaria)
 */
router.post('/',
  requireRole('admin', 'parroco', 'secretaria'),
  catequizandoValidations.create,
  logActivity('CREATE_CATEQUIZANDO'),
  catequizandoController.createCatequizando
);

/**
 * @route PUT /api/catequizandos/:id
 * @desc Actualizar catequizando
 * @access Private (Admin, Párroco, Secretaria)
 */
router.put('/:id',
  requireRole('admin', 'parroco', 'secretaria'),
  catequizandoValidations.update,
  logActivity('UPDATE_CATEQUIZANDO'),
  catequizandoController.updateCatequizando
);

/**
 * @route DELETE /api/catequizandos/:id
 * @desc Eliminar catequizando
 * @access Private (Admin)
 */
router.delete('/:id',
  requireRole('admin'),
  commonValidations.objectId,
  logActivity('DELETE_CATEQUIZANDO'),
  catequizandoController.deleteCatequizando
);

/**
 * @route PUT /api/catequizandos/:id/egresar
 * @desc Marcar catequizando como egresado
 * @access Private (Admin, Párroco, Secretaria)
 */
router.put('/:id/egresar',
  requireRole('admin', 'parroco', 'secretaria'),
  commonValidations.objectId,
  body('motivo')
    .isIn(['graduacion', 'retiro_voluntario', 'cambio_parroquia', 'suspension', 'otro'])
    .withMessage('Motivo de egreso inválido'),
  body('fecha')
    .optional()
    .isISO8601()
    .withMessage('Fecha inválida'),
  logActivity('EGRESAR_CATEQUIZANDO'),
  catequizandoController.marcarEgresado
);

/**
 * @route PUT /api/catequizandos/:id/reactivar
 * @desc Reactivar catequizando
 * @access Private (Admin, Párroco, Secretaria)
 */
router.put('/:id/reactivar',
  requireRole('admin', 'parroco', 'secretaria'),
  commonValidations.objectId,
  logActivity('REACTIVAR_CATEQUIZANDO'),
  catequizandoController.reactivarCatequizando
);

module.exports = router;