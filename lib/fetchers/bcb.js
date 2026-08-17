/**
 * Banco Central do Brasil — PTAX oficial (USD/BRL).
 * API pública, gratuita, sem necessidade de chave.
 * Documentação: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/
 *
 * O BCB só publica a PTAX em dias úteis, ~13h. Se hoje ainda não tiver
 * cotação (fim de semana, feriado, ou antes da publicação), buscamos o
 * último dia útil disponível voltando até 7 dias.
 */

function formatMMDDYYYY(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

async function fetchUsdBrl() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 7);

  const url =
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo" +
    `(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${formatMMDDYYYY(start)}'` +
    `&@dataFinalCotacao='${formatMMDDYYYY(today)}'&$format=json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`BCB PTAX HTTP ${res.status}`);
  const json = await res.json();
  const rows = json.value || [];
  if (!rows.length) throw new Error("BCB PTAX: nenhuma cotação retornada no período consultado");

  rows.sort((a, b) => new Date(a.dataHoraCotacao) - new Date(b.dataHoraCotacao));
  const latest = rows[rows.length - 1];
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;

  const value = latest.cotacaoVenda;
  const change = previous ? ((value - previous.cotacaoVenda) / previous.cotacaoVenda) * 100 : null;

  return {
    id: "usdbrl",
    value,
    unit: "R$",
    change,
    asOf: latest.dataHoraCotacao,
    source: "Banco Central do Brasil — PTAX oficial (API Olinda)",
    sourceUrl: "https://www.bcb.gov.br/conversao",
    dataStatus: "real"
  };
}

module.exports = { fetchUsdBrl };
