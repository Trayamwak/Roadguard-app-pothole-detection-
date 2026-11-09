export function distanceMeters(
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
) {
  const radius = 6371000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = radians(first.lat);
  const lat2 = radians(second.lat);
  const dLat = radians(second.lat - first.lat);
  const dLng = radians(second.lng - first.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}
