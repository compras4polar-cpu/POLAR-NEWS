/**
 * Trading Economics — USD/CNY e Baltic Dry Index.
 *
 * Trading Economics NÃO tem API gratuita oficial, mas (diferente de
 * SunSirs/100ppi.com) suas páginas HTML não têm desafio anti-bot — um
 * fetch simples com um User-Agent de navegador real funciona. Isso é
 * scraping de HTML, não uma API estável: se a Trading Economics mudar o
 * layout da tabela, este parser pode parar de funcionar e passará a
 * retornar unavailable (nunca um número inventado).
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchRow(url, dataSymbol) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Trading Economics HTTP ${res.status}`);
  const html = await res.text();

  const rowRegex = new RegExp(
    `data-symbol=["']${escapeRegex(dataSymbol)}["'][\\s\\S]*?</tr>`
  );
  const rowMatch = html.match(rowRegex);
  if (!rowMatch) throw new Error(`Símbolo ${dataSymbol} não encontrado na página (layout pode ter mudado)`);
  const row = rowMatch[0];

  const priceMatch = row.match(/id="p">([^<]+)</);
  const changeMatch = row.match(/id="pch"[^>]*>([^<]+)</);
  const dateMatch = row.match(/id="date"[^>]*>([^<]+)</);

  if (!priceMatch) throw new Error(`Preço não encontrado para ${dataSymbol} (layout pode ter mudado)`);

  const value = parseFloat(priceMatch[1].replace(/,/g, "").trim());
  const change = changeMatch ? parseFloat(changeMatch[1].replace("%", "").trim()) : null;
  const dateLabel = dateMatch ? dateMatch[1].trim() : null;

  return { value, change, dateLabel };
}

async function fetchUsdCny() {
  const { value, change, dateLabel } = await fetchRow("https://tradingeconomics.com/china/currency", "USDCNY:CUR");
  return {
    id: "usdcny",
    value,
    unit: "¥",
    change,
    asOf: dateLabel || new Date().toISOString().slice(0, 10),
    source: "Trading Economics",
    sourceUrl: "https://tradingeconomics.com/china/currency",
    dataStatus: "real"
  };
}

async function fetchBdi() {
  const { value, change, dateLabel } = await fetchRow("https://tradingeconomics.com/commodity/baltic", "BDIY:IND");
  return {
    id: "bdi",
    value,
    unit: "pts",
    change,
    asOf: dateLabel || new Date().toISOString().slice(0, 10),
    source: "Trading Economics (proxy gratuito; Baltic Exchange oficial é pago)",
    sourceUrl: "https://tradingeconomics.com/commodity/baltic",
    dataStatus: "real"
  };
}

module.exports = { fetchUsdCny, fetchBdi };
