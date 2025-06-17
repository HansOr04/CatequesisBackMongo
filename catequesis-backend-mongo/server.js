const app = require('./src/app');
const config = require('./src/config/environment');
const database = require('./src/config/database');

/**
 * Iniciar el servidor
 */
async function startServer() {
  try {
    console.log('🚀 ===============================================');
    console.log('🎉 SISTEMA DE CATEQUESIS API - MONGODB');
    console.log('🚀 ===============================================');
    
    // Conectar a la base de datos
    console.log('📡 Iniciando conexión a MongoDB...');
    await database.connect();
    
    // Crear índices si es necesario
    if (config.server.nodeEnv !== 'test') {
      await database.createIndexes();
    }
    
    // Iniciar servidor HTTP
    const server = app.listen(config.server.port, () => {
      console.log('🚀 ===============================================');
      console.log('✅ SERVIDOR INICIADO EXITOSAMENTE');
      console.log('🚀 ===============================================');
      console.log(`🌍 Entorno: ${config.server.nodeEnv}`);
      console.log(`📍 Servidor: http://localhost:${config.server.port}`);
      console.log(`💚 Health Check: http://localhost:${config.server.port}/health`);
      console.log(`🔐 API Base: http://localhost:${config.server.port}/api`);
      console.log(`🗄️  Test DB: http://localhost:${config.server.port}/test-db`);
      console.log('🚀 ===============================================');
      
      if (config.server.nodeEnv === 'development') {
        console.log('🔧 Modo Desarrollo:');
        console.log('   - Logs detallados activados');
        console.log('   - CORS permisivo');
        console.log('   - Rate limiting relajado');
        console.log('🚀 ===============================================');
      }
    });

    // Configurar timeout del servidor
    server.timeout = 30000; // 30 segundos

    // Manejo elegante de cierre del servidor
    setupGracefulShutdown(server);
    
    return server;
  } catch (error) {
    console.error('💀 Error fatal iniciando servidor:', error);
    process.exit(1);
  }
}

/**
 * Configurar cierre elegante del servidor
 */
function setupGracefulShutdown(server) {
  const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Recibida señal ${signal}. Iniciando cierre elegante...`);
    
    // Cerrar servidor HTTP
    server.close(async () => {
      console.log('🔒 Servidor HTTP cerrado');
      
      try {
        // Cerrar conexión a la base de datos
        await database.disconnect();
        console.log('✅ Cierre elegante completado');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error durante cierre elegante:', error);
        process.exit(1);
      }
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      console.error('⚠️ Forzando cierre después de 10 segundos...');
      process.exit(1);
    }, 10000);
  };

  // Escuchar señales de cierre
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Manejar errores no capturados
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Promesa rechazada no manejada en:', promise, 'razón:', reason);
    // No cerrar el proceso en desarrollo, solo loggear
    if (config.server.nodeEnv === 'production') {
      gracefulShutdown('unhandledRejection');
    }
  });

  process.on('uncaughtException', (error) => {
    console.error('🚨 Excepción no capturada:', error);
    gracefulShutdown('uncaughtException');
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
    process.exit(1);
  }
  
  // Verificar que JWT_SECRET no sea el valor por defecto en producción
  if (config.server.nodeEnv === 'production' && 
      config.jwt.secret === 'default-secret-key-change-in-production') {
    console.error('❌ JWT_SECRET no puede usar el valor por defecto en producción');
    process.exit(1);
  }
}

/**
 * Mostrar información del sistema
 */
function showSystemInfo() {
  console.log('📊 Información del Sistema:');
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Plataforma: ${process.platform}`);
  console.log(`   Arquitectura: ${process.arch}`);
  console.log(`   Memoria: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
  console.log(`   PID: ${process.pid}`);
}

// Ejecutar solo si este archivo es ejecutado directamente
if (require.main === module) {
  // Validar entorno antes de iniciar
  validateEnvironment();
  
  // Mostrar información del sistema en desarrollo
  if (config.server.nodeEnv === 'development') {
    showSystemInfo();
  }
  
  // Iniciar servidor
  startServer().catch(error => {
    console.error('💀 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { startServer };