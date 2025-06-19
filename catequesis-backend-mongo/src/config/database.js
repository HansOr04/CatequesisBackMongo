const mongoose = require('mongoose');
const config = require('./environment');

class Database {
  constructor() {
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 segundos
  }

  /**
   * Conectar a MongoDB Atlas
   */
  async connect() {
    try {
      // Evitar múltiples conexiones
      if (this.isConnected) {
        console.log('💚 Ya conectado a MongoDB');
        return mongoose.connection;
      }

      console.log('🔄 Conectando a MongoDB Atlas...');
      console.log(`🌐 URI: ${this.maskUri(config.database.uri)}`);

      // Configurar eventos de mongoose
      this.setupEventHandlers();

      // ✅ CONFIGURACIÓN CORREGIDA - Opciones compatibles con versiones modernas
      const connectionOptions = {
        // Opciones de conexión básicas
        maxPoolSize: 10, // Reemplaza maxPoolSize en lugar de bufferMaxEntries
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4, // Usar IPv4
        
        // Opciones de escritura
        retryWrites: true,
        w: 'majority',
        
        // Opciones de timeout
        connectTimeoutMS: 10000,
        
        // Deshabilitar buffering (reemplaza bufferMaxEntries y bufferCommands)
        bufferCommands: false,
        maxIdleTimeMS: 30000,
        
        // Para desarrollo - opcional
        ...(config.server.nodeEnv === 'development' && {
          autoIndex: true, // Solo en desarrollo
        })
      };

      // Conectar a MongoDB
      await mongoose.connect(config.database.uri, connectionOptions);

      this.isConnected = true;
      this.connectionAttempts = 0;
      
      console.log('✅ ¡Conectado a MongoDB Atlas exitosamente!');
      console.log(`📊 Base de datos: ${mongoose.connection.name}`);
      console.log(`🏠 Host: ${mongoose.connection.host}`);
      
      return mongoose.connection;
    } catch (error) {
      this.isConnected = false;
      this.connectionAttempts++;
      
      console.error('❌ Error de conexión a MongoDB:', {
        message: error.message,
        attempt: this.connectionAttempts,
        maxRetries: this.maxRetries
      });

      // Intentar reconectar si no se han agotado los intentos
      if (this.connectionAttempts < this.maxRetries) {
        console.log(`🔄 Reintentando conexión en ${this.retryDelay/1000} segundos...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      } else {
        console.error('💀 Se agotaron los intentos de conexión a MongoDB');
        throw error;
      }
    }
  }

  /**
   * Desconectar de MongoDB
   */
  async disconnect() {
    try {
      if (!this.isConnected) {
        console.log('💙 MongoDB ya estaba desconectado');
        return;
      }

      await mongoose.disconnect();
      this.isConnected = false;
      console.log('🔒 Desconectado de MongoDB');
    } catch (error) {
      console.error('❌ Error al desconectar de MongoDB:', error.message);
      throw error;
    }
  }

  /**
   * Configurar manejadores de eventos de mongoose
   */
  setupEventHandlers() {
    // Conexión exitosa
    mongoose.connection.on('connected', () => {
      console.log('🎉 Mongoose conectado a MongoDB');
      this.isConnected = true;
    });

    // Error de conexión
    mongoose.connection.on('error', (error) => {
      console.error('🚨 Error de conexión Mongoose:', error.message);
      this.isConnected = false;
    });

    // Desconexión
    mongoose.connection.on('disconnected', () => {
      console.log('💔 Mongoose desconectado de MongoDB');
      this.isConnected = false;
    });

    // Reconexión exitosa
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 Mongoose reconectado a MongoDB');
      this.isConnected = true;
    });

    // Buffer overflow (útil para debugging)
    mongoose.connection.on('fullsetup', () => {
      console.log('📡 Conexión completa establecida con todas las réplicas');
    });

    // Cierre graceful de la aplicación
    process.on('SIGINT', async () => {
      console.log('\n🛑 Cerrando aplicación...');
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Terminando aplicación...');
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Verificar estado de conexión
   */
  isHealthy() {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      isConnected: this.isConnected && state === 1,
      readyState: state,
      stateDescription: states[state] || 'unknown',
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }

  /**
   * Obtener estadísticas de la base de datos
   */
  async getStats() {
    try {
      if (!this.isConnected) {
        throw new Error('No hay conexión a la base de datos');
      }

      const admin = mongoose.connection.db.admin();
      const stats = await admin.serverStatus();
      
      return {
        host: stats.host,
        version: stats.version,
        uptime: stats.uptime,
        connections: stats.connections,
        memory: stats.mem,
        network: stats.network
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de DB:', error.message);
      throw error;
    }
  }

  /**
   * Enmascarar URI para logs (ocultar credenciales)
   */
  maskUri(uri) {
    if (!uri) return 'No configurada';
    
    // Reemplazar credenciales con asteriscos
    return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
  }

  /**
   * Limpiar colecciones (solo para testing/desarrollo)
   */
  async clearDatabase() {
    if (config.server.nodeEnv === 'production') {
      throw new Error('No se puede limpiar la base de datos en producción');
    }

    try {
      const collections = await mongoose.connection.db.collections();
      
      for (let collection of collections) {
        await collection.deleteMany({});
      }
      
      console.log('🧹 Base de datos limpiada');
    } catch (error) {
      console.error('Error limpiando base de datos:', error.message);
      throw error;
    }
  }

  /**
   * Crear índices para optimización
   */
  async createIndexes() {
    try {
      console.log('📝 Creando índices...');
      
      // Crear índices para modelos específicos
      const models = mongoose.modelNames();
      
      for (const modelName of models) {
        try {
          const Model = mongoose.model(modelName);
          await Model.syncIndexes(); // Método más moderno que createIndexes()
          console.log(`✅ Índices sincronizados para ${modelName}`);
        } catch (error) {
          console.warn(`⚠️ Error sincronizando índices para ${modelName}:`, error.message);
        }
      }
      
      console.log('✅ Sincronización de índices completada');
    } catch (error) {
      console.error('Error en sincronización de índices:', error.message);
      throw error;
    }
  }

  /**
   * Verificar conexión con ping
   */
  async ping() {
    try {
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      console.error('Error en ping a la base de datos:', error.message);
      return false;
    }
  }

  /**
   * Obtener información de las colecciones
   */
  async getCollectionsInfo() {
    try {
      if (!this.isConnected) {
        throw new Error('No hay conexión a la base de datos');
      }

      const collections = await mongoose.connection.db.listCollections().toArray();
      
      const collectionsInfo = await Promise.all(
        collections.map(async (collection) => {
          const stats = await mongoose.connection.db.collection(collection.name).stats();
          return {
            name: collection.name,
            count: stats.count,
            size: stats.size,
            avgObjSize: stats.avgObjSize
          };
        })
      );

      return collectionsInfo;
    } catch (error) {
      console.error('Error obteniendo información de colecciones:', error.message);
      throw error;
    }
  }
}

// Crear instancia única (Singleton)
const database = new Database();

module.exports = database;