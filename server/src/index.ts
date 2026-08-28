import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import reportRoutes from './routes/reportRoutes';
import settingsRoutes from './routes/settingsRoutes';
import arrivalsRoutes from './routes/arrivalsRoutes';
import appUpdateRoutes from './routes/appUpdateRoutes';
import fontDiagnosticRoutes from './routes/fontDiagnosticRoutes';
import { ENV_FILE, PUBLIC_DIR } from './paths';

dotenv.config({ path: ENV_FILE });

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file hosting for generated posters and uploads
const publicDir = PUBLIC_DIR;
if (!fs.existsSync(path.join(publicDir, 'posters'))) {
  fs.mkdirSync(path.join(publicDir, 'posters'), { recursive: true });
}
app.use(express.static(publicDir));
app.use('/posters', express.static(path.join(publicDir, 'posters')));
// Over-the-air web bundles for the Android app. Immutable once published: each
// release gets its own filename, so a long cache is safe and phones mid-download
// never have the file changed under them.
app.use(
  '/bundles',
  express.static(path.join(publicDir, 'bundles'), { maxAge: '30d', immutable: true })
);

// API Routes
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/arrivals', arrivalsRoutes);
app.use('/api/app', appUpdateRoutes);
app.use('/api/app', fontDiagnosticRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🌾 APMC Onion Market Server is running on http://127.0.0.1:${PORT}`);
  console.log(`Poster storage: ${path.join(publicDir, 'posters')}`);
});
