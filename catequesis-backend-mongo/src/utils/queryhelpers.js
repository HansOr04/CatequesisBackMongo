const config = require('../config/environment');

/**
 * Construir query de paginación
 */
function buildPaginationQuery(page = 1, limit = 10) {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(config.pagination.maxLimit, Math.max(1, parseInt(limit)));
  
  return {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum
  };
}

/**
 * Construir query de orden
 */
function buildSortQuery(sort = 'createdAt') {
  const sortQuery = {};
  
  if (sort.startsWith('-')) {
    // Orden descendente
    const field = sort.substring(1);
    sortQuery[field] = -1;
  } else {
    // Orden ascendente
    sortQuery[sort] = 1;
  }
  
  return sortQuery;
}

/**
 * Construir filtros de búsqueda
 */
function buildSearchFilter(searchText, searchFields) {
  if (!searchText || !searchFields || searchFields.length === 0) {
    return {};
  }

  return {
    $or: searchFields.map(field => ({
      [field]: { $regex: searchText, $options: 'i' }
    }))
  };
}

/**
 * Construir filtros de fecha
 */
function buildDateFilter(dateField, startDate, endDate) {
  const filter = {};
  
  if (startDate || endDate) {
    filter[dateField] = {};
    
    if (startDate) {
      filter[dateField].$gte = new Date(startDate);
    }
    
    if (endDate) {
      filter[dateField].$lte = new Date(endDate);
    }
  }
  
  return filter;
}

/**
 * Aplicar filtros de parroquia según permisos del usuario
 */
function applyParroquiaFilter(baseFilter, currentUser, parroquiaField = 'parroquia') {
  if (currentUser.tipoPerfil === 'admin') {
    // Admin puede ver todos los registros
    return baseFilter;
  }
  
  // Otros usuarios solo ven registros de su parroquia
  return {
    ...baseFilter,
    [parroquiaField]: currentUser.parroquia
  };
}

/**
 * Construir respuesta paginada
 */
function buildPaginatedResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      itemsPerPage: parseInt(limit),
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Validar y limpiar filtros de query
 */
function sanitizeQueryFilters(query) {
  const sanitized = {};
  
  // Lista de campos permitidos y sus tipos
  const allowedFilters = {
    page: 'number',
    limit: 'number',
    sort: 'string',
    search: 'string',
    activo: 'boolean',
    genero: 'string',
    estado: 'string',
    nivel: 'string',
    grupo: 'string',
    parroquia: 'string',
    anioLectivo: 'string',
    tipoPerfil: 'string',
    fechaInicio: 'date',
    fechaFin: 'date'
  };

  Object.keys(query).forEach(key => {
    if (allowedFilters[key]) {
      const type = allowedFilters[key];
      const value = query[key];

      switch (type) {
        case 'number':
          const num = parseInt(value);
          if (!isNaN(num)) sanitized[key] = num;
          break;
          
        case 'boolean':
          if (value === 'true' || value === 'false') {
            sanitized[key] = value === 'true';
          }
          break;
          
        case 'date':
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            sanitized[key] = date;
          }
          break;
          
        case 'string':
          if (typeof value === 'string' && value.trim()) {
            sanitized[key] = value.trim();
          }
          break;
      }
    }
  });

  return sanitized;
}

/**
 * Construir agregación para estadísticas
 */
function buildStatsAggregation(matchFilter, groupBy, countField = 'count') {
  return [
    { $match: matchFilter },
    {
      $group: {
        _id: groupBy,
        [countField]: { $sum: 1 }
      }
    },
    { $sort: { [countField]: -1 } }
  ];
}

/**
 * Construir lookup para poblar referencias
 */
function buildLookupStage(from, localField, foreignField, as, pipeline = null) {
  const lookup = {
    $lookup: {
      from,
      localField,
      foreignField,
      as
    }
  };
  
  if (pipeline) {
    lookup.$lookup.pipeline = pipeline;
  }
  
  return lookup;
}

/**
 * Aplicar filtros dinámicos
 */
function applyDynamicFilters(baseFilter, filters) {
  const dynamicFilter = { ...baseFilter };
  
  Object.keys(filters).forEach(key => {
    const value = filters[key];
    
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'string' && value.includes(',')) {
        // Múltiples valores separados por coma
        dynamicFilter[key] = { $in: value.split(',') };
      } else {
        dynamicFilter[key] = value;
      }
    }
  });
  
  return dynamicFilter;
}

/**
 * Construir pipeline de agregación para búsqueda con poblado
 */
function buildSearchWithPopulateAggregation(matchFilter, populateFields, sortField, paginationOptions) {
  const pipeline = [
    { $match: matchFilter }
  ];
  
  // Agregar lookups para poblar campos
  populateFields.forEach(field => {
    pipeline.push(buildLookupStage(
      field.collection,
      field.localField,
      field.foreignField || '_id',
      field.as || field.localField,
      field.pipeline
    ));
    
    if (!field.preserveNullAndEmptyArrays) {
      pipeline.push({ $unwind: `${field.as || field.localField}` });
    }
  });
  
  // Ordenamiento
  if (sortField) {
    pipeline.push({ $sort: buildSortQuery(sortField) });
  }
  
  // Paginación
  if (paginationOptions) {
    pipeline.push({ $skip: paginationOptions.skip });
    pipeline.push({ $limit: paginationOptions.limit });
  }
  
  return pipeline;
}

/**
 * Validar ObjectId de MongoDB
 */
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Construir filtro de rango de fechas
 */
function buildDateRangeFilter(field, startDate, endDate, includeTime = false) {
  const filter = {};
  
  if (startDate || endDate) {
    filter[field] = {};
    
    if (startDate) {
      const start = new Date(startDate);
      if (!includeTime) {
        start.setHours(0, 0, 0, 0);
      }
      filter[field].$gte = start;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      if (!includeTime) {
        end.setHours(23, 59, 59, 999);
      }
      filter[field].$lte = end;
    }
  }
  
  return filter;
}

/**
 * Construir filtro de texto completo
 */
function buildFullTextSearchFilter(searchText, fields, options = {}) {
  if (!searchText || !fields || fields.length === 0) {
    return {};
  }

  const searchOptions = {
    $options: 'i',
    ...options
  };

  if (fields.length === 1) {
    return {
      [fields[0]]: { $regex: searchText, ...searchOptions }
    };
  }

  return {
    $or: fields.map(field => ({
      [field]: { $regex: searchText, ...searchOptions }
    }))
  };
}

/**
 * Calcular estadísticas de paginación
 */
function calculatePaginationStats(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  const startItem = total > 0 ? ((page - 1) * limit) + 1 : 0;
  const endItem = Math.min(page * limit, total);
  
  return {
    totalItems: total,
    totalPages,
    currentPage: page,
    itemsPerPage: limit,
    startItem,
    endItem,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    isFirstPage: page === 1,
    isLastPage: page === totalPages
  };
}

module.exports = {
  buildPaginationQuery,
  buildSortQuery,
  buildSearchFilter,
  buildDateFilter,
  applyParroquiaFilter,
  buildPaginatedResponse,
  sanitizeQueryFilters,
  buildStatsAggregation,
  buildLookupStage,
  applyDynamicFilters,
  buildSearchWithPopulateAggregation,
  isValidObjectId,
  buildDateRangeFilter,
  buildFullTextSearchFilter,
  calculatePaginationStats
};