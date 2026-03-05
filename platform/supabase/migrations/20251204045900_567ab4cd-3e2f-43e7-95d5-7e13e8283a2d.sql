-- Add mask_regions column to post_unlock_rules table
-- This stores an array of rectangular regions to mask (x%, y%, width%, height%)
ALTER TABLE post_unlock_rules 
ADD COLUMN IF NOT EXISTS mask_regions JSONB DEFAULT '[]'::jsonb;