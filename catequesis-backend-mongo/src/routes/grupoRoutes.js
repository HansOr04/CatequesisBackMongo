const express = require('express');
const grupoController = require('../controllers/grupoController');
const { 
  authenticateToken, 
  requireRole, 
  logActivity 
} = require('../middleware/auth');
const { 
  grupoValidations,
  commonValidations 
} = require('../middleware/validation');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * @route GET /api/grupos
 * @desc Obtener todos los grupos
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.pagination,
  logActivity('GET_GRUPOS'),
  grupoController.getAllGrupos
);

/**
 * @route GET /api/grupos/search
 * @desc Buscar grupos
 * @access Private (Admin, Párroco, Secretaria, Catequista)
 */
router.get('/search',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  logActivity('SEARCH_GRUPOS'),
  grupoController.searchGrupos
);

/**
 * @route GET /api/grupos/mis-grupos
 * @desc Obtener grupos del catequista actual
 * @access Private (Catequista)
 */
router.get('/mis-grupos',
  requireRole('catequista'),
  logActivity('GET_MIS_GRUPOS'),
  grupoController.getMisGrupos
);

/**
 * @route GET /api/grupos/:id
 * @desc Obtener grupo por ID
 * @access Private (Admin, Párroco, Secretaria, Catequista del grupo)
 */
router.get('/:id',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('GET_GRUPO'),
  grupoController.getGrupoById
);

/**
 * @route GET /api/grupos/:id/inscripciones
 * @desc Obtener inscripciones de un grupo
 * @access Private (Admin, Párroco, Secretaria, Catequista del grupo)
 */
router.get('/:id/inscripciones',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('GET_GRUPO_INSCRIPCIONES'),
  grupoController.getGrupoInscripciones
);

/**
 * @route GET /api/grupos/:id/stats
 * @desc Obtener estadísticas del grupo
 * @access Private (Admin, Párroco, Secretaria, Catequista del grupo)
 */
router.get('/:id/stats',
  requireRole('admin', 'parroco', 'secretaria', 'catequista'),
  commonValidations.objectId,
  logActivity('GET_GRUPO_STATS'),
  grupoController.getGrupoStats
);

/**
 * @route POST /api/grupos
 * @desc Crear nuevo grupo
 * @access Private (Admin, Párroco, Secretaria)
 */
router.post('/',
  requireRole('admin', 'parroco', 'secretaria'),
  grupoValidations.create,
  logActivity('CREATE_GRUPO'),
  grupoController.createGrupo
);

/**
 * @route POST /api/grupos/:id/duplicar
 * @desc Duplicar grupo para nuevo periodo
 * @access Private (Admin, Párroco)
 */
router.post('/:id/duplicar',
  requireRole('admin', 'parroco'),
  commonValidations.objectId,
  logActivity('DUPLICAR_GRUPO'),
  grupoController.duplicarGrupo
);

/**
 * @route POST /api/grupos/:id/catequistas
 * @desc Asignar catequista a grupo
 * @access Private (Admin, Párroco)
 */
router.post('/:id/catequistas',
  requireRole('admin', 'parroco'),
  grupoValidations.asignarCatequista,
  logActivity('ASIGNAR_CATEQUISTA'),
  grupoController.asignarCatequista
);

/**
 * @route PUT /api/grupos/:id
 * @desc Actualizar grupo
 * @access Private (Admin, Párroco, Secretaria)
 */
router.put('/:id',
  requireRole('admin', 'parroco', 'secretaria'),
  grupoValidations.update,
  logActivity('UPDATE_GRUPO'),
  grupoController.updateGrupo
);

/**
 * @route PUT /api/grupos/:id/estado
 * @desc Cambiar estado del grupo
 * @access Private (Admin, Párroco)
 */
router.put('/:id/estado',
  requireRole('admin', 'parroco'),
  commonValidations.objectId,
  logActivity('CAMBIAR_ESTADO_GRUPO'),
  grupoController.cambiarEstado
);

/**
 * @route DELETE /api/grupos/:id
 * @desc Eliminar grupo
 * @access Private (Admin)
 */
router.delete('/:id',
  requireRole('admin'),
  commonValidations.objectId,
  logActivity('DELETE_GRUPO'),
  grupoController.deleteGrupo
);

/**
 * @route DELETE /api/grupos/:id/catequistas/:usuarioId
 * @desc Remover catequista de grupo
 * @access Private (Admin, Párroco)
 */
router.delete('/:id/catequistas/:usuarioId',
  requireRole('admin', 'parroco'),
  commonValidations.objectId,
  logActivity('REMOVER_CATEQUISTA'),
  grupoController.removerCatequista
);

module.exports = router;