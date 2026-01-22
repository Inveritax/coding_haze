const express = require('express');
const cors = require('cors');
const path = require('path');
const { getInstance } = require('./database-config');
const createAuthRoutes = require('./auth-routes');

const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/screenshots', express.static(path.join(__dirname, '../data/screenshots')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Database instance
let db;
let authRoutes;

(async () => {
  try {
    db = await getInstance();
    console.log('Database initialized');

    authRoutes = createAuthRoutes(db);
    app.use('/api/auth', authRoutes);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
})();

// Auth middleware
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  // Check for machine token first (bypasses JWT auth)
  const machineToken = process.env.MACHINE_TOKEN;
  if (machineToken && token === machineToken) {
    req.user = { userId: 0, username: 'machine', role: 'admin' };
    return next();
  }

  if (!authRoutes || !authRoutes.auth) {
    return res.status(503).json({ error: 'Authentication service not ready' });
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = authRoutes.auth.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
};

// ==================== API ROUTES ====================

// Get available states
app.get('/api/states', requireAuth, async (req, res) => {
  try {
    const states = await db.getAvailableStates();
    res.json(states);
  } catch (error) {
    console.error('States API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all counties with filtering
app.get('/api/counties', requireAuth, async (req, res) => {
  try {
    const state = req.query.state;
    const search = req.query.search || null;
    const searchMode = req.query.searchMode || 'general';
    const jurisdictionType = req.query.jurisdictionType || 'all';
    const hideValidated = req.query.hideValidated === 'true';
    const paginate = req.query.paginate === 'true';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'municipality_name';
    const sortOrder = req.query.sortOrder || 'asc';

    const counties = await db.getAllCountiesWithResults(state, search, searchMode);

    // Add calculated jurisdiction_type
    const countiesWithJurisdictionType = counties.map(county => ({
      ...county,
      jurisdiction_type: (!county.municipality_name || county.municipality_name === county.county_name) ?
        'county' : 'municipality',
      display_name: county.municipality_name || county.county_name
    }));

    // Apply jurisdiction type filtering
    let filteredCounties = countiesWithJurisdictionType;
    if (jurisdictionType !== 'all') {
      filteredCounties = countiesWithJurisdictionType.filter(county => {
        if (jurisdictionType === 'county') {
          return county.jurisdiction_type === 'county';
        } else if (jurisdictionType === 'municipality') {
          return county.jurisdiction_type === 'municipality';
        }
        return true;
      });
    }

    // Apply hideValidated filter
    // Validated means:
    // - Municipalities: has manual edits OR is propagated (propagated_from_county only - NOT MI_Auto_populated)
    // - Counties: has manual edits AND all child municipalities are validated
    // Note: MI_Auto_populated is NOT validated - it just means data was copied but needs manual verification
    if (hideValidated) {
      filteredCounties = filteredCounties.filter(county => {
        if (county.jurisdiction_type === 'municipality') {
          // Hide if has manual edits OR is propagated (only propagated_from_county counts)
          const isPropagated = county.method_used === 'propagated_from_county';
          return !county.has_audit_entries && !isPropagated;
        } else {
          // County: hide if has edits AND all municipalities are validated (edited or propagated)
          const allMunisValidated = county.total_municipalities > 0 &&
            (county.municipalities_with_edits + county.municipalities_propagated) >= county.total_municipalities;
          return !county.has_audit_entries || !allMunisValidated;
        }
      });
    }

    // Apply sorting - always sort alphabetically by display_name
    const sortedCounties = filteredCounties.sort((a, b) => {
      const aVal = (a.display_name || '').toLowerCase();
      const bVal = (b.display_name || '').toLowerCase();
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    });

    if (paginate) {
      const paginatedCounties = sortedCounties.slice(offset, offset + limit);
      res.json({
        data: paginatedCounties,
        total: sortedCounties.length,
        page: page,
        limit: limit,
        totalPages: Math.ceil(sortedCounties.length / limit),
        sortBy: sortBy,
        sortOrder: sortOrder
      });
    } else {
      res.json(sortedCounties);
    }
  } catch (error) {
    console.error('Counties API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a specific field for a county
app.patch('/api/counties/:researchId', requireAuth, async (req, res) => {
  try {
    const { field, value, editReason } = req.body;
    const researchId = req.params.researchId;

    if (!field || value === undefined) {
      return res.status(400).json({ error: 'Field and value are required' });
    }

    // Validate field name
    const allowedFields = [
      'current_tax_year', 'num_installments',
      'due_date_1', 'due_date_2', 'due_date_3', 'due_date_4', 'due_date_5',
      'due_date_6', 'due_date_7', 'due_date_8', 'due_date_9', 'due_date_10',
      'primary_contact_name', 'primary_contact_title', 'primary_contact_phone', 'primary_contact_email',
      'tax_authority_physical_address', 'tax_authority_mailing_address',
      'general_phone_number', 'fax_number', 'web_address', 'county_website', 'pay_taxes_url',
      'notes',
      // General collection settings
      'default_delq_collector', 'default_escrow_collector',
      'delq_search_start_date', 'default_escrow_search_start_date', 'tax_billing_date'
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid field name' });
    }

    // Convert empty strings to null for date fields (PostgreSQL can't accept empty string for DATE)
    const dateFields = [
      'delq_search_start_date', 'default_escrow_search_start_date', 'tax_billing_date'
    ];
    let processedValue = value;
    if (dateFields.includes(field) && value === '') {
      processedValue = null;
    }

    // Get current value for audit logging
    const oldValue = await db.getCurrentFieldValue(researchId, field);

    // Perform the update
    await db.updateResearchField(researchId, field, processedValue);

    // Log the edit to audit trail
    const user = req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    await db.logFieldEdit(
      researchId,
      user.userId,
      user.username,
      field,
      oldValue,
      processedValue,
      ipAddress,
      userAgent,
      editReason
    );

    res.json({
      success: true,
      message: 'Field updated successfully',
      auditLogged: true
    });
  } catch (error) {
    console.error('Update county API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get screenshots for a research result
app.get('/api/screenshots/:researchId', requireAuth, async (req, res) => {
  try {
    const screenshots = await db.getScreenshots(req.params.researchId);
    res.json(screenshots);
  } catch (error) {
    console.error('Screenshots API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get source data for a research result
app.get('/api/source-data/:researchId', requireAuth, async (req, res) => {
  try {
    const sourceData = await db.getSourceData(req.params.researchId);
    res.json(sourceData);
  } catch (error) {
    console.error('Source data API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get field edit history for a specific research record
app.get('/api/counties/:researchId/edit-history', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;
    const editHistory = await db.getFieldEditHistory(researchId);

    res.json({
      success: true,
      researchId: researchId,
      editHistory: editHistory,
      totalEdits: editHistory.length
    });
  } catch (error) {
    console.error('Get edit history API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get installment details for a research record
app.get('/api/counties/:researchId/installments', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;
    const installments = await db.getInstallmentDetails(researchId);

    res.json({
      success: true,
      researchId: researchId,
      installments: installments
    });
  } catch (error) {
    console.error('Get installment details API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update installment detail
app.put('/api/counties/:researchId/installments/:installmentNumber', requireAuth, async (req, res) => {
  try {
    const { researchId, installmentNumber } = req.params;
    const data = req.body;

    const num = parseInt(installmentNumber);
    if (num < 1 || num > 10) {
      return res.status(400).json({ error: 'Installment number must be between 1 and 10' });
    }

    const result = await db.upsertInstallmentDetail(researchId, num, data);

    res.json({
      success: true,
      installment: result
    });
  } catch (error) {
    console.error('Update installment detail API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete installment detail
app.delete('/api/counties/:researchId/installments/:installmentNumber', requireAuth, async (req, res) => {
  try {
    const { researchId, installmentNumber } = req.params;

    const num = parseInt(installmentNumber);
    if (num < 1 || num > 10) {
      return res.status(400).json({ error: 'Installment number must be between 1 and 10' });
    }

    await db.deleteInstallmentDetail(researchId, num);

    res.json({
      success: true,
      message: `Installment ${num} deleted`
    });
  } catch (error) {
    console.error('Delete installment detail API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all research versions for a county
app.get('/api/counties/:researchId/versions', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;

    // First get the county_id from the current research result
    const countyId = await db.getCountyIdFromResearchId(researchId);
    if (!countyId) {
      return res.status(404).json({ error: 'Research result not found' });
    }

    // Get all research versions for this county
    const versions = await db.getResearchVersionsByCountyId(countyId);

    res.json({
      success: true,
      currentResearchId: parseInt(researchId),
      countyId: countyId,
      versions: versions,
      totalVersions: versions.length
    });
  } catch (error) {
    console.error('Get research versions API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific research result by ID (for switching versions)
app.get('/api/research/:researchId', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;
    const result = await db.getResearchResultById(researchId);

    if (!result) {
      return res.status(404).json({ error: 'Research result not found' });
    }

    // Add calculated fields
    result.jurisdiction_type = (!result.municipality_name || result.municipality_name === result.county_name) ?
      'county' : 'municipality';
    result.display_name = result.municipality_name || result.county_name;

    res.json({
      success: true,
      research: result
    });
  } catch (error) {
    console.error('Get research result API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export county data to CSV
app.get('/api/export/csv', requireAuth, async (req, res) => {
  try {
    const state = req.query.state;
    const search = req.query.search || null;
    const jurisdictionType = req.query.jurisdictionType || 'all';

    const counties = await db.getAllCountiesWithResults(state, search);

    // Add calculated jurisdiction_type
    const countiesWithJurisdictionType = counties.map(county => ({
      ...county,
      jurisdiction_type: (!county.municipality_name || county.municipality_name === county.county_name) ?
        'county' : 'municipality',
      display_name: county.municipality_name || county.county_name
    }));

    // Apply jurisdiction type filtering
    let filteredCounties = countiesWithJurisdictionType;
    if (jurisdictionType !== 'all') {
      filteredCounties = countiesWithJurisdictionType.filter(county => {
        if (jurisdictionType === 'county') {
          return county.jurisdiction_type === 'county';
        } else if (jurisdictionType === 'municipality') {
          return county.jurisdiction_type === 'municipality';
        }
        return true;
      });
    }

    // Create CSV header
    const headers = [
      'State', 'Municipality Name', 'FIPS Code', 'Parent County',
      'Current Tax Year', '# Installments',
      'Due Date 1', 'Due Date 2', 'Due Date 3', 'Due Date 4', 'Due Date 5', 'Due Date 6',
      'Primary Contact Name', 'Primary Contact Title', 'Primary Contact Phone', 'Primary Contact Email',
      'Tax Authority Physical Address', 'Tax Authority Mailing Address',
      'General Phone Number', 'Fax Number', 'Web Address', 'Notes'
    ];

    // Create CSV rows
    const rows = filteredCounties.map(county => [
      county.state || '',
      county.municipality_name || county.county_name || '',
      county.fips_code || '',
      county.county_name || '',
      county.current_tax_year || '',
      county.num_installments || '',
      county.due_date_1 || '',
      county.due_date_2 || '',
      county.due_date_3 || '',
      county.due_date_4 || '',
      county.due_date_5 || '',
      county.due_date_6 || '',
      county.primary_contact_name || '',
      county.primary_contact_title || '',
      county.primary_contact_phone || '',
      county.primary_contact_email || '',
      county.tax_authority_physical_address || '',
      county.tax_authority_mailing_address || '',
      county.general_phone_number || '',
      county.fax_number || '',
      county.web_address || '',
      county.notes || ''
    ]);

    // Convert to CSV format
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tax_jurisdictions.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Export CSV API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: db ? 'connected' : 'disconnected',
    type: 'PostgreSQL',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Database: PostgreSQL`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
