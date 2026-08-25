-- ==========================================================
-- Supabase Database Schema for Onion & Mandi Market Poster App
-- Run this in your Supabase SQL Editor
-- ==========================================================

-- 1. Create 'settings' table
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'default_shop',
    shop_name TEXT NOT NULL DEFAULT 'SRI MANJUNATHA ONION TRADERS',
    proprietor_name TEXT DEFAULT 'M. Ramesh & Sons',
    phone TEXT DEFAULT '+91 98450 12345',
    whatsapp TEXT DEFAULT '+91 98450 12345',
    apmc_address TEXT DEFAULT 'Shop No. 42, APMC Yard, Yeshwanthpur, Bengaluru - 560022',
    license_no TEXT DEFAULT 'APMC/BLR/2018/8492',
    footer_tagline TEXT DEFAULT 'Commission Agents & Wholesale Onion Merchants • Daily Fresh Supply',
    logo_url TEXT,
    theme_id TEXT DEFAULT 'emerald-classic',
    custom_accent_color TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial shop settings if not existing
INSERT INTO public.settings (
    id, shop_name, proprietor_name, phone, whatsapp, apmc_address, license_no, footer_tagline, theme_id
) VALUES (
    'default_shop',
    'SRI MANJUNATHA ONION TRADERS',
    'M. Ramesh & Sons',
    '+91 98450 12345',
    '+91 98450 12345',
    'Shop No. 42, APMC Yard, Yeshwanthpur, Bengaluru - 560022',
    'APMC/BLR/2018/8492',
    'Commission Agents & Wholesale Onion Merchants • Daily Fresh Supply',
    'emerald-classic'
) ON CONFLICT (id) DO NOTHING;

-- 2. Create 'reports' table
CREATE TABLE IF NOT EXISTS public.reports (
    id TEXT PRIMARY KEY,
    raw_message TEXT NOT NULL DEFAULT '',
    extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    edited_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    image_path TEXT,
    report_date TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for high performance queries
CREATE INDEX IF NOT EXISTS idx_reports_report_date ON public.reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- 3. Enable Row Level Security (RLS) and Allow Public/Anon Access (or Service Role)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on settings"
ON public.settings FOR SELECT USING (true);

CREATE POLICY "Allow public update/insert on settings"
ON public.settings FOR ALL USING (true);

CREATE POLICY "Allow public read on reports"
ON public.reports FOR SELECT USING (true);

CREATE POLICY "Allow public insert/update/delete on reports"
ON public.reports FOR ALL USING (true);
