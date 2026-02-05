-- Migration: Add scraper_page_url and pmt_amounts_contact_info fields
-- Date: 2026-02-04
-- Description: Add new fields for contact scraper page URL and payment amounts contact info

-- Add scraper_page_url to research_results table
ALTER TABLE research_results
  ADD COLUMN IF NOT EXISTS scraper_page_url TEXT;

-- Add scraper_page_url to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS scraper_page_url TEXT;

-- Add pmt_amounts_contact_info to payment section
-- This field stores URL, phone, or email based on pmt_preferred_method
ALTER TABLE research_results
  ADD COLUMN IF NOT EXISTS pmt_amounts_contact_info TEXT;

-- Add comments for documentation
COMMENT ON COLUMN research_results.scraper_page_url IS 'URL to the scraper page for this jurisdiction';
COMMENT ON COLUMN contacts.scraper_page_url IS 'URL to the scraper page for this contact';
COMMENT ON COLUMN research_results.pmt_amounts_contact_info IS 'Contact information for providing payment amounts (URL, phone, or email based on pmt_preferred_method)';
