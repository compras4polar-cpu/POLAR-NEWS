/**
 * USGS — terremotos significativos na última semana (magnitude relevante).
 * Feed público, gratuito, sem chave.
 * Documentação: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 */

async function fetchSignificantEarthquakes() {
  const res = await fetch(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson"
  );
  if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
  const json = await res.json();
  const features = json.features || [];

  return {
    id: "significant-earthquakes",
    count: features.length,
    events: features.map((f) => ({
      place: f.properties.place,
      magnitude: f.properties.mag,
      time: new Date(f.properties.time).toISOString(),
      tsunamiWarning: !!f.properties.tsunami,
      url: f.properties.url
    })),
    source: "USGS — Significant Earthquakes, Past Week",
    sourceUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
    dataStatus: "real"
  };
}

module.exports = { fetchSignificantEarthquakes };
