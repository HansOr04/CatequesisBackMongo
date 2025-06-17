const { Nivel } = require('../models');

/**
 * Controlador de Niveles
 */
class NivelController {
  /**
   * Obtener todos los niveles
   * GET /api/niveles
   */
  async getAllNiveles(req, res) {
    try {
      const { activos = 'true', incluirEvaluacion = 'false' } = req.query;
      
      const filtros = {};
      if (activos !== 'all') {
        filtros.activo = activos === 'true';
      }

      let query = Nivel.find(filtros).sort({ orden: 1 });

      // Incluir información de evaluación si se solicita
      if (incluirEvaluacion === 'false') {
        query = query.select('-evaluacion -contenido.temas -contenido.recursos');
      }

      const niveles = await query;

      return res.status(200).json({
        success: true,
        message: 'Niveles obtenidos exitosamente',
        data: niveles
      });

    } catch (error) {
      console.error('Error obteniendo niveles:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener niveles ordenados
   * GET /api/niveles/ordenados
   */
  async getNivelesOrdenados(req, res) {
    try {
      const niveles = await Nivel.obtenerNivelesOrdenados();

      return res.status(200).json({
        success: true,
        message: 'Niveles ordenados obtenidos exitosamente',
        data: niveles
      });

    } catch (error) {
      console.error('Error obteniendo niveles ordenados:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener nivel por ID
   * GET /api/niveles/:id
   */
  async getNivelById(req, res) {
    try {
      const { id } = req.params;

      const nivel = await Nivel.findById(id);

      if (!nivel) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Nivel obtenido exitosamente',
        data: nivel
      });

    } catch (error) {
      console.error('Error obteniendo nivel:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Crear nuevo nivel
   * POST /api/niveles
   */
  async createNivel(req, res) {
    try {
      // Solo admin puede crear niveles
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden crear niveles'
        });
      }

      const nivelData = req.body;

      // Verificar que no exista un nivel con el mismo orden
      const ordenExistente = await Nivel.findOne({ orden: nivelData.orden });
      if (ordenExistente) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un nivel con ese orden'
        });
      }

      // Verificar que no exista un nivel con el mismo nombre
      const nombreExistente = await Nivel.findOne({ 
        nombre: { $regex: `^${nivelData.nombre}$`, $options: 'i' }
      });
      if (nombreExistente) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un nivel con ese nombre'
        });
      }

      const nuevoNivel = new Nivel(nivelData);
      await nuevoNivel.save();

      return res.status(201).json({
        success: true,
        message: 'Nivel creado exitosamente',
        data: nuevoNivel
      });

    } catch (error) {
      console.error('Error creando nivel:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de nivel inválidos',
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
   * Actualizar nivel
   * PUT /api/niveles/:id
   */
  async updateNivel(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Solo admin puede actualizar niveles
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden actualizar niveles'
        });
      }

      const nivel = await Nivel.findById(id);

      if (!nivel) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      // Verificar orden único si se está cambiando
      if (updateData.orden && updateData.orden !== nivel.orden) {
        const ordenExistente = await Nivel.findOne({ 
          orden: updateData.orden,
          _id: { $ne: id }
        });

        if (ordenExistente) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe un nivel con ese orden'
          });
        }
      }

      // Verificar nombre único si se está cambiando
      if (updateData.nombre && updateData.nombre !== nivel.nombre) {
        const nombreExistente = await Nivel.findOne({ 
          nombre: { $regex: `^${updateData.nombre}$`, $options: 'i' },
          _id: { $ne: id }
        });

        if (nombreExistente) {
          return res.status(409).json({
            success: false,
            message: 'Ya existe un nivel con ese nombre'
          });
        }
      }

      // Actualizar nivel
      Object.assign(nivel, updateData);
      await nivel.save();

      return res.status(200).json({
        success: true,
        message: 'Nivel actualizado exitosamente',
        data: nivel
      });

    } catch (error) {
      console.error('Error actualizando nivel:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Datos de nivel inválidos',
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
   * Eliminar nivel
   * DELETE /api/niveles/:id
   */
  async deleteNivel(req, res) {
    try {
      const { id } = req.params;

      // Solo admin puede eliminar niveles
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden eliminar niveles'
        });
      }

      const nivel = await Nivel.findById(id);

      if (!nivel) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      // Verificar dependencias
      const { Grupo, Certificado } = require('../models');
      
      const [gruposCount, certificadosCount] = await Promise.all([
        Grupo.countDocuments({ nivel: id }),
        Certificado.countDocuments({ nivel: id })
      ]);

      if (gruposCount > 0 || certificadosCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'No se puede eliminar el nivel porque tiene grupos o certificados asociados',
          dependencies: {
            grupos: gruposCount,
            certificados: certificadosCount
          }
        });
      }

      await Nivel.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: 'Nivel eliminado exitosamente',
        data: nivel
      });

    } catch (error) {
      console.error('Error eliminando nivel:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas de un nivel
   * GET /api/niveles/:id/stats
   */
  async getNivelStats(req, res) {
    try {
      const { id } = req.params;

      const nivel = await Nivel.findById(id);

      if (!nivel) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      // Actualizar estadísticas
      await nivel.actualizarEstadisticas();

      return res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: nivel.estadisticas
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
   * Buscar niveles
   * GET /api/niveles/search
   */
  async searchNiveles(req, res) {
    try {
      const { q } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El término de búsqueda debe tener al menos 2 caracteres'
        });
      }

      const niveles = await Nivel.find({
        $or: [
          { nombre: { $regex: q, $options: 'i' } },
          { descripcion: { $regex: q, $options: 'i' } }
        ],
        activo: true
      }).sort({ orden: 1 });

      return res.status(200).json({
        success: true,
        message: `Se encontraron ${niveles.length} niveles`,
        data: niveles
      });

    } catch (error) {
      console.error('Error buscando niveles:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Reordenar niveles
   * PUT /api/niveles/reorder
   */
  async reorderNiveles(req, res) {
    try {
      const { ordenData } = req.body;

      // Solo admin puede reordenar
      if (req.user.tipoPerfil !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden reordenar niveles'
        });
      }

      if (!Array.isArray(ordenData) || ordenData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Datos de reordenamiento inválidos'
        });
      }

      await Nivel.reordenar(ordenData);

      const nivelesActualizados = await Nivel.obtenerNivelesOrdenados();

      return res.status(200).json({
        success: true,
        message: 'Niveles reordenados exitosamente',
        data: nivelesActualizados
      });

    } catch (error) {
      console.error('Error reordenando niveles:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener progresión de niveles para un catequizando
   * GET /api/niveles/progresion/:idCatequizando
   */
  async getProgresionNiveles(req, res) {
    try {
      const { idCatequizando } = req.params;

      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria', 'catequista'].includes(req.user.tipoPerfil)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver la progresión de catequizandos'
        });
      }

      // Verificar que el catequizando existe
      const { Catequizando } = require('../models');
      const catequizando = await Catequizando.findById(idCatequizando);

      if (!catequizando) {
        return res.status(404).json({
          success: false,
          message: 'Catequizando no encontrado'
        });
      }

      const progresion = await Nivel.obtenerProgresionNiveles(idCatequizando);

      return res.status(200).json({
        success: true,
        message: 'Progresión de niveles obtenida exitosamente',
        data: {
          catequizando: {
            id: catequizando._id,
            nombreCompleto: catequizando.nombreCompleto,
            documentoIdentidad: catequizando.documentoIdentidad
          },
          progresion
        }
      });

    } catch (error) {
      console.error('Error obteniendo progresión:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener niveles por sacramento
   * GET /api/niveles/sacramento/:sacramento
   */
  async getNivelesPorSacramento(req, res) {
    try {
      const { sacramento } = req.params;

      const niveles = await Nivel.obtenerPorSacramento(sacramento);

      return res.status(200).json({
        success: true,
        message: 'Niveles obtenidos exitosamente',
        data: niveles
      });

    } catch (error) {
      console.error('Error obteniendo niveles por sacramento:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Validar completitud del contenido de un nivel
   * POST /api/niveles/:id/validar-contenido
   */
  async validarContenido(req, res) {
    try {
      const { id } = req.params;

      const nivel = await Nivel.findById(id);

      if (!nivel) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      const validacion = nivel.validarCompletitudContenido();

      return res.status(200).json({
        success: true,
        message: 'Validación completada',
        data: validacion
      });

    } catch (error) {
      console.error('Error validando contenido:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estadísticas globales de niveles
   * GET /api/niveles/stats/global
   */
  async getGlobalStats(req, res) {
    try {
      const stats = await Nivel.obtenerEstadisticas();

      return res.status(200).json({
        success: true,
        message: 'Estadísticas globales obtenidas exitosamente',
        data: stats[0] || {
          totalNiveles: 0,
          totalGrupos: 0,
          totalCatequizandos: 0,
          promedioAprobacionGeneral: 0,
          nivelesConSacramento: 0
        }
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas globales:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener plantilla de contenido para un tipo de nivel
   * GET /api/niveles/plantilla/:tipo
   */
  async getPlantillaContenido(req, res) {
    try {
      const { tipo } = req.params;

      // Plantillas predefinidas para diferentes tipos de niveles
      const plantillas = {
        infantil: {
          objetivos: [
            { descripcion: 'Conocer el amor de Dios Padre', tipo: 'general' },
            { descripcion: 'Aprender las oraciones básicas', tipo: 'especifico' },
            { descripcion: 'Desarrollar valores cristianos', tipo: 'especifico' }
          ],
          temas: [
            { nombre: 'Dios es nuestro Padre', descripcion: 'Introducción al amor paternal de Dios', sesionesEstimadas: 2, orden: 1 },
            { nombre: 'Jesús es nuestro amigo', descripcion: 'La figura de Jesús como guía y amigo', sesionesEstimadas: 3, orden: 2 },
            { nombre: 'María, Madre de Jesús', descripcion: 'El papel de María en la salvación', sesionesEstimadas: 2, orden: 3 },
            { nombre: 'La oración', descripcion: 'Cómo hablar con Dios', sesionesEstimadas: 2, orden: 4 }
          ]
        },
        juvenil: {
          objetivos: [
            { descripcion: 'Profundizar en la fe cristiana', tipo: 'general' },
            { descripcion: 'Entender los sacramentos', tipo: 'especifico' },
            { descripcion: 'Fortalecer la vida en comunidad', tipo: 'especifico' }
          ],
          temas: [
            { nombre: 'Los Sacramentos', descripcion: 'Signos visibles de la gracia de Dios', sesionesEstimadas: 4, orden: 1 },
            { nombre: 'La Biblia', descripcion: 'Palabra de Dios para nuestras vidas', sesionesEstimadas: 3, orden: 2 },
            { nombre: 'La Iglesia', descripcion: 'Comunidad de creyentes', sesionesEstimadas: 3, orden: 3 },
            { nombre: 'Compromiso cristiano', descripcion: 'Vivir la fe en el día a día', sesionesEstimadas: 2, orden: 4 }
          ]
        },
        adulto: {
          objetivos: [
            { descripcion: 'Madurar en la fe cristiana', tipo: 'general' },
            { descripcion: 'Conocer la doctrina social de la Iglesia', tipo: 'especifico' },
            { descripcion: 'Desarrollar liderazgo espiritual', tipo: 'especifico' }
          ],
          temas: [
            { nombre: 'Teología fundamental', descripcion: 'Bases de la fe cristiana', sesionesEstimadas: 5, orden: 1 },
            { nombre: 'Moral cristiana', descripcion: 'Principios éticos del cristianismo', sesionesEstimadas: 4, orden: 2 },
            { nombre: 'Liturgia y espiritualidad', descripcion: 'La vida de oración y celebración', sesionesEstimadas: 3, orden: 3 },
            { nombre: 'Apostolado', descripcion: 'Misión del laico en la Iglesia', sesionesEstimadas: 3, orden: 4 }
          ]
        }
      };

      const plantilla = plantillas[tipo];

      if (!plantilla) {
        return res.status(404).json({
          success: false,
          message: 'Plantilla no encontrada para el tipo especificado'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Plantilla obtenida exitosamente',
        data: {
          tipo,
          contenido: plantilla
        }
      });

    } catch (error) {
      console.error('Error obteniendo plantilla:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new NivelController();