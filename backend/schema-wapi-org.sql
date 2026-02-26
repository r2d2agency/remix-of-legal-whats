-- Add wapi_token to organizations table for account-level W-API integration
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'wapi_token'
    ) THEN
        ALTER TABLE organizations 
        ADD COLUMN wapi_token TEXT;
        
        COMMENT ON COLUMN organizations.wapi_token IS 'W-API account token for automatic instance provisioning';
    END IF;
END $$;
