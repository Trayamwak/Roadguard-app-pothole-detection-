import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import type { AppSettings, DriveImpactLog, PotholeReport, ScanRecord } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

export const USERNAME_KEY = 'roadguard:username';
export const LOCAL_REPORTS_KEY = 'roadguard:reports:v1';
export const SCAN_HISTORY_KEY = 'roadguard:scan-history:v1';
export const DRIVE_IMPACTS_KEY = 'roadguard:drive-impacts:v1';
export const SETTINGS_KEY = 'roadguard:settings:v1';

/**
 * Username Local Storage
 */
export async function getUserName(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(USERNAME_KEY);
    return value ? value.trim() : null;
  } catch (error) {
    console.error('Failed to get username:', error);
    return null;
  }
}

export async function saveUserName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(USERNAME_KEY, name.trim());
  } catch (error) {
    console.error('Failed to save username:', error);
  }
}

/**
 * On-Device File Storage for Camera & Gallery Images using expo-file-system
 */
export async function saveImageLocally(sourceUri: string, id: string): Promise<string> {
  if (!sourceUri) return '';
  if (Platform.OS === 'web' || !sourceUri.startsWith('file://')) {
    return sourceUri;
  }

  try {
    const dir = `${FileSystem.documentDirectory}roadguard_scans/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    const extension = sourceUri.split('.').pop() || 'jpg';
    const destination = `${dir}${id}_${Date.now()}.${extension}`;
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destination,
    });
    return destination;
  } catch (error) {
    console.warn('Could not copy image to local documentDirectory, keeping source URI:', error);
    return sourceUri;
  }
}

/**
 * Local Pothole Reports Storage
 */
export async function getLocalReports(): Promise<PotholeReport[]> {
  try {
    const value = await AsyncStorage.getItem(LOCAL_REPORTS_KEY);
    if (!value) return [];
    const list = JSON.parse(value) as PotholeReport[];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Failed to get local reports:', error);
    return [];
  }
}

export async function saveLocalReport(report: PotholeReport): Promise<PotholeReport> {
  try {
    // If there is an image, copy to local app storage
    let persistentUri = report.image_uri || report.localImageUri || report.imageUrl || null;
    if (persistentUri && persistentUri.startsWith('file://')) {
      persistentUri = await saveImageLocally(persistentUri, report.id);
    }

    const normalizedReport: PotholeReport = {
      ...report,
      image_uri: persistentUri ?? undefined,
      localImageUri: persistentUri,
      imageUrl: persistentUri,
      latitude: report.lat ?? report.latitude ?? 0,
      longitude: report.lng ?? report.longitude ?? 0,
      lat: report.lat ?? report.latitude ?? 0,
      lng: report.lng ?? report.longitude ?? 0,
      date: report.date || new Date(report.createdAt).toISOString(),
      is_road_surface: report.is_road_surface ?? true,
      has_pothole: report.has_pothole ?? (report.potholes ? report.potholes.length > 0 : true),
      pothole_count: report.pothole_count ?? (report.potholes ? report.potholes.length : 1),
      description: report.description || report.reason || 'Road inspection scan',
      potholes: report.potholes || [],
    };

    const existing = await getLocalReports();
    const updated = [
      normalizedReport,
      ...existing.filter((item) => item.id !== normalizedReport.id),
    ];
    await AsyncStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(updated));
    return normalizedReport;
  } catch (error) {
    console.error('Failed to save local report:', error);
    return report;
  }
}

export async function deleteLocalReport(id: string): Promise<void> {
  try {
    const existing = await getLocalReports();
    const updated = existing.filter((item) => item.id !== id);
    await AsyncStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to delete local report:', error);
  }
}

export async function updateLocalReport(id: string, updates: Partial<PotholeReport>): Promise<void> {
  try {
    const existing = await getLocalReports();
    const updated = existing.map((item) => (item.id === id ? { ...item, ...updates } : item));
    await AsyncStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update local report:', error);
  }
}

// Backward compatibility helper
export const getQueuedReports = getLocalReports;
export const saveQueuedReport = saveLocalReport;
export const removeQueuedReport = deleteLocalReport;

/**
 * Scan History
 */
export async function getScanHistory(): Promise<ScanRecord[]> {
  try {
    const value = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
    if (!value) return [];
    return (JSON.parse(value) as ScanRecord[]).slice(0, 150);
  } catch {
    return [];
  }
}

export async function saveScanRecord(record: ScanRecord): Promise<void> {
  try {
    let localUri = record.photoUri || record.image_uri || null;
    if (localUri && localUri.startsWith('file://')) {
      localUri = await saveImageLocally(localUri, record.id);
    }
    const recordWithUri: ScanRecord = {
      ...record,
      photoUri: localUri,
      image_uri: localUri,
      date: record.date || new Date(record.createdAt).toISOString(),
    };

    const history = await getScanHistory();
    const next = [recordWithUri, ...history.filter((item) => item.id !== record.id)];
    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(next.slice(0, 150)));
  } catch (error) {
    console.error('Failed to save scan record:', error);
  }
}

export async function updateScanRecord(id: string, changes: Partial<ScanRecord>): Promise<void> {
  const history = await getScanHistory();
  const current = history.find((item) => item.id === id);
  if (!current) return;
  await saveScanRecord({ ...current, ...changes });
}

/**
 * App Settings
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    const value = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!value) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(value) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Drive Mode Accelerometer Impact Logs
 */
export async function getDriveImpactLogs(): Promise<DriveImpactLog[]> {
  try {
    const value = await AsyncStorage.getItem(DRIVE_IMPACTS_KEY);
    if (!value) return [];
    return JSON.parse(value) as DriveImpactLog[];
  } catch {
    return [];
  }
}

export async function saveDriveImpactLog(log: DriveImpactLog): Promise<void> {
  try {
    const existing = await getDriveImpactLogs();
    const updated = [log, ...existing.filter((item) => item.id !== log.id)].slice(0, 100);
    await AsyncStorage.setItem(DRIVE_IMPACTS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save drive impact log:', error);
  }
}

