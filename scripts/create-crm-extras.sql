-- Extra CRM columns
DO $$ BEGIN
  -- Contacts extras
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='cargo') THEN
    ALTER TABLE contacts ADD COLUMN cargo text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='linkedin_url') THEN
    ALTER TABLE contacts ADD COLUMN linkedin_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='idioma') THEN
    ALTER TABLE contacts ADD COLUMN idioma text DEFAULT 'es';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='tags') THEN
    ALTER TABLE contacts ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='custom_fields') THEN
    ALTER TABLE contacts ADD COLUMN custom_fields jsonb DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='last_email_opened_at') THEN
    ALTER TABLE contacts ADD COLUMN last_email_opened_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='last_email_clicked_at') THEN
    ALTER TABLE contacts ADD COLUMN last_email_clicked_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='email_engagement_score') THEN
    ALTER TABLE contacts ADD COLUMN email_engagement_score int DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='total_revenue') THEN
    ALTER TABLE contacts ADD COLUMN total_revenue decimal(12,2) DEFAULT 0;
  END IF;

  -- Companies extras
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='tags') THEN
    ALTER TABLE companies ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='industry_size') THEN
    ALTER TABLE companies ADD COLUMN industry_size text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='annual_contract_value') THEN
    ALTER TABLE companies ADD COLUMN annual_contract_value decimal(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='payment_status') THEN
    ALTER TABLE companies ADD COLUMN payment_status text DEFAULT 'al_dia';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='days_overdue') THEN
    ALTER TABLE companies ADD COLUMN days_overdue int DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='last_invoice_date') THEN
    ALTER TABLE companies ADD COLUMN last_invoice_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='next_invoice_date') THEN
    ALTER TABLE companies ADD COLUMN next_invoice_date date;
  END IF;
END $$;
