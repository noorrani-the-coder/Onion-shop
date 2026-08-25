import fs from 'fs';
import path from 'path';
import { MarketReportNormalized, ReportRecord, ShopSettings } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from './supabase';
import { DATA_DIR } from '../paths';

const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'SRI MANJUNATHA ONION TRADERS',
  proprietorName: 'M. Ramesh & Sons',
  phone: '+91 98450 12345',
  phoneContactName: '',
  whatsapp: '+91 98450 12345',
  whatsappContactName: '',
  apmcAddress: 'Shop No. 42, APMC Yard, Yeshwanthpur, Bengaluru - 560022',
  licenseNo: 'APMC/BLR/2018/8492',
  footerTagline: 'Commission Agents & Wholesale Onion Merchants • Daily Fresh Supply',
  logoUrl: null,
  themeId: 'emerald-classic'
};

class Database {
  private reports: ReportRecord[] = [];
  private settings: ShopSettings = { ...DEFAULT_SETTINGS };
  private initialized = false;

  constructor() {
    this.loadLocal();
    if (isSupabaseConfigured) {
      this.syncFromSupabase();
    }
  }

  private loadLocal(): void {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      } else {
        this.saveLocalSettings();
      }

      if (fs.existsSync(REPORTS_FILE)) {
        const raw = fs.readFileSync(REPORTS_FILE, 'utf-8');
        this.reports = JSON.parse(raw);
      } else {
        this.saveLocalReports();
      }
    } catch (err) {
      console.error('Error loading local database files:', err);
    }
  }

  private saveLocalReports(): void {
    try {
      fs.writeFileSync(REPORTS_FILE, JSON.stringify(this.reports, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save reports locally:', err);
    }
  }

  private saveLocalSettings(): void {
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save settings locally:', err);
    }
  }

  private async syncFromSupabase(): Promise<void> {
    if (!supabase) return;
    try {
      // Sync Settings
      const { data: settingsRow, error: setErr } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'default_shop')
        .maybeSingle();

      if (setErr) {
        console.warn('Supabase settings fetch warning:', setErr.message);
      } else if (settingsRow) {
        this.settings = {
          shopName: settingsRow.shop_name || DEFAULT_SETTINGS.shopName,
          proprietorName: settingsRow.proprietor_name || DEFAULT_SETTINGS.proprietorName,
          phone: settingsRow.phone || DEFAULT_SETTINGS.phone,
          whatsapp: settingsRow.whatsapp || DEFAULT_SETTINGS.whatsapp,
          apmcAddress: settingsRow.apmc_address || DEFAULT_SETTINGS.apmcAddress,
          licenseNo: settingsRow.license_no || DEFAULT_SETTINGS.licenseNo,
          footerTagline: settingsRow.footer_tagline || DEFAULT_SETTINGS.footerTagline,
          logoUrl: settingsRow.logo_url || null,
          themeId: settingsRow.theme_id || DEFAULT_SETTINGS.themeId,
          customAccentColor: settingsRow.custom_accent_color || undefined
        };
        this.saveLocalSettings();
      }

      // Sync Reports
      const { data: reportRows, error: repErr } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (repErr) {
        console.warn('Supabase reports fetch warning:', repErr.message);
      } else if (reportRows && reportRows.length > 0) {
        this.reports = reportRows.map(r => ({
          id: r.id,
          rawMessage: r.raw_message,
          extractedData: r.extracted_data,
          editedData: r.edited_data,
          imagePath: r.image_path,
          reportDate: r.report_date,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
        this.saveLocalReports();
      }
      this.initialized = true;
    } catch (err) {
      console.warn('Supabase sync error (falling back to local cache):', err);
    }
  }

  public async getSettings(): Promise<ShopSettings> {
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'default_shop')
          .maybeSingle();

        if (!error && data) {
          this.settings = {
            shopName: data.shop_name || DEFAULT_SETTINGS.shopName,
            proprietorName: data.proprietor_name || DEFAULT_SETTINGS.proprietorName,
            phone: data.phone || DEFAULT_SETTINGS.phone,
            whatsapp: data.whatsapp || DEFAULT_SETTINGS.whatsapp,
            apmcAddress: data.apmc_address || DEFAULT_SETTINGS.apmcAddress,
            licenseNo: data.license_no || DEFAULT_SETTINGS.licenseNo,
            footerTagline: data.footer_tagline || DEFAULT_SETTINGS.footerTagline,
            logoUrl: data.logo_url || null,
            themeId: data.theme_id || DEFAULT_SETTINGS.themeId,
            customAccentColor: data.custom_accent_color || undefined
          };
          this.saveLocalSettings();
        }
      } catch (err) {
        console.warn('Error querying Supabase settings:', err);
      }
    }
    return { ...this.settings };
  }

  public getSettingsSync(): ShopSettings {
    return { ...this.settings };
  }

  public async updateSettings(newSettings: Partial<ShopSettings>): Promise<ShopSettings> {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    this.saveLocalSettings();

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('settings')
          .upsert({
            id: 'default_shop',
            shop_name: this.settings.shopName,
            proprietor_name: this.settings.proprietorName,
            phone: this.settings.phone,
            whatsapp: this.settings.whatsapp,
            apmc_address: this.settings.apmcAddress,
            license_no: this.settings.licenseNo,
            footer_tagline: this.settings.footerTagline,
            logo_url: this.settings.logoUrl || null,
            theme_id: this.settings.themeId,
            custom_accent_color: this.settings.customAccentColor || null,
            updated_at: new Date().toISOString()
          });
      } catch (err) {
        console.error('Error updating settings in Supabase:', err);
      }
    }

    return { ...this.settings };
  }

  public async getAllReports(): Promise<ReportRecord[]> {
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          this.reports = data.map(r => ({
            id: r.id,
            rawMessage: r.raw_message,
            extractedData: r.extracted_data,
            editedData: r.edited_data,
            imagePath: r.image_path,
            reportDate: r.report_date,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));
          this.saveLocalReports();
        }
      } catch (err) {
        console.warn('Error querying Supabase reports:', err);
      }
    }

    return [...this.reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async getReportById(id: string): Promise<ReportRecord | null> {
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            rawMessage: data.raw_message,
            extractedData: data.extracted_data,
            editedData: data.edited_data,
            imagePath: data.image_path,
            reportDate: data.report_date,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
        }
      } catch (err) {
        console.warn('Error querying Supabase report by id:', err);
      }
    }

    const report = this.reports.find(r => r.id === id);
    return report ? { ...report } : null;
  }

  public async createOrUpdateReport(params: {
    id?: string;
    rawMessage: string;
    extractedData: MarketReportNormalized;
    editedData: MarketReportNormalized;
    imagePath?: string | null;
    reportDate?: string;
  }): Promise<ReportRecord> {
    const now = new Date().toISOString();
    const id = params.id || uuidv4();
    const reportDate = params.reportDate || params.editedData.reportDate || params.extractedData.reportDate || now.split('T')[0];

    const existingIndex = this.reports.findIndex(r => r.id === id);

    const record: ReportRecord = {
      id,
      rawMessage: params.rawMessage,
      extractedData: params.extractedData,
      editedData: params.editedData,
      imagePath: params.imagePath !== undefined ? params.imagePath : (existingIndex >= 0 ? this.reports[existingIndex].imagePath : null),
      reportDate,
      createdAt: existingIndex >= 0 ? this.reports[existingIndex].createdAt : now,
      updatedAt: now
    };

    if (existingIndex >= 0) {
      this.reports[existingIndex] = record;
    } else {
      this.reports.unshift(record);
    }

    this.saveLocalReports();

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('reports')
          .upsert({
            id: record.id,
            raw_message: record.rawMessage,
            extracted_data: record.extractedData,
            edited_data: record.editedData,
            image_path: record.imagePath,
            report_date: record.reportDate,
            created_at: record.createdAt,
            updated_at: record.updatedAt
          });
      } catch (err) {
        console.error('Error saving report to Supabase:', err);
      }
    }

    return record;
  }

  public async updateReportImage(id: string, imagePath: string): Promise<ReportRecord | null> {
    const existingIndex = this.reports.findIndex(r => r.id === id);
    if (existingIndex < 0) return null;

    this.reports[existingIndex].imagePath = imagePath;
    this.reports[existingIndex].updatedAt = new Date().toISOString();
    this.saveLocalReports();

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('reports')
          .update({
            image_path: imagePath,
            updated_at: this.reports[existingIndex].updatedAt
          })
          .eq('id', id);
      } catch (err) {
        console.error('Error updating report image in Supabase:', err);
      }
    }

    return { ...this.reports[existingIndex] };
  }

  public async deleteReport(id: string): Promise<boolean> {
    const prevLen = this.reports.length;
    this.reports = this.reports.filter(r => r.id !== id);
    const deleted = this.reports.length !== prevLen;

    if (deleted) {
      this.saveLocalReports();
      if (supabase && isSupabaseConfigured) {
        try {
          await supabase.from('reports').delete().eq('id', id);
        } catch (err) {
          console.error('Error deleting report from Supabase:', err);
        }
      }
      return true;
    }
    return false;
  }
}

export const db = new Database();
