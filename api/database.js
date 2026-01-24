const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

class PostgresDatabase {
  constructor() {
    const connectionString = process.env.DATABASE_URL || {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'tax_jurisdiction',
      user: process.env.DB_USER || 'tax_admin',
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };

    this.pool = new Pool(
      typeof connectionString === 'string'
        ? { connectionString }
        : connectionString
    );

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    this.initialized = false;
  }

  async query(text, params = []) {
    return await this.pool.query(text, params);
  }

  async initializeTables() {
    if (this.initialized) return;

    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      console.log('PostgreSQL connection established');
      this.initialized = true;

      const tablesExist = await this.checkTablesExist();
      if (!tablesExist) {
        console.log('Tables not found. Please run migrations first.');
      }
    } catch (error) {
      console.error('PostgreSQL connection error:', error.message);
      throw error;
    }
  }

  async checkTablesExist() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'counties'
        );
      `);
      return result.rows[0].exists;
    } finally {
      client.release();
    }
  }

  // Get all counties with latest research results
  async getAllCountiesWithResults(state = null, search = null, searchMode = 'general') {
    const client = await this.pool.connect();
    try {
      let whereClause = '';
      let queryParams = [];
      let paramCount = 0;

      if (state) {
        paramCount++;
        whereClause += `WHERE c.state = $${paramCount}`;
        queryParams.push(state);
      }

      if (search) {
        paramCount++;
        const searchPattern = `%${search.toLowerCase()}%`;

        let searchCondition;
        if (searchMode === 'name') {
          searchCondition = `(
            LOWER(c.municipality_name) LIKE $${paramCount} OR
            LOWER(c.county_name) LIKE $${paramCount}
          )`;
        } else {
          searchCondition = `(
            LOWER(c.municipality_name) LIKE $${paramCount} OR
            LOWER(c.county_name) LIKE $${paramCount} OR
            LOWER(c.state) LIKE $${paramCount} OR
            LOWER(lr.primary_contact_name) LIKE $${paramCount} OR
            LOWER(lr.primary_contact_phone) LIKE $${paramCount} OR
            LOWER(lr.primary_contact_email) LIKE $${paramCount} OR
            LOWER(lr.web_address) LIKE $${paramCount}
          )`;
        }

        if (whereClause) {
          whereClause += ` AND ${searchCondition}`;
        } else {
          whereClause = `WHERE ${searchCondition}`;
        }
        queryParams.push(searchPattern);
      }

      const query = `
        SELECT
          c.*,
          lr.id as research_id,
          lr.research_date,
          lr.method_used,
          lr.success,
          lr.current_tax_year,
          lr.num_installments,
          lr.due_date_1,
          lr.due_date_2,
          lr.due_date_3,
          lr.due_date_4,
          lr.due_date_5,
          lr.due_date_6,
          lr.due_date_7,
          lr.due_date_8,
          lr.due_date_9,
          lr.due_date_10,
          lr.default_delq_collector,
          lr.default_escrow_collector,
          lr.delq_search_start_date,
          lr.default_escrow_search_start_date,
          lr.tax_billing_date,
          lr.primary_contact_name,
          lr.primary_contact_title,
          lr.primary_contact_phone,
          lr.primary_contact_email,
          lr.tax_authority_physical_address,
          lr.tax_authority_mailing_address,
          lr.general_phone_number,
          lr.fax_number,
          lr.web_address,
          lr.county_website,
          lr.pay_taxes_url,
          lr.notes,
          lr.validation_score,
          CASE WHEN fea.research_id IS NOT NULL THEN true ELSE false END as has_audit_entries,
          fea.edit_count,
          fea.last_edit_date,
          CASE
            WHEN c.municipality_name IS NULL OR c.municipality_name = c.county_name
            THEN (
              SELECT COUNT(DISTINCT c2.id)
              FROM counties c2
              WHERE c2.state = c.state
                AND (c2.county_name = c.county_name OR c2.county_name || ' County' = c.county_name)
                AND c2.municipality_name IS NOT NULL
                AND c2.municipality_name != c2.county_name
            )
            ELSE NULL
          END as total_municipalities,
          CASE
            WHEN c.municipality_name IS NULL OR c.municipality_name = c.county_name
            THEN (
              SELECT COUNT(DISTINCT c2.id)
              FROM counties c2
              LEFT JOIN research_results rr2 ON rr2.county_id = c2.id
              LEFT JOIN field_edit_audit fea2 ON fea2.research_id = rr2.id
              WHERE c2.state = c.state
                AND (c2.county_name = c.county_name OR c2.county_name || ' County' = c.county_name)
                AND c2.municipality_name IS NOT NULL
                AND c2.municipality_name != c2.county_name
                AND fea2.id IS NOT NULL
            )
            ELSE NULL
          END as municipalities_with_edits,
          CASE
            WHEN c.municipality_name IS NULL OR c.municipality_name = c.county_name
            THEN (
              SELECT COUNT(DISTINCT c2.id)
              FROM counties c2
              LEFT JOIN research_results rr2 ON rr2.county_id = c2.id
              WHERE c2.state = c.state
                AND (c2.county_name = c.county_name OR c2.county_name || ' County' = c.county_name)
                AND c2.municipality_name IS NOT NULL
                AND c2.municipality_name != c2.county_name
                AND rr2.method_used = 'propagated_from_county'
            )
            ELSE NULL
          END as municipalities_propagated
        FROM counties c
        LEFT JOIN LATERAL (
          SELECT * FROM research_results
          WHERE county_id = c.id
          ORDER BY research_date DESC
          LIMIT 1
        ) lr ON true
        LEFT JOIN LATERAL (
          SELECT
            research_id,
            COUNT(*) as edit_count,
            MAX(created_at) as last_edit_date
          FROM field_edit_audit
          WHERE research_id = lr.id
          GROUP BY research_id
        ) fea ON lr.id IS NOT NULL
        ${whereClause}
        ORDER BY c.state, COALESCE(c.municipality_name, c.county_name);
      `;

      const result = await client.query(query, queryParams);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Get available states
  async getAvailableStates() {
    try {
      const result = await this.pool.query(`
        SELECT DISTINCT state, COUNT(*) as county_count
        FROM counties
        GROUP BY state
        ORDER BY state
      `);

      const stateNames = {
        'WI': 'Wisconsin',
        'IL': 'Illinois',
        'IA': 'Iowa',
        'MI': 'Michigan',
        'MN': 'Minnesota',
        'IN': 'Indiana',
        'OH': 'Ohio',
        'FL': 'Florida'
      };

      return result.rows.map(row => ({
        code: row.state,
        name: stateNames[row.state] || row.state,
        jurisdiction_count: parseInt(row.county_count)
      }));
    } catch (error) {
      console.error("Error getting states:", error);
      throw error;
    }
  }

  // Update a specific field in research results
  async updateResearchField(researchId, field, value) {
    const client = await this.pool.connect();
    try {
      let processedValue = value;
      if (field.includes('due_date') && value && typeof value === 'string') {
        const mmddyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
        const match = value.match(mmddyyPattern);
        if (match) {
          const [, month, day, year] = match;
          const fullYear = parseInt(year) + (parseInt(year) < 50 ? 2000 : 1900);
          processedValue = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      const query = `
        UPDATE research_results
        SET ${field} = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;

      await client.query(query, [processedValue, researchId]);
    } finally {
      client.release();
    }
  }

  // Get current field value (for audit logging)
  async getCurrentFieldValue(researchId, fieldName) {
    try {
      const result = await this.pool.query(`
        SELECT ${fieldName} as field_value FROM research_results WHERE id = $1
      `, [researchId]);

      return result.rows.length > 0 ? result.rows[0].field_value : null;
    } catch (error) {
      console.error("Error getting current field value:", error);
      return null;
    }
  }

  // Log field edit with before/after values
  async logFieldEdit(researchId, userId, username, fieldName, oldValue, newValue, ipAddress = null, userAgent = null, editReason = null) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO field_edit_audit (
          research_id, user_id, username, field_name, old_value, new_value,
          ip_address, user_agent, edit_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id;
      `;

      const result = await client.query(query, [
        researchId, userId, username, fieldName,
        oldValue, newValue, ipAddress, userAgent, editReason
      ]);

      return result.rows[0].id;
    } catch (error) {
      console.error("Error logging field edit:", error);
    } finally {
      client.release();
    }
  }

  // Get screenshots for a research result
  async getScreenshots(researchId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM screenshots
         WHERE research_result_id = $1
         ORDER BY created_at DESC`,
        [researchId]
      );
      return result.rows;
    } catch (error) {
      console.error("Error getting screenshots:", error);
      throw error;
    }
  }

  // Get source data for a research result
  async getSourceData(researchId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM source_data
         WHERE research_result_id = $1
         ORDER BY created_at DESC`,
        [researchId]
      );
      return result.rows;
    } catch (error) {
      console.error("Error getting source data:", error);
      throw error;
    }
  }

  // Get edit history for a specific research record
  async getFieldEditHistory(researchId) {
    try {
      const result = await this.pool.query(`
        SELECT
          fea.id,
          fea.field_name,
          fea.old_value,
          fea.new_value,
          fea.username,
          fea.edit_reason,
          fea.ip_address,
          fea.created_at
        FROM field_edit_audit fea
        WHERE fea.research_id = $1
        ORDER BY fea.created_at DESC
      `, [researchId]);

      return result.rows;
    } catch (error) {
      console.error("Error getting field edit history:", error);
      throw error;
    }
  }

  // Get installment details for a research record
  async getInstallmentDetails(researchId) {
    try {
      const result = await this.pool.query(`
        SELECT
          id,
          installment_number,
          delq_collector,
          escrow_collector,
          escrow_search_start_date,
          tax_billing_date,
          created_at,
          updated_at
        FROM installment_details
        WHERE research_id = $1
        ORDER BY installment_number
      `, [researchId]);

      return result.rows;
    } catch (error) {
      console.error("Error getting installment details:", error);
      throw error;
    }
  }

  // Upsert installment detail (create or update)
  async upsertInstallmentDetail(researchId, installmentNumber, data) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO installment_details (
          research_id, installment_number, delq_collector, escrow_collector,
          escrow_search_start_date, tax_billing_date, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (research_id, installment_number)
        DO UPDATE SET
          delq_collector = EXCLUDED.delq_collector,
          escrow_collector = EXCLUDED.escrow_collector,
          escrow_search_start_date = EXCLUDED.escrow_search_start_date,
          tax_billing_date = EXCLUDED.tax_billing_date,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const result = await client.query(query, [
        researchId,
        installmentNumber,
        data.delq_collector || null,
        data.escrow_collector || null,
        data.escrow_search_start_date || null,
        data.tax_billing_date || null
      ]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Delete installment detail
  async deleteInstallmentDetail(researchId, installmentNumber) {
    const client = await this.pool.connect();
    try {
      await client.query(
        'DELETE FROM installment_details WHERE research_id = $1 AND installment_number = $2',
        [researchId, installmentNumber]
      );
    } finally {
      client.release();
    }
  }

  // Get all research versions for a county by county_id
  async getResearchVersionsByCountyId(countyId) {
    try {
      const result = await this.pool.query(`
        SELECT
          rr.id as research_id,
          rr.research_date,
          rr.method_used,
          rr.success,
          rr.validation_score,
          rr.current_tax_year,
          rr.num_installments,
          rr.due_date_1,
          rr.due_date_2,
          rr.due_date_3,
          rr.due_date_4,
          rr.due_date_5,
          rr.due_date_6,
          rr.primary_contact_name,
          rr.primary_contact_phone,
          rr.primary_contact_email,
          rr.web_address,
          rr.created_at,
          rr.updated_at,
          (SELECT COUNT(*) FROM field_edit_audit fea WHERE fea.research_id = rr.id) as edit_count,
          (SELECT MAX(created_at) FROM field_edit_audit fea WHERE fea.research_id = rr.id) as last_edit_date
        FROM research_results rr
        WHERE rr.county_id = $1
        ORDER BY rr.research_date DESC, rr.created_at DESC
      `, [countyId]);

      return result.rows;
    } catch (error) {
      console.error("Error getting research versions:", error);
      throw error;
    }
  }

  // Get county_id from research_id
  async getCountyIdFromResearchId(researchId) {
    try {
      const result = await this.pool.query(
        'SELECT county_id FROM research_results WHERE id = $1',
        [researchId]
      );
      return result.rows.length > 0 ? result.rows[0].county_id : null;
    } catch (error) {
      console.error("Error getting county_id:", error);
      throw error;
    }
  }

  // Get full research result by ID
  async getResearchResultById(researchId) {
    try {
      const result = await this.pool.query(`
        SELECT
          rr.*,
          c.state,
          c.county_name,
          c.municipality_name,
          c.fips_code
        FROM research_results rr
        JOIN counties c ON c.id = rr.county_id
        WHERE rr.id = $1
      `, [researchId]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error("Error getting research result:", error);
      throw error;
    }
  }

  // ==================== NEW TABLE METHODS ====================

  // Get installments for a research result (new expandable table)
  async getInstallments(researchResultId) {
    try {
      const result = await this.pool.query(`
        SELECT *
        FROM installments
        WHERE research_result_id = $1
        ORDER BY installment_number
      `, [researchResultId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting installments:', error);
      throw error;
    }
  }

  // Create installment
  async createInstallment(researchResultId, data) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO installments (
          research_result_id, installment_number, due_date,
          delq_collector, escrow_collector, escrow_search_start_date,
          tax_billing_date, precommitment_date, finalize_balance_date,
          make_payment_due_date, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `;
      const result = await client.query(query, [
        researchResultId,
        data.installment_number,
        data.due_date || null,
        data.delq_collector || null,
        data.escrow_collector || null,
        data.escrow_search_start_date || null,
        data.tax_billing_date || null,
        data.precommitment_date || null,
        data.finalize_balance_date || null,
        data.make_payment_due_date || null,
        data.notes || null
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Update installment
  async updateInstallment(installmentId, data) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE installments SET
          due_date = $2,
          delq_collector = $3,
          escrow_collector = $4,
          escrow_search_start_date = $5,
          tax_billing_date = $6,
          precommitment_date = $7,
          finalize_balance_date = $8,
          make_payment_due_date = $9,
          notes = $10,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;
      const result = await client.query(query, [
        installmentId,
        data.due_date || null,
        data.delq_collector || null,
        data.escrow_collector || null,
        data.escrow_search_start_date || null,
        data.tax_billing_date || null,
        data.precommitment_date || null,
        data.finalize_balance_date || null,
        data.make_payment_due_date || null,
        data.notes || null
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Delete installment
  async deleteInstallment(installmentId) {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM installments WHERE id = $1', [installmentId]);
    } finally {
      client.release();
    }
  }

  // Get contacts for a research result
  async getContacts(researchResultId) {
    try {
      const result = await this.pool.query(`
        SELECT *
        FROM contacts
        WHERE research_result_id = $1
        ORDER BY sort_order, contact_type
      `, [researchResultId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting contacts:', error);
      throw error;
    }
  }

  // Create contact
  async createContact(researchResultId, data) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO contacts (
          research_result_id, contact_type, sort_order, name, title,
          phone, email, physical_address, mailing_address,
          general_phone, fax, website, tax_search_website, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *;
      `;
      const result = await client.query(query, [
        researchResultId,
        data.contact_type || 'primary',
        data.sort_order || 0,
        data.name || null,
        data.title || null,
        data.phone || null,
        data.email || null,
        data.physical_address || null,
        data.mailing_address || null,
        data.general_phone || null,
        data.fax || null,
        data.website || null,
        data.tax_search_website || null,
        data.notes || null
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Update contact
  async updateContact(contactId, data) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE contacts SET
          contact_type = $2,
          sort_order = $3,
          name = $4,
          title = $5,
          phone = $6,
          email = $7,
          physical_address = $8,
          mailing_address = $9,
          general_phone = $10,
          fax = $11,
          website = $12,
          tax_search_website = $13,
          notes = $14,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;
      const result = await client.query(query, [
        contactId,
        data.contact_type || 'primary',
        data.sort_order || 0,
        data.name || null,
        data.title || null,
        data.phone || null,
        data.email || null,
        data.physical_address || null,
        data.mailing_address || null,
        data.general_phone || null,
        data.fax || null,
        data.website || null,
        data.tax_search_website || null,
        data.notes || null
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Delete contact
  async deleteContact(contactId) {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM contacts WHERE id = $1', [contactId]);
    } finally {
      client.release();
    }
  }

  // Reorder contacts
  async reorderContacts(researchResultId, orderedIds) {
    const client = await this.pool.connect();
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await client.query(
          'UPDATE contacts SET sort_order = $1 WHERE id = $2 AND research_result_id = $3',
          [i, orderedIds[i], researchResultId]
        );
      }
    } finally {
      client.release();
    }
  }

  // Get fees for a research result
  async getFees(researchResultId) {
    try {
      const result = await this.pool.query(`
        SELECT *
        FROM fees
        WHERE research_result_id = $1
        ORDER BY fee_category, fee_number
      `, [researchResultId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting fees:', error);
      throw error;
    }
  }

  // Create fee
  async createFee(researchResultId, data) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO fees (
          research_result_id, fee_category, fee_number, fee_type, fee_amount, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const result = await client.query(query, [
        researchResultId,
        data.fee_category || 'delq',
        data.fee_number || 1,
        data.fee_type || null,
        data.fee_amount || null,
        data.notes || null
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Update fee
  async updateFee(feeId, data) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE fees SET
          fee_category = $2,
          fee_number = $3,
          fee_type = $4,
          fee_amount = $5,
          notes = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;
      const result = await client.query(query, [
        feeId,
        data.fee_category || 'delq',
        data.fee_number || 1,
        data.fee_type || null,
        data.fee_amount || null,
        data.notes || null
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Delete fee
  async deleteFee(feeId) {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM fees WHERE id = $1', [feeId]);
    } finally {
      client.release();
    }
  }

  // Get fee types (distinct values for dropdown)
  async getFeeTypes() {
    try {
      const result = await this.pool.query(`
        SELECT DISTINCT fee_type
        FROM fees
        WHERE fee_type IS NOT NULL
        ORDER BY fee_type
      `);
      return result.rows.map(r => r.fee_type);
    } catch (error) {
      console.error('Error getting fee types:', error);
      throw error;
    }
  }

  // Get contact types (distinct values for dropdown)
  async getContactTypes() {
    try {
      const result = await this.pool.query(`
        SELECT DISTINCT contact_type
        FROM contacts
        WHERE contact_type IS NOT NULL
        ORDER BY
          CASE contact_type
            WHEN 'primary' THEN 1
            WHEN 'secondary' THEN 2
            WHEN 'billing' THEN 3
            WHEN 'technical' THEN 4
            WHEN 'emergency' THEN 5
            ELSE 6
          END
      `);
      return result.rows.map(r => r.contact_type);
    } catch (error) {
      console.error('Error getting contact types:', error);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = PostgresDatabase;
