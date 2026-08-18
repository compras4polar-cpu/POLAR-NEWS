/**
 * SunSirs — TDI, Cloreto de metileno (Dichloromethane) e Silicone DMC.
 *
 * SunSirs tem um desafio anti-bot em JavaScript que bloqueia fetch() simples
 * (testado e confirmado) — só passa com um navegador real. Por isso esta
 * busca reaproveita o mesmo Chromium headless (@sparticuz/chromium +
 * puppeteer-core) já usado em send-daily-report.js, e é mais lenta (~10s)
 * e mais frágil que as demais fontes: se o SunSirs mudar o HTML da lista,
 * este parser para de encontrar os itens e retorna unavailable para os
 * três — nunca um número inventado.
 *
 * Estrutura real da página (confirmada em 18/08/2026):
 *   ul.zwd_table > li > a > p (nome) / p (setor) / p (preço anterior) /
 *   p (preço atual) / p.zwd_green|zwd_red (variação %)
 */

const SOURCE_URL = "https://www.sunsirs.com/commodity-price/list-chemical.html";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

function toChemicalResult(id, productLabel, row, fxUsdCny) {
  if (!row) {
    return {
      id,
      unavailable: true,
      unavailableReason: `${productLabel} não encontrado na lista do SunSirs nesta execução (layout pode ter mudado, ou desafio anti-bot bloqueou).`
    };
  }
  const priceCny = parseFloat(row[3].replace(/,/g, ""));
  const changeValue = parseFloat(row[4].replace("%", ""));
  return {
    id,
    priceCny,
    priceUsd: fxUsdCny ? priceCny / fxUsdCny : null,
    changeValue,
    trend: changeValue > 0 ? "ALTA" : changeValue < 0 ? "BAIXA" : "ESTÁVEL",
    priceDate: new Date().toISOString().slice(0, 10),
    source: "SunSirs (China Commodity Data Group)",
    sourceUrl: SOURCE_URL,
    dataStatus: "real"
  };
}

async function fetchSunSirsChemicals(fxUsdCny) {
  const chromium = (await import("@sparticuz/chromium")).default;
  const puppeteer = (await import("puppeteer-core")).default;

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    // O desafio anti-bot recarrega a página sozinho; a lista real só
    // aparece alguns segundos depois disso.
    await new Promise((resolve) => setTimeout(resolve, 8000));

    const items = await page.evaluate(() => {
      const lis = Array.from(document.querySelectorAll("ul.zwd_table li"));
      return lis.map((li) => Array.from(li.querySelectorAll("a > p")).map((p) => p.textContent.trim()));
    });

    const findRow = (nameMatcher) => items.find((row) => nameMatcher.test(row[0] || ""));

    return {
      tdi: toChemicalResult("tdi", "TDI", findRow(/^TDI$/i), fxUsdCny),
      dcm: toChemicalResult("dcm", "Cloreto de metileno (Dichloromethane)", findRow(/dichlor/i), fxUsdCny),
      silicone: toChemicalResult("silicone", "Silicone DMC", findRow(/silicone/i), fxUsdCny)
    };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { fetchSunSirsChemicals };
