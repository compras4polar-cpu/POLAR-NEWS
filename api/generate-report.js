/**
 * GET /api/generate-report
 * Gera o PDF do painel a partir de DASHBOARD_PUBLIC_URL e devolve o arquivo
 * diretamente na resposta (Content-Type: application/pdf).
 *
 * Endpoint de calibração: existe para testar a atualização em tela + a
 * renderização do PDF isoladamente, sem depender de SENDGRID_API_KEY nem de
 * REPORT_EMAIL_FROM — assim um problema no envio de e-mail nunca impede
 * verificar se os dados/PDF estão corretos. Não é acionado por cron; use
 * manualmente (navegador ou curl) enquanto calibra.
 */

const { renderDashboardPdf } = require("../lib/pdf");

module.exports = async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers["authorization"];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Não autorizado" });
    }
  }

  try {
    const pdfBuffer = await renderDashboardPdf();
    const dateLabel = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="painel-compras-internacionais-${dateLabel.replace(/\//g, "-")}.pdf"`
    );
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("[generate-report] Erro ao gerar PDF:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
