const express = require('express');
const asistenciaController = require('../controllers/asistenciaController');
const { 
  authenticateToken, 
  requireRole, 
  logActivity 
} = require('../middleware/auth');
const { 
  asistenciaValidations,
  commonValidations 
} = require('../middleware/validation');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * @route GET /api/asistencias
 * @desc Obtener asistencias con filtros
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.pagination,
  commonValidations.dateRange,
  logActivity('GET_ASISTENCIAS'),
  asistenciaController.getAllAsistencias
);

/**
 * @route GET /api/asistencias/reporte
 * @desc Obtener reporte de asistencia
 * @access Private (Admin, Párroco, Secretaria)
 */
router.get('/reporte',
  requireRole('admin', 'parroco', 'secretaria'),
  commonValidations.dateRange,
  logActivity('GET_REPORTE_ASISTENCIA'),
  asistenciaController.getReporteAsistencia
);

/**
 * @route GET /api/asistencias/ausencias-pendientes
 * @desc Obtener ausencias pendientes de notificar
 * @access Private (Admin, Párroco, Secretaria)
 */
router.get('/ausencias-pendientes',
  requireRole('admin', 'parroco', 'secretaria'),
  logActivity('GET_AUSENCIAS_PENDIENTES'),
  asistenciaController.getAusenciasPendientes
);

/**
 * @route GET /api/asistencias/stats/grupo/:grupoId
 * @desc Obtener estadísticas de asistencia por grupo
 * @access Private (Admin, Párroco, Secretaria, Catequista del grupo)
 */
router.get('/stats/grupo/:grupoId',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  commonValidations.dateRange,
  logActivity('GET_STATS_ASISTENCIA_GRUPO'),
  asistenciaController.getStatsGrupo
);

/**
 * @route GET /api/asistencias/grupo/:grupoId/fecha/:fecha
 * @desc Obtener asistencias por grupo y fecha
 * @access Private (Admin, Párroco, Secretaria, Catequista del grupo)
 */
router.get('/grupo/:grupoId/fecha/:fecha',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  logActivity('GET_ASISTENCIAS_GRUPO_FECHA'),
  asistenciaController.getAsistenciasPorGrupoYFecha
);

/**
 * @route GET /api/asistencias/:id
 * @desc Obtener asistencia por ID
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/:id',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('GET_ASISTENCIA'),
  asistenciaController.getAsistenciaById
);

/**
 * @route POST /api/asistencias
 * @desc Registrar asistencia individual
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.post('/',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  asistenciaValidations.create,
  logActivity('REGISTRAR_ASISTENCIA'),
  asistenciaController.registrarAsistencia
);

/**
 * @route POST /api/asistencias/grupo/:grupoId
 * @desc Registrar asistencia masiva para un grupo
 * @access Private (Admin, Párroco, Secretaria, Catequista del grupo)
 */
router.post('/grupo/:grupoId',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  asistenciaValidations.registrarGrupo,
  logActivity('REGISTRAR_ASISTENCIA_GRUPO'),
  asistenciaController.registrarAsistenciaGrupo
);

/**
 * @route POST /api/asistencias/:id/observaciones
 * @desc Agregar observación a asistencia
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.post('/:id/observaciones',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('AGREGAR_OBSERVACION_ASISTENCIA'),
  asistenciaController.agregarObservacion
);

/**
 * @route POST /api/asistencias/:id/tareas
 * @desc Registrar tarea en asistencia
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.post('/:id/tareas',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('REGISTRAR_TAREA_ASISTENCIA'),
  asistenciaController.registrarTarea
);

/**
 * @route PUT /api/asistencias/:id
 * @desc Actualizar asistencia
 * @access Private (Admin, Párroco, Secretaria, Catequista del grupo)
 */
router.put('/:id',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('UPDATE_ASISTENCIA'),
  asistenciaController.updateAsistencia
);

/**
 * @route PUT /api/asistencias/:id/notificacion/:tipo
 * @desc Marcar notificación como enviada
 * @access Private (Admin, Párroco, Secretaria)
 */
router.put('/:id/notificacion/:tipo',
  requireRole('admin', 'parroco', 'secretaria'),
  commonValidations.objectId,
  logActivity('MARCAR_NOTIFICACION_ENVIADA'),
  asistenciaController.marcarNotificacionEnviada
);

module.exports = router;