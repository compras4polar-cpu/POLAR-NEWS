/**
 * Camada de persistência dos dados do dashboard.
 *
 * Em vez de um banco externo (Vercel KV/Redis exige uma integração de
 * marketplace com aceite de termos manual, o que não é automatizável), este
 * projeto usa o próprio repositório GitHub como armazenamento: o cron grava
 * um arquivo JSON versionado via GitHub Contents API. Isso tem um efeito
 * colateral bom: cada atualização vira um commit, dando de graça um
 * histórico auditável dos indicadores (algo que a visão futura do projeto
 * já pedia).
 *
 * Variáveis de ambiente necessárias:
 *   GITHUB_TOKEN      - token com escopo de escrita no repositório
 *   GITHUB_REPO       - "dono/repositorio", ex.: "compras4polar-cpu/POLAR-NEWS"
 *   GITHUB_DATA_PATH  - caminho do arquivo de dados no repo (opcional,
 *                       padrão "data/live-snapshot.json")
 *
 * Sem essas variáveis, o sistema cai para o snapshot estático em memória —
 * a API nunca quebra, só não persiste entre execuções.
 */

const DEFAULT_PATH = "data/live-snapshot.json";

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const path = process.env.GITHUB_DATA_PATH || DEFAULT_PATH;
  if (!token || !repo) return null;
  return { token, repo, path };
}

async function readDashboardData(fallback) {
  const cfg = getConfig();
  if (!cfg) return fallback;
  try {
    const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/vnd.github+json"
      }
    });
    if (res.status === 404) return fallback; // ainda não existe primeiro snapshot ao vivo
    if (!res.ok) throw new Error(`GitHub Contents API HTTP ${res.status}`);
    const json = await res.json();
    const content = Buffer.from(json.content, "base64").toString("utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("[store] Falha ao ler do GitHub, usando fallback:", err.message);
    return fallback;
  }
}

async function writeDashboardData(data) {
  const cfg = getConfig();
  if (!cfg) {
    console.warn("[store] GITHUB_TOKEN/GITHUB_REPO não configurados — dado NÃO foi persistido.");
    return false;
  }

  const apiUrl = `https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`;
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json"
  };

  // Precisa do sha do arquivo atual para poder sobrescrevê-lo (API do GitHub exige isso).
  let sha;
  const current = await fetch(apiUrl, { headers });
  if (current.ok) {
    const currentJson = await current.json();
    sha = currentJson.sha;
  } else if (current.status !== 404) {
    throw new Error(`GitHub Contents API (GET) HTTP ${current.status}`);
  }

  const body = {
    message: `chore: atualização automática dos dados (${new Date().toISOString()})`,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    committer: { name: "Painel Compras Bot", email: "compras4.polar@gmail.com" }
  };
  if (sha) body.sha = sha;

  const put = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!put.ok) {
    const errText = await put.text();
    throw new Error(`GitHub Contents API (PUT) HTTP ${put.status}: ${errText}`);
  }
  return true;
}

module.exports = { readDashboardData, writeDashboardData };
