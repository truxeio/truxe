/**
 * Validation Middleware for Tenant API
 * 
 * Provides input validation for tenant operations including
 * data validation, hierarchy rules, and permission checks.
 */

const Joi = require('joi');

// ===================================================================
// VALIDATION SCHEMAS
// ===================================================================

const tenantSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .required()
    .messages({
      'string.empty': 'Name is required',
      'string.max': 'Name must be less than 255 characters'
    }),

  slug: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
    .min(2)
    .max(63)
    .required()
    .messages({
      'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
      'string.min': 'Slug must be at least 2 characters',
      'string.max': 'Slug must be less than 63 characters'
    }),

  tenantType: Joi.string()
    .valid('workspace', 'team', 'project', 'department', 'division')
    .default('workspace'),

  description: Joi.string()
    .max(1000)
    .allow('')
    .optional(),

  settings: Joi.object()
    .optional()
    .default({}),

  metadata: Joi.object()
    .optional()
    .default({}),

  maxDepth: Joi.number()
    .integer()
    .min(2)
    .max(5)
    .default(3)
    .when('tenantType', {
      is: 'workspace',
      then: Joi.number().min(2).max(5),
      otherwise: Joi.forbidden()
    })
});

const memberSchema = Joi.object({
  userId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'User ID must be a valid UUID'
    }),

  role: Joi.string()
    .valid('owner', 'admin', 'member', 'viewer', 'guest')
    .default('member'),

  permissions: Joi.array()
    .items(Joi.string())
    .default([])
    .optional()
});

const hierarchyMoveSchema = Joi.object({
  newParentId: Joi.string()
    .uuid()
    .allow(null)
    .required()
    .messages({
      'string.uuid': 'New parent ID must be a valid UUID or null'
    })
});

// ===================================================================
// MIDDLEWARE FUNCTIONS
// ===================================================================

/**
 * Validate tenant data for create/update operations
 */
const validateTenantData = async (req, res, next) => {
  try {
    const { error, value } = tenantSchema.validate(req.body, {
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    // Additional business logic validation
    if (req.method === 'POST' && req.path.includes('/children')) {
      const validHierarchy = {
        workspace: ['team', 'department'],
        department: ['team'],
        team: ['project'],
        project: [],
        division: ['department']
      };

      const parentType = req.parentTenant?.tenantType;
      const childType = value.tenantType;

      if (parentType && !validHierarchy[parentType]?.includes(childType)) {
        return res.status(400).json({
          success: false,
          error: `Cannot create ${childType} under ${parentType}`
        });
      }
    }

    req.body = value;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Validation error occurred'
    });
  }
};

/**
 * Validate member data for member operations
 */
const validateMemberData = async (req, res, next) => {
  try {
    const { error, value } = memberSchema.validate(req.body, {
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    // Prevent self-removal for owners
    if (req.method === 'DELETE' && value.userId === req.user.id) {
      const userRole = await req.tenantService.getUserRole(req.params.id, req.user.id);
      if (userRole === 'owner') {
        return res.status(400).json({
          success: false,
          error: 'Owner cannot remove themselves'
        });
      }
    }

    req.body = value;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Validation error occurred'
    });
  }
};

/**
 * Validate hierarchy move operations
 */
const validateHierarchyMove = async (req, res, next) => {
  try {
    const { error, value } = hierarchyMoveSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const tenantId = req.params.id;
    const newParentId = value.newParentId;

    // Prevent moving to self
    if (tenantId === newParentId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot move tenant to itself'
      });
    }

    // Additional validation will be done in the service layer
    req.body = value;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Validation error occurred'
    });
  }
};

/**
 * Validate UUID parameters
 */
const validateUuidParam = (paramName) => {
  return (req, res, next) => {
    const value = req.params[paramName];
    
    if (!value) {
      return res.status(400).json({
        success: false,
        error: `${paramName} is required`
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(value)) {
      return res.status(400).json({
        success: false,
        error: `${paramName} must be a valid UUID`
      });
    }

    next();
  };
};

/**
 * Validate query parameters
 */
const validateQueryParams = (allowedParams) => {
  return (req, res, next) => {
    const invalidParams = Object.keys(req.query).filter(
      param => !allowedParams.includes(param)
    );

    if (invalidParams.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid query parameters: ${invalidParams.join(', ')}`
      });
    }

    // Validate boolean parameters
    const booleanParams = ['includeArchived', 'includeMembers', 'includePermissions', 'hierarchical', 'cascade'];
    
    for (const param of booleanParams) {
      if (req.query[param] !== undefined && !['true', 'false'].includes(req.query[param])) {
        return res.status(400).json({
          success: false,
          error: `${param} must be 'true' or 'false'`
        });
      }
    }

    // Validate numeric parameters
    const numericParams = ['maxDepth', 'limit', 'offset'];
    
    for (const param of numericParams) {
      if (req.query[param] !== undefined) {
        const value = parseInt(req.query[param]);
        if (isNaN(value) || value < 0) {
          return res.status(400).json({
            success: false,
            error: `${param} must be a non-negative integer`
          });
        }
        req.query[param] = value;
      }
    }

    next();
  };
};

/**
 * Sanitize and normalize slug
 */
const sanitizeSlug = (req, res, next) => {
  if (req.body.slug) {
    req.body.slug = req.body.slug
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
};

/**
 * Rate limiting validation for sensitive operations
 */
const validateOperationLimits = (operation, maxPerHour = 100) => {
  const operationCounts = new Map();

  return (req, res, next) => {
    const userId = req.user.id;
    const key = `${userId}:${operation}`;
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;

    if (!operationCounts.has(key)) {
      operationCounts.set(key, []);
    }

    const timestamps = operationCounts.get(key);
    
    // Remove timestamps older than 1 hour
    const recentTimestamps = timestamps.filter(ts => now - ts < hourMs);
    operationCounts.set(key, recentTimestamps);

    if (recentTimestamps.length >= maxPerHour) {
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded for ${operation}. Max ${maxPerHour} per hour.`,
        retryAfter: Math.ceil((recentTimestamps[0] + hourMs - now) / 1000)
      });
    }

    recentTimestamps.push(now);
    next();
  };
};

module.exports = {
  validateTenantData,
  validateMemberData,
  validateHierarchyMove,
  validateUuidParam,
  validateQueryParams,
  sanitizeSlug,
  validateOperationLimits
};