require('dotenv').config();

const config = {
  // Configuración del servidor
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    allowedOrigins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001']
  },

  // Configuración de MongoDB
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/catequesis',
    // ✅ OPCIONES CORREGIDAS - Compatibles con versiones modernas
    options: {
      // Gestión del pool de conexiones
      maxPoolSize: 10, // Reemplaza bufferMaxEntries
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      
      // Timeouts
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      
      // Configuración de red
      family: 4, // Usar IPv4
      
      // Buffer y comandos
      bufferCommands: false, // Deshabilitar buffering
      
      // Escritura
      retryWrites: true,
      w: 'majority',
      
      // Monitoreo
      heartbeatFrequencyMS: 10000,
      
      // Solo en desarrollo
      ...(process.env.NODE_ENV === 'development' && {
        autoIndex: true,
      })
    }
  },

  // Configuración de JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    algorithm: 'HS256'
  },

  // Configuración de Bcrypt
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
  },

  // Configuración de Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // Configuración de logs
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
  },

  // Validaciones
  validation: {
    // Longitudes mínimas y máximas para campos
    username: { min: 3, max: 50 },
    password: { min: 6, max: 100 },
    nombres: { min: 2, max: 100 },
    apellidos: { min: 2, max: 100 },
    documento: { min: 6, max: 20 },
    telefono: { min: 7, max: 20 }
  },

  // Configuración de paginación
  pagination: {
    defaultPage: 1,
    defaultLimit: 10,
    maxLimit: 100
  }
};

// Validar variables de entorno críticas
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];

if (config.server.nodeEnv === 'production') {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Variables de entorno faltantes:', missingVars);
    process.exit(1);
  }
}

// Mostrar configuración en desarrollo
if (config.server.nodeEnv === 'development') {
  console.log('🔧 Configuración cargada:', {
    nodeEnv: config.server.nodeEnv,
    port: config.server.port,
    database: config.database.uri ? '✅ Configurada' : '❌ No configurada',
    jwtSecret: config.jwt.secret !== 'default-secret-key-change-in-production' ? '✅ Configurada' : '⚠️  Usando valor por defecto'
  });
}

module.exports = config;