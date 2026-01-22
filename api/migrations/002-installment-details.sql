-- Migration: Add installment details and general collection settings
-- This adds per-installment collector/escrow fields and general collection settings

-- Add general collection settings to research_results
ALTER TABLE research_results
ADD COLUMN IF NOT EXISTS default_delq_collector VARCHAR(255),
ADD COLUMN IF NOT EXISTS default_escrow_collector VARCHAR(255),
ADD COLUMN IF NOT EXISTS default_escrow_search_start_date DATE,
ADD COLUMN IF NOT EXISTS tax_billing_date DATE;

-- Note: delq_search_start_date already exists in research_results

-- Create installment_details table for per-installment settings
-- This allows each installment to have its own collector and date settings
CREATE TABLE IF NOT EXISTS installment_details (
    id SERIAL PRIMARY KEY,
    research_id INTEGER NOT NULL REFERENCES research_results(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL CHECK (installment_number BETWEEN 1 AND 10),

    -- Collector settings (can override defaults)
    delq_collector VARCHAR(255),
    escrow_collector VARCHAR(255),

    -- Date settings
    escrow_search_start_date DATE,
    tax_billing_date DATE,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Each research record can only have one entry per installment number
    UNIQUE(research_id, installment_number)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_installment_details_research_id ON installment_details(research_id);

-- Add comments for documentation
COMMENT ON TABLE installment_details IS 'Per-installment collector and date settings that can override general defaults';
COMMENT ON COLUMN installment_details.delq_collector IS 'Delinquent tax collector for this installment (overrides default_delq_collector)';
COMMENT ON COLUMN installment_details.escrow_collector IS 'Escrow collector for this installment (overrides default_escrow_collector)';
COMMENT ON COLUMN research_results.default_delq_collector IS 'Default delinquent collector for all installments';
COMMENT ON COLUMN research_results.default_escrow_collector IS 'Default escrow collector for all installments';
