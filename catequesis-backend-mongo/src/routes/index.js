const express = require('express');
const cors = require('cors');

// Importar rutas
const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const parroquiaRoutes = require('./parroquiaRoutes');
const nivelRoutes = require('./nivelRoutes');
const catequizandoRoutes = require('./catequizandoRoutes');
const grupoRoutes = require('./grupoRoutes');
const inscripcionRoutes = require('./inscripcionRoutes');
const asistenciaRoutes = require('./asistenciaRoutes');

// Importar middlewares
const { optionalAuth } = require('../middleware/auth');
const { notFoundHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Ruta de información de la API
 * GET /api
 */
router.get('/', optionalAuth, (req, res) => {
  const isAuthenticated = !!req.user;
  
  res.json({
    success: true,
    message: '🎉 Sistema de Catequesis API - MongoDB',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    authenticated: isAuthenticated,
    user: isAuthenticated ? {
      username: req.user.username,
      tipoPerfil: req.user.tipoPerfil,
      parroquia: req.user.parroquia
    } : null,
    endpoints: {
      authentication: {
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile',
        changePassword: 'PUT /api/auth/change-password',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        verify: 'GET /api/auth/verify'
      },
      usuarios: {
        list: 'GET /api/usuarios',
        create: 'POST /api/usuarios',
        get: 'GET /api/usuarios/:id',
        update: 'PUT /api/usuarios/:id',
        delete: 'DELETE /api/usuarios/:id',
        search: 'GET /api/usuarios/search',
        stats: 'GET /api/usuarios/stats',
        catequistas: 'GET /api/usuarios/catequistas'
      },
      parroquias: {
        list: 'GET /api/parroquias',
        create: 'POST /api/parroquias',
        get: 'GET /api/parroquias/:id',
        update: 'PUT /api/parroquias/:id',
        delete: 'DELETE /api/parroquias/:id',
        search: 'GET /api/parroquias/search',
        stats: 'GET /api/parroquias/:id/stats',
        horarios: 'GET /api/parroquias/:id/horarios'
      },
      niveles: {
        list: 'GET /api/niveles',
        create: 'POST /api/niveles',
        get: 'GET /api/niveles/:id',
        update: 'PUT /api/niveles/:id',
        delete: 'DELETE /api/niveles/:id',
        ordenados: 'GET /api/niveles/ordenados',
        reorder: 'PUT /api/niveles/reorder',
        search: 'GET /api/niveles/search',
        stats: 'GET /api/niveles/:id/stats'
      },
      catequizandos: {
        list: 'GET /api/catequizandos',
        create: 'POST /api/catequizandos',
        get: 'GET /api/catequizandos/:id',
        update: 'PUT /api/catequizandos/:id',
        delete: 'DELETE /api/catequizandos/:id',
        search: 'GET /api/catequizandos/search',
        stats: 'GET /api/catequizandos/stats',
        byDocument: 'GET /api/catequizandos/documento/:documento',
        inscripciones: 'GET /api/catequizandos/:id/inscripciones',
        cumpleanos: 'GET /api/catequizandos/cumpleanos'
      },
      grupos: {
        list: 'GET /api/grupos',
        create: 'POST /api/grupos',
        get: 'GET /api/grupos/:id',
        update: 'PUT /api/grupos/:id',
        delete: 'DELETE /api/grupos/:id',
        search: 'GET /api/grupos/search',
        misGrupos: 'GET /api/grupos/mis-grupos',
        asignarCatequista: 'POST /api/grupos/:id/catequistas',
        inscripciones: 'GET /api/grupos/:id/inscripciones',
        stats: 'GET /api/grupos/:id/stats'
      },
      inscripciones: {
        list: 'GET /api/inscripciones',
        create: 'POST /api/inscripciones',
        get: 'GET /api/inscripciones/:id',
        update: 'PUT /api/inscripciones/:id',
        cambiarEstado: 'PUT /api/inscripciones/:id/estado',
        registrarPago: 'POST /api/inscripciones/:id/pagos',
        observaciones: 'POST /api/inscripciones/:id/observaciones',
        calificaciones: 'POST /api/inscripciones/:id/calificaciones',
        pagosPendientes: 'GET /api/inscripciones/pagos-pendientes',
        stats: 'GET /api/inscripciones/stats'
      },
      asistencias: {
        list: 'GET /api/asistencias',
        create: 'POST /api/asistencias',
        get: 'GET /api/asistencias/:id',
        update: 'PUT /api/asistencias/:id',
        registrarGrupo: 'POST /api/asistencias/grupo/:grupoId',
        porGrupoFecha: 'GET /api/asistencias/grupo/:grupoId/fecha/:fecha',
        reporte: 'GET /api/asistencias/reporte',
        statsGrupo: 'GET /api/asistencias/stats/grupo/:grupoId',
        observaciones: 'POST /api/asistencias/:id/observaciones'
      }
    },
    documentation: {
      swagger: '/api-docs',
      postman: '/api/postman-collection',
      examples: '/api/examples'
    }
  });
});

/**
 * Ruta de estado de salud de la API
 * GET /api/health
 */
router.get('/health', (req, res) => {
  const healthcheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  };

  try {
    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.status = 'ERROR';
    healthcheck.error = error.message;
    res.status(503).json(healthcheck);
  }
});

/**
 * Ruta para obtener estadísticas globales del sistema
 * GET /api/stats
 */
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    // Solo usuarios autenticados pueden ver estadísticas
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida para ver estadísticas'
      });
    }

    // Solo admin puede ver estadísticas globales
    if (req.user.tipoPerfil !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden ver estadísticas globales'
      });
    }

    const { Usuario, Parroquia, Catequizando, Grupo, Inscripcion } = require('../models');

    const [
      usuariosStats,
      parroquiasCount,
      catequizandosCount,
      gruposCount,
      inscripcionesCount
    ] = await Promise.all([
      Usuario.obtenerEstadisticas(),
      Parroquia.countDocuments({ activa: true }),
      Catequizando.countDocuments({ 'estado.activo': true }),
      Grupo.countDocuments({ 'estado.activo': true }),
      Inscripcion.countDocuments({ activa: true })
    ]);

    res.json({
      success: true,
      message: 'Estadísticas globales obtenidas exitosamente',
      timestamp: new Date().toISOString(),
      data: {
        usuarios: usuariosStats[0] || { total: 0, activos: 0 },
        parroquias: parroquiasCount,
        catequizandos: catequizandosCount,
        grupos: gruposCount,
        inscripciones: inscripcionesCount,
        resumen: {
          totalEntidades: parroquiasCount + catequizandosCount + gruposCount + inscripcionesCount,
          sistemaActivo: true,
          ultimaActualizacion: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas globales:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Configurar rutas de módulos
 */
router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/parroquias', parroquiaRoutes);
router.use('/niveles', nivelRoutes);
router.use('/catequizandos', catequizandoRoutes);
router.use('/grupos', grupoRoutes);
router.use('/inscripciones', inscripcionRoutes);
router.use('/asistencias', asistenciaRoutes);

/**
 * Ruta para exportar colección de Postman
 * GET /api/postman-collection
 */
router.get('/postman-collection', (req, res) => {
  const collection = {
    info: {
      name: "Sistema de Catequesis API",
      description: "Colección de endpoints para el Sistema de Catequesis",
      version: "1.0.0",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    variable: [
      {
        key: "baseUrl",
        value: "http://localhost:3000/api",
        type: "string"
      },
      {
        key: "token",
        value: "",
        type: "string"
      }
    ],
    auth: {
      type: "bearer",
      bearer: [
        {
          key: "token",
          value: "{{token}}",
          type: "string"
        }
      ]
    },
    item: [
      {
        name: "Autenticación",
        item: [
          {
            name: "Login",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  username: "admin",
                  password: "password123"
                })
              },
              url: {
                raw: "{{baseUrl}}/auth/login",
                host: ["{{baseUrl}}"],
                path: ["auth", "login"]
              }
            }
          },
          {
            name: "Get Profile",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/auth/profile",
                host: ["{{baseUrl}}"],
                path: ["auth", "profile"]
              }
            }
          }
        ]
      },
      {
        name: "Usuarios",
        item: [
          {
            name: "Get All Users",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/usuarios",
                host: ["{{baseUrl}}"],
                path: ["usuarios"]
              }
            }
          }
        ]
      }
    ]
  };

  res.json(collection);
});

/**
 * Ruta de ejemplos de uso
 * GET /api/examples
 */
router.get('/examples', (req, res) => {
  res.json({
    success: true,
    message: 'Ejemplos de uso de la API',
    examples: {
      authentication: {
        login: {
          method: 'POST',
          url: '/api/auth/login',
          body: {
            username: 'admin',
            password: 'password123'
          },
          response: {
            success: true,
            message: 'Login exitoso',
            data: {
              token: 'jwt_token_here',
              user: {
                id: 'user_id',
                username: 'admin',
                tipoPerfil: 'admin'
              }
            }
          }
        }
      },
      catequizando: {
        create: {
          method: 'POST',
          url: '/api/catequizandos',
          headers: {
            'Authorization': 'Bearer jwt_token_here'
          },
          body: {
            nombres: 'Juan Carlos',
            apellidos: 'Pérez García',
            fechaNacimiento: '2010-05-15',
            documentoIdentidad: '1234567890',
            genero: 'masculino',
            contacto: {
              direccion: 'Av. Principal 123',
              telefono: '0987654321',
              ciudad: 'Quito'
            }
          }
        }
      },
      inscripcion: {
        create: {
          method: 'POST',
          url: '/api/inscripciones',
          headers: {
            'Authorization': 'Bearer jwt_token_here'
          },
          body: {
            catequizando: 'catequizando_id',
            grupo: 'grupo_id'
          }
        }
      }
    }
  });
});

/**
 * Middleware para rutas no encontradas
 */
router.use('*', notFoundHandler);

module.exports = router;