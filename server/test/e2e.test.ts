import sharp from 'sharp';
import fs from 'fs';

async function testE2E() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING END-TO-END SERVER & POSTER ENGINE VERIFICATION');
  console.log('======================================================\n');

  // 1. Health check
  const healthRes = await fetch('http://localhost:5000/api/health');
  const health: any = await healthRes.json();
  console.log('1. Health check:', health);

  // 2. Settings check
  const settingsRes = await fetch('http://localhost:5000/api/settings');
  const settingsData: any = await settingsRes.json();
  console.log('2. Active Settings:', settingsData.settings.shopName, `[Theme: ${settingsData.settings.themeId}]`);

  // 3. Extract Format A report
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

  const extractRes = await fetch('http://localhost:5000/api/reports/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: formatA })
  });
  const extractData: any = await extractRes.json();
  console.log('3. Extraction Result:');
  console.log('   - Date:', extractData.data.reportDate, `(${extractData.data.reportDateDisplay})`);
  console.log('   - Market:', extractData.data.market);
  console.log('   - Arrivals:', extractData.data.totalArrivals?.display, `| Trucks: ${extractData.data.truckCount}`);
  console.log('   - Extra Big:', extractData.data.maharashtra.extraBig?.display);
  console.log('   - Big:', extractData.data.maharashtra.big?.display);
  console.log('   - Vijayapura:', extractData.data.vijayapura.rate?.display);
  console.log('   - Weather:', extractData.data.weather);
  console.log('   - Confidence overall:', extractData.confidence.overall);

  // 4. Generate 1080x1920 Poster PNG
  console.log('\n4. Generating Branded 1080x1920 Poster...');
  const genRes = await fetch('http://localhost:5000/api/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawMessage: formatA,
      extractedData: extractData.data,
      data: extractData.data
    })
  });
  const genData: any = await genRes.json();
  console.log('   - Success:', genData.success);
  console.log('   - Report ID:', genData.reportId);
  console.log('   - Image URL:', genData.imageUrl);
  console.log('   - Image File Path:', genData.imagePath);

  // 5. Verify generated file with Sharp
  if (fs.existsSync(genData.imagePath)) {
    const meta = await sharp(genData.imagePath).metadata();
    console.log('\n5. Sharp Image File Verification:');
    console.log(`   - Dimensions: ${meta.width} × ${meta.height} (Expected: 1080 × 1920)`);
    console.log(`   - Format: ${meta.format} (Expected: png)`);
    console.log(`   - Color Space: ${meta.space}`);
    console.log(`   - File Size: ${(fs.statSync(genData.imagePath).size / 1024).toFixed(1)} KB`);
    
    if (meta.width === 1080 && meta.height === 1920 && meta.format === 'png') {
      console.log('   ✓ POSTER DIMENSIONS & FORMAT 100% PERFECT!');
    } else {
      console.error('   ✗ DIMENSION MISMATCH');
      process.exit(1);
    }
  } else {
    console.error('   ✗ Poster file was not found on disk:', genData.imagePath);
    process.exit(1);
  }

  // 6. Test GET all reports
  const allRes = await fetch('http://localhost:5000/api/reports');
  const allData: any = await allRes.json();
  console.log(`\n6. Reports in Database: ${allData.reports.length} report(s) found`);

  console.log('\n======================================================');
  console.log('🎉 ALL END-TO-END VERIFICATION CHECKS PASSED!');
  console.log('======================================================\n');
}

testE2E().catch(err => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
