-- Migration 004: Payment Info fields on research_results
-- Adds 24 new columns for the Payment Information tab

-- Providing Amounts
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_preferred_method VARCHAR(255);

-- Paying on Multiple Parcels
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_bulk_upload_allowed BOOLEAN;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_bulk_upload_format TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_tax_roll_required BOOLEAN;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_tax_roll_cost VARCHAR(100);

-- Third Party Payment Co.
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_third_party_name VARCHAR(255);
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_third_party_fee VARCHAR(100);
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_third_party_file_format TEXT;

-- Tax Bill Requirements
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_original_bill_required BOOLEAN;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_how_to_obtain_bill TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_duplicate_bill_fee_yn BOOLEAN;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_duplicate_bill_fee VARCHAR(100);

-- PreCommit
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_precommit_required BOOLEAN;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_precommit_file_format TEXT;

-- Payment Methods Accepted
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_method_wire BOOLEAN;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_method_ach BOOLEAN;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_method_check BOOLEAN;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_method_other VARCHAR(255);

-- Payment Instructions (internal only, not surveyable)
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_wire_instructions TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_ach_instructions TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_check_instructions TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_other_instructions TEXT;

-- Payment Contact & Notes
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_wire_ach_contact_name VARCHAR(255);
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_wire_ach_contact_info VARCHAR(255);
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS pmt_notes TEXT;
