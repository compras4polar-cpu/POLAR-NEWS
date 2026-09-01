/**
 * Geração do PDF do painel a partir da URL pública publicada no Vercel.
 *
 * Isolado do envio de e-mail (ver api/send-daily-report.js) para permitir
 * calibrar a renderização (Chromium/Puppeteer) via api/generate-report.js
 * sem depender de SendGrid estar configurado — uma etapa não trava a outra.
 */

const REPORT_URL = process.env.DASHBOARD_PUBLIC_URL; // ex.: https://polar-news.vercel.app

async function renderDashboardPdf() {
  if (!REPORT_URL) {
    const err = new Error(
      "DASHBOARD_PUBLIC_URL não configurada. Defina com a URL pública do painel implantado (ex.: https://polar-news.vercel.app)."
    );
    err.code = "MISSING_DASHBOARD_URL";
    throw err;
  }

  let browser;
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    const page = await browser.newPage();
    // O painel fica protegido pelo Vercel Deployment Protection; sem este
    // header, o Puppeteer só conseguiria "imprimir" a tela de login do
    // Vercel em vez do painel real. VERCEL_AUTOMATION_BYPASS_SECRET é o
    // mesmo valor gerado em Settings > Deployment Protection > Protection
    // Bypass for Automation.
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      await page.setExtraHTTPHeaders({
        "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        "x-vercel-set-bypass-cookie": "true"
      });
    }
    await page.goto(REPORT_URL, { waitUntil: "networkidle0", timeout: 45000 });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" }
    });
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { renderDashboardPdf };
