/**
 * Endpoint acionado pelo Vercel Cron (ver vercel.json) para buscar dados
 * reais das fontes gratuitas e persistir em data/live-snapshot.json no
 * próprio repositório GitHub (ver lib/store.js).
 *
 * Protegido por CRON_SECRET: o Vercel já envia esse header automaticamente
 * em invocações de cron (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
 * Configure a env var CRON_SECRET no projeto para habilitar a checagem.
 */

const { fetchUsdBrl } = require("../lib/fetchers/bcb");
const { fetchBrent } = require("../lib/fetchers/eia");
const { fetchActiveStorms } = require("../lib/fetchers/noaa");
const { fetchSignificantEarthquakes } = require("../lib/fetchers/usgs");
const { icisPrices, drewryFreight, lmeOfficial } = require("../lib/fetchers/paidSources");
const { readDashboardData, writeDashboardData } = require("../lib/store");

// Snapshot estático usado como base/fallback — mesmos dados reais e datados
// que já estão embutidos no index.html entregue em 17/08/2026.
const staticSnapshot = require("../data/static-snapshot.json");

async function safe(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[cron-refresh] Falha em "${label}":`, err.message);
    return { id: label, unavailable: true, unavailableReason: `Erro ao consultar a fonte: ${err.message}` };
  }
}

module.exports = async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers["authorization"];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Não autorizado" });
    }
  }

  const [usdBrl, brent, storms, quakes, icis, drewry, lme] = await Promise.all([
    safe("usdbrl", fetchUsdBrl),
    safe("brent", fetchBrent),
    safe("atlantic-storms", fetchActiveStorms),
    safe("significant-earthquakes", fetchSignificantEarthquakes),
    safe("icis-chemicals", async () => icisPrices()),
    safe("drewry-freight", async () => drewryFreight()),
    safe("lme-metals", async () => lmeOfficial())
  ]);

  const current = await readDashboardData(staticSnapshot);

  const updated = {
    ...current,
    lastUpdate: new Date().toISOString(),
    live: {
      usdBrl,
      brent,
      atlanticStorms: storms,
      significantEarthquakes: quakes,
      icisChemicals: icis,
      drewryFreight: drewry,
      lmeMetals: lme
    }
  };

  const persisted = await writeDashboardData(updated);

  return res.status(200).json({
    ok: true,
    persisted,
    updatedAt: updated.lastUpdate,
    sources: { usdBrl, brent, storms, quakes, icis, drewry, lme }
  });
};
