/**
 * GET /api/dashboard-data
 * Retorna o snapshot de dados mais recente (persistido pelo cron-refresh),
 * ou o fallback estático se o KV ainda não tiver sido populado.
 *
 * Chamado pelo frontend (index.html) quando servido a partir do domínio
 * do Vercel. Quando o mesmo index.html é aberto localmente como arquivo
 * (file://), este fetch falha silenciosamente e o painel usa os dados
 * embutidos — ver função loadLiveDataIfAvailable() no index.html.
 */

const { readDashboardData } = require("../lib/store");
const staticSnapshot = require("../data/static-snapshot.json");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  const data = await readDashboardData(staticSnapshot);
  return res.status(200).json(data);
};
