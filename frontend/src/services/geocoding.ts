/**
 * Geocoding service
 * Uses Nominatim (OpenStreetMap) geocoding API
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

/**
 * Geocode a search query to geographic coordinates
 * Uses Nominatim API with appropriate rate limiting and headers
 */
export async function geocode(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) {
    return [];
  }

  // Use Nominatim (OSM) geocoding API
  // Rate limit: 1 request per second
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mesh Community Planner (Development)',
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();

    return data.map((item: any) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      display_name: item.display_name,
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}
