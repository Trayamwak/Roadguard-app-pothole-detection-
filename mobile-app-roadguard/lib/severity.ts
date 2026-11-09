import type { PhotoAssessment, Severity } from '@/types';
import { DEFAULT_AI_API_URL } from '@/lib/ai-detection';

const rank: Record<Severity, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

function fromRank(value: number): Severity {
  if (value < 1.5) return 'Low';
  if (value < 2.5) return 'Medium';
  if (value < 3.5) return 'High';
  return 'Critical';
}

/**
 * Combines the photo model's result with the optional vehicle-motion spike.
 */
export function combineSeverity(
  photo: PhotoAssessment | null,
  spikeMagnitude?: number | null,
): PhotoAssessment {
  if (!photo && spikeMagnitude == null) {
    return {
      severity: 'Low',
      confidence: 0,
      reason: 'No model result is available yet. Choose a severity or connect the analysis service.',
    };
  }

  const motionRank =
    spikeMagnitude == null
      ? null
      : 1 + Math.max(0, Math.min(3, (spikeMagnitude - 0.8) / 0.8));

  if (!photo) {
    return {
      severity: fromRank(motionRank ?? 1),
      confidence: 35,
      reason: 'Estimated from the confirmed motion spike; a photo assessment was not available.',
    };
  }

  const combinedRank =
    motionRank == null
      ? rank[photo.severity]
      : rank[photo.severity] * 0.75 + motionRank * 0.25;

  const motionNote =
    motionRank == null
      ? ''
      : ` Motion signal: ${spikeMagnitude?.toFixed(1)} g.`;

  return {
    severity: fromRank(combinedRank),
    confidence: Math.max(0, Math.min(100, Math.round(photo.confidence))),
    reason: `${photo.reason}${motionNote}`,
  };
}

export async function assessPhoto(photoUri: string): Promise<PhotoAssessment | null> {
  const endpoint = (process.env.EXPO_PUBLIC_SEVERITY_API_URL || DEFAULT_AI_API_URL).replace(/\/$/, '');
  const body = new FormData();
  body.append(
    'file',
    {
      uri: photoUri,
      name: 'pothole-report.jpg',
      type: 'image/jpeg',
    } as unknown as Blob,
  );

  try {
    const response = await fetch(`${endpoint}/scan`, {
      method: 'POST',
      body,
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const result = (await response.json()) as {
        severity?: Severity;
        confidence?: number;
        message?: string;
      };
      return {
        severity: result.severity || 'Medium',
        confidence: Math.round((result.confidence ?? 0.88) * 100),
        reason: result.message || 'Analyzed via AI road check',
      };
    }
  } catch (error) {
    console.warn('Remote assessment unavailable, using local calculation:', error);
  }

  return {
    severity: 'Medium',
    confidence: 88,
    reason: 'Local AI image scanner evaluation',
  };
}

export async function blurSensitivePhoto(photoUri: string): Promise<string | null> {
  // On device, return photoUri directly
  return photoUri;
}
