const { Catequizando, Inscripcion, Certificado } = require('../models');

/**
 * Controlador de Catequizandos
 */
class CatequizandoController {
  /**
   * Obtener todos los catequizandos
   * GET /api/catequizandos
   */
  async getAllCatequizandos(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        activos = 'true',
        edad_min,
        edad_max,
        genero,
        ciudad,
        casos_especiales = 'all'
      } = req.query;
      
      // Construir filtros
      const filtros = {};
      
      if (activos !== 'all') {
        filtros['estado.activo'] = activos === 'true';
      }
      
      if (casos_especiales !== 'all') {
        filtros['estado.casoEspecial'] = casos_especiales === 'true';
      }
      
      if (genero) {
        filtros.genero = genero;
      }
      
      if (ciudad) {
        filtros['contacto.ciudad'] = { $regex: ciudad, $options: 'i' };
      }
      
      // Filtro de búsqueda por texto
      if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        filtros.$or = [
          { nombres: searchRegex },
          { apellidos: searchRegex },
          { documentoIdentidad: searchRegex }
        ];
      }
      
      // Filtros de edad
      if (edad_min || edad_max) {
        const fechaMaxima = edad_min ? new Date() : null;
        const fechaMinima = edad_max ? new Date() : null;
        
        if (fechaMaxima) {
          fechaMaxima.setFullYear(fechaMaxima.getFullYear() - parseInt(edad_min));
        }
        
        if (fechaMinima) {
          fechaMinima.setFullYear(fechaMinima.getFullYear() - parseInt(edad_max) - 1);
        }
        
        filtros.fechaNacimiento = {};
        if (fechaMinima) filtros.fechaNacimiento.$gte = fechaMinima;
        if (fechaMaxima) filtros.fechaNacimiento.$lte = fechaMaxima;
      }

      // Paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [catequizandos, total] = await Promise.all([
        Catequizando.find(filtros)
          .sort({ apellidos: 1, nombres: 1 })
          .skip(skip)
          .limit(parseInt(limit))
          .select('nombres apellidos fechaNacimiento documentoIdentidad genero contacto.ciudad estado'),
        Catequizando.countDocuments(filtros)
      ]);

      // Agregar edad calculada
      const catequizandosConEdad = catequizandos.map(cat => ({
        ...cat.toObject(),
        edad: cat.calcularEdad()
      }));

      return res.status(200).json({
        success: true,
        message: 'Catequizandos obtenidos exitosamente',
        data: {
          catequizandos: catequizandosConEdad,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error obteniendo catequizandos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener catequizando por ID
   * GET /api/catequizandos/:id
   */
  async getCatequizandoById(req, res) {
    try {
      const { id } = req.params;

      const catequizando = await Catequizando.findById(id)
        .populate('familia.hermanos', 'nombres apellidos documentoIdentidad');

      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'Catequizando no encontrado'
        });
      }

      // Agregar información adicional
      const catequizandoCompleto = {
        ...catequizando.toObject(),
        edad: catequizando.calcularEdad(),
        tieneCondicionesEspeciales: catequizando.tieneCondicionesEspeciales(),
        contactosEmergencia: catequizando.obtenerContactosEmergencia()
      };

      return res.status(200).json({
        success: true,
        message: 'Catequizando obtenido exitosamente',
        data: catequizandoCompleto
      });

    } catch (error) {
      console.error('Error obteniendo catequizando:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Buscar catequizando por documento
   * GET /api/catequizandos/documento/:documento
   */
  async getCatequizandoByDocumento(req, res) {
    try {
      const { documento } = req.params;

      const catequizando = await Catequizando.buscarPorDocumento(documento);

      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'No se encontró un catequizando con ese documento'
        });
      }

      const catequizandoCompleto = {
        ...catequizando.toObject(),
        edad: catequizando.calcularEdad()
      };

      return res.status(200).json({
        success: true,
        message: 'Catequizando encontrado exitosamente',
        data: catequizandoCompleto
      });

    } catch (error) {
      console.error('Error buscando catequizando:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Crear nuevo catequizando
   * POST /api/catequizandos
   */
  async createCatequizando(req, res) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para crear catequizandos'
        });
      }

      const catequizandoData = req.body;

      // Verificar que no exista el documento
      const documentoExistente = await Catequizando.buscarPorDocumento(catequizandoData.documentoIdentidad);
      if (documentoExistente) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un catequizando con este documento de identidad'
        });
      }

      // Validar edad apropiada
      const fechaNacimiento = new Date(catequizandoData.fechaNacimiento);
      const edad = Math.floor((new Date() - fechaNacimiento) / (365.25 * 24 * 60 * 60 * 1000));
      
      if (edad < 4 && !catequizandoData.estado?.casoEspecial) {
        return res.status(400).json({
          success: false,
          message: 'La edad mínima para catequesis es 4 años (marque como caso especial si es necesario)'
        });
      }

      const nuevoCatequizando = new Catequizando(catequizandoData);
      await nuevoCatequizando.save();

      return res.status(201).json({
        success: true,
        message: 'Catequizando creado exitosamente',
        data: {
          ...nuevoCatequizando.toObject(),
          edad: nuevoCatequizando.calcularEdad()
        }
      });

    } catch (error) {
      console.error('Error creando catequizando:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de catequizando inválidos',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un catequizando con este documento de identidad'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar catequizando
   * PUT /api/catequizandos/:id
   */
  async updateCatequizando(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar catequizandos'
        });
      }

      const catequizando = await Catequizando.findById(id);

      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'Catequizando no encontrado'
        });
      }

      // Verificar documento único si se está cambiando
      if (updateData.documentoIdentidad && updateData.documentoIdentidad !== catequizando.documentoIdentidad) {
        const documentoExistente = await Catequizando.findOne({
          documentoIdentidad: updateData.documentoIdentidad,
          _id: { $ne: id }
        });

        if (documentoExistente) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe otro catequizando con este documento de identidad'
          });
        }
      }

      // Actualizar catequizando
      Object.assign(catequizando, updateData);
      await catequizando.save();

      return res.status(200).json({
        success: true,
        message: 'Catequizando actualizado exitosamente',
        data: {
          ...catequizando.toObject(),
          edad: catequizando.calcularEdad()
        }
      });

    } catch (error) {
      console.error('Error actualizando catequizando:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de catequizando inválidos',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Eliminar catequizando
   * DELETE /api/catequizandos/:id
   */
  async deleteCatequizando(req, res) {
    try {
      const { id } = req.params;

      // Solo admin puede eliminar
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden eliminar catequizandos'
        });
      }

      const catequizando = await Catequizando.findById(id);

      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'Catequizando no encontrado'
        });
      }

      // Verificar dependencias
      const [inscripcionesCount, certificadosCount] = await Promise.all([
        Inscripcion.countDocuments({ catequizando: id }),
        Certificado.countDocuments({ catequizando: id })
      ]);

      if (inscripcionesCount > 0 || certificadosCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'No se puede eliminar el catequizando porque tiene inscripciones o certificados asociados',
          dependencies: {
            inscripciones: inscripcionesCount,
            certificados: certificadosCount
          }
        });
      }

      await Catequizando.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: 'Catequizando eliminado exitosamente',
        data: catequizando
      });

    } catch (error) {
      console.error('Error eliminando catequizando:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener inscripciones de un catequizando
   * GET /api/catequizandos/:id/inscripciones
   */
  async getCatequizandoInscripciones(req, res) {
    try {
      const { id } = req.params;

      const catequizando = await Catequizando.findById(id);
      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'Catequizando no encontrado'
        });
      }

      const inscripciones = await Inscripcion.obtenerPorCatequizando(id);

      return res.status(200).json({
        success: true,
        message: 'Inscripciones obtenidas exitosamente',
        data: inscripciones
      });

    } catch (error) {
      console.error('Error obteniendo inscripciones:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener certificados de un catequizando
   * GET /api/catequizandos/:id/certificados
   */
  async getCatequizandoCertificados(req, res) {
    try {
      const { id } = req.params;

      const catequizando = await Catequizando.findById(id);
      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'Catequizando no encontrado'
        });
      }

      const certificados = await Certificado.obtenerPorCatequizando(id);

      return res.status(200).json({
        success: true,
        message: 'Certificados obtenidos exitosamente',
        data: certificados
      });

    } catch (error) {
      console.error('Error obteniendo certificados:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Buscar catequizandos
   * GET /api/catequizandos/search
   */
  async searchCatequizandos(req, res) {
    try {
      const { q, tipo = 'todos' } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El término de búsqueda debe tener al menos 2 caracteres'
        });
      }

      let catequizandos;

      if (tipo === 'sin_inscripcion') {
        catequizandos = await Catequizando.obtenerSinInscripcion();
        // Filtrar por búsqueda
        catequizandos = catequizandos.filter(cat => 
          cat.nombres.toLowerCase().includes(q.toLowerCase()) ||
          cat.apellidos.toLowerCase().includes(q.toLowerCase()) ||
          cat.documentoIdentidad.toLowerCase().includes(q.toLowerCase())
        );
      } else {
        catequizandos = await Catequizando.buscarPorTexto(q);
      }

      // Agregar edad calculada
      const catequizandosConEdad = catequizandos.map(cat => ({
        ...cat.toObject(),
        edad: cat.calcularEdad()
      }));

      return res.status(200).json({
        success: true,
        message: `Se encontraron ${catequizandosConEdad.length} catequizandos`,
        data: catequizandosConEdad
      });

    } catch (error) {
      console.error('Error buscando catequizandos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas de catequizandos
   * GET /api/catequizandos/stats
   */
  async getCatequizandosStats(req, res) {
    try {
      // Filtrar por parroquia si no es admin
      const filtros = {};
      if (req.user.tipoPerfil !== 'admin' && req.user.parroquia) {
        // Para filtrar por parroquia necesitamos hacer join con inscripciones
        const inscripcionesParroquia = await Inscripcion.distinct('catequizando', {
          parroquia: req.user.parroquia
        });
        filtros._id = { $in: inscripcionesParroquia };
      }

      const stats = await Catequizando.obtenerEstadisticas(filtros);

      return res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats[0] || {
          total: 0,
          masculinos: 0,
          femeninos: 0,
          edadPromedio: 0,
          ninos: 0,
          adolescentes: 0,
          adultos: 0,
          conBautismo: 0,
          conPrimeraComunion: 0,
          conConfirmacion: 0,
          casosEspeciales: 0,
          conCondicionesEspeciales: 0,
          porcentajeBautizados: 0
        }
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Validar elegibilidad para inscripción
   * POST /api/catequizandos/:id/validar-inscripcion
   */
  async validarInscripcion(req, res) {
    try {
      const { id } = req.params;
      const { id_nivel } = req.body;

      const catequizando = await Catequizando.findById(id);
      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'Catequizando no encontrado'
        });
      }

      const { Nivel } = require('../models');
      const nivel = await Nivel.findById(id_nivel);
      if (!nivel) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      const validacion = catequizando.esAptoParaNivel(nivel);

      if (validacion.apto) {
        return res.status(200).json({
          success: true,
          message: 'Catequizando elegible para inscripción',
          data: validacion
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Catequizando no elegible para inscripción',
          data: validacion
        });
      }

    } catch (error) {
      console.error('Error validando inscripción:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener cumpleañeros del mes
   * GET /api/catequizandos/cumpleanos
   */
  async getCumpleanosMes(req, res) {
    try {
      const { mes } = req.query;
      const mesActual = mes ? parseInt(mes) : new Date().getMonth() + 1;

      const cumpleañeros = await Catequizando.obtenerCumpleanosMes(mesActual);

      // Agregar edad calculada y día del cumpleaños
      const cumpleañerosConInfo = cumpleañeros.map(cat => ({
        ...cat.toObject(),
        edad: cat.calcularEdad(),
        diaCumpleanos: cat.fechaNacimiento.getDate(),
        proximaEdad: cat.calcularEdad() + 1
      }));

      return res.status(200).json({
        success: true,
        message: `Cumpleañeros del mes ${mesActual} obtenidos exitosamente`,
        data: cumpleañerosConInfo
      });

    } catch (error) {
      console.error('Error obteniendo cumpleañeros:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Marcar como egresado
   * PUT /api/catequizandos/:id/egresar
   */
  async marcarEgresado(req, res) {
    try {
      const { id } = req.params;
      const { motivo, fecha } = req.body;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para marcar catequizandos como egresados'
        });
      }

      const catequizando = await Catequizando.findById(id);
      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'Catequizando no encontrado'
        });
      }

      await catequizando.marcarComoEgresado(motivo, fecha ? new Date(fecha) : new Date());

      return res.status(200).json({
        success: true,
        message: 'Catequizando marcado como egresado exitosamente',
        data: catequizando
      });

    } catch (error) {
      console.error('Error marcando como egresado:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Reactivar catequizando
   * PUT /api/catequizandos/:id/reactivar
   */
  async reactivarCatequizando(req, res) {
    try {
      const { id } = req.params;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para reactivar catequizandos'
        });
      }

      const catequizando = await Catequizando.findById(id);
      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'Catequizando no encontrado'
        });
      }

      await catequizando.reactivar();

      return res.status(200).json({
        success: true,
        message: 'Catequizando reactivado exitosamente',
        data: catequizando
      });

    } catch (error) {
      console.error('Error reactivando catequizando:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new CatequizandoController();