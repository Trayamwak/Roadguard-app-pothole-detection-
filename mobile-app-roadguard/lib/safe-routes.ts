import { auth } from '@/lib/firebase';

export interface SafeRoutePoint {
  latitude: number;
  longitude: number;
}

export interface SafeRouteWarning {
  report_id: string;
  lat: number;
  lng: number;
  severity: 'High' | 'Critical';
}

export interface SafeRouteOption {
  polyline: string;
  points: SafeRoutePoint[];
  distance_meters: number;
  duration_seconds: number;
  warning_count: number;
  warnings: SafeRouteWarning[];
  score_seconds: number;
}

export async function findSafeRoutes(
  origin: { lat: number; lng: number },
  destination: string,
): Promise<{ routes: SafeRouteOption[]; notice: string }> {
  const endpoint = process.env.EXPO_PUBLIC_SEVERITY_API_URL?.replace(/\/$/, '');
  if (!endpoint) throw new Error('Configure the FastAPI service URL to search for a safer route.');
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Log in to use pothole-aware routing.');
  let response: Response;
  try {
    response = await fetch(`${endpoint}/safe-route`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination: destination.trim(),
      }),
    });
  } catch {
    throw new Error('Could not reach the route service. Check the network and try again.');
  }
  const payload = await response.json().catch(() => ({})) as {
    detail?: string;
    routes?: SafeRouteOption[];
    notice?: string;
  };
  if (!response.ok) throw new Error(payload.detail || `Route service returned ${response.status}.`);
  if (!Array.isArray(payload.routes)) throw new Error('The route service returned an invalid result.');
  return { routes: payload.routes, notice: payload.notice || '' };
}
