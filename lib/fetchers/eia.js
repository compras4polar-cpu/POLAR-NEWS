/**
 * EIA (U.S. Energy Information Administration) — Brent Crude Oil Spot Price.
 * API pública, GRATUITA, mas exige registro de uma chave gratuita em:
 * https://www.eia.gov/opendata/register.php
 *
 * Sem a chave (env var EIA_API_KEY), esta função retorna unavailable:true
 * em vez de inventar um preço.
 */

async function fetchBrent() {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    return {
      id: "brent",
      unavailable: true,
      unavailableReason: "EIA_API_KEY não configurada. Registre uma chave gratuita em https://www.eia.gov/opendata/register.php e adicione como variável de ambiente no Vercel."
    };
  }

  const url =
    "https://api.eia.gov/v2/petroleum/pri/spt/data/" +
    `?api_key=${apiKey}&frequency=daily&data[0]=value` +
    "&facets[series][]=RBRTE&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=2";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`EIA HTTP ${res.status}`);
  const json = await res.json();
  const rows = json.response && json.response.data ? json.response.data : [];
  if (!rows.length) throw new Error("EIA: nenhum dado retornado para a série RBRTE (Brent)");

  const latest = rows[0];
  const previous = rows[1] || null;
  const value = Number(latest.value);
  const change = previous ? ((value - Number(previous.value)) / Number(previous.value)) * 100 : null;

  return {
    id: "brent",
    value,
    unit: "US$/barril",
    change,
    changePeriod: "vs. dia anterior (dado diário EIA)",
    asOf: latest.period,
    source: "EIA — U.S. Energy Information Administration (série RBRTE, Brent spot FOB)",
    sourceUrl: "https://www.eia.gov/todayinenergy/prices.php",
    dataStatus: "real"
  };
}

module.exports = { fetchBrent };
