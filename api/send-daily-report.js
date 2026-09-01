/**
 * Endpoint acionado diariamente pelo Vercel Cron (ver vercel.json) para
 * gerar um PDF do painel e enviar por e-mail via SendGrid para
 * compras4.polar@gmail.com.
 *
 * A geração do PDF (Chromium/Puppeteer) vive em lib/pdf.js e também é usada
 * isoladamente por api/generate-report.js para calibração — aqui as duas
 * etapas (gerar PDF / enviar e-mail) rodam em try/catch separados, então uma
 * falha do SendGrid nunca é confundida com uma falha na renderização do PDF.
 *
 * Requer SENDGRID_API_KEY configurada (conta gratuita em
 * https://sendgrid.com — tier grátis cobre bem o volume de 1 e-mail/dia).
 * O e-mail remetente ("from") precisa ser um domínio/endereço verificado no
 * SendGrid (Single Sender Verification), senão o envio é rejeitado.
 */

const sgMail = require("@sendgrid/mail");
const { renderDashboardPdf } = require("../lib/pdf");
const { readDashboardData } = require("../lib/store");
const staticSnapshot = require("../data/static-snapshot.json");

const REPORT_TO = process.env.REPORT_EMAIL_TO || "compras4.polar@gmail.com";
const REPORT_FROM = process.env.REPORT_EMAIL_FROM; // precisa ser verificado no SendGrid

module.exports = async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers["authorization"];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Não autorizado" });
    }
  }

  // --- Etapa 1: gerar o PDF (mesma lógica usada por /api/generate-report) ---
  let pdfBuffer;
  try {
    pdfBuffer = await renderDashboardPdf();
  } catch (err) {
    console.error("[send-daily-report] Falha ao gerar o PDF:", err);
    return res.status(500).json({ ok: false, stage: "generate-pdf", error: err.message });
  }

  // --- Etapa 2: enviar por e-mail — só chega aqui se o PDF já existe ---
  if (!process.env.SENDGRID_API_KEY) {
    return res.status(412).json({
      ok: false,
      stage: "send-email",
      error: "SENDGRID_API_KEY não configurada. Crie uma conta gratuita em sendgrid.com, gere uma API key e adicione como variável de ambiente no Vercel."
    });
  }
  if (!REPORT_FROM) {
    return res.status(412).json({
      ok: false,
      stage: "send-email",
      error: "REPORT_EMAIL_FROM não configurada. Precisa ser um remetente verificado no SendGrid (Single Sender Verification)."
    });
  }

  try {
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
    console.error("[send-daily-report] Falha ao enviar e-mail:", err);
    return res.status(500).json({ ok: false, stage: "send-email", error: err.message });
  }
};
