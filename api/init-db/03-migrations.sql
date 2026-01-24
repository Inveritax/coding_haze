-- Migration: Add new tables and columns for Tax Agency Hub restructure
-- Version: 2026-01-23
-- This migration is idempotent - safe to run multiple times

-- ============================================
-- NEW TABLES
-- ============================================

-- Installments table (replaces due_date_1-10)
CREATE TABLE IF NOT EXISTS installments (
    id SERIAL PRIMARY KEY,
    research_result_id INTEGER REFERENCES research_results(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE,
    delq_collector VARCHAR(255),
    escrow_collector VARCHAR(255),
    escrow_search_start_date DATE,
    tax_billing_date DATE,
    precommitment_date DATE,
    finalize_balance_date DATE,
    make_payment_due_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(research_result_id, installment_number)
);
CREATE INDEX IF NOT EXISTS idx_installments_research_result_id ON installments(research_result_id);

-- Contacts table (replaces fixed primary contact fields)
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    research_result_id INTEGER REFERENCES research_results(id) ON DELETE CASCADE,
    contact_type VARCHAR(50) DEFAULT 'primary', -- 'primary', 'secondary', 'billing', 'technical', 'emergency', 'other'
    sort_order INTEGER DEFAULT 0,
    name VARCHAR(255),
    title VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    physical_address TEXT,
    mailing_address TEXT,
    general_phone VARCHAR(50),
    fax VARCHAR(50),
    website VARCHAR(500),
    tax_search_website VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contacts_research_result_id ON contacts(research_result_id);

-- Fees table (pass-through fees)
CREATE TABLE IF NOT EXISTS fees (
    id SERIAL PRIMARY KEY,
    research_result_id INTEGER REFERENCES research_results(id) ON DELETE CASCADE,
    fee_category VARCHAR(50), -- 'delq', 'escrow'
    fee_number INTEGER DEFAULT 1, -- 1, 2, etc. for multiple fees
    fee_type VARCHAR(255), -- Dropdown with ability to add values
    fee_amount DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fees_research_result_id ON fees(research_result_id);

-- ============================================
-- NEW COLUMNS ON research_results
-- ============================================

-- Dates tab fields
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS search_by_installments BOOLEAN DEFAULT FALSE;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS tax_dates_notes TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS full_year_due_date DATE;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS full_year_precommitment_date DATE;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS full_year_finalize_balance_date DATE;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS full_year_make_payment_due_date DATE;

-- Tax Key Format tab fields
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS tax_key_format_masked VARCHAR(100);
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS tax_key_format_unmasked VARCHAR(100);
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS alt_tax_key_format_masked VARCHAR(100);
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS alt_tax_key_format_unmasked VARCHAR(100);
