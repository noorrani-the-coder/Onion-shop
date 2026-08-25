import { parseMarketReportDeterministic, parseDate, parsePriceRange } from '../src/services/parser/marketParser';

let passed = 0;
let failed = 0;

function assert(condition: any, msg: string) {
  if (Boolean(condition)) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('🧪 RUNNING 15 ONION MARKET REPORT PARSER TEST CASES');
console.log('======================================================\n');

// TEST 1: Exact original APMC message format (Format A)
console.log('--- TEST 1: Format A (Original APMC) ---');
const formatA = `APMC BENGALURU
ONION MARKET REPORT
Date. 22.08.2026

apmc wise Arrivals
65,326 bags 325+ Trucks

Maharashtra onions
Extra Big only. 4300-4500
BIG. 4000-4200
Mukkal. 3500-3800
Medium. 3000-3500
Golta. 2500-3000
Golty. 2000-2400
Chopda 2000-3000
Average quality. 3000-3500

Karnataka Vijayapura onions
Rates. 3000-3700

New onions
Karnataka 7000+ bags
Rates. 1600-3400
1-2 lot. 3500-3800
Sales slow.
Weather ☁️
Rates for 100 kg`;

const r1 = parseMarketReportDeterministic(formatA).normalized;
assert(r1.reportDate === '2026-08-22', 'Date normalized to 2026-08-22');
assert(r1.market === 'APMC BENGALURU', 'Market is APMC BENGALURU');
assert(r1.totalArrivals?.value === 65326, 'Arrivals 65,326');
assert(r1.truckCount === '325+', 'Truck count 325+ preserved');
assert(r1.maharashtra.extraBig?.display === '4300-4500', 'Extra Big 4300-4500');
assert(r1.maharashtra.big?.display === '4000-4200', 'Big 4000-4200');
assert(r1.maharashtra.medium?.display === '3000-3500', 'Medium 3000-3500');
assert(r1.vijayapura.rate?.display === '3000-3700', 'Vijayapura 3000-3700');
assert(Boolean(r1.newOnions.bagCount?.includes('7000+')), 'New onions 7000+ bags');
assert(r1.weather === 'Cloudy', 'Weather is Cloudy from ☁️');
assert(r1.salesStatus === 'Slow', 'Sales is Slow');

// TEST 2: Alternative ordering (Format B)
console.log('\n--- TEST 2: Format B (Alternative ordering) ---');
const formatB = `Bangalore APMC Onion Rates
22/08/26

Arrival - 65,326 bags
Trucks - 325+

MH Onion:
Big: 4000 to 4200
Extra Big: 4300-4500
Medium: 3000/3500
Golta: 2500-3000

Vijayapura:
3000-3700

New Karnataka:
7000+ bags
1600-3400

Sales: Slow
Weather: Cloudy`;

const r2 = parseMarketReportDeterministic(formatB).normalized;
assert(r2.reportDate === '2026-08-22', 'Date 22/08/26 parsed to 2026-08-22');
assert(r2.maharashtra.big?.display === '4000-4200', 'Big parsed from "4000 to 4200"');
assert(r2.maharashtra.medium?.display === '3000-3500', 'Medium parsed from "3000/3500"');
assert(r2.weather === 'Cloudy', 'Weather is Cloudy');
assert(r2.salesStatus === 'Slow', 'Sales is Slow');

// TEST 3: All caps and abbreviations (Format C)
console.log('\n--- TEST 3: Format C (All caps) ---');
const formatC = `BENGALURU ONION MARKET
TODAY RATE

MH:
BIG 4000-4200
MED 3000-3500
GOLTA 2500-3000
GOLTY 2000-2400

VIJAYAPURA 3000-3700

NEW ONION 1600-3400

ARRIVAL 65326
TRUCK 325+`;

const r3 = parseMarketReportDeterministic(formatC).normalized;
assert(r3.maharashtra.big?.display === '4000-4200', 'BIG normalized');
assert(r3.maharashtra.medium?.display === '3000-3500', 'MED normalized');
assert(r3.totalArrivals?.value === 65326, 'ARRIVAL 65326 parsed');
assert(r3.truckCount === '325+', 'TRUCK 325+ parsed');

// TEST 4: Date prefix & slashes (Format D)
console.log('\n--- TEST 4: Format D (Date prefix & slashes) ---');
const formatD = `22-08-2026 Bangalore APMC

Maharashtra onion:
Extra big 4300/4500
Big quality 4000/4200
Medium 3000/3500
Golta 2500/3000

Karnataka Vijayapura 3000-3700

New onion 1600-3400
7,000+ bags

Sales slow
Cloudy
Rate per 100kg`;

const r4 = parseMarketReportDeterministic(formatD).normalized;
assert(r4.reportDate === '2026-08-22', 'Date 22-08-2026 parsed');
assert(r4.maharashtra.extraBig?.display === '4300-4500', 'Extra big 4300/4500 parsed');
assert(r4.maharashtra.big?.display === '4000-4200', 'Big quality 4000/4200 parsed');
assert(r4.rateUnit === 'Per 100 kg (Quintal)', 'Rate per 100kg parsed');

// TEST 5: Rates written using "to"
console.log('\n--- TEST 5: Rates written using "to" ---');
const r5 = parsePriceRange('Big Onion: Rs. 4000 to 4200');
assert(r5?.min === 4000 && r5?.max === 4200 && r5?.display === '4000-4200', '4000 to 4200 parsed into range');

// TEST 6: Rates written using "/"
console.log('\n--- TEST 6: Rates written using "/" ---');
const r6 = parsePriceRange('Extra Big 4300/4500');
assert(r6?.min === 4300 && r6?.max === 4500 && r6?.display === '4300-4500', '4300/4500 parsed into range');

// TEST 7: Missing weather
console.log('\n--- TEST 7: Missing weather ---');
const noWeatherMsg = `APMC BENGALURU 22.08.2026\nBig 4000-4200\nArrivals 65,000 bags`;
const r7 = parseMarketReportDeterministic(noWeatherMsg).normalized;
assert(r7.weather === null, 'Missing weather stays null, not invented');

// TEST 8: Missing truck count
console.log('\n--- TEST 8: Missing truck count ---');
const noTruckMsg = `APMC BENGALURU 22.08.2026\nBig 4000-4200\nArrivals 65,000 bags`;
const r8 = parseMarketReportDeterministic(noTruckMsg).normalized;
assert(r8.truckCount === null, 'Missing truck count stays null');

// TEST 9: Additional onion varieties (White Onion / Garva)
console.log('\n--- TEST 9: Additional onion varieties ---');
const extraVarietyMsg = `APMC BENGALURU 22.08.2026\nBig 4000-4200\nWhite Onion Special: 3200-3600\nGarva Onion: 2800-3100`;
const r9 = parseMarketReportDeterministic(extraVarietyMsg).normalized;
assert(r9.additionalInformation.length >= 2, 'Unmapped varieties placed into additionalInformation');

// TEST 10: Different date formats
console.log('\n--- TEST 10: Varied Date Formats ---');
assert(parseDate('Date: 22 Aug 2026').isoDate === '2026-08-22', '22 Aug 2026 parsed');
assert(parseDate('22.08.2026').isoDate === '2026-08-22', '22.08.2026 parsed');
assert(parseDate('22/08/2026').isoDate === '2026-08-22', '22/08/2026 parsed');

// TEST 11: Emojis and WhatsApp formatting
console.log('\n--- TEST 11: Emojis and WhatsApp styling ---');
const emojiMsg = `*APMC BENGALURU* 🧅\n*Date:* 22.08.2026 📅\n*Big:* ₹4000-4200 🔥\n*Arrivals:* 65,326 bags 🚛 325+\nWeather: ☀️`;
const r11 = parseMarketReportDeterministic(emojiMsg).normalized;
assert(r11.maharashtra.big?.display === '4000-4200', 'Asterisks and rupee symbol stripped correctly');
assert(r11.weather === 'Sunny', '☀️ parsed to Sunny');

// TEST 12: Abbreviations (EB, MED, MH)
console.log('\n--- TEST 12: Abbreviations ---');
const abbrevMsg = `MH Onion:\nEB: 4300-4500\nMED: 3000-3500`;
const r12 = parseMarketReportDeterministic(abbrevMsg).normalized;
assert(r12.maharashtra.extraBig?.display === '4300-4500', 'EB mapped to Extra Big');
assert(r12.maharashtra.medium?.display === '3000-3500', 'MED mapped to Medium');

// TEST 13: Completely unrelated message
console.log('\n--- TEST 13: Completely unrelated message ---');
const unrelatedMsg = `Hello good morning please find attached the invoices for the cement delivery today.`;
const r13 = parseMarketReportDeterministic(unrelatedMsg);
assert(r13.isUnrelated === true, 'Flagged as unrelated message');
assert(r13.normalized.confidence.overall === 'low', 'Confidence set to low');

// TEST 14: Partially incomplete report
console.log('\n--- TEST 14: Partially incomplete report ---');
const partialMsg = `Bangalore APMC\nBig onion 4000-4200`;
const r14 = parseMarketReportDeterministic(partialMsg).normalized;
assert(r14.maharashtra.big?.display === '4000-4200', 'Big rate captured');
assert(r14.missingFields.includes('Date'), 'Flagged Date as missing');

// TEST 16: Vegetable & Commodity rates parsing
console.log('\n--- TEST 16: Vegetable & Commodity rates ---');
const vegMsg = `APMC BENGALURU
23.08.2026
Potato (Agra): 1800-2200 / 100kg
Tomato (Hybrid): 600-850 / 25kg box
Garlic: 14000-18000
Ginger: 6500-8000
Green Chilli: 2800-3600`;
const r16 = parseMarketReportDeterministic(vegMsg).normalized;
assert(Boolean(r16.commodities && r16.commodities.length >= 5), `Found ${r16.commodities?.length} vegetable commodities`);
const potato = r16.commodities?.find(c => c.name.includes('POTATO'));
assert(Boolean(potato && potato.rate?.display === '1800-2200'), 'Potato parsed with 1800-2200');
const tomato = r16.commodities?.find(c => c.name.includes('TOMATO'));
assert(Boolean(tomato && tomato.rate?.display === '600-850'), 'Tomato parsed with 600-850');
const garlic = r16.commodities?.find(c => c.name.includes('GARLIC'));
assert(Boolean(garlic && garlic.rate?.display === '14000-18000'), 'Garlic parsed with 14000-18000');

console.log('\n======================================================');
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
