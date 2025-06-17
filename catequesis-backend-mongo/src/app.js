const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config/environment');
const database = require('./config/database');

// Importar rutas (se crearán después)
// const authRoutes = require('./routes/authRoutes');
// const routes = require('./routes');

const app = express();

/**
 * Configuración de middlewares de seguridad
 */
function setupSecurity() {
  // Helmet para headers de seguridad
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS configurado
  app.use(cors({
    origin: function (origin, callback) {
      // Permitir solicitudes sin origin (móviles, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (config.server.allowedOrigins.indexOf(origin) !== -1 || 
          config.server.nodeEnv === 'development') {
        callback(null, true);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      success: false,
      message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/', limiter);
}

/**
 * Configuración de middlewares básicos
 */
function setupMiddlewares() {
  // Logging
  app.use(morgan(config.logging.format));

  // Parseo de JSON
  app.use(express.json({ 
    limit: '10mb',
    strict: true
  }));

  // Parseo de URL encoded
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));

  // Middleware personalizado para logging de requests
  if (config.server.nodeEnv === 'development') {
    app.use((req, res, next) => {
      console.log(`🌐 ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
      next();
    });
  }
}

/**
 * Configuración de rutas
 */
function setupRoutes() {
  // Ruta de salud básica
  app.get('/health', (req, res) => {
    const dbHealth = database.isHealthy();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: config.server.nodeEnv,
      database: {
        connected: dbHealth.isConnected,
        state: dbHealth.stateDescription
      },
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  });

  // Ruta de información de la API
  app.get('/', (req, res) => {
    res.json({
      message: '🎉 Sistema de Catequesis API - MongoDB',
      version: '1.0.0',
      environment: config.server.nodeEnv,
      documentation: {
        baseUrl: '/api',
        health: '/health',
        endpoints: {
          auth: '/api/auth',
          parroquias: '/api/parroquias',
          niveles: '/api/niveles',
          catequizandos: '/api/catequizandos',
          grupos: '/api/grupos',
          inscripciones: '/api/inscripciones',
          asistencias: '/api/asistencias',
          usuarios: '/api/usuarios'
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  // Ruta de test de base de datos
  app.get('/test-db', async (req, res) => {
    try {
      const dbHealth = database.isHealthy();
      
      if (!dbHealth.isConnected) {
        return res.status(503).json({
          success: false,
          message: 'Base de datos no conectada',
          details: dbHealth
        });
      }

      const stats = await database.getStats();
      
      res.json({
        success: true,
        message: 'Conexión a MongoDB exitosa',
        database: {
          name: dbHealth.name,
          host: dbHealth.host,
          state: dbHealth.stateDescription,
          version: stats.version
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error conectando a MongoDB',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Rutas de autenticación (cuando estén listas)
  // app.use('/api/auth', authRoutes);

  // Otras rutas de la API (cuando estén listas)
  // app.use('/api', routes);

  // Ruta para endpoints no encontrados
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Endpoint ${req.method} ${req.originalUrl} no encontrado`,
      availableEndpoints: {
        info: 'GET /',
        health: 'GET /health',
        testDb: 'GET /test-db',
        api: 'GET /api/*'
      },
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Configuración de manejo de errores
 */
function setupErrorHandling() {
  // Middleware de manejo de errores
  app.use((error, req, res, next) => {
    console.error('🚨 Error no manejado:', {
      message: error.message,
      stack: config.server.nodeEnv === 'development' ? error.stack : undefined,
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    // Errores de CORS
    if (error.message.includes('CORS')) {
      return res.status(403).json({
        success: false,
        message: 'Origen no permitido por política CORS',
        timestamp: new Date().toISOString()
      });
    }

    // Errores de validación de JSON
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({
        success: false,
        message: 'JSON inválido en el cuerpo de la solicitud',
        timestamp: new Date().toISOString()
      });
    }

    // Error genérico
    res.status(error.status || 500).json({
      success: false,
      message: config.server.nodeEnv === 'production' 
        ? 'Error interno del servidor' 
        : error.message,
      timestamp: new Date().toISOString()
    });
  });

  // Manejar promesas rechazadas no capturadas
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Promesa rechazada no manejada:', reason);
    if (config.server.nodeEnv === 'production') {
      // En producción, cerrar la aplicación de manera elegante
      process.exit(1);
    }
  });

  // Manejar excepciones no capturadas
  process.on('uncaughtException', (error) => {
    console.error('🚨 Excepción no capturada:', error);
    process.exit(1);
  });
}

/**
 * Inicializar la aplicación
 */
async function initializeApp() {
  try {
    // Configurar middlewares
    setupSecurity();
    setupMiddlewares();
    setupRoutes();
    setupErrorHandling();

    console.log('✅ Aplicación Express configurada correctamente');
    return app;
  } catch (error) {
    console.error('❌ Error inicializando aplicación:', error);
    throw error;
  }
}

// Inicializar la aplicación
initializeApp().catch(error => {
  console.error('💀 Error fatal inicializando aplicación:', error);
  process.exit(1);
});

module.exports = app;