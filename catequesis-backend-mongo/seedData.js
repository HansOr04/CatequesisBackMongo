/**
 * Script para inicializar la base de datos 'catequesis' con datos de ejemplo
 * Ejecutar: node seedDatabase.js
 */

// Cargar variables de entorno
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Configuración de la base de datos
const DATABASE_CONFIG = {
  uri: process.env.MONGODB_URI || 'mongodb+srv://hansortiz:admin@krugerback.nuobj.mongodb.net/catequesis?retryWrites=true&w=majority&appName=Krugerback',
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000, // Aumentado para conexiones remotas
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    family: 4,
    retryWrites: true,
    w: 'majority',
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
};

// Importar modelos (asumiendo que están en la carpeta models)
const Usuario = require('./src/models/Usuario');
const Parroquia = require('./src/models/Parroquia');
const Nivel = require('./src/models/Nivel');
const Catequizando = require('./src/models/Catequizando');
const Grupo = require('./src/models/Grupo');
const Inscripcion = require('./src/models/Inscripcion');
const Asistencia = require('./src/models/Asistencia');

// Función principal
async function seedDatabase() {
  try {
    console.log('🚀 Iniciando proceso de inicialización de base de datos...');
    
    // Conectar a MongoDB
    await mongoose.connect(DATABASE_CONFIG.uri, DATABASE_CONFIG.options);
    console.log('✅ Conectado a MongoDB - Base de datos: catequesis');
    
    // Limpiar base de datos existente
    await cleanDatabase();
    
    // Crear datos de ejemplo
    const datos = await createSampleData();
    
    console.log('\n🎉 ¡Base de datos inicializada exitosamente!');
    console.log('📊 Resumen de datos creados:');
    console.log(`   👥 Usuarios: ${datos.usuarios.length}`);
    console.log(`   ⛪ Parroquias: ${datos.parroquias.length}`);
    console.log(`   📚 Niveles: ${datos.niveles.length}`);
    console.log(`   👦 Catequizandos: ${datos.catequizandos.length}`);
    console.log(`   📋 Grupos: ${datos.grupos.length}`);
    console.log(`   📝 Inscripciones: ${datos.inscripciones.length}`);
    console.log(`   ✅ Asistencias: ${datos.asistencias.length}`);
    
    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Admin: admin / admin123');
    console.log('   Párroco: parroco / parroco123');
    console.log('   Secretaria: secretaria / secretaria123');
    console.log('   Catequista: catequista / catequista123');
    
  } catch (error) {
    console.error('❌ Error durante la inicialización:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Limpiar base de datos
async function cleanDatabase() {
  try {
    console.log('🧹 Limpiando base de datos existente...');
    
    await Promise.all([
      Asistencia.deleteMany({}),
      Inscripcion.deleteMany({}),
      Grupo.deleteMany({}),
      Catequizando.deleteMany({}),
      Nivel.deleteMany({}),
      Usuario.deleteMany({}),
      Parroquia.deleteMany({})
    ]);
    
    console.log('✅ Base de datos limpiada');
  } catch (error) {
    console.error('❌ Error limpiando base de datos:', error);
    throw error;
  }
}

// Crear datos de ejemplo
async function createSampleData() {
  console.log('📝 Creando datos de ejemplo...');
  
  const datos = {};
  
  // 1. Crear Parroquias
  datos.parroquias = await createParroquias();
  
  // 2. Crear Usuarios
  datos.usuarios = await createUsuarios(datos.parroquias);
  
  // 3. Crear Niveles
  datos.niveles = await createNiveles();
  
  // 4. Crear Catequizandos
  datos.catequizandos = await createCatequizandos();
  
  // 5. Crear Grupos
  datos.grupos = await createGrupos(datos.parroquias, datos.niveles, datos.usuarios);
  
  // 6. Crear Inscripciones
  datos.inscripciones = await createInscripciones(datos.catequizandos, datos.grupos, datos.parroquias, datos.usuarios);
  
  // 7. Crear Asistencias
  datos.asistencias = await createAsistencias(datos.inscripciones, datos.usuarios);
  
  return datos;
}

// Crear Parroquias
async function createParroquias() {
  console.log('⛪ Creando parroquias...');
  
  const parroquiasData = [
    {
      nombre: 'Sagrado Corazón de Jesús',
      direccion: 'Av. 6 de Diciembre N24-253 y Lizardo García',
      telefono: '02-2234567',
      email: 'sagradocorazon@quito.ec',
      ubicacion: {
        ciudad: 'Quito',
        provincia: 'Pichincha',
        pais: 'Ecuador',
        coordenadas: {
          latitud: -0.1807,
          longitud: -78.4678
        }
      },
      informacion: {
        santo: 'Sagrado Corazón de Jesús',
        diocesis: 'Arquidiócesis de Quito',
        zona: 'Norte'
      },
      horarios: {
        oficina: {
          lunes: { abierto: true, inicio: '08:00', fin: '17:00' },
          martes: { abierto: true, inicio: '08:00', fin: '17:00' },
          miercoles: { abierto: true, inicio: '08:00', fin: '17:00' },
          jueves: { abierto: true, inicio: '08:00', fin: '17:00' },
          viernes: { abierto: true, inicio: '08:00', fin: '17:00' },
          sabado: { abierto: true, inicio: '08:00', fin: '12:00' },
          domingo: { abierto: false }
        },
        misas: [
          { dia: 'domingo', hora: '07:00', tipo: 'ordinaria' },
          { dia: 'domingo', hora: '09:00', tipo: 'ordinaria' },
          { dia: 'domingo', hora: '11:00', tipo: 'ordinaria' },
          { dia: 'domingo', hora: '18:00', tipo: 'ordinaria' }
        ]
      },
      configuracion: {
        costos: {
          catequesis: 25,
          certificados: 5,
          sacramentos: 15
        }
      }
    },
    {
      nombre: 'San Francisco de Asís',
      direccion: 'Calle Cuenca 477 y Chile',
      telefono: '02-2287124',
      email: 'sanfrancisco@quito.ec',
      ubicacion: {
        ciudad: 'Quito',
        provincia: 'Pichincha',
        pais: 'Ecuador',
        coordenadas: {
          latitud: -0.2186,
          longitud: -78.5097
        }
      },
      informacion: {
        santo: 'San Francisco de Asís',
        diocesis: 'Arquidiócesis de Quito',
        zona: 'Centro Histórico'
      },
      configuracion: {
        costos: {
          catequesis: 20,
          certificados: 3,
          sacramentos: 10
        }
      }
    },
    {
      nombre: 'Nuestra Señora de Guadalupe',
      direccion: 'Av. Mariscal Sucre S1-344 y Av. Napo',
      telefono: '02-2456789',
      email: 'guadalupe@quito.ec',
      ubicacion: {
        ciudad: 'Quito',
        provincia: 'Pichincha',
        pais: 'Ecuador'
      },
      informacion: {
        santo: 'Nuestra Señora de Guadalupe',
        diocesis: 'Arquidiócesis de Quito',
        zona: 'Sur'
      }
    }
  ];
  
  const parroquias = await Parroquia.insertMany(parroquiasData);
  console.log(`✅ ${parroquias.length} parroquias creadas`);
  return parroquias;
}

// Crear Usuarios
async function createUsuarios(parroquias) {
  console.log('👥 Creando usuarios...');
  
  const usuariosData = [
    {
      username: 'admin',
      password: 'admin123',
      tipoPerfil: 'admin',
      datosPersonales: {
        nombres: 'Administrador',
        apellidos: 'del Sistema',
        email: 'admin@catequesis.ec',
        telefono: '0999123456'
      },
      primerLogin: false
    },
    {
      username: 'parroco',
      password: 'parroco123',
      tipoPerfil: 'parroco',
      parroquia: parroquias[0]._id,
      datosPersonales: {
        nombres: 'Padre Miguel',
        apellidos: 'González',
        email: 'padre.miguel@sagradocorazon.ec',
        telefono: '0998765432'
      },
      primerLogin: false
    },
    {
      username: 'secretaria',
      password: 'secretaria123',
      tipoPerfil: 'secretaria',
      parroquia: parroquias[0]._id,
      datosPersonales: {
        nombres: 'María Elena',
        apellidos: 'Rodríguez',
        email: 'secretaria@sagradocorazon.ec',
        telefono: '0987654321'
      }
    },
    {
      username: 'catequista',
      password: 'catequista123',
      tipoPerfil: 'catequista',
      parroquia: parroquias[0]._id,
      datosPersonales: {
        nombres: 'Ana Patricia',
        apellidos: 'Morales',
        email: 'ana.morales@sagradocorazon.ec',
        telefono: '0976543210'
      }
    },
    {
      username: 'catequista2',
      password: 'catequista123',
      tipoPerfil: 'catequista',
      parroquia: parroquias[0]._id,
      datosPersonales: {
        nombres: 'Carlos Eduardo',
        apellidos: 'Vásquez',
        email: 'carlos.vasquez@sagradocorazon.ec',
        telefono: '0965432109'
      }
    },
    {
      username: 'parroco2',
      password: 'parroco123',
      tipoPerfil: 'parroco',
      parroquia: parroquias[1]._id,
      datosPersonales: {
        nombres: 'Padre Juan',
        apellidos: 'Pérez',
        email: 'padre.juan@sanfrancisco.ec'
      }
    }
  ];
  
  // Hash passwords before saving
  for (let userData of usuariosData) {
    userData.password = await bcrypt.hash(userData.password, 10);
  }
  
  const usuarios = await Usuario.insertMany(usuariosData);
  console.log(`✅ ${usuarios.length} usuarios creados`);
  return usuarios;
}

// Crear Niveles
async function createNiveles() {
  console.log('📚 Creando niveles...');
  
  const nivelesData = [
    {
      nombre: 'Preparación Primera Comunión',
      descripcion: 'Nivel inicial para preparación a la Primera Comunión, dirigido a niños de 7 a 9 años',
      orden: 1,
      configuracion: {
        edadMinima: 7,
        edadMaxima: 9,
        duracion: { meses: 12, sesiones: 30 },
        requiereBautismo: true,
        sacramentoAsociado: 'primera_comunion'
      },
      contenido: {
        objetivos: [
          { descripcion: 'Conocer la vida de Jesús', tipo: 'general' },
          { descripcion: 'Comprender el sacramento de la Eucaristía', tipo: 'especifico' }
        ],
        temas: [
          { nombre: 'Dios Padre Creador', descripcion: 'Conocimiento de Dios como padre', sesionesEstimadas: 3, orden: 1 },
          { nombre: 'La vida de Jesús', descripcion: 'Historia de Jesucristo', sesionesEstimadas: 4, orden: 2 },
          { nombre: 'Los Sacramentos', descripcion: 'Introducción a los sacramentos', sesionesEstimadas: 3, orden: 3 }
        ]
      },
      evaluacion: {
        tieneExamen: true,
        notaMinima: 70,
        criterios: [
          { nombre: 'Conocimiento doctrinal', peso: 40 },
          { nombre: 'Participación en clase', peso: 30 },
          { nombre: 'Comportamiento', peso: 30 }
        ]
      }
    },
    {
      nombre: 'Preparación Confirmación',
      descripcion: 'Nivel avanzado para preparación a la Confirmación, dirigido a adolescentes de 14 a 16 años',
      orden: 2,
      configuracion: {
        edadMinima: 14,
        edadMaxima: 16,
        duracion: { meses: 18, sesiones: 40 },
        requiereBautismo: true,
        requiereNivelAnterior: true,
        sacramentoAsociado: 'confirmacion'
      },
      contenido: {
        objetivos: [
          { descripcion: 'Fortalecer la fe cristiana', tipo: 'general' },
          { descripcion: 'Comprender los dones del Espíritu Santo', tipo: 'especifico' }
        ],
        temas: [
          { nombre: 'El Espíritu Santo', descripcion: 'Los dones y frutos del Espíritu', sesionesEstimadas: 5, orden: 1 },
          { nombre: 'La Iglesia', descripcion: 'Historia y misión de la Iglesia', sesionesEstimadas: 4, orden: 2 },
          { nombre: 'Moral Cristiana', descripcion: 'Valores y principios cristianos', sesionesEstimadas: 6, orden: 3 }
        ]
      },
      evaluacion: {
        tieneExamen: true,
        notaMinima: 75,
        criterios: [
          { nombre: 'Conocimiento doctrinal', peso: 50 },
          { nombre: 'Compromiso cristiano', peso: 30 },
          { nombre: 'Servicio comunitario', peso: 20 }
        ]
      }
    },
    {
      nombre: 'Catequesis Familiar',
      descripcion: 'Preparación para padres de familia en la educación cristiana de sus hijos',
      orden: 3,
      configuracion: {
        edadMinima: 25,
        edadMaxima: 65,
        duracion: { meses: 6, sesiones: 15 },
        requiereBautismo: false
      },
      contenido: {
        objetivos: [
          { descripcion: 'Formar padres evangelizadores', tipo: 'general' }
        ],
        temas: [
          { nombre: 'La familia cristiana', descripcion: 'Valores en la familia', sesionesEstimadas: 3, orden: 1 },
          { nombre: 'Educación en la fe', descripción: 'Cómo enseñar la fe a los hijos', sesionesEstimadas: 4, orden: 2 }
        ]
      }
    }
  ];
  
  const niveles = await Nivel.insertMany(nivelesData);
  console.log(`✅ ${niveles.length} niveles creados`);
  return niveles;
}

// Crear Catequizandos
async function createCatequizandos() {
  console.log('👦 Creando catequizandos...');
  
  const catequizandosData = [
    {
      nombres: 'José Manuel',
      apellidos: 'García López',
      fechaNacimiento: new Date('2015-03-15'),
      documentoIdentidad: '1756789012',
      genero: 'masculino',
      contacto: {
        direccion: 'Av. La Prensa N47-123 y Río Coca',
        telefono: '0987123456',
        email: 'familia.garcia@gmail.com',
        ciudad: 'Quito'
      },
      responsable: {
        nombres: 'Carmen',
        apellidos: 'López',
        telefono: '0987123456',
        relacion: 'madre'
      },
      sacramentos: {
        bautismo: {
          recibido: true,
          fecha: new Date('2015-06-20'),
          parroquia: 'Sagrado Corazón'
        }
      }
    },
    {
      nombres: 'María Fernanda',
      apellidos: 'Rodríguez Silva',
      fechaNacimiento: new Date('2014-08-22'),
      documentoIdentidad: '1756789013',
      genero: 'femenino',
      contacto: {
        direccion: 'Calle Los Rosales 245 y Av. República',
        telefono: '0987234567',
        ciudad: 'Quito'
      },
      responsable: {
        nombres: 'Pedro',
        apellidos: 'Rodríguez',
        telefono: '0987234567',
        relacion: 'padre'
      },
      sacramentos: {
        bautismo: {
          recibido: true,
          fecha: new Date('2014-12-08')
        }
      }
    },
    {
      nombres: 'Carlos Andrés',
      apellidos: 'Morales Vega',
      fechaNacimiento: new Date('2015-11-10'),
      documentoIdentidad: '1756789014',
      genero: 'masculino',
      contacto: {
        direccion: 'Sector La Carolina, Mz. 15 Casa 7',
        telefono: '0987345678',
        ciudad: 'Quito'
      },
      responsable: {
        nombres: 'Ana María',
        apellidos: 'Vega',
        telefono: '0987345678',
        relacion: 'madre'
      }
    },
    {
      nombres: 'Sofía Valentina',
      apellidos: 'Hernández Castro',
      fechaNacimiento: new Date('2009-05-18'),
      documentoIdentidad: '1756789015',
      genero: 'femenino',
      contacto: {
        direccion: 'Av. Shyris N36-188 y Naciones Unidas',
        telefono: '0987456789',
        email: 'sofia.hernandez@hotmail.com',
        ciudad: 'Quito'
      },
      responsable: {
        nombres: 'Luis Fernando',
        apellidos: 'Hernández',
        telefono: '0987456789',
        relacion: 'padre'
      },
      sacramentos: {
        bautismo: {
          recibido: true,
          fecha: new Date('2009-08-15')
        },
        primeraComunion: {
          recibido: true,
          fecha: new Date('2017-05-20')
        }
      }
    },
    {
      nombres: 'Diego Alejandro',
      apellidos: 'Vargas Ruiz',
      fechaNacimiento: new Date('2008-12-03'),
      documentoIdentidad: '1756789016',
      genero: 'masculino',
      contacto: {
        direccion: 'Conjunto Habitacional Los Pinos, Casa 42',
        telefono: '0987567890',
        ciudad: 'Quito'
      },
      responsable: {
        nombres: 'Mónica',
        apellidos: 'Ruiz',
        telefono: '0987567890',
        relacion: 'madre'
      },
      sacramentos: {
        bautismo: {
          recibido: true,
          fecha: new Date('2009-03-15')
        },
        primeraComunion: {
          recibido: true,
          fecha: new Date('2016-11-20')
        }
      }
    },
    {
      nombres: 'Valentina Isabel',
      apellidos: 'Paredes Mendoza',
      fechaNacimiento: new Date('2016-01-25'),
      documentoIdentidad: '1756789017',
      genero: 'femenino',
      contacto: {
        direccion: 'Barrio San Carlos, Calle Principal S/N',
        telefono: '0987678901',
        ciudad: 'Quito'
      },
      responsable: {
        nombres: 'Roberto',
        apellidos: 'Paredes',
        telefono: '0987678901',
        relacion: 'padre'
      }
    }
  ];
  
  const catequizandos = await Catequizando.insertMany(catequizandosData);
  console.log(`✅ ${catequizandos.length} catequizandos creados`);
  return catequizandos;
}

// Crear Grupos
async function createGrupos(parroquias, niveles, usuarios) {
  console.log('📋 Creando grupos...');
  
  const fechaInicio = new Date('2024-02-01');
  const fechaFin = new Date('2024-11-30');
  
  const gruposData = [
    {
      nombre: 'Primera Comunión - Grupo A',
      parroquia: parroquias[0]._id,
      nivel: niveles[0]._id,
      periodo: '2024',
      informacion: {
        descripcion: 'Grupo de preparación para Primera Comunión - horario matutino',
        capacidadMaxima: 15,
        edadMinima: 7,
        edadMaxima: 9
      },
      horarios: {
        diaSemana: 'sabado',
        horaInicio: '08:00',
        horaFin: '10:00',
        salon: {
          nombre: 'Aula 1',
          ubicacion: 'Planta baja',
          capacidad: 20
        }
      },
      fechas: {
        inicioClases: fechaInicio,
        finClases: fechaFin
      },
      catequistas: [
        {
          usuario: usuarios.find(u => u.datosPersonales.nombres === 'Ana Patricia')._id,
          rol: 'coordinador'
        }
      ],
      configuracion: {
        costoInscripcion: 25,
        costoMateriales: 15,
        asistenciaMinima: 80
      }
    },
    {
      nombre: 'Primera Comunión - Grupo B',
      parroquia: parroquias[0]._id,
      nivel: niveles[0]._id,
      periodo: '2024',
      informacion: {
        descripcion: 'Grupo de preparación para Primera Comunión - horario vespertino',
        capacidadMaxima: 12
      },
      horarios: {
        diaSemana: 'domingo',
        horaInicio: '15:00',
        horaFin: '17:00',
        salon: {
          nombre: 'Aula 2',
          ubicacion: 'Segundo piso'
        }
      },
      fechas: {
        inicioClases: fechaInicio,
        finClases: fechaFin
      },
      catequistas: [
        {
          usuario: usuarios.find(u => u.datosPersonales.nombres === 'Carlos Eduardo')._id,
          rol: 'catequista'
        }
      ]
    },
    {
      nombre: 'Confirmación 2024',
      parroquia: parroquias[0]._id,
      nivel: niveles[1]._id,
      periodo: '2024',
      informacion: {
        descripcion: 'Preparación para el sacramento de la Confirmación',
        capacidadMaxima: 20,
        edadMinima: 14,
        edadMaxima: 17
      },
      horarios: {
        diaSemana: 'sabado',
        horaInicio: '16:00',
        horaFin: '18:00'
      },
      fechas: {
        inicioClases: fechaInicio,
        finClases: fechaFin
      },
      catequistas: [
        {
          usuario: usuarios.find(u => u.tipoPerfil === 'parroco' && u.parroquia.toString() === parroquias[0]._id.toString())._id,
          rol: 'coordinador'
        }
      ]
    }
  ];
  
  const grupos = await Grupo.insertMany(gruposData);
  console.log(`✅ ${grupos.length} grupos creados`);
  return grupos;
}

// Crear Inscripciones
async function createInscripciones(catequizandos, grupos, parroquias, usuarios) {
  console.log('📝 Creando inscripciones...');
  
  const secretaria = usuarios.find(u => u.tipoPerfil === 'secretaria');
  const inscripcionesData = [];
  
  // Inscribir catequizandos en grupos según su edad
  for (let catequizando of catequizandos) {
    const edad = Math.floor((new Date() - catequizando.fechaNacimiento) / (365.25 * 24 * 60 * 60 * 1000));
    let grupoAsignado = null;
    
    if (edad >= 7 && edad <= 9) {
      // Asignar a grupo de Primera Comunión
      grupoAsignado = grupos.find(g => g.nombre.includes('Primera Comunión - Grupo A'));
    } else if (edad >= 14 && edad <= 17) {
      // Asignar a grupo de Confirmación
      grupoAsignado = grupos.find(g => g.nombre.includes('Confirmación'));
    }
    
    if (grupoAsignado) {
      inscripcionesData.push({
        catequizando: catequizando._id,
        grupo: grupoAsignado._id,
        parroquia: parroquias[0]._id,
        fechaInscripcion: new Date('2024-01-15'),
        fechaInicio: new Date('2024-02-01'),
        estado: 'activa',
        pagos: {
          inscripcion: {
            monto: 25,
            pagado: true,
            fechaPago: new Date('2024-01-15'),
            metodoPago: 'efectivo'
          },
          materiales: {
            monto: 15,
            pagado: edad > 10, // Solo los mayores han pagado materiales
            fechaPago: edad > 10 ? new Date('2024-01-20') : null,
            metodoPago: edad > 10 ? 'transferencia' : null
          }
        },
        proceso: {
          registradoPor: secretaria._id,
          documentosPresentados: [
            { tipo: 'certificado_bautismo', presentado: catequizando.sacramentos?.bautismo?.recibido || false },
            { tipo: 'cedula_representante', presentado: true },
            { tipo: 'foto_catequizando', presentado: true }
          ],
          validaciones: {
            edad: { realizada: true, aprobada: true },
            documentos: { realizada: true, aprobada: true },
            bautismo: { realizada: true, aprobada: catequizando.sacramentos?.bautismo?.recibido || false }
          },
          aprobacionFinal: {
            aprobada: true,
            fechaAprobacion: new Date('2024-01-16'),
            aprobadaPor: secretaria._id
          }
        }
      });
    }
  }
  
  const inscripciones = await Inscripcion.insertMany(inscripcionesData);
  console.log(`✅ ${inscripciones.length} inscripciones creadas`);
  return inscripciones;
}

// Crear Asistencias
async function createAsistencias(inscripciones, usuarios) {
  console.log('✅ Creando asistencias...');
  
  const catequista = usuarios.find(u => u.tipoPerfil === 'catequista');
  const asistenciasData = [];
  
  // Crear asistencias para las últimas 8 semanas
  const fechaInicio = new Date('2024-02-03'); // Primer sábado de febrero
  const semanasClases = 8;
  
  for (let semana = 0; semana < semanasClases; semana++) {
    const fechaClase = new Date(fechaInicio);
    fechaClase.setDate(fechaInicio.getDate() + (semana * 7));
    
    for (let inscripcion of inscripciones) {
      // 85% de probabilidad de asistencia
      const asistio = Math.random() > 0.15;
      
      asistenciasData.push({
        inscripcion: inscripcion._id,
        fecha: fechaClase,
        asistio: asistio,
        tipoClase: 'regular',
        tema: `Tema ${semana + 1}`,
        detalles: {
          horaLlegada: asistio ? '08:00' : null,
          horaSalida: asistio ? '10:00' : null,
          llegadaTarde: asistio ? Math.random() > 0.9 : false,
          salidaTemprana: asistio ? Math.random() > 0.95 : false,
          motivoAusencia: !asistio ? ['enfermedad', 'viaje', 'compromiso_familiar', 'no_justificada'][Math.floor(Math.random() * 4)] : null,
          ausenciaJustificada: !asistio ? Math.random() > 0.3 : null
        },
        participacion: asistio ? {
          participoEnClase: Math.random() > 0.2,
          nivelParticipacion: ['excelente', 'buena', 'regular'][Math.floor(Math.random() * 3)],
          comportamiento: ['excelente', 'bueno', 'regular'][Math.floor(Math.random() * 3)],
          actividades: [
            {
              nombre: 'Lectura bíblica',
              completada: Math.random() > 0.1,
              calificacion: Math.floor(Math.random() * 31) + 70
            }
          ]
        } : {},
        registro: {
          registradoPor: catequista._id,
          fechaRegistro: new Date(fechaClase.getTime() + 2 * 60 * 60 * 1000), // 2 horas después
          metodoRegistro: 'manual'
        }
      });
    }
  }
  
  const asistencias = await Asistencia.insertMany(asistenciasData);
  console.log(`✅ ${asistencias.length} asistencias creadas`);
  return asistencias;
}

// Función para actualizar estadísticas después de crear los datos
async function updateStatistics() {
  console.log('📊 Actualizando estadísticas...');
  
  try {
    // Actualizar estadísticas de parroquias
    const parroquias = await Parroquia.find({});
    for (let parroquia of parroquias) {
      await parroquia.actualizarEstadisticas();
    }
    
    // Actualizar estadísticas de niveles
    const niveles = await Nivel.find({});
    for (let nivel of niveles) {
      await nivel.actualizarEstadisticas();
    }
    
    // Actualizar estadísticas de grupos
    const grupos = await Grupo.find({});
    for (let grupo of grupos) {
      await grupo.actualizarEstadisticas();
    }
    
    // Actualizar estadísticas de inscripciones (asistencia)
    const inscripciones = await Inscripcion.find({});
    for (let inscripcion of inscripciones) {
      await inscripcion.actualizarAsistencia();
    }
    
    console.log('✅ Estadísticas actualizadas');
  } catch (error) {
    console.error('⚠️ Error actualizando estadísticas:', error.message);
  }
}

// Función para crear datos adicionales de ejemplo
async function createAdditionalData() {
  console.log('📋 Creando datos adicionales...');
  
  try {
    // Agregar algunas observaciones a inscripciones
    const inscripciones = await Inscripcion.find({}).limit(3);
    const usuarios = await Usuario.find({ tipoPerfil: { $in: ['catequista', 'secretaria'] } });
    
    for (let inscripcion of inscripciones) {
      await inscripcion.agregarObservacion(
        'Estudiante muy participativo en clase',
        usuarios[Math.floor(Math.random() * usuarios.length)]._id,
        'academica'
      );
    }
    
    // Agregar algunas calificaciones
    for (let inscripcion of inscripciones) {
      inscripcion.evaluacion.calificaciones.push({
        concepto: 'Evaluación parcial',
        calificacion: Math.floor(Math.random() * 31) + 70,
        fecha: new Date('2024-03-15'),
        observaciones: 'Buen desempeño general'
      });
      
      await inscripcion.save();
    }
    
    console.log('✅ Datos adicionales creados');
  } catch (error) {
    console.error('⚠️ Error creando datos adicionales:', error.message);
  }
}

// Función para mostrar información de conexión
function showConnectionInfo() {
  console.log('\n🔗 Información de conexión:');
  console.log(`   Database: ${DATABASE_CONFIG.uri}`);
  console.log(`   Entorno: Desarrollo`);
  console.log(`   Fecha: ${new Date().toLocaleString('es-EC')}`);
}

// Función para crear índices adicionales
async function createAdditionalIndexes() {
  console.log('🔧 Creando índices adicionales...');
  
  try {
    // Índices compuestos para mejor rendimiento
    await Inscripcion.collection.createIndex({ parroquia: 1, estado: 1, activa: 1 });
    await Asistencia.collection.createIndex({ inscripcion: 1, fecha: -1 });
    await Grupo.collection.createIndex({ parroquia: 1, periodo: 1, 'estado.activo': 1 });
    await Catequizando.collection.createIndex({ 'contacto.ciudad': 1, 'estado.activo': 1 });
    
    console.log('✅ Índices adicionales creados');
  } catch (error) {
    console.error('⚠️ Error creando índices:', error.message);
  }
}

// Función principal mejorada
async function initializeDatabase() {
  try {
    console.log('🎯 INICIALIZADOR DE BASE DE DATOS CATEQUESIS');
    console.log('='.repeat(50));
    
    showConnectionInfo();
    
    // Conectar a MongoDB
    await mongoose.connect(DATABASE_CONFIG.uri, DATABASE_CONFIG.options);
    console.log('✅ Conectado a MongoDB exitosamente');
    
    // Limpiar base de datos
    await cleanDatabase();
    
    // Crear datos de ejemplo
    const datos = await createSampleData();
    
    // Crear índices adicionales
    await createAdditionalIndexes();
    
    // Crear datos adicionales
    await createAdditionalData();
    
    // Actualizar estadísticas
    await updateStatistics();
    
    // Mostrar resumen final
    console.log('\n🎉 ¡INICIALIZACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('='.repeat(50));
    console.log('📊 RESUMEN DE DATOS CREADOS:');
    console.log(`   ⛪ Parroquias: ${datos.parroquias.length}`);
    console.log(`   👥 Usuarios: ${datos.usuarios.length}`);
    console.log(`   📚 Niveles: ${datos.niveles.length}`);
    console.log(`   👦 Catequizandos: ${datos.catequizandos.length}`);
    console.log(`   📋 Grupos: ${datos.grupos.length}`);
    console.log(`   📝 Inscripciones: ${datos.inscripciones.length}`);
    console.log(`   ✅ Asistencias: ${datos.asistencias.length}`);
    
    console.log('\n🔑 CREDENCIALES DE ACCESO:');
    console.log('   👑 Admin:      admin / admin123');
    console.log('   ⛪ Párroco:    parroco / parroco123');
    console.log('   📋 Secretaria: secretaria / secretaria123');
    console.log('   👨‍🏫 Catequista: catequista / catequista123');
    
    console.log('\n🌐 INFORMACIÓN DE LA BASE DE DATOS:');
    console.log(`   📍 URI: ${DATABASE_CONFIG.uri}`);
    console.log(`   📅 Fecha: ${new Date().toLocaleString('es-EC')}`);
    console.log(`   ⏰ Duración: ${Date.now() - startTime}ms`);
    
    console.log('\n🚀 ¡La base de datos está lista para usar!');
    
  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA INICIALIZACIÓN:');
    console.error(error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Manejo de errores y señales
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️ Proceso interrumpido por el usuario');
  await mongoose.disconnect();
  process.exit(0);
});

// Variables globales
const startTime = Date.now();

// Ejecutar inicialización si este archivo se ejecuta directamente
if (require.main === module) {
  // Cambiar la función principal
  seedDatabase = initializeDatabase;
  initializeDatabase();
}

// Exportar funciones para uso externo
module.exports = {
  initializeDatabase,
  createSampleData,
  cleanDatabase,
  createParroquias,
  createUsuarios,
  createNiveles,
  createCatequizandos,
  createGrupos,
  createInscripciones,
  createAsistencias,
  updateStatistics
};