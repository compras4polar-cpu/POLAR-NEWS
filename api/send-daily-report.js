/**
 * Endpoint acionado diariamente pelo Vercel Cron (06:00 BRT / 09:00 UTC,
 * ver vercel.json) para gerar um PDF do painel e enviar por e-mail via
 * SendGrid para compras4.polar@gmail.com.
 *
 * ATENÇÃO — esta é a peça mais frágil do backend:
 *   - Depende de renderizar Chromium headless dentro de uma função
 *     serverless (via @sparticuz/chromium + puppeteer-core). É um padrão
 *     conhecido, mas normalmente exige 1-2 rodadas de ajuste no ambiente
 *     real do Vercel (cold start, memória, timeout) que não há como
 *     testar sem uma conta Vercel real.
 *   - Requer SENDGRID_API_KEY configurada (conta gratuita em
 *     https://sendgrid.com — tier grátis cobre bem o volume de 1 e-mail/dia).
 *   - O e-mail remetente ("from") precisa ser um domínio/endereço
 *     verificado no SendGrid (Single Sender Verification), senão o envio
 *     é rejeitado.
 */

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const sgMail = require("@sendgrid/mail");
const { readDashboardData } = require("../lib/store");
const staticSnapshot = require("../data/static-snapshot.json");

const REPORT_URL = process.env.DASHBOARD_PUBLIC_URL; // ex.: https://compradores-polar.vercel.app
const REPORT_TO = process.env.REPORT_EMAIL_TO || "compras4.polar@gmail.com";
const REPORT_FROM = process.env.REPORT_EMAIL_FROM; // precisa ser verificado no SendGrid

module.exports = async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers["authorization"];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Não autorizado" });
    }
  }

  if (!process.env.SENDGRID_API_KEY) {
    return res.status(412).json({
      ok: false,
      error: "SENDGRID_API_KEY não configurada. Crie uma conta gratuita em sendgrid.com, gere uma API key e adicione como variável de ambiente no Vercel."
    });
  }
  if (!REPORT_FROM) {
    return res.status(412).json({
      ok: false,
      error: "REPORT_EMAIL_FROM não configurada. Precisa ser um remetente verificado no SendGrid (Single Sender Verification)."
    });
  }
  if (!REPORT_URL) {
    return res.status(412).json({
      ok: false,
      error: "DASHBOARD_PUBLIC_URL não configurada. Defina com a URL pública do painel implantado (ex.: https://compradores-polar.vercel.app)."
    });
  }

  let browser;
  try {
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
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" }
    });

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const dataSnapshot = await readDashboardData(staticSnapshot);
    const dateLabel = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    await sgMail.send({
      to: REPORT_TO,
      from: REPORT_FROM,
      subject: `Painel de Compras Internacionais — Polar — ${dateLabel}`,
      text: `Relatório diário automático em anexo. Última atualização de dados: ${dataSnapshot.lastUpdate}.`,
      attachments: [
        {
          content: pdfBuffer.toString("base64"),
          filename: `painel-compras-internacionais-${dateLabel.replace(/\//g, "-")}.pdf`,
          type: "application/pdf",
          disposition: "attachment"
        }
      ]
    });

    return res.status(200).json({ ok: true, sentTo: REPORT_TO, date: dateLabel });
  } catch (err) {
    console.error("[send-daily-report] Erro:", err);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (browser) await browser.close();
  }
};
