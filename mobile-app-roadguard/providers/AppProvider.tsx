import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getLocalReports,
  getUserName,
  saveLocalReport,
  saveUserName as persistUserName,
  deleteLocalReport,
  getSettings,
  saveSettings,
} from '@/lib/storage';
import { confirmReport as persistConfirmReport } from '@/lib/reports';
import type { AppSettings, PotholeReport } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

interface AppContextValue {
  userName: string;
  setUserName: (name: string) => Promise<void>;
  reports: PotholeReport[];
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => Promise<void>;
  isLoadingReports: boolean;
  reportError: string | null;
  addReport: (report: PotholeReport) => Promise<{ merged: boolean; synced: boolean; reportId: string }>;
  confirmPothole: (reportId: string) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  reloadReports: () => Promise<void>;
  user: { uid: string; displayName: string } | null;
  guestMode: boolean;
  setGuestMode: (value: boolean) => void;
  firebaseReady: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [userName, setUserNameState] = useState<string>('');
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  const reloadReports = useCallback(async () => {
    try {
      setIsLoadingReports(true);
      const data = await getLocalReports();
      setReports(data);
      setReportError(null);
    } catch (err) {
      setReportError('Failed to load local reports');
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    // Check local storage for username
    getUserName().then((name) => {
      if (name) setUserNameState(name);
    });

    // Load settings & reports
    getSettings().then(setSettings).catch(() => setSettings(DEFAULT_SETTINGS));
    reloadReports();
  }, [reloadReports]);

  const setUserName = async (name: string) => {
    const trimmed = name.trim();
    setUserNameState(trimmed);
    await persistUserName(trimmed);
  };

  const updateSettings = async (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    await saveSettings(nextSettings);
  };

  const addReport = async (report: PotholeReport) => {
    const saved = await saveLocalReport(report);
    await reloadReports();
    return {
      merged: false,
      synced: true,
      reportId: saved.id,
    };
  };

  const confirmPothole = async (reportId: string) => {
    await persistConfirmReport(reportId);
    await reloadReports();
  };

  const deleteReport = async (reportId: string) => {
    await deleteLocalReport(reportId);
    await reloadReports();
  };

  const user = userName ? { uid: 'local_user', displayName: userName } : null;

  return (
    <AppContext.Provider
      value={{
        userName,
        setUserName,
        reports,
        settings,
        updateSettings,
        isLoadingReports,
        reportError,
        addReport,
        confirmPothole,
        deleteReport,
        reloadReports,
        user,
        guestMode: true,
        setGuestMode: () => {},
        firebaseReady: false,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside <AppProvider />');
  }
  return context;
}
