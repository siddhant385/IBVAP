/**
 * Convert any PostgREST/JSON representation of a `point` column to Leaflet [lat, lng].
 *
 * Postgres `point` is stored as (x, y) = (longitude, latitude).
 * Leaflet `LatLngExpression` is [latitude, longitude].
 *
 * Accepts:
 *   - point text "(lng, lat)" e.g. "(72.345, 30.85)"
 *   - [lng, lat] array
 *   - { x: lng, y: lat } object
 *   - JSON string of any of the above
 *
 * Returns null if value is missing or unparseable.
 */
export function parsePointToLatLng(value: unknown): [number, number] | null {
  if (value === null || value === undefined) return null

  let lng: number | null = null
  let lat: number | null = null

  if (Array.isArray(value) && value.length === 2) {
    lng = Number(value[0])
    lat = Number(value[1])
  } else if (typeof value === 'object' && 'x' in value && 'y' in value) {
    lng = Number((value as { x: number }).x)
    lat = Number((value as { y: number }).y)
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    const paren = trimmed.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?$/)
    if (paren) {
      lng = Number(paren[1])
      lat = Number(paren[2])
    } else {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed) && parsed.length === 2) {
          lng = Number(parsed[0])
          lat = Number(parsed[1])
        }
      } catch { /* ignore */ }
    }
  }

  if (lng === null || lat === null || isNaN(lng) || isNaN(lat)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return [lat, lng]
}
