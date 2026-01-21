export function randomPointWithinRadius(
  lat: number,
  lng: number,
  radiusMeters: number,
): { lat: number; lng: number } {
  const r = radiusMeters / 111_300; // meters → degrees
  const u = Math.random();
  const v = Math.random();

  const w = r * Math.sqrt(u);
  const t = 2 * Math.PI * v;

  const newLat = lat + w * Math.cos(t);
  const newLng = lng + (w * Math.sin(t)) / Math.cos(lat * (Math.PI / 180));

  return { lat: newLat, lng: newLng };
}

export function randomDistanceMeters(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
