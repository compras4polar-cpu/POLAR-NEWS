/**
 * Conectores para fontes PAGAS (ICIS, Drewry/Xeneta, LME/Bloomberg oficial).
 *
 * A Polar ainda não confirmou assinatura ativa para nenhuma destas fontes.
 * Estas funções NÃO inventam valores: enquanto a variável de ambiente
 * correspondente não existir, retornam unavailable:true com a orientação
 * exata de como habilitar.
 *
 * Quando a Polar assinar um desses serviços, o time de TI só precisa:
 *   1) Obter as credenciais/endpoint da API junto ao fornecedor.
 *   2) Adicionar a variável de ambiente no projeto Vercel.
 *   3) Implementar a chamada HTTP real dentro da função correspondente
 *      (a assinatura de retorno já está pronta para o resto do sistema).
 */

function icisPrices() {
  if (!process.env.ICIS_API_KEY) {
    return {
      id: "icis-chemicals",
      unavailable: true,
      unavailableReason:
        "ICIS_API_KEY não configurada. Requer contrato comercial com a ICIS (icis.com/explore/services/pricing). " +
        "Sem isso, o painel continua usando os preços spot gratuitos (SunSirs/100ppi) já embutidos no snapshot estático."
    };
  }
  // TODO: implementar chamada real ao endpoint contratado da ICIS assim que a Polar tiver acesso.
  throw new Error("Conector ICIS ainda não implementado — apenas a checagem de credencial está pronta.");
}

function drewryFreight() {
  if (!process.env.DREWRY_API_KEY) {
    return {
      id: "drewry-freight",
      unavailable: true,
      unavailableReason:
        "DREWRY_API_KEY não configurada. Requer assinatura Drewry Supply Chain Advisors ou Xeneta. " +
        "Sem isso, o painel usa os valores públicos do World Container Index publicados semanalmente (com atraso de dias)."
    };
  }
  throw new Error("Conector Drewry ainda não implementado — apenas a checagem de credencial está pronta.");
}

function lmeOfficial() {
  if (!process.env.LME_API_KEY) {
    return {
      id: "lme-metals",
      unavailable: true,
      unavailableReason:
        "LME_API_KEY não configurada. Requer assinatura LME.com ou terminal Bloomberg/Refinitiv. " +
        "Sem isso, o painel usa a Trading Economics como espelho gratuito do estanho (com defasagem de 1-3 dias)."
    };
  }
  throw new Error("Conector LME oficial ainda não implementado — apenas a checagem de credencial está pronta.");
}

module.exports = { icisPrices, drewryFreight, lmeOfficial };
