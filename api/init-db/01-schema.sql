-- Tax Scraper Database Schema
-- This creates all tables needed for the minimal API

-- Counties table
CREATE TABLE IF NOT EXISTS counties (
    id SERIAL PRIMARY KEY,
    state VARCHAR(10) NOT NULL,
    municipality_name VARCHAR(255),
    county_name VARCHAR(255) NOT NULL,
    fips_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(state, county_name, municipality_name)
);

-- Research results table (matches backup schema exactly)
CREATE TABLE IF NOT EXISTS research_results (
    id SERIAL PRIMARY KEY,
    county_id INTEGER NOT NULL REFERENCES counties(id),
    research_date TIMESTAMP,
    method_used VARCHAR(100) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    tax_year VARCHAR(20),
    tax_year_rollover_date DATE,
    delq_search_start_date DATE,
    default_delq_collector VARCHAR(255),
    default_escrow_collector VARCHAR(255),
    default_escrow_search_start_date DATE,
    tax_billing_date DATE,
    current_tax_year VARCHAR(20),
    num_installments VARCHAR(20),
    due_date_1 DATE,
    due_date_2 DATE,
    due_date_3 DATE,
    due_date_4 DATE,
    due_date_5 DATE,
    due_date_6 DATE,
    due_date_7 DATE,
    due_date_8 DATE,
    due_date_9 DATE,
    due_date_10 DATE,
    primary_contact_name VARCHAR(255),
    primary_contact_title VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    primary_contact_email VARCHAR(255),
    tax_authority_physical_address TEXT,
    tax_authority_mailing_address TEXT,
    general_phone_number VARCHAR(50),
    fax_number VARCHAR(50),
    web_address VARCHAR(500),
    county_website VARCHAR(500),
    pay_taxes_url VARCHAR(500),
    notes TEXT,
    data_source_method VARCHAR(100),
    research_count INTEGER,
    is_research_locked BOOLEAN,
    validation_score INTEGER,
    validation_confidence VARCHAR(20),
    validation_issues TEXT,
    -- Payment Info fields
    pmt_preferred_method VARCHAR(255),
    pmt_bulk_upload_allowed BOOLEAN,
    pmt_bulk_upload_format TEXT,
    pmt_tax_roll_required BOOLEAN,
    pmt_tax_roll_cost VARCHAR(100),
    pmt_third_party_name VARCHAR(255),
    pmt_third_party_fee VARCHAR(100),
    pmt_third_party_file_format TEXT,
    pmt_original_bill_required BOOLEAN,
    pmt_how_to_obtain_bill TEXT,
    pmt_duplicate_bill_fee_yn BOOLEAN,
    pmt_duplicate_bill_fee VARCHAR(100),
    pmt_precommit_required BOOLEAN,
    pmt_precommit_file_format TEXT,
    pmt_method_wire BOOLEAN,
    pmt_method_ach BOOLEAN,
    pmt_method_check BOOLEAN,
    pmt_method_other VARCHAR(255),
    pmt_wire_instructions TEXT,
    pmt_ach_instructions TEXT,
    pmt_check_instructions TEXT,
    pmt_other_instructions TEXT,
    pmt_wire_ach_contact_name VARCHAR(255),
    pmt_wire_ach_contact_info VARCHAR(255),
    pmt_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    refresh_token TEXT NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auth audit log
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invite codes table
CREATE TABLE IF NOT EXISTS invite_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255),
    created_by INTEGER REFERENCES users(id),
    used_by INTEGER REFERENCES users(id),
    used_at TIMESTAMP,
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Field edit audit table
CREATE TABLE IF NOT EXISTS field_edit_audit (
    id SERIAL PRIMARY KEY,
    research_id INTEGER REFERENCES research_results(id),
    user_id INTEGER,
    username VARCHAR(100),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    edit_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Screenshots table
CREATE TABLE IF NOT EXISTS screenshots (
    id SERIAL PRIMARY KEY,
    research_result_id INTEGER REFERENCES research_results(id),
    filename VARCHAR(500),
    url VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Source data table
CREATE TABLE IF NOT EXISTS source_data (
    id SERIAL PRIMARY KEY,
    research_result_id INTEGER REFERENCES research_results(id),
    tracking_detail_id INTEGER,
    data_type VARCHAR(50),
    content TEXT,
    url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collectors table (empty but needed for schema)
CREATE TABLE IF NOT EXISTS collectors (
    id SERIAL PRIMARY KEY,
    county_id INTEGER REFERENCES counties(id),
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manual notes table
CREATE TABLE IF NOT EXISTS manual_notes (
    id SERIAL PRIMARY KEY,
    research_result_id INTEGER REFERENCES research_results(id),
    note TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Research tracking details (empty but needed for schema)
CREATE TABLE IF NOT EXISTS research_tracking_details (
    id SERIAL PRIMARY KEY,
    research_result_id INTEGER REFERENCES research_results(id),
    county_id INTEGER REFERENCES counties(id),
    inveritax_name VARCHAR(255),
    inveritax_phone VARCHAR(50),
    inveritax_email VARCHAR(255),
    inveritax_title VARCHAR(255),
    scraped_name VARCHAR(255),
    scraped_phone VARCHAR(50),
    scraped_email VARCHAR(255),
    scraped_title VARCHAR(255),
    name_match BOOLEAN,
    phone_match BOOLEAN,
    email_match BOOLEAN,
    overall_match BOOLEAN,
    match_confidence DECIMAL(5,2),
    primary_method VARCHAR(100),
    fallback_methods TEXT[],
    final_method_used VARCHAR(100),
    scraping_steps JSONB,
    model_used VARCHAR(100),
    api_calls_made INTEGER,
    total_tokens_used INTEGER,
    estimated_cost DECIMAL(10,4),
    search_urls TEXT[],
    source_urls TEXT[],
    ai_search_queries TEXT[],
    search_duration_ms INTEGER,
    total_duration_ms INTEGER,
    error_occurred BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    error_type VARCHAR(100),
    used_playwright BOOLEAN DEFAULT FALSE,
    used_ai_overview BOOLEAN DEFAULT FALSE,
    used_county_directory BOOLEAN DEFAULT FALSE,
    domain_filter_disabled BOOLEAN DEFAULT FALSE,
    ai_overview_first BOOLEAN DEFAULT FALSE,
    notes TEXT,
    ai_quality_notes TEXT,
    manual_review_needed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Research comparisons table
CREATE TABLE IF NOT EXISTS research_comparisons (
    id SERIAL PRIMARY KEY,
    research_result_id INTEGER REFERENCES research_results(id),
    original_data JSONB,
    new_data JSONB,
    comparison_metadata JSONB,
    research_model VARCHAR(100),
    research_options JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    applied_selections JSONB,
    applied_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom prompts table
CREATE TABLE IF NOT EXISTS custom_prompts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    prompt_template TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom prompt fields table
CREATE TABLE IF NOT EXISTS custom_prompt_fields (
    id SERIAL PRIMARY KEY,
    prompt_id INTEGER REFERENCES custom_prompts(id),
    field_name VARCHAR(100),
    display_name VARCHAR(255),
    field_type VARCHAR(50),
    display_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom research results table
CREATE TABLE IF NOT EXISTS custom_research_results (
    id SERIAL PRIMARY KEY,
    research_result_id INTEGER REFERENCES research_results(id),
    prompt_id INTEGER REFERENCES custom_prompts(id),
    field_name VARCHAR(100),
    field_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- County treasurers table (empty)
CREATE TABLE IF NOT EXISTS county_treasurers (
    id SERIAL PRIMARY KEY,
    county_id INTEGER REFERENCES counties(id),
    name VARCHAR(255),
    title VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Field mappings table
CREATE TABLE IF NOT EXISTS field_mappings (
    id SERIAL PRIMARY KEY,
    research_id INTEGER REFERENCES research_results(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    selector TEXT,
    confidence DECIMAL(3,2),
    type VARCHAR(20) DEFAULT 'element',
    specificity INTEGER,
    alternatives JSONB,
    transformations JSONB,
    text_transformations JSONB,
    example_text TEXT,
    source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(research_id, field_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_counties_state ON counties(state);
CREATE INDEX IF NOT EXISTS idx_counties_county_name ON counties(county_name);
CREATE INDEX IF NOT EXISTS idx_research_results_county_id ON research_results(county_id);
CREATE INDEX IF NOT EXISTS idx_field_edit_audit_research_id ON field_edit_audit(research_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_research_id ON field_mappings(research_id);
