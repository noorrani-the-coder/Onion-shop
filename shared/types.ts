export interface PriceRange {
  min: number;
  max: number;
  display: string;
}

export interface ArrivalCount {
  value: number;
  display: string;
}

/**
 * One label/rate line inside a section ("BIG QUALITY  4800-5000").
 */
export interface ReportRow {
  label: string;
  rate: PriceRange | null;
}

/**
 * A titled block of rows, exactly as the message laid it out.
 *
 * Sections are read by SHAPE, not by name: a line carrying no rate opens a
 * section, and the label/rate lines under it belong to it. Nothing in the code
 * knows the word "Maharashtra" - so a message that says "Nashik", "Bangalore"
 * or a heading invented next season renders without a code change, and a rate
 * can never be attributed to a section it was not written under.
 */
export interface ReportSection {
  title: string;
  /**
   * An arrival count written on the heading itself ("New onions 15,000+ bags").
   * Kept apart from the title so the heading stays a heading and the count can
   * be shown as its own row.
   */
  count?: string | null;
  rows: ReportRow[];
}

export interface MaharashtraRates {
  extraBig: PriceRange | null;
  big: PriceRange | null;
  mukkal: PriceRange | null;
  medium: PriceRange | null;
  golta: PriceRange | null;
  golty: PriceRange | null;
  chopda: PriceRange | null;
  averageQuality: PriceRange | null;
}

export interface VijayapuraRates {
  rate: PriceRange | null;
}

/**
 * One grade row under NEW ONIONS ("Medium 4200-4800", "Pickle size 1800-3000").
 *
 * The grades traders quote here are not a fixed set the way the Maharashtra
 * ones are - a message may carry medium/golta/golty one day and add pickle
 * size the next - so they are kept as a list and rendered in the order the
 * message listed them, rather than mapped onto named fields.
 */
export interface NewOnionGrade {
  label: string;
  rate: PriceRange | null;
}

export interface NewOnionRates {
  state: string | null;
  bagCount: string | null;
  /** Per-grade rows, in message order. Empty when the message quoted a single rate. */
  grades: NewOnionGrade[];
  rate: PriceRange | null;
  lotRate: PriceRange | null;
}

export interface CommodityItem {
  id?: string;
  name: string;
  variety?: string | null;
  rate: PriceRange | null;
  unit?: string | null;
  isHighlight?: boolean;
}

export interface ConfidenceScores {
  overall: 'high' | 'medium' | 'low';
  date: 'high' | 'medium' | 'low';
  market: 'high' | 'medium' | 'low';
  arrivals: 'high' | 'medium' | 'low';
  maharashtra: 'high' | 'medium' | 'low';
  vijayapura: 'high' | 'medium' | 'low';
  newOnions: 'high' | 'medium' | 'low';
  commodities?: 'high' | 'medium' | 'low';
  salesStatus: 'high' | 'medium' | 'low';
  weather: 'high' | 'medium' | 'low';
}

export interface MarketReportNormalized {
  /**
   * What produced this record. Absent means a parsed rate report, which is
   * every record written before branded uploads existed — so History must
   * treat undefined as 'rates' rather than as missing data.
   */
  sourceKind?: 'rates' | 'branded-upload';
  reportDate: string | null; // ISO YYYY-MM-DD
  reportDateDisplay: string | null; // Formatted DD.MM.YYYY
  market: string | null;
  totalArrivals: ArrivalCount | null;
  truckCount: string | null;

  /**
   * Every section the message contained, in message order. This is the source
   * of truth for rendering; the named fields below are kept so reports stored
   * before sections existed still load and render.
   */
  sections: ReportSection[];

  maharashtra: MaharashtraRates;
  vijayapura: VijayapuraRates;
  newOnions: NewOnionRates;
  commodities?: CommodityItem[];

  salesStatus: string | null;
  weather: string | null;
  rateUnit: string | null;

  additionalInformation: string[];

  confidence: ConfidenceScores;
  missingFields: string[];
  warnings: string[];
}

export interface ShopSettings {
  shopName: string;
  proprietorName: string;
  phone: string;
  phoneContactName?: string;
  whatsapp: string;
  whatsappContactName?: string;
  apmcAddress: string;
  licenseNo: string;
  footerTagline: string;
  logoUrl?: string | null;
  themeId: 'emerald-classic' | 'sapphire-modern' | 'ruby-wholesale' | 'golden-harvest';
  customAccentColor?: string;
}

export interface ReportRecord {
  id: string;
  rawMessage: string;
  extractedData: MarketReportNormalized;
  editedData: MarketReportNormalized;
  imagePath: string | null;
  reportDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionResponse {
  success: boolean;
  data: MarketReportNormalized;
  warnings: string[];
  confidence: ConfidenceScores;
  rawMessage: string;
  isUnrelated?: boolean;
}

export interface PosterGenerationRequest {
  reportId?: string;
  rawMessage?: string;
  extractedData?: MarketReportNormalized;
  data: MarketReportNormalized;
  settings?: Partial<ShopSettings>;
}

export interface PosterGenerationResponse {
  success: boolean;
  reportId: string;
  imageUrl: string;
  imagePath: string;
  reportDate: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ *
 * Arrivals board
 *
 * A different report from the rate poster above: how much of each
 * commodity physically arrived in each market today, and in how many
 * vehicles. One board carries any number of markets, each with any
 * number of product rows.
 * ------------------------------------------------------------------ */

export interface ArrivalProduct {
  name: string;
  /** As printed, thousands separators kept: "46,442". */
  arrival: string;
  arrivalValue: number | null;
  /** "BAGS", "QUINTALS", "KGS"... */
  unit: string;
  /** As printed, leading zeros kept: "07". */
  vehicles: string;
  vehicleValue: number | null;
}

export interface MarketArrivals {
  name: string;
  products: ArrivalProduct[];
}

export interface ArrivalsBoardData {
  committeeName: string;
  location: string;
  /** ISO YYYY-MM-DD. */
  reportDate: string | null;
  /** As printed on the board: "27-08-2026". */
  reportDateDisplay: string | null;
  /** "THURSDAY" — derived from reportDate when the message omits it. */
  weekday: string | null;
  markets: MarketArrivals[];
  /**
   * Null means "add it up from the rows". A parsed message may instead state
   * its own total (and its own per-market split), which always wins over the
   * sum — the market's own arithmetic is the source of truth for the board.
   */
  totalVehicles: { total: number; parts: number[] } | null;
}
