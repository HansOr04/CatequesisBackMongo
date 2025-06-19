const app = require('./src/app');
const config = require('./src/config/environment');
const database = require('./src/config/database');

// Variables globales
let server = null;

/**
 * Iniciar el servidor
 */
async function startServer() {
  try {
    console.log('🚀 ===============================================');
    console.log('🎉 SISTEMA DE CATEQUESIS API - MONGODB');
    console.log('🚀 ===============================================');
    
    // Mostrar información del entorno
    console.log(`📊 Entorno: ${config.server.nodeEnv}`);
    console.log(`📊 Puerto: ${config.server.port}`);
    console.log(`📊 Node.js: ${process.version}`);
    
    // Conectar a la base de datos
    console.log('📡 Iniciando conexión a MongoDB...');
    await database.connect();
    console.log('✅ Conexión a MongoDB establecida');
    
    // Iniciar servidor HTTP
    console.log('🌐 Iniciando servidor HTTP...');
    server = app.listen(config.server.port, '0.0.0.0', () => {
      console.log('✅ Servidor iniciado exitosamente');
      console.log(`🌍 Servidor corriendo en puerto ${config.server.port}`);
      console.log(`🔗 URL: http://localhost:${config.server.port}`);
      console.log(`📖 Health Check: http://localhost:${config.server.port}/health`);
      console.log(`📚 API Docs: http://localhost:${config.server.port}/api`);
      console.log('🚀 ===============================================');
      
      // Mostrar endpoints disponibles en desarrollo
      if (config.server.nodeEnv === 'development') {
        console.log('📋 Endpoints disponibles:');
        console.log('   GET  /health - Health check');
        console.log('   GET  /test-db - Test de base de datos');
        console.log('   POST /api/auth/login - Iniciar sesión');
        console.log('   POST /api/auth/register - Registrar usuario');
        console.log('   GET  /api/usuarios - Listar usuarios');
        console.log('   GET  /api/parroquias - Listar parroquias');
        console.log('   GET  /api/niveles - Listar niveles');
        console.log('   GET  /api/catequizandos - Listar catequizandos');
        console.log('   GET  /api/grupos - Listar grupos');
        console.log('   GET  /api/inscripciones - Listar inscripciones');
        console.log('   GET  /api/asistencias - Listar asistencias');
        console.log('🚀 ===============================================');
      }
    });

    // Configurar timeouts del servidor
    server.timeout = 30000; // 30 segundos
    server.keepAliveTimeout = 5000; // 5 segundos
    server.headersTimeout = 6000; // 6 segundos

    // Manejar errores del servidor
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Puerto ${config.server.port} ya está en uso`);
        console.error('💡 Intenta cambiar el puerto en las variables de entorno');
      } else {
        console.error('❌ Error del servidor:', error);
      }
      process.exit(1);
    });

    // Configurar manejo de señales de cierre
    setupGracefulShutdown();

  } catch (error) {
    console.error('💀 Error fatal al iniciar el servidor:', error);
    
    // Intentar cerrar conexiones antes de salir
    if (database.isHealthy().isConnected) {
      await database.disconnect();
    }
    
    process.exit(1);
  }
}

/**
 * Configurar cierre graceful del servidor
 */
function setupGracefulShutdown() {
  // Función para cerrar el servidor de manera graceful
  const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Señal ${signal} recibida. Iniciando cierre graceful...`);
    
    try {
      // Cerrar servidor HTTP
      if (server) {
        console.log('🔌 Cerrando servidor HTTP...');
        await new Promise((resolve) => {
          server.close(resolve);
        });
        console.log('✅ Servidor HTTP cerrado');
      }

      // Cerrar conexión a base de datos
      if (database.isHealthy().isConnected) {
        console.log('🔌 Cerrando conexión a MongoDB...');
        await database.disconnect();
        console.log('✅ Conexión a MongoDB cerrada');
      }

      console.log('✅ Cierre graceful completado');
      process.exit(0);

    } catch (error) {
      console.error('❌ Error durante el cierre graceful:', error);
      process.exit(1);
    }
  };

  // Manejar señales de sistema
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Manejar errores no capturados
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Promesa rechazada no manejada:', reason);
    console.error('🚨 En:', promise);
    
    // En producción, cerrar la aplicación
    if (config.server.nodeEnv === 'production') {
      gracefulShutdown('unhandledRejection');
    }
  });

  process.on('uncaughtException', (error) => {
    console.error('🚨 Excepción no capturada:', error);
    gracefulShutdown('uncaughtException');
  });

  // Manejar advertencias de Node.js
  process.on('warning', (warning) => {
    if (config.server.nodeEnv === 'development') {
      console.warn('⚠️ Advertencia de Node.js:', warning.message);
      if (warning.stack) {
        console.warn(warning.stack);
      }
    }
  });
}

/**
 * Verificar variables de entorno críticas
 */
function validateEnvironment() {
  const critical = ['MONGODB_URI'];
  const missing = critical.filter(var_name => !process.env[var_name]);
  
  if (missing.length > 0) {
    console.error('❌ Variables de entorno críticas faltantes:', missing);
    console.error('💡 Asegúrate de tener un archivo .env con las variables necesarias');
    console.error('📝 Ejemplo de .env:');
    console.error('   MONGODB_URI=mongodb://localhost:27017/catequesis');
    console.error('   JWT_SECRET=tu-clave-secreta-muy-segura');
    console.error('   NODE_ENV=development');
    console.error('   PORT=3000');
    process.exit(1);
  }
  
  // Verificar que JWT_SECRET no sea el valor por defecto en producción
  if (config.server.nodeEnv === 'production' && 
      config.jwt.secret === 'default-secret-key-change-in-production') {
    console.error('❌ JWT_SECRET no puede usar el valor por defecto en producción');
    console.error('💡 Configura una clave secreta segura en las variables de entorno');
    process.exit(1);
  }

  console.log('✅ Variables de entorno validadas correctamente');
}

/**
 * Mostrar información del sistema
 */
function showSystemInfo() {
  console.log('📊 Información del Sistema:');
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Plataforma: ${process.platform} (${process.arch})`);
  console.log(`   Memoria: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
  console.log(`   PID: ${process.pid}`);
  console.log(`   Directorio: ${process.cwd()}`);
  
  // Mostrar configuración importante (sin datos sensibles)
  console.log('⚙️ Configuración:');
  console.log(`   Entorno: ${config.server.nodeEnv}`);
  console.log(`   Puerto: ${config.server.port}`);
  console.log(`   CORS: ${config.server.allowedOrigins.length} orígenes permitidos`);
  console.log(`   Rate Limit: ${config.rateLimit.maxRequests} req/${config.rateLimit.windowMs}ms`);
  console.log(`   JWT Expira: ${config.jwt.expiresIn}`);
  console.log(`   MongoDB: ${config.database.uri ? '✅ Configurado' : '❌ No configurado'}`);
  
  if (config.server.nodeEnv === 'development') {
    console.log('🔧 Modo Desarrollo:');
    console.log('   - Logging detallado activado');
    console.log('   - CORS permisivo activado');
    console.log('   - Hot reload disponible con nodemon');
  }
}

/**
 * Verificar estado del sistema
 */
async function healthCheck() {
  try {
    // Verificar memoria disponible
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapUsed + memUsage.heapTotal;
    
    if (totalMem > 500 * 1024 * 1024) { // 500MB
      console.warn('⚠️ Uso alto de memoria:', Math.round(totalMem / 1024 / 1024), 'MB');
    }

    // Verificar conexión a base de datos
    const dbHealth = database.isHealthy();
    if (!dbHealth.isConnected) {
      console.error('❌ Base de datos desconectada');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error en health check:', error);
    return false;
  }
}

/**
 * Configurar monitoreo periódico
 */
function setupMonitoring() {
  // Health check cada 5 minutos en producción
  if (config.server.nodeEnv === 'production') {
    setInterval(async () => {
      const isHealthy = await healthCheck();
      if (!isHealthy) {
        console.error('🚨 Sistema no saludable detectado');
      }
    }, 5 * 60 * 1000);
  }

  // Reporte de memoria cada hora en desarrollo
  if (config.server.nodeEnv === 'development') {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      console.log(`📊 Memoria: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS`);
    }, 60 * 60 * 1000);
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🔍 Validando entorno...');
    validateEnvironment();
    
    if (config.server.nodeEnv === 'development') {
      showSystemInfo();
    }
    
    console.log('🚀 Iniciando aplicación...');
    await startServer();
    
    console.log('📊 Configurando monitoreo...');
    setupMonitoring();
    
    console.log('🎉 Sistema iniciado completamente');
    
  } catch (error) {
    console.error('💀 Error fatal en la inicialización:', error);
    process.exit(1);
  }
}

// Ejecutar solo si este archivo es ejecutado directamente
if (require.main === module) {
  main();
}

// Exportar funciones para testing
module.exports = { 
  startServer, 
  server: () => server,
  healthCheck,
  gracefulShutdown: setupGracefulShutdown
};