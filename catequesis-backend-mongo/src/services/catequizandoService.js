const Catequizando = require('../models/Catequizando');
const Inscripcion = require('../models/Inscripcion');
const { AppError, ErrorBuilder } = require('../utils/errors');
const { buildPaginationQuery, buildSortQuery } = require('../utils/queryHelpers');

class CatequizandoService {
  /**
   * Crear nuevo catequizando
   */
  async createCatequizando(catequizandoData, currentUser) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para crear catequizandos');
      }

      const { documento, nombres, apellidos, fechaNacimiento, genero, direccion, telefono, email, 
              nombrePadre, nombreMadre, telefonoPadres, parroquia } = catequizandoData;

      // Verificar si ya existe un catequizando con el mismo documento
      const catequizandoExistente = await Catequizando.findOne({ documento });
      if (catequizandoExistente) {
        throw ErrorBuilder.conflict('Ya existe un catequizando con este documento');
      }

      // Crear catequizando
      const nuevoCatequizando = new Catequizando({
        documento,
        nombres,
        apellidos,
        fechaNacimiento,
        genero,
        direccion,
        telefono,
        email,
        nombrePadre,
        nombreMadre,
        telefonoPadres,
        parroquia: parroquia || currentUser.parroquia,
        activo: true
      });

      await nuevoCatequizando.save();
      await nuevoCatequizando.populate('parroquia', 'nombre');

      return {
        success: true,
        message: 'Catequizando creado exitosamente',
        data: nuevoCatequizando
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de catequizando inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al crear catequizando');
    }
  }

  /**
   * Obtener catequizandos con filtros y paginación
   */
  async getCatequizandos(queryParams, currentUser) {
    try {
      const { page = 1, limit = 10, search, parroquia, genero, activo, sort = 'apellidos' } = queryParams;

      // Construir filtros
      let filtros = {};

      // Filtro por parroquia según el rol del usuario
      if (currentUser.tipoPerfil === 'admin') {
        if (parroquia) {
          filtros.parroquia = parroquia;
        }
      } else {
        // No admin solo puede ver catequizandos de su parroquia
        filtros.parroquia = currentUser.parroquia;
      }

      // Filtro de búsqueda
      if (search) {
        filtros.$or = [
          { nombres: { $regex: search, $options: 'i' } },
          { apellidos: { $regex: search, $options: 'i' } },
          { documento: { $regex: search, $options: 'i' } }
        ];
      }

      // Filtros adicionales
      if (genero) {
        filtros.genero = genero;
      }

      if (activo !== undefined) {
        filtros.activo = activo === 'true';
      }

      // Configurar paginación
      const paginationQuery = buildPaginationQuery(page, limit);
      const sortQuery = buildSortQuery(sort);

      // Ejecutar consulta
      const [catequizandos, total] = await Promise.all([
        Catequizando.find(filtros)
          .populate('parroquia', 'nombre')
          .sort(sortQuery)
          .skip(paginationQuery.skip)
          .limit(paginationQuery.limit),
        Catequizando.countDocuments(filtros)
      ]);

      // Metadatos de paginación
      const totalPages = Math.ceil(total / paginationQuery.limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        success: true,
        data: catequizandos,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: paginationQuery.limit,
          hasNext,
          hasPrev
        }
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener catequizandos');
    }
  }

  /**
   * Obtener catequizando por ID
   */
  async getCatequizandoById(id, currentUser) {
    try {
      let query = Catequizando.findById(id).populate('parroquia', 'nombre direccion telefono');

      // Si no es admin, verificar que sea de su parroquia
      if (currentUser.tipoPerfil !== 'admin') {
        query = query.where('parroquia').equals(currentUser.parroquia);
      }

      const catequizando = await query;

      if (!catequizando) {
        throw ErrorBuilder.notFound('Catequizando no encontrado');
      }

      // Obtener inscripciones del catequizando
      const inscripciones = await Inscripcion.find({ catequizando: id })
        .populate('nivel', 'nombre orden')
        .populate('grupo', 'nombre')
        .sort({ fechaInscripcion: -1 });

      return {
        success: true,
        data: {
          catequizando,
          inscripciones
        }
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al obtener catequizando');
    }
  }

  /**
   * Actualizar catequizando
   */
  async updateCatequizando(id, updateData, currentUser) {
    try {
      // Verificar permisos
      if (!['admin', 'parroco', 'secretaria'].includes(currentUser.tipoPerfil)) {
        throw ErrorBuilder.forbidden('No tienes permisos para actualizar catequizandos');
      }

      let query = Catequizando.findById(id);

      // Si no es admin, verificar que sea de su parroquia
      if (currentUser.tipoPerfil !== 'admin') {
        query = query.where('parroquia').equals(currentUser.parroquia);
      }

      const catequizando = await query;

      if (!catequizando) {
        throw ErrorBuilder.notFound('Catequizando no encontrado');
      }

      // Verificar documento único si se está cambiando
      if (updateData.documento && updateData.documento !== catequizando.documento) {
        const documentoExistente = await Catequizando.findOne({
          documento: updateData.documento,
          _id: { $ne: id }
        });

        if (documentoExistente) {
          throw ErrorBuilder.conflict('Ya existe un catequizando con este documento');
        }
      }

      // Actualizar catequizando
      Object.assign(catequizando, updateData);
      await catequizando.save();
      await catequizando.populate('parroquia', 'nombre');

      return {
        success: true,
        message: 'Catequizando actualizado exitosamente',
        data: catequizando
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw ErrorBuilder.badRequest('Datos de catequizando inválidos', validationErrors);
      }

      throw ErrorBuilder.internal('Error interno al actualizar catequizando');
    }
  }

  /**
   * Eliminar catequizando (soft delete)
   */
  async deleteCatequizando(id, currentUser) {
    try {
      // Solo admin puede eliminar catequizandos
      if (currentUser.tipoPerfil !== 'admin') {
        throw ErrorBuilder.forbidden('Solo los administradores pueden eliminar catequizandos');
      }

      const catequizando = await Catequizando.findById(id);

      if (!catequizando) {
        throw ErrorBuilder.notFound('Catequizando no encontrado');
      }

      // Verificar si tiene inscripciones activas
      const inscripcionesActivas = await Inscripcion.countDocuments({
        catequizando: id,
        estado: 'activa'
      });

      if (inscripcionesActivas > 0) {
        throw ErrorBuilder.conflict('No se puede eliminar un catequizando con inscripciones activas');
      }

      // Soft delete
      catequizando.activo = false;
      await catequizando.save();

      return {
        success: true,
        message: 'Catequizando eliminado exitosamente'
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorBuilder.internal('Error interno al eliminar catequizando');
    }
  }

  /**
   * Buscar catequizandos por criterios específicos
   */
  async searchCatequizandos(searchParams, currentUser) {
    try {
      const { documento, nombres, apellidos, telefono } = searchParams;

      let filtros = {};

      // Filtro por parroquia según el rol del usuario
      if (currentUser.tipoPerfil !== 'admin') {
        filtros.parroquia = currentUser.parroquia;
      }

      // Construir filtros de búsqueda
      if (documento) {
        filtros.documento = { $regex: documento, $options: 'i' };
      }

      if (nombres) {
        filtros.nombres = { $regex: nombres, $options: 'i' };
      }

      if (apellidos) {
        filtros.apellidos = { $regex: apellidos, $options: 'i' };
      }

      if (telefono) {
        filtros.$or = [
          { telefono: { $regex: telefono, $options: 'i' } },
          { telefonoPadres: { $regex: telefono, $options: 'i' } }
        ];
      }

      const catequizandos = await Catequizando.find(filtros)
        .populate('parroquia', 'nombre')
        .sort({ apellidos: 1, nombres: 1 })
        .limit(20);

      return {
        success: true,
        data: catequizandos
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al buscar catequizandos');
    }
  }

  /**
   * Obtener estadísticas de catequizandos
   */
  async getEstadisticas(currentUser) {
    try {
      let filtroBase = {};

      // Filtrar por parroquia si no es admin
      if (currentUser.tipoPerfil !== 'admin') {
        filtroBase.parroquia = currentUser.parroquia;
      }

      const estadisticas = await Promise.all([
        // Total de catequizandos
        Catequizando.countDocuments({ ...filtroBase, activo: true }),
        
        // Por género
        Catequizando.aggregate([
          { $match: { ...filtroBase, activo: true } },
          { $group: { _id: '$genero', count: { $sum: 1 } } }
        ]),

        // Por rango de edad
        Catequizando.aggregate([
          { $match: { ...filtroBase, activo: true } },
          {
            $addFields: {
              edad: {
                $floor: {
                  $divide: [
                    { $subtract: [new Date(), '$fechaNacimiento'] },
                    1000 * 60 * 60 * 24 * 365.25
                  ]
                }
              }
            }
          },
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    { case: { $lte: ['$edad', 7] }, then: '0-7 años' },
                    { case: { $lte: ['$edad', 12] }, then: '8-12 años' },
                    { case: { $lte: ['$edad', 17] }, then: '13-17 años' },
                    { case: { $gte: ['$edad', 18] }, then: '18+ años' }
                  ],
                  default: 'Sin edad'
                }
              },
              count: { $sum: 1 }
            }
          }
        ]),

        // Catequizandos recientes (últimos 30 días)
        Catequizando.countDocuments({
          ...filtroBase,
          activo: true,
          fechaCreacion: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
      ]);

      return {
        success: true,
        data: {
          total: estadisticas[0],
          porGenero: estadisticas[1],
          porEdad: estadisticas[2],
          recientes: estadisticas[3]
        }
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al obtener estadísticas');
    }
  }

  /**
   * Exportar catequizandos (para generar reportes)
   */
  async exportCatequizandos(filtros, currentUser) {
    try {
      let query = {};

      // Filtrar por parroquia si no es admin
      if (currentUser.tipoPerfil !== 'admin') {
        query.parroquia = currentUser.parroquia;
      } else if (filtros.parroquia) {
        query.parroquia = filtros.parroquia;
      }

      // Aplicar filtros adicionales
      if (filtros.genero) {
        query.genero = filtros.genero;
      }

      if (filtros.activo !== undefined) {
        query.activo = filtros.activo;
      }

      const catequizandos = await Catequizando.find(query)
        .populate('parroquia', 'nombre')
        .sort({ apellidos: 1, nombres: 1 })
        .select('documento nombres apellidos fechaNacimiento genero telefono email parroquia activo');

      return {
        success: true,
        data: catequizandos
      };

    } catch (error) {
      throw ErrorBuilder.internal('Error interno al exportar catequizandos');
    }
  }
}

module.exports = new CatequizandoService();