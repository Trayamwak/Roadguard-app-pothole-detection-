import { escapeCsv } from '@/lib/geo';
import {
  getLocalReports,
  saveLocalReport,
  deleteLocalReport,
  updateLocalReport,
} from '@/lib/storage';
import type { PotholeReport } from '@/types';

/**
 * On-device local reports management
 */
export async function fetchReports(): Promise<PotholeReport[]> {
  return await getLocalReports();
}

export function subscribeReports(
  onReports: (reports: PotholeReport[]) => void,
  _onError?: (error: Error) => void,
): () => void {
  // Load initially from local storage
  getLocalReports()
    .then(onReports)
    .catch(() => onReports([]));

  // Return a cleanup no-op
  return () => undefined;
}

export async function createReport(report: PotholeReport): Promise<{
  report: PotholeReport;
  synced: boolean;
  merged: boolean;
}> {
  const saved = await saveLocalReport(report);
  return {
    report: saved,
    synced: true,
    merged: false,
  };
}

export async function confirmReport(reportId: string): Promise<void> {
  const reports = await getLocalReports();
  const current = reports.find((r) => r.id === reportId);
  if (current) {
    await updateLocalReport(reportId, {
      upvotes: (current.upvotes || 0) + 1,
    });
  }
}

export async function updateReportStatus(reportId: string, status: 'fixed'): Promise<void> {
  await updateLocalReport(reportId, { status });
}

export async function deleteReport(reportId: string): Promise<void> {
  await deleteLocalReport(reportId);
}

export function reportsToCsv(reports: PotholeReport[]): string {
  const headers = [
    'id',
    'latitude',
    'longitude',
    'severity',
    'confidence',
    'source',
    'status',
    'upvotes',
    'createdAt',
    'date',
    'address',
    'image_uri',
    'note',
  ];

  const rows = reports.map((report) =>
    [
      report.id,
      report.lat ?? report.latitude ?? '',
      report.lng ?? report.longitude ?? '',
      report.severity,
      report.confidence,
      report.source,
      report.status,
      report.upvotes,
      new Date(report.createdAt).toISOString(),
      report.date ?? new Date(report.createdAt).toLocaleString(),
      report.address ?? '',
      report.image_uri ?? report.localImageUri ?? '',
      report.note,
    ]
      .map(escapeCsv)
      .join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}
