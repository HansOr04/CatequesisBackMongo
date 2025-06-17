const Usuario = require('./Usuario');
const Parroquia = require('./Parroquia');
const Nivel = require('./Nivel');
const Catequizando = require('./Catequizando');
const Grupo = require('./Grupo');
const Inscripcion = require('./Inscripcion');
const Asistencia = require('./Asistencia');

// Configurar relaciones adicionales si es necesario
// Esto es útil para evitar dependencias circulares

module.exports = {
  Usuario,
  Parroquia,
  Nivel,
  Catequizando,
  Grupo,
  Inscripcion,
  Asistencia
};

// Función para inicializar índices y configuraciones
async function initializeModels() {
  try {
    console.log('🔧 Inicializando modelos...');
    
    // Crear índices que no se hayan creado automáticamente
    await Promise.all([
      Usuario.createIndexes(),
      Parroquia.createIndexes(),
      Nivel.createIndexes(),
      Catequizando.createIndexes(),
      Grupo.createIndexes(),
      Inscripcion.createIndexes(),
      Asistencia.createIndexes()
    ]);
    
    console.log('✅ Modelos e índices inicializados correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando modelos:', error);
    throw error;
  }
}

// Función para limpiar bloqueos expirados (ejecutar periódicamente)
async function cleanupExpiredLocks() {
  try {
    await Usuario.limpiarBloqueosExpirados();
    console.log('🧹 Bloqueos expirados limpiados');
  } catch (error) {
    console.error('Error limpiando bloqueos:', error);
  }
}

// Función para validar integridad de datos
async function validateDataIntegrity() {
  try {
    console.log('🔍 Validando integridad de datos...');
    
    // Verificar usuarios sin parroquia que no sean admin
    const usuariosSinParroquia = await Usuario.find({
      tipoPerfil: { $ne: 'admin' },
      parroquia: { $exists: false }
    });
    
    if (usuariosSinParroquia.length > 0) {
      console.warn(`⚠️ Encontrados ${usuariosSinParroquia.length} usuarios sin parroquia asignada`);
    }
    
    // Verificar inscripciones huérfanas (sin catequizando o grupo)
    const inscripcionesHuerfanas = await Inscripcion.find({
      $or: [
        { catequizando: { $exists: false } },
        { grupo: { $exists: false } },
        { parroquia: { $exists: false } }
      ]
    });
    
    if (inscripcionesHuerfanas.length > 0) {
      console.warn(`⚠️ Encontradas ${inscripcionesHuerfanas.length} inscripciones con referencias faltantes`);
    }
    
    // Verificar asistencias huérfanas
    const asistenciasHuerfanas = await Asistencia.find({
      inscripcion: { $exists: false }
    });
    
    if (asistenciasHuerfanas.length > 0) {
      console.warn(`⚠️ Encontradas ${asistenciasHuerfanas.length} asistencias sin inscripción`);
    }
    
    console.log('✅ Datos validados correctamente');
  } catch (error) {
    console.error('Error validando integridad de datos:', error);
  }
}