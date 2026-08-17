/**
 * Camada de persistência dos dados do dashboard.
 *
 * Usa Vercel KV (Redis gerenciado, tem plano gratuito) quando as variáveis
 * KV_REST_API_URL / KV_REST_API_TOKEN estiverem configuradas no projeto
 * Vercel (isso acontece automaticamente ao habilitar "Storage > KV" no
 * painel do projeto — não precisa escrever nenhuma credencial manualmente).
 *
 * Se o KV não estiver configurado (ex.: ambiente local, ou antes de você
 * habilitar o Storage), cai para um snapshot estático em memória para que
 * a API nunca quebre — apenas não terá dados "ao vivo".
 */

const KEY = "dashboardData:v1";

let kvClient = null;
function getKv() {
  if (kvClient) return kvClient;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  // import tardio para não falhar caso o pacote não esteja instalado localmente
  const { kv } = require("@vercel/kv");
  kvClient = kv;
  return kvClient;
}

async function readDashboardData(fallback) {
  const kv = getKv();
  if (!kv) return fallback;
  try {
    const data = await kv.get(KEY);
    return data || fallback;
  } catch (err) {
    console.error("[store] Falha ao ler do Vercel KV, usando fallback:", err.message);
    return fallback;
  }
}

async function writeDashboardData(data) {
  const kv = getKv();
  if (!kv) {
    console.warn("[store] Vercel KV não configurado — dado NÃO foi persistido (apenas retornado em memória).");
    return false;
  }
  await kv.set(KEY, data);
  return true;
}

module.exports = { readDashboardData, writeDashboardData };
