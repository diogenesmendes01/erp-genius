import { EtapaLead, Segmento, Temperatura } from "@prisma/client";
import type { AnaliseLead, ContextoAnalise, DriverIA, ResumoExecutivo } from "./tipos";

// DRIVER SIMULADO (heurístico, determinístico, sem rede): o copiloto FUNCIONA em qualquer
// ambiente — sem ANTHROPIC_API_KEY o app continua operável e testável ponta a ponta, e as
// sugestões deixam claro que vieram da heurística local ("simulado" no rótulo do modelo).
// As regras são deliberadamente conservadoras: melhor NÃO sugerir do que sugerir errado.

const KEYWORDS_KIDS = ["filho", "filha", "hijo", "hija", "niño", "nina", "niña", "kids", "criança", "crianca"];
const KEYWORDS_TEENS = ["adolescente", "teen", "teens", "15 anos", "16 anos", "17 anos", "colegio", "colégio"];
const KEYWORDS_EMPRESA = ["empresa", "equipe", "funcionários", "funcionarios", "colaboradores", "corporativo", "in company"];
const KEYWORDS_URGENCIA = ["urgente", "logo", "rápido", "rapido", "essa semana", "esta semana", "amanhã", "amanha", "ya", "pronto"];
const KEYWORDS_PRECO = ["caro", "preço", "preco", "precio", "valor", "desconto", "cuánto", "cuanto", "quanto custa"];
const KEYWORDS_HORARIO = ["horário", "horario", "noite", "manhã", "manha", "sábado", "sabado", "fim de semana"];
const KEYWORDS_EXPERIMENTAL = ["experimental", "aula teste", "aula gratis", "clase de prueba", "prueba"];

function contem(textos: string[], keywords: string[]): boolean {
  return textos.some((t) => keywords.some((k) => t.includes(k)));
}

export const driverSimulado: DriverIA = {
  nome: "simulado",
  async analisar(ctx: ContextoAnalise): Promise<AnaliseLead> {
    const entradas = ctx.mensagens.filter((m) => m.direcao === "ENTRADA");
    const textosEntrada = entradas.map((m) => m.corpo.toLowerCase());
    const ultimaEntrada = entradas.at(-1) ?? null;

    // ── Temperatura: engajamento recente do LEAD (não da escola) ──
    let temperatura: Temperatura | null = null;
    if (ultimaEntrada) {
      const horasDesde = (Date.now() - new Date(ultimaEntrada.quandoISO).getTime()) / 3600_000;
      if (entradas.length >= 3 && horasDesde <= 24) temperatura = Temperatura.QUENTE;
      else if (horasDesde > 24 * 7) temperatura = Temperatura.FRIO;
      else if (entradas.length >= 1) temperatura = Temperatura.MORNO;
    }
    if (temperatura === ctx.lead.temperatura) temperatura = null; // igual ao atual: nada a sugerir

    // ── Segmento: só quando há sinal textual explícito ──
    let segmento: Segmento | null = null;
    if (contem(textosEntrada, KEYWORDS_EMPRESA)) segmento = Segmento.EMPRESA;
    else if (contem(textosEntrada, KEYWORDS_KIDS)) segmento = Segmento.KIDS;
    else if (contem(textosEntrada, KEYWORDS_TEENS)) segmento = Segmento.TEENS;
    if (segmento === ctx.lead.segmento) segmento = null;

    // ── Resumo executivo: preenche apenas campos com evidência ──
    const resumo: ResumoExecutivo = {
      interesse: null,
      objetivo: null,
      urgencia: contem(textosEntrada, KEYWORDS_URGENCIA) ? "Alta — mencionou pressa nas mensagens" : null,
      orcamento: contem(textosEntrada, KEYWORDS_PRECO) ? "Sensível a preço — perguntou sobre valores" : null,
      objecao: contem(textosEntrada, KEYWORDS_HORARIO) ? "Restrição de horário mencionada" : null,
      proximaAcao: null,
    };
    if (contem(textosEntrada, KEYWORDS_EXPERIMENTAL)) {
      resumo.interesse = "Aula experimental";
      resumo.proximaAcao = ctx.lead.dataExperimentalISO ? null : "Oferecer horários da aula experimental";
    } else if (ultimaEntrada) {
      resumo.interesse = "Informações sobre os cursos";
    }
    const resumoTemAlgo = Object.values(resumo).some((v) => v !== null);
    const resumoNovo = resumoTemAlgo
      ? Object.entries(resumo).some(
          ([campo, valor]) => valor !== null && ctx.lead.resumoAtual[campo as keyof ResumoExecutivo] !== valor,
        )
      : false;

    // ── Etapa: só a transição óbvia e segura (NOVO → EM_ATENDIMENTO quando a escola já
    //    respondeu) e sempre dentro dos destinos manuais permitidos ──
    let etapaSugerida: EtapaLead | null = null;
    const escolaRespondeu = ctx.mensagens.some((m) => m.direcao === "SAIDA");
    if (
      ctx.lead.etapa === EtapaLead.NOVO &&
      escolaRespondeu &&
      ctx.lead.etapasPermitidas.includes(EtapaLead.EM_ATENDIMENTO)
    ) {
      etapaSugerida = EtapaLead.EM_ATENDIMENTO;
    }

    return {
      resumo: resumoNovo ? resumo : null,
      temperatura,
      segmento,
      etapaSugerida,
      justificativa:
        `Heurística local sobre ${ctx.mensagens.length} mensagem(ns) da conversa` +
        (entradas.length ? ` (${entradas.length} do lead)` : "") +
        ". Configure ANTHROPIC_API_KEY para análise por IA.",
    };
  },
};
