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

export const ReportRowSchema = z.object({
  label: z.string().min(1),
  rate: PriceRangeSchema
});

export const ReportSectionSchema = z.object({
  title: z.string().min(1),
  count: z.string().nullable().optional(),
  rows: z.array(ReportRowSchema).default([])
});

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

export const NewOnionGradeSchema = z.object({
  label: z.string().min(1),
  rate: PriceRangeSchema
});

export const NewOnionRatesSchema = z.object({
  state: z.string().nullable(),
  bagCount: z.string().nullable(),
  // Defaulted, not required: reports stored before per-grade rows existed have
  // no `grades` key, and they must keep loading rather than fail validation.
  grades: z.array(NewOnionGradeSchema).default([]),
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

  // Defaulted so reports stored before structure-driven sections existed keep
  // validating; the renderer falls back to the named fields when it is empty.
  sections: z.array(ReportSectionSchema).default([]),

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

/* ---------------------------- Arrivals board ---------------------------- */

export const ArrivalProductSchema = z.object({
  name: z.string().min(1),
  arrival: z.string().min(1),
  arrivalValue: z.number().nullable(),
  unit: z.string().min(1),
  vehicles: z.string(),
  vehicleValue: z.number().nullable()
});

export const MarketArrivalsSchema = z.object({
  name: z.string().min(1),
  products: z.array(ArrivalProductSchema)
});

export const ArrivalsBoardDataSchema = z.object({
  committeeName: z.string().min(1),
  location: z.string(),
  reportDate: z.string().nullable(),
  reportDateDisplay: z.string().nullable(),
  weekday: z.string().nullable(),
  markets: z.array(MarketArrivalsSchema).min(1, 'An arrivals board needs at least one market'),
  totalVehicles: z
    .object({ total: z.number(), parts: z.array(z.number()) })
    .nullable()
});

// Either hand over a raw message to parse, or structured data already corrected
// by the user. Exactly one is required — a request with neither has nothing to
// render, and one with both would leave which of the two wins ambiguous.
export const GenerateArrivalsBoardSchema = z
  .object({
    rawMessage: z.string().optional(),
    data: ArrivalsBoardDataSchema.optional()
  })
  .refine(body => Boolean(body.rawMessage) !== Boolean(body.data), {
    message: 'Provide exactly one of "rawMessage" or "data".'
  });
