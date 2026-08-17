/**
 * NOAA NHC — tempestades tropicais/furacões ativos no Atlântico.
 * Feed público, gratuito, sem chave: https://www.nhc.noaa.gov/CurrentStorms.json
 */

async function fetchActiveStorms() {
  const res = await fetch("https://www.nhc.noaa.gov/CurrentStorms.json");
  if (!res.ok) throw new Error(`NOAA CurrentStorms HTTP ${res.status}`);
  const json = await res.json();
  const storms = json.activeStorms || [];

  return {
    id: "atlantic-storms",
    count: storms.length,
    storms: storms.map((s) => ({
      name: s.name,
      classification: s.classification,
      intensity: s.intensity,
      pressure: s.pressure,
      lastUpdate: s.lastUpdate
    })),
    source: "NOAA National Hurricane Center — CurrentStorms.json",
    sourceUrl: "https://www.nhc.noaa.gov/",
    dataStatus: "real"
  };
}

module.exports = { fetchActiveStorms };
