const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Configuración
const config = require('./config/environment');
const database = require('./config/database');
const { globalErrorHandler, logCriticalErrors } = require('./utils/errors');

// Rutas
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const parroquiaRoutes = require('./routes/parroquiaRoutes');
const nivelRoutes = require('./routes/nivelRoutes');
const catequizandoRoutes = require('./routes/catequizandoRoutes');
const grupoRoutes = require('./routes/grupoRoutes');
const inscripcionRoutes = require('./routes/inscripcionRoutes');
const asistenciaRoutes = require('./routes/asistenciaRoutes');

const app = express();

/**
 * Configuración de seguridad
 */
function setupSecurity() {
  // Helmet para seguridad básica
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

  // CORS
  app.use(cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, postman, etc.)
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

  // Trust proxy (importante para rate limiting y obtener IPs reales)
  app.set('trust proxy', 1);
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
      memory: process.memoryUsage(),
      version: '1.0.0'
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
          usuarios: '/api/usuarios',
          parroquias: '/api/parroquias',
          niveles: '/api/niveles',
          catequizandos: '/api/catequizandos',
          grupos: '/api/grupos',
          inscripciones: '/api/inscripciones',
          asistencias: '/api/asistencias'
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
          details: dbHealth,
          timestamp: new Date().toISOString()
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

  // Rutas de la API
  app.use('/api/auth', authRoutes);
  app.use('/api/usuarios', usuarioRoutes);
  app.use('/api/parroquias', parroquiaRoutes);
  app.use('/api/niveles', nivelRoutes);
  app.use('/api/catequizandos', catequizandoRoutes);
  app.use('/api/grupos', grupoRoutes);
  app.use('/api/inscripciones', inscripcionRoutes);
  app.use('/api/asistencias', asistenciaRoutes);

  // Middleware para rutas no encontradas
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Endpoint ${req.method} ${req.originalUrl} no encontrado`,
      availableEndpoints: {
        info: 'GET /',
        health: 'GET /health',
        testDb: 'GET /test-db',
        auth: '/api/auth/*',
        usuarios: '/api/usuarios/*',
        parroquias: '/api/parroquias/*',
        niveles: '/api/niveles/*',
        catequizandos: '/api/catequizandos/*',
        grupos: '/api/grupos/*',
        inscripciones: '/api/inscripciones/*',
        asistencias: '/api/asistencias/*'
      },
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Configuración de manejo de errores
 */
function setupErrorHandling() {
  // Middleware de logging de errores críticos
  app.use(logCriticalErrors);

  // Middleware global de manejo de errores
  app.use(globalErrorHandler);

  // Manejo de errores de JSON malformado
  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({
        success: false,
        message: 'JSON inválido en el cuerpo de la solicitud',
        timestamp: new Date().toISOString()
      });
    }
    next(error);
  });
}

/**
 * Inicializar aplicación
 */
function initializeApp() {
  console.log('🔧 Configurando seguridad...');
  setupSecurity();
  
  console.log('🔧 Configurando middlewares...');
  setupMiddlewares();
  
  console.log('🔧 Configurando rutas...');
  setupRoutes();
  
  console.log('🔧 Configurando manejo de errores...');
  setupErrorHandling();
  
  console.log('✅ Aplicación configurada correctamente');
}

// Inicializar la aplicación
initializeApp();

module.exports = app;