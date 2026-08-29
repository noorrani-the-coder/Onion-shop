import { apiUrl } from './config';
import {
  ArrivalsBoardData,
  ExtractionResponse,
  MarketReportNormalized,
  PosterGenerationResponse,
  ReportRecord,
  ShopSettings
} from '@shared/types';

// Poster paths come back server-relative ('/posters/x.png'). Resolve them once here
// so every screen — and the Android WebView, which has no proxy — can load them.
function withAbsoluteImagePath<T extends { imagePath?: string }>(report: T): T {
  return report?.imagePath ? { ...report, imagePath: apiUrl(report.imagePath) } : report;
}

export const api = {
  // Extract market report from WhatsApp text
  async extractReport(message: string): Promise<ExtractionResponse> {
    const res = await fetch(apiUrl('/api/reports/extract'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to extract report');
    }
    return res.json();
  },

  // Generate 1080x1920 Poster
  async generatePoster(params: {
    reportId?: string;
    rawMessage?: string;
    extractedData?: MarketReportNormalized;
    data: MarketReportNormalized;
    settings?: Partial<ShopSettings>;
  }): Promise<PosterGenerationResponse> {
    const res = await fetch(apiUrl('/api/reports/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate poster');
    }
    return res.json();
  },

  // Get all past reports
  async getReports(): Promise<ReportRecord[]> {
    const res = await fetch(apiUrl('/api/reports'));
    if (!res.ok) throw new Error('Failed to fetch reports');
    const data = await res.json();
    return (data.reports || []).map(withAbsoluteImagePath);
  },

  // Get single report
  async getReportById(id: string): Promise<ReportRecord> {
    const res = await fetch(apiUrl(`/api/reports/${id}`));
    if (!res.ok) throw new Error('Failed to fetch report');
    const data = await res.json();
    return withAbsoluteImagePath(data.report);
  },

  // Delete report
  async deleteReport(id: string): Promise<void> {
    const res = await fetch(apiUrl(`/api/reports/${id}`), { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete report');
  },

  // Get Shop Settings
  async getSettings(): Promise<ShopSettings> {
    const res = await fetch(apiUrl('/api/settings'));
    if (!res.ok) throw new Error('Failed to fetch shop settings');
    const data = await res.json();
    return data.settings;
  },

  // Update Shop Settings
  async updateSettings(settings: Partial<ShopSettings>): Promise<ShopSettings> {
    const res = await fetch(apiUrl('/api/settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to save settings');
    const data = await res.json();
    return data.settings;
  },

  /**
   * Read a market report out of a photograph or screenshot.
   *
   * Returns the same shape as extractReport, with rawMessage set to the text
   * that was read off the image — so the verify screen shows what the figures
   * came from and the rest of the flow is unchanged.
   */
  async extractReportFromImage(
    file: File
  ): Promise<ExtractionResponse & { kind?: 'rates' | 'arrivals'; arrivals?: ArrivalsBoardData }> {
    const body = new FormData();
    body.append('image', file);

    const res = await fetch(apiUrl('/api/reports/extract-image'), { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || 'Could not read a report from that image.');
    }
    return data;
  },

  /**
   * Render an arrivals board (products, bags, vehicles) — a different report
   * from the rate poster, with its own data and its own renderer.
   */
  async generateArrivalsBoard(data: ArrivalsBoardData): Promise<{
    imageUrl: string;
    width: number;
    height: number;
  }> {
    const res = await fetch(apiUrl('/api/arrivals/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Could not build the arrivals board.');
    }
    return { ...json, imageUrl: apiUrl(json.imageUrl) };
  },
  /**
   * Wrap a picture the user picked in the shop's header and footer bands.
   *
   * Sent as multipart rather than JSON: the file goes up as bytes instead of
   * a base64 string a third larger, which matters on a mandi phone's data.
   * No Content-Type header is set on purpose — the browser has to add its own
   * multipart boundary, and setting it by hand breaks the upload.
   */
  async brandImage(file: File): Promise<{
    imageUrl: string;
    width: number;
    height: number;
    source: { width: number; height: number; format: string };
  }> {
    const body = new FormData();
    body.append('image', file);

    const res = await fetch(apiUrl('/api/branded/generate'), { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Could not add your details to that image.');
    }
    return { ...data, imageUrl: apiUrl(data.imageUrl) };
  }
};
