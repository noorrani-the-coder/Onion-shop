import { MarketReportNormalizedSchema } from '../../../../shared/schemas';
import { ExtractionResponse, MarketReportNormalized } from '../../../../shared/types';
import { parseMarketReportDeterministic } from '../parser/marketParser';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'https://ollama.com';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud';

export class AIExtractionService {
  private ollamaApiKey: string | null = null;

  constructor() {
    this.ollamaApiKey = process.env.OLLAMA_API_KEY || null;
  }

  public async extractMarketReport(rawMessage: string): Promise<ExtractionResponse> {
    if (!rawMessage || !rawMessage.trim()) {
      const { normalized } = parseMarketReportDeterministic('');
      return {
        success: false,
        data: normalized,
        warnings: ['Empty message received.'],
        confidence: normalized.confidence,
        rawMessage: '',
        isUnrelated: true
      };
    }

    // If Ollama Cloud is configured, attempt AI structured extraction
    if (this.ollamaApiKey) {
      try {
        const aiResult = await this.extractWithOllama(rawMessage);
        if (aiResult) {
          return {
            success: true,
            data: aiResult,
            warnings: aiResult.warnings || [],
            confidence: aiResult.confidence,
            rawMessage
          };
        }
      } catch (err) {
        console.warn('Ollama extraction failed, falling back to deterministic parser:', err);
      }
    }

    // Fallback: Smart deterministic APMC parser
    const { normalized, isUnrelated } = parseMarketReportDeterministic(rawMessage);
    return {
      success: !isUnrelated,
      data: normalized,
      warnings: normalized.warnings,
      confidence: normalized.confidence,
      rawMessage,
      isUnrelated
    };
  }

  private async extractWithOllama(rawMessage: string): Promise<MarketReportNormalized | null> {
    if (!this.ollamaApiKey) return null;

    const prompt = `You are a specialized APMC Mandi & Vegetable/Onion Wholesale Market Report Extraction Engine.
Extract the structured market data from the following WhatsApp message.

CRITICAL RULES:
1. NEVER invent, calculate, or guess any value. If a value is missing, return null.
2. Preserve exact price ranges (e.g. 4300-4500) and preserve '+' in counts (e.g. "325+", "7000+").
   "truckCount" is the BARE COUNT ONLY — never include the word "trucks"/"lorries".
   From "325+ Trucks" return "325+", NOT "325+ Trucks". The renderer adds the word itself.
3. Do not confuse dates with prices.
4. Normalize dates to ISO "YYYY-MM-DD" and display "DD.MM.YYYY".
5. Map Onion varieties accurately:
   - Extra Big / EB -> maharashtra.extraBig
   - Big / Big Quality -> maharashtra.big
   - Mukkal / 3/4 -> maharashtra.mukkal
   - Medium / MED -> maharashtra.medium
   - Golta / Golte -> maharashtra.golta
   - Golty / Choti Golta -> maharashtra.golty
   - Chopda -> maharashtra.chopda
   - Average Quality -> maharashtra.averageQuality
6. If the message contains ANY OTHER VEGETABLES OR COMMODITIES (e.g. Potato, Tomato, Garlic, Ginger, Green Chilli, Lemon, Carrot, Cabbage, Cauliflower, Capsicum, Brinjal, Beans, etc. or custom items), extract them into the "commodities" array!
   For each commodity:
   - name: Vegetable or Commodity Name in UPPERCASE (e.g. "POTATO", "TOMATO", "GARLIC", "GREEN CHILLI", "GINGER")
   - variety: Variety/Origin if mentioned (e.g. "Agra", "Jyoti", "Hybrid", "Desi") or null
   - rate: { min, max, display }
   - unit: Unit if mentioned (e.g. "Per 100 kg", "Per 50 kg", "Per 25 kg box", "Per kg") or null
   - isHighlight: true or false
7. If an item doesn't fit standard fields or commodities, put it into additionalInformation array.
8. Return confidence for each category: "high" | "medium" | "low".

OUTPUT JSON SCHEMA:
{
  "reportDate": string | null,
  "reportDateDisplay": string | null,
  "market": string | null,
  "totalArrivals": { "value": number, "display": string } | null,
  "truckCount": string | null,
  "maharashtra": {
    "extraBig": { "min": number, "max": number, "display": string } | null,
    "big": { "min": number, "max": number, "display": string } | null,
    "mukkal": { "min": number, "max": number, "display": string } | null,
    "medium": { "min": number, "max": number, "display": string } | null,
    "golta": { "min": number, "max": number, "display": string } | null,
    "golty": { "min": number, "max": number, "display": string } | null,
    "chopda": { "min": number, "max": number, "display": string } | null,
    "averageQuality": { "min": number, "max": number, "display": string } | null
  },
  "vijayapura": {
    "rate": { "min": number, "max": number, "display": string } | null
  },
  "newOnions": {
    "state": string | null,
    "bagCount": string | null,
    "rate": { "min": number, "max": number, "display": string } | null,
    "lotRate": { "min": number, "max": number, "display": string } | null
  },
  "commodities": [
    {
      "name": string,
      "variety": string | null,
      "rate": { "min": number, "max": number, "display": string } | null,
      "unit": string | null,
      "isHighlight": boolean
    }
  ],
  "salesStatus": string | null,
  "weather": string | null,
  "rateUnit": string | null,
  "additionalInformation": string[],
  "confidence": {
    "overall": "high" | "medium" | "low",
    "date": "high" | "medium" | "low",
    "market": "high" | "medium" | "low",
    "arrivals": "high" | "medium" | "low",
    "maharashtra": "high" | "medium" | "low",
    "vijayapura": "high" | "medium" | "low",
    "newOnions": "high" | "medium" | "low",
    "commodities": "high" | "medium" | "low",
    "salesStatus": "high" | "medium" | "low",
    "weather": "high" | "medium" | "low"
  },
  "missingFields": string[],
  "warnings": string[]
}

MESSAGE TO PARSE:
${rawMessage}`;

    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.ollamaApiKey}`
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        format: 'json',
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama Cloud request failed: ${response.status} ${await response.text()}`);
    }

    const result = await response.json() as { message?: { content?: string } };
    const text = result.message?.content;
    if (!text) throw new Error('Ollama Cloud returned an empty response');

    const parsed = JSON.parse(text);
    const validated = MarketReportNormalizedSchema.parse(parsed);
    return stripEchoedLabels(validated as MarketReportNormalized);
  }
}

/**
 * Strips labels the poster adds itself, which the model tends to echo back from
 * the source phrasing:
 *
 *   truckCount   "325+ Trucks" -> "325+"   (poster appends " Trucks")
 *   salesStatus  "Sales slow"  -> "slow"   (poster prepends "SALES ")
 *
 * Left as-is they render as "325+ Trucks Trucks" and "SALES SALES SLOW". The
 * prompt asks for bare values; this enforces it regardless of compliance.
 *
 * Note the neighbouring count fields deliberately DO carry their unit
 * (`totalArrivals.display` = "65,326 bags", `newOnions.bagCount` = "7000+
 * bags"), which is what makes these two easy to get wrong.
 */
function stripEchoedLabels(report: MarketReportNormalized): MarketReportNormalized {
  const out = { ...report };
  if (out.truckCount) {
    out.truckCount = out.truckCount.replace(/\s*(?:trucks?|lorr(?:y|ies))\s*$/i, '').trim() || null;
  }
  if (out.salesStatus) {
    out.salesStatus = out.salesStatus.replace(/^\s*sales\s+/i, '').trim() || null;
  }
  return out;
}

export const aiExtractor = new AIExtractionService();
