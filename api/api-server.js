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
      'delq_search_start_date', 'default_escrow_search_start_date', 'tax_billing_date',
      // New fields for Tax Agency Hub restructure
      'search_by_installments', 'tax_dates_notes',
      'full_year_due_date', 'full_year_precommitment_date',
      'full_year_finalize_balance_date', 'full_year_make_payment_due_date',
      'tax_key_format_masked', 'tax_key_format_unmasked',
      'alt_tax_key_format_masked', 'alt_tax_key_format_unmasked',
      // Payment Info fields
      'pmt_preferred_method', 'pmt_bulk_upload_allowed', 'pmt_bulk_upload_format',
      'pmt_tax_roll_required', 'pmt_tax_roll_cost',
      'pmt_third_party_name', 'pmt_third_party_fee', 'pmt_third_party_file_format',
      'pmt_original_bill_required', 'pmt_how_to_obtain_bill',
      'pmt_duplicate_bill_fee_yn', 'pmt_duplicate_bill_fee',
      'pmt_precommit_required', 'pmt_precommit_file_format',
      'pmt_method_wire', 'pmt_method_ach', 'pmt_method_check', 'pmt_method_other',
      'pmt_wire_instructions', 'pmt_ach_instructions', 'pmt_check_instructions', 'pmt_other_instructions',
      'pmt_wire_ach_contact_name', 'pmt_wire_ach_contact_info', 'pmt_notes'
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid field name' });
    }

    // Convert empty strings to null for date fields (PostgreSQL can't accept empty string for DATE)
    const dateFields = [
      'delq_search_start_date', 'default_escrow_search_start_date', 'tax_billing_date',
      'full_year_due_date', 'full_year_precommitment_date',
      'full_year_finalize_balance_date', 'full_year_make_payment_due_date'
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

// ==================== INSTALLMENTS (NEW EXPANDABLE TABLE) ====================

// Get all installments for a research result
app.get('/api/counties/:researchId/installments', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;
    const installments = await db.getInstallments(researchId);
    res.json({ success: true, researchId, installments });
  } catch (error) {
    console.error('Get installments API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new installment
app.post('/api/counties/:researchId/installments', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;
    const data = req.body;

    if (!data.installment_number) {
      return res.status(400).json({ error: 'installment_number is required' });
    }

    const installment = await db.createInstallment(researchId, data);
    res.json({ success: true, installment });
  } catch (error) {
    console.error('Create installment API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update installment by ID
app.put('/api/installments/:installmentId', requireAuth, async (req, res) => {
  try {
    const installmentId = req.params.installmentId;
    const data = req.body;
    const installment = await db.updateInstallment(installmentId, data);
    res.json({ success: true, installment });
  } catch (error) {
    console.error('Update installment API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete installment by ID
app.delete('/api/installments/:installmentId', requireAuth, async (req, res) => {
  try {
    const installmentId = req.params.installmentId;
    await db.deleteInstallment(installmentId);
    res.json({ success: true, message: 'Installment deleted' });
  } catch (error) {
    console.error('Delete installment API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONTACTS (NEW EXPANDABLE TABLE) ====================

// Get all contacts for a research result
app.get('/api/counties/:researchId/contacts', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;
    const contacts = await db.getContacts(researchId);
    res.json({ success: true, researchId, contacts });
  } catch (error) {
    console.error('Get contacts API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new contact
app.post('/api/counties/:researchId/contacts', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;
    const data = req.body;
    const contact = await db.createContact(researchId, data);
    res.json({ success: true, contact });
  } catch (error) {
    console.error('Create contact API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update contact by ID
app.put('/api/contacts/:contactId', requireAuth, async (req, res) => {
  try {
    const contactId = req.params.contactId;
    const data = req.body;
    const contact = await db.updateContact(contactId, data);
    res.json({ success: true, contact });
  } catch (error) {
    console.error('Update contact API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete contact by ID
app.delete('/api/contacts/:contactId', requireAuth, async (req, res) => {
  try {
    const contactId = req.params.contactId;
    await db.deleteContact(contactId);
    res.json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    console.error('Delete contact API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reorder contacts
app.put('/api/counties/:researchId/contacts/reorder', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds must be an array' });
    }

    await db.reorderContacts(researchId, orderedIds);
    res.json({ success: true, message: 'Contacts reordered' });
  } catch (error) {
    console.error('Reorder contacts API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get contact types for dropdown
app.get('/api/contact-types', requireAuth, async (req, res) => {
  try {
    const types = await db.getContactTypes();
    // Return default types if none exist
    const defaultTypes = ['primary', 'secondary', 'billing', 'technical', 'emergency', 'other'];
    res.json({ success: true, types: types.length > 0 ? types : defaultTypes });
  } catch (error) {
    console.error('Get contact types API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FEES (NEW EXPANDABLE TABLE) ====================

// Get all fees for a research result
app.get('/api/counties/:researchId/fees', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;
    const fees = await db.getFees(researchId);
    res.json({ success: true, researchId, fees });
  } catch (error) {
    console.error('Get fees API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new fee
app.post('/api/counties/:researchId/fees', requireAuth, async (req, res) => {
  try {
    const researchId = req.params.researchId;
    const data = req.body;
    const fee = await db.createFee(researchId, data);
    res.json({ success: true, fee });
  } catch (error) {
    console.error('Create fee API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update fee by ID
app.put('/api/fees/:feeId', requireAuth, async (req, res) => {
  try {
    const feeId = req.params.feeId;
    const data = req.body;
    const fee = await db.updateFee(feeId, data);
    res.json({ success: true, fee });
  } catch (error) {
    console.error('Update fee API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete fee by ID
app.delete('/api/fees/:feeId', requireAuth, async (req, res) => {
  try {
    const feeId = req.params.feeId;
    await db.deleteFee(feeId);
    res.json({ success: true, message: 'Fee deleted' });
  } catch (error) {
    console.error('Delete fee API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get fee types for dropdown
app.get('/api/fee-types', requireAuth, async (req, res) => {
  try {
    const types = await db.getFeeTypes();
    res.json({ success: true, types });
  } catch (error) {
    console.error('Get fee types API error:', error);
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

// ==================== SURVEY CONFIGS ====================

// List all survey configs
app.get('/api/survey-configs', requireAuth, async (req, res) => {
  try {
    const configs = await db.getSurveyConfigs();
    res.json({ success: true, configs });
  } catch (error) {
    console.error('Get survey configs API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single survey config
app.get('/api/survey-configs/:id', requireAuth, async (req, res) => {
  try {
    const config = await db.getSurveyConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: 'Survey config not found' });
    }
    res.json({ success: true, config });
  } catch (error) {
    console.error('Get survey config API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create survey config
app.post('/api/survey-configs', requireAuth, async (req, res) => {
  try {
    const { name, description, config, status } = req.body;
    if (!name || !config) {
      return res.status(400).json({ error: 'name and config are required' });
    }
    if (!config.meta || !Array.isArray(config.items)) {
      return res.status(400).json({ error: 'config must have meta and items array' });
    }
    const result = await db.createSurveyConfig(
      name, description, config, status, req.user.username
    );
    res.json({ success: true, config: result });
  } catch (error) {
    console.error('Create survey config API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update survey config
app.put('/api/survey-configs/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.updateSurveyConfig(req.params.id, req.body);
    if (!result) {
      return res.status(404).json({ error: 'Survey config not found' });
    }
    res.json({ success: true, config: result });
  } catch (error) {
    console.error('Update survey config API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete survey config
app.delete('/api/survey-configs/:id', requireAuth, async (req, res) => {
  try {
    await db.deleteSurveyConfig(req.params.id);
    res.json({ success: true, message: 'Survey config deleted' });
  } catch (error) {
    console.error('Delete survey config API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SURVEY QUEUE ====================

// List all batches with stats
app.get('/api/survey-queue/batches', requireAuth, async (req, res) => {
  try {
    const batches = await db.getSurveyBatches();
    res.json({ success: true, batches });
  } catch (error) {
    console.error('Get survey batches API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single batch
app.get('/api/survey-queue/batches/:batchId', requireAuth, async (req, res) => {
  try {
    const batch = await db.getSurveyBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json({ success: true, batch });
  } catch (error) {
    console.error('Get survey batch API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Paginated queue items with filters
app.get('/api/survey-queue/items', requireAuth, async (req, res) => {
  try {
    const filters = {
      batchId: req.query.batchId ? parseInt(req.query.batchId) : null,
      status: req.query.status || null,
      state: req.query.state || null,
      surveyConfigId: req.query.surveyConfigId ? parseInt(req.query.surveyConfigId) : null,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };
    const result = await db.getQueueItems(filters);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get queue items API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Aggregate stats
app.get('/api/survey-queue/stats', requireAuth, async (req, res) => {
  try {
    const batchId = req.query.batchId ? parseInt(req.query.batchId) : null;
    const stats = await db.getQueueStats(batchId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Get queue stats API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Preview scope count
app.post('/api/survey-queue/preview', requireAuth, async (req, res) => {
  try {
    const { scopeType, scopeFilter } = req.body;
    if (!scopeType) {
      return res.status(400).json({ error: 'scopeType is required' });
    }
    const count = await db.previewQueueScope(scopeType, scopeFilter || {});
    res.json({ success: true, count });
  } catch (error) {
    console.error('Preview queue scope API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate batch + queue items
app.post('/api/survey-queue/generate', requireAuth, async (req, res) => {
  try {
    const { surveyConfigId, scopeType, scopeFilter } = req.body;
    if (!surveyConfigId || !scopeType) {
      return res.status(400).json({ error: 'surveyConfigId and scopeType are required' });
    }

    const config = await db.getSurveyConfig(surveyConfigId);
    if (!config) {
      return res.status(404).json({ error: 'Survey config not found' });
    }
    if (config.status !== 'active') {
      return res.status(400).json({ error: 'Survey config must be active to generate a queue' });
    }

    const batch = await db.createSurveyBatch(
      surveyConfigId,
      scopeType,
      scopeFilter || {},
      req.user.username
    );

    res.json({ success: true, batch });
  } catch (error) {
    console.error('Generate queue API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update single queue item status
app.patch('/api/survey-queue/items/:itemId', requireAuth, async (req, res) => {
  try {
    const { status, response_data, error_message } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    const validStatuses = ['pending', 'sent', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const item = await db.updateQueueItemStatus(
      req.params.itemId,
      status,
      { response_data, error_message }
    );
    if (!item) {
      return res.status(404).json({ error: 'Queue item not found' });
    }
    res.json({ success: true, item });
  } catch (error) {
    console.error('Update queue item API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk action on batch items
app.post('/api/survey-queue/batches/:batchId/bulk-action', requireAuth, async (req, res) => {
  try {
    const { action } = req.body;
    const batchId = parseInt(req.params.batchId);

    let count;
    if (action === 'retry-failed') {
      count = await db.bulkUpdateQueueStatus(batchId, 'failed', 'pending');
    } else if (action === 'cancel-pending') {
      count = await db.bulkUpdateQueueStatus(batchId, 'pending', 'cancelled');
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "retry-failed" or "cancel-pending"' });
    }

    res.json({ success: true, action, affectedCount: count });
  } catch (error) {
    console.error('Bulk action API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete batch and all its items
app.delete('/api/survey-queue/batches/:batchId', requireAuth, async (req, res) => {
  try {
    await db.deleteSurveyBatch(parseInt(req.params.batchId));
    res.json({ success: true, message: 'Batch deleted' });
  } catch (error) {
    console.error('Delete batch API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PUBLIC SURVEY ENDPOINTS (no auth) ====================

// Get survey by unique ID (public)
app.get('/api/survey/:uniqueId', async (req, res) => {
  try {
    const item = await db.getQueueItemByUniqueId(req.params.uniqueId);
    if (!item) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    if (item.status === 'completed') {
      return res.json({
        success: true,
        completed: true,
        completedAt: item.completed_at,
        surveyName: item.survey_name,
        municipality: item.municipality_name || item.county_name,
        state: item.state
      });
    }
    if (item.status === 'cancelled') {
      return res.status(410).json({ error: 'This survey has been cancelled' });
    }

    // Build template variable replacements
    const vars = {
      '{CountyName}': item.county_name || '',
      '{State}': item.state || '',
      '{StateName}': item.state || '',
      '{MunicipalityName}': item.municipality_name || item.county_name || '',
      '{TreasurerName}': item.primary_contact_name || '',
      '{TreasurerEmail}': item.primary_contact_email || '',
      '{TreasurerPhone}': item.primary_contact_phone || '',
      '{TaxYear}': item.current_tax_year || ''
    };

    // Deep clone config and substitute variables in string values
    const config = JSON.parse(JSON.stringify(item.survey_config));
    function substituteVars(obj) {
      if (typeof obj === 'string') {
        let result = obj;
        for (const [key, val] of Object.entries(vars)) {
          result = result.split(key).join(val);
        }
        return result;
      }
      if (Array.isArray(obj)) return obj.map(substituteVars);
      if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          out[k] = substituteVars(v);
        }
        return out;
      }
      return obj;
    }

    const processedConfig = substituteVars(config);

    // Extract prepopulated values from research_results
    const prepopulatedValues = {};
    if (processedConfig.items) {
      for (const configItem of processedConfig.items) {
        // Handle db_field prepopulation
        if (configItem.prepopulated && configItem.type === 'db_field' && configItem.dbField) {
          const value = item[configItem.dbField];
          if (value !== null && value !== undefined && value !== '') {
            prepopulatedValues[configItem.id] = value;
          }
        }

        // Handle custom field prepopulation (if they have a dbField mapping)
        if (configItem.prepopulated && configItem.type === 'custom' && configItem.dbField) {
          const value = item[configItem.dbField];
          if (value !== null && value !== undefined && value !== '') {
            prepopulatedValues[configItem.id] = value;
          }
        }

        // Handle due_date_group prepopulation
        if (configItem.prepopulated && configItem.type === 'due_date_group') {
          const maxDates = configItem.maxDates || 10;
          for (let i = 1; i <= maxDates; i++) {
            const dateField = `due_date_${i}`;
            const value = item[dateField];
            if (value !== null && value !== undefined && value !== '') {
              prepopulatedValues[`${configItem.id}_date_${i}`] = value;
            }
          }
        }
      }
    }

    res.json({
      success: true,
      completed: false,
      uniqueId: item.unique_id,
      surveyName: item.survey_name,
      municipality: item.municipality_name || item.county_name,
      state: item.state,
      county: item.county_name,
      config: processedConfig,
      prepopulatedValues: prepopulatedValues
    });
  } catch (error) {
    console.error('Get public survey error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit survey response (public)
// Save survey progress (partial responses) without marking as completed
app.patch('/api/survey/:uniqueId/progress', async (req, res) => {
  try {
    const { responses } = req.body;
    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({ error: 'responses object is required' });
    }

    const item = await db.getQueueItemByUniqueId(req.params.uniqueId);
    if (!item) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    if (item.status === 'completed') {
      return res.status(409).json({ error: 'This survey has already been completed' });
    }
    if (item.status === 'cancelled') {
      return res.status(410).json({ error: 'This survey has been cancelled' });
    }

    const updated = await db.saveSurveyProgress(req.params.uniqueId, responses);
    if (!updated) {
      return res.status(400).json({ error: 'Unable to save progress' });
    }

    res.json({ success: true, message: 'Progress saved successfully' });
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/survey/:uniqueId/submit', async (req, res) => {
  try {
    const { responses } = req.body;
    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({ error: 'responses object is required' });
    }

    const item = await db.getQueueItemByUniqueId(req.params.uniqueId);
    if (!item) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    if (item.status === 'completed') {
      return res.status(409).json({ error: 'This survey has already been completed' });
    }
    if (item.status === 'cancelled') {
      return res.status(410).json({ error: 'This survey has been cancelled' });
    }

    const updated = await db.submitSurveyResponse(req.params.uniqueId, responses);
    if (!updated) {
      return res.status(400).json({ error: 'Unable to submit survey' });
    }

    res.json({ success: true, message: 'Survey submitted successfully' });
  } catch (error) {
    console.error('Submit survey error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
