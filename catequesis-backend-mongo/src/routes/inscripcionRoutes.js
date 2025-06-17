const express = require('express');
const inscripcionController = require('../controllers/inscripcionController');
const { 
  authenticateToken, 
  requireRole, 
  logActivity 
} = require('../middleware/auth');
const { 
  inscripcionValidations,
  commonValidations 
} = require('../middleware/validation');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * @route GET /api/inscripciones
 * @desc Obtener todas las inscripciones
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.pagination,
  logActivity('GET_INSCRIPCIONES'),
  inscripcionController.getAllInscripciones
);

/**
 * @route GET /api/inscripciones/pagos-pendientes
 * @desc Obtener inscripciones con pagos pendientes
 * @access Private (Admin, Párroco, Secretaria)
 */
router.get('/pagos-pendientes',
  requireRole('admin', 'parroco', 'secretaria'),
  logActivity('GET_PAGOS_PENDIENTES'),
  inscripcionController.getPagosPendientes
);

/**
 * @route GET /api/inscripciones/stats
 * @desc Obtener estadísticas de inscripciones
 * @access Private (Admin, Párroco, Secretaria)
 */
router.get('/stats',
  requireRole('admin', 'parroco', 'secretaria'),
  logActivity('GET_INSCRIPCIONES_STATS'),
  inscripcionController.getInscripcionesStats
);

/**
 * @route GET /api/inscripciones/catequizando/:catequizandoId
 * @desc Obtener inscripciones por catequizando
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/catequizando/:catequizandoId',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('GET_INSCRIPCIONES_CATEQUIZANDO'),
  inscripcionController.getInscripcionesPorCatequizando
);

/**
 * @route GET /api/inscripciones/:id
 * @desc Obtener inscripción por ID
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/:id',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('GET_INSCRIPCION'),
  inscripcionController.getInscripcionById
);

/**
 * @route POST /api/inscripciones
 * @desc Crear nueva inscripción
 * @access Private (Admin, Párroco, Secretaria)
 */
router.post('/',
  requireRole('admin', 'parroco', 'secretaria'),
  inscripcionValidations.create,
  logActivity('CREATE_INSCRIPCION'),
  inscripcionController.createInscripcion
);

/**
 * @route POST /api/inscripciones/:id/pagos
 * @desc Registrar pago de inscripción
 * @access Private (Admin, Párroco, Secretaria)
 */
router.post('/:id/pagos',
  requireRole('admin', 'parroco', 'secretaria'),
  inscripcionValidations.registrarPago,
  logActivity('REGISTRAR_PAGO'),
  inscripcionController.registrarPago
);

/**
 * @route POST /api/inscripciones/:id/observaciones
 * @desc Agregar observación a inscripción
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.post('/:id/observaciones',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('AGREGAR_OBSERVACION_INSCRIPCION'),
  inscripcionController.agregarObservacion
);

/**
 * @route POST /api/inscripciones/:id/calificaciones
 * @desc Registrar calificación
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.post('/:id/calificaciones',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('REGISTRAR_CALIFICACION'),
  inscripcionController.registrarCalificacion
);

/**
 * @route PUT /api/inscripciones/:id
 * @desc Actualizar inscripción
 * @access Private (Admin, Párroco, Secretaria)
 */
router.put('/:id',
  requireRole('admin', 'parroco', 'secretaria'),
  commonValidations.objectId,
  logActivity('UPDATE_INSCRIPCION'),
  inscripcionController.updateInscripcion
);

/**
 * @route PUT /api/inscripciones/:id/estado
 * @desc Cambiar estado de inscripción
 * @access Private (Admin, Párroco, Secretaria)
 */
router.put('/:id/estado',
  requireRole('admin', 'parroco', 'secretaria'),
  commonValidations.objectId,
  logActivity('CAMBIAR_ESTADO_INSCRIPCION'),
  inscripcionController.cambiarEstado
);

/**
 * @route PUT /api/inscripciones/:id/aprobar
 * @desc Aprobar inscripción
 * @access Private (Admin, Párroco)
 */
router.put('/:id/aprobar',
  requireRole('admin', 'parroco'),
  commonValidations.objectId,
  logActivity('APROBAR_INSCRIPCION'),
  inscripcionController.aprobarInscripcion
);

module.exports = router;