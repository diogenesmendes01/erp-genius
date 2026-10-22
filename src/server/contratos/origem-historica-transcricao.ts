import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { CoberturaInicialSchema, DataCivilSchema, periodoMensalNaData } from "@/server/matricula/cobertura";
import { calcularAdiantamentoProposto } from "@/server/matricula/adiantamento-proposto";
import { planejarCobrancasEntrada } from "@/server/matricula/plano-cobrancas-entrada";
import type { OrigemCampo } from "./campos";

// Contrato legado assinado fora do sistema: a transcrição é a declaração explícita das condições que constam no
// PDF. Nada é presumido — só o que for transcrito fica estruturado (e, portanto, alterável por aditivo). A
// projeção reproduz o formato do snapshot da prévia, para que a cadeia de aditivos leia a mesma coisa.
const dinheiro = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, "Informe decimal canônico com até duas casas.");
const moeda = z.string().regex(/^[A-Z]{3}$/, "Informe a moeda ISO em três letras maiúsculas.");
const textoCurto = z.string().trim().min(1).max(400);
const opcional = z.string().trim().min(1).max(400).optional();
const parte = z.object({ nome: textoCurto, documento: opcional, email: z.string().trim().email().max(254).optional(), endereco: opcional }).strict();

export const TranscricaoOrigemHistoricaSchema = z.object({
  moeda,
  aluno: parte,
  pagador: parte.optional(),
  taxa: z.object({ valor: dinheiro, vencimento: DataCivilSchema }).strict(),
  aulas: z.discriminatedUnion("regime", [
    z.object({ regime: z.literal("MENSALIDADE"), valor: dinheiro, primeiroVencimento: DataCivilSchema, cobertura: CoberturaInicialSchema }).strict(),
    z.object({ regime: z.literal("HORA_PARTICULAR"), valorHora: dinheiro, adiantamento: z.object({ minutos: z.number().int().positive().max(5_256_000), vencimento: DataCivilSchema }).strict().optional() }).strict(),
  ]),
}).strict();
export type TranscricaoOrigemHistorica = z.infer<typeof TranscricaoOrigemHistoricaSchema>;

/** Projeta a transcrição no formato do snapshot da prévia (condições + campos), sem texto de modelo. */
export function projetarOrigemHistorica(entrada: unknown) {
  const t = TranscricaoOrigemHistoricaSchema.parse(entrada);
  const diaVencimento = Number(t.aulas.regime === "MENSALIDADE" ? t.aulas.primeiroVencimento.slice(8, 10) : "1");
  const adiantamento = t.aulas.regime === "HORA_PARTICULAR" && t.aulas.adiantamento
    ? calcularAdiantamentoProposto("HORA_PARTICULAR", t.aulas.adiantamento.minutos, t.aulas.valorHora, true) : null;
  const condicoes = {
    taxaVencimento: t.taxa.vencimento,
    aulas: t.aulas.regime === "MENSALIDADE"
      ? { regime: "MENSALIDADE" as const, cobertura: t.aulas.cobertura, primeiroVencimento: t.aulas.primeiroVencimento, diaVencimentoContratado: diaVencimento }
      : { regime: "HORA_PARTICULAR" as const, ...(t.aulas.adiantamento ? { vencimentoAdiantamento: t.aulas.adiantamento.vencimento } : {}) },
    moeda: t.moeda, taxaProposta: t.taxa.valor,
    valorServicoProposto: t.aulas.regime === "MENSALIDADE" ? t.aulas.valor : t.aulas.valorHora,
    politicaEntrada: { taxaPreviaAssinatura: true, exigirPrimeiraMensalidade: t.aulas.regime === "MENSALIDADE" ? true : null, adiantamentoHoraExigido: t.aulas.regime === "HORA_PARTICULAR" ? !!t.aulas.adiantamento : null },
    adiantamentoProposto: adiantamento ? { minutos: adiantamento.minutos, valor: adiantamento.valor, valorHora: adiantamento.valorHora, unidadeMinutos: 60 as const } : null,
  };
  // A mesma aritmética do plano de entrada confere a transcrição (cobertura mensal, adiantamento por minutos).
  let plano: ReturnType<typeof planejarCobrancasEntrada>;
  try { plano = planejarCobrancasEntrada(condicoes); } catch (erro) { throw new ErroRegra(erro instanceof Error ? erro.message : "Transcrição insuficiente."); }
  const taxa = plano.find(p => p.tipo === "MATRICULA")!, mensalidade = plano.find(p => p.tipo === "MENSALIDADE"), antecipacao = plano.find(p => p.tipo === "HORA_PARTICULAR");
  if (t.aulas.regime === "MENSALIDADE") periodoMensalNaData(t.aulas.cobertura.referencia === "MES_CIVIL" ? { referencia: "MES_CIVIL" } : { referencia: "CICLO_MATRICULA", dataReferencia: t.aulas.cobertura.inicio }, t.aulas.cobertura.inicio);
  const valorMoeda = (v: string) => `${new Prisma.Decimal(v).toFixed(2)} ${t.moeda}`;
  const fontes: Partial<Record<OrigemCampo, string | undefined>> = {
    ALUNO_NOME: t.aluno.nome, ALUNO_DOCUMENTO: t.aluno.documento, ALUNO_EMAIL: t.aluno.email, ALUNO_ENDERECO: t.aluno.endereco,
    PAGADOR_NOME: t.pagador?.nome, PAGADOR_DOCUMENTO: t.pagador?.documento, PAGADOR_EMAIL: t.pagador?.email, PAGADOR_ENDERECO: t.pagador?.endereco,
    MOEDA: t.moeda, REGIME: t.aulas.regime === "MENSALIDADE" ? "Mensalidade" : "Particular por hora",
    TAXA_VALOR: valorMoeda(taxa.valor), TAXA_VENCIMENTO: taxa.vencimento,
    MENSALIDADE_VALOR: mensalidade && valorMoeda(mensalidade.valor), PRIMEIRA_MENSALIDADE_VENCIMENTO: mensalidade?.vencimento,
    COBERTURA_INICIO: mensalidade?.cobertura?.inicio, COBERTURA_FIM: mensalidade?.cobertura?.fim,
    HORA_VALOR: t.aulas.regime === "HORA_PARTICULAR" ? valorMoeda(t.aulas.valorHora) : undefined,
    ADIANTAMENTO_VALOR: antecipacao && valorMoeda(antecipacao.valor), ADIANTAMENTO_MINUTOS: antecipacao?.minutos?.toString(), ADIANTAMENTO_VENCIMENTO: antecipacao?.vencimento,
  };
  const campos = Object.entries(fontes).filter((par): par is [OrigemCampo, string] => typeof par[1] === "string" && par[1].length > 0)
    .map(([origem, valor]) => ({ chave: origem.toLowerCase(), origem, valor }));
  return {
    transcricao: t,
    projecao: {
      modeloCodigo: "ORIGEM_HISTORICA", modeloVersao: 0, condicoesVersao: 0, aplicacao: "ORIGEM_HISTORICA", condicoes,
      documento: { titulo: "Contrato de origem histórica (transcrição conferida)", secoes: [], campos },
    },
  };
}
