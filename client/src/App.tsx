import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BackgroundAnimation } from './components/BackgroundAnimation';
import { DashboardPage } from './pages/DashboardPage';
import { PastePage } from './pages/PastePage';
import { VerifyPage } from './pages/VerifyPage';
import { PreviewPage } from './pages/PreviewPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { BrandImagePage } from './pages/BrandImagePage';
import { MarketReportNormalized, ReportRecord, ShopSettings } from '@shared/types';
import { api } from './services/api';
import { apiUrl } from './services/config';

type Tab = 'dashboard' | 'paste' | 'verify' | 'preview' | 'history' | 'settings' | 'brand';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<Tab>('dashboard');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);

  // Active workflow state
  const [rawMessage, setRawMessage] = useState<string>('');
  const [extractedData, setExtractedData] = useState<MarketReportNormalized | null>(null);
  const [activeReport, setActiveReport] = useState<ReportRecord | null>(null);

  // Load reports and settings on initial load
  const loadInitialData = async () => {
    try {
      const [fetchedReports, fetchedSettings] = await Promise.all([
        api.getReports().catch(() => []),
        api.getSettings().catch(() => null)
      ]);
      setReports(fetchedReports);
      if (fetchedSettings) setSettings(fetchedSettings);
    } catch (err) {
      console.error('Failed to load initial app data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Workflow handlers
  const handleExtractionSuccess = (message: string, data: MarketReportNormalized) => {
    setRawMessage(message);
    setExtractedData(data);
    setCurrentTab('verify');
  };

  const handlePosterGenerated = (result: {
    reportId: string;
    imageUrl: string;
    imagePath: string;
    reportDate: string;
    createdAt: string;
  }) => {
    // Reload reports so history & dashboard are in sync
    api.getReports().then(reps => setReports(reps)).catch(() => {});

    if (extractedData) {
      const newRecord: ReportRecord = {
        id: result.reportId,
        rawMessage,
        extractedData,
        editedData: extractedData,
        imagePath: apiUrl(result.imageUrl),
        reportDate: result.reportDate,
        createdAt: result.createdAt,
        updatedAt: result.createdAt
      };
      setActiveReport(newRecord);
    }
    setCurrentTab('preview');
  };

  const handleSelectReportForPreview = (report: ReportRecord) => {
    setActiveReport(report);
    setRawMessage(report.rawMessage);
    setExtractedData(report.editedData);
    setCurrentTab('preview');
  };

  const handleNewReport = () => {
    setRawMessage('');
    setExtractedData(null);
    setActiveReport(null);
    setCurrentTab('paste');
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col relative overflow-x-hidden">
      <BackgroundAnimation />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          hasActiveReport={!!activeReport}
        />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-6">
        {currentTab === 'dashboard' && (
          <DashboardPage
            reports={reports}
            settings={settings}
            onNavigate={(tab) => setCurrentTab(tab as Tab)}
            onSelectReportForPreview={handleSelectReportForPreview}
          />
        )}

        {currentTab === 'paste' && (
          <PastePage
            onExtractionSuccess={handleExtractionSuccess}
          />
        )}

        {currentTab === 'verify' && extractedData && (
          <VerifyPage
            rawMessage={rawMessage}
            initialData={extractedData}
            onBack={() => setCurrentTab('paste')}
            onPosterGenerated={handlePosterGenerated}
          />
        )}

        {currentTab === 'preview' && activeReport && (
          <PreviewPage
            report={activeReport}
            settings={settings}
            onEditData={() => setCurrentTab('verify')}
            onNewReport={handleNewReport}
          />
        )}

        {currentTab === 'brand' && (
          <BrandImagePage
            settings={settings}
            onSaved={() => api.getReports().then(setReports).catch(() => {})}
          />
        )}

        {currentTab === 'history' && (
          <HistoryPage
            reports={reports}
            onSelectReport={handleSelectReportForPreview}
            onRefresh={loadInitialData}
            onNewReport={handleNewReport}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsPage
            settings={settings}
            onSettingsSaved={(updated) => setSettings(updated)}
          />
        )}
      </main>
      </div>
    </div>
  );
};
export default App;
