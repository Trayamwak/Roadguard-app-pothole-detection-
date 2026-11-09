export type Severity = 'Low' | 'Medium' | 'High' | 'Critical' | 'None';
export type ReportSource = 'sensor' | 'camera' | 'ai_live' | 'ai_upload';
export type ReportStatus = 'open' | 'fixed';

export interface PotholeBox {
  id: number;
  size: 'Small' | 'Medium' | 'Large';
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000 range
  confidence?: number;
}

export interface ScanResponse {
  is_road_surface: boolean;
  has_pothole: boolean;
  pothole_count: number;
  severity: 'Low' | 'Medium' | 'High' | 'None';
  confidence: number;
  description: string;
  potholes: PotholeBox[];
}

export interface PotholeReport {
  id: string;
  userId?: string;
  authorLabel?: string;
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
  severity: Severity;
  confidence: number;
  reason?: string;
  description?: string;
  is_road_surface?: boolean;
  has_pothole?: boolean;
  pothole_count?: number;
  potholes?: PotholeBox[];
  imageUrl?: string | null;
  image_uri?: string;
  localImageUri?: string | null;
  source: ReportSource;
  status: ReportStatus;
  upvotes: number;
  createdAt: number;
  date?: string;
  note: string;
  address?: string | null;
  spikeMagnitude?: number | null;
}

// Backward compatibility alias for legacy detection
export interface PotholeDetection {
  bbox: [number, number, number, number];
  confidence: number;
  severity: Severity;
  area_percent: number;
}

export interface DetectionResult extends ScanResponse {
  overall_severity: Severity;
  message?: string;
}

export interface ScanRecord {
  id: string;
  source: 'ai_live' | 'ai_upload';
  createdAt: number;
  date?: string;
  photoUri: string | null;
  image_uri?: string | null;
  is_road_surface: boolean;
  has_pothole: boolean;
  pothole_count: number;
  severity: Severity;
  overallSeverity?: Severity;
  confidence: number;
  description: string;
  potholes: PotholeBox[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  latitude?: number | null;
  longitude?: number | null;
  reportId: string | null;
  status: 'saved' | 'discarded' | 'pending';
  note: string;
}

export interface PhotoAssessment {
  severity: Severity;
  confidence: number;
  reason: string;
}

export interface DriveImpactLog {
  id: string;
  timestamp: number;
  date: string;
  speedKmh: number;
  magnitudeG: number;
  severity: 'Low' | 'Medium' | 'High';
  latitude: number;
  longitude: number;
  address?: string | null;
}

export interface AppSettings {
  sensitivity: number;
  useMiles: boolean;
  notificationsEnabled: boolean;
  anonymousReports: boolean;
  driveMode: boolean;
  autoSaveScans: boolean;
  userName?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  sensitivity: 1.6,
  useMiles: false,
  notificationsEnabled: false,
  anonymousReports: false,
  driveMode: false,
  autoSaveScans: true,
  userName: '',
};

export const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical', 'None'];
