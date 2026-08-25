import { z } from 'zod';

export const PriceRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  display: z.string()
}).nullable();

export const ArrivalCountSchema = z.object({
  value: z.number(),
  display: z.string()
}).nullable();

export const MaharashtraRatesSchema = z.object({
  extraBig: PriceRangeSchema,
  big: PriceRangeSchema,
  mukkal: PriceRangeSchema,
  medium: PriceRangeSchema,
  golta: PriceRangeSchema,
  golty: PriceRangeSchema,
  chopda: PriceRangeSchema,
  averageQuality: PriceRangeSchema
});

export const VijayapuraRatesSchema = z.object({
  rate: PriceRangeSchema
});

export const NewOnionRatesSchema = z.object({
  state: z.string().nullable(),
  bagCount: z.string().nullable(),
  rate: PriceRangeSchema,
  lotRate: PriceRangeSchema
});

export const CommodityItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  variety: z.string().nullable().optional(),
  rate: PriceRangeSchema,
  unit: z.string().nullable().optional(),
  isHighlight: z.boolean().optional()
});

export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);

export const ConfidenceScoresSchema = z.object({
  overall: ConfidenceLevelSchema,
  date: ConfidenceLevelSchema,
  market: ConfidenceLevelSchema,
  arrivals: ConfidenceLevelSchema,
  maharashtra: ConfidenceLevelSchema,
  vijayapura: ConfidenceLevelSchema,
  newOnions: ConfidenceLevelSchema,
  commodities: ConfidenceLevelSchema.optional().default('high'),
  salesStatus: ConfidenceLevelSchema,
  weather: ConfidenceLevelSchema
});

export const MarketReportNormalizedSchema = z.object({
  reportDate: z.string().nullable(),
  reportDateDisplay: z.string().nullable(),
  market: z.string().nullable(),
  totalArrivals: ArrivalCountSchema,
  truckCount: z.string().nullable(),

  maharashtra: MaharashtraRatesSchema,
  vijayapura: VijayapuraRatesSchema,
  newOnions: NewOnionRatesSchema,
  commodities: z.array(CommodityItemSchema).default([]),

  salesStatus: z.string().nullable(),
  weather: z.string().nullable(),
  rateUnit: z.string().nullable(),

  additionalInformation: z.array(z.string()).default([]),

  confidence: ConfidenceScoresSchema,
  missingFields: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
});

// No .default() on any field here: this schema is only ever used via .partial() (for the
// settings PUT endpoint and the poster-generation settings override), and a Zod .default()
// still fires for an omitted key even under .partial() — meaning any partial update would
// silently reset every unspecified field (blanking phone/whatsapp/address, resetting the
// theme) instead of leaving it untouched for the route's {...current, ...update} merge.
export const ShopSettingsSchema = z.object({
  shopName: z.string().min(1, 'Shop name is required'),
  proprietorName: z.string(),
  phone: z.string(),
  phoneContactName: z.string().optional(),
  whatsapp: z.string(),
  whatsappContactName: z.string().optional(),
  apmcAddress: z.string(),
  licenseNo: z.string(),
  footerTagline: z.string(),
  logoUrl: z.string().nullable().optional(),
  themeId: z.enum(['emerald-classic', 'sapphire-modern', 'ruby-wholesale', 'golden-harvest']),
  customAccentColor: z.string().optional()
});

export const ExtractRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty')
});

export const GeneratePosterRequestSchema = z.object({
  reportId: z.string().optional(),
  rawMessage: z.string().optional(),
  extractedData: MarketReportNormalizedSchema.optional(),
  data: MarketReportNormalizedSchema,
  settings: ShopSettingsSchema.partial().optional()
});
