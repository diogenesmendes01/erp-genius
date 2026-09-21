import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { ErroRegra } from "@/server/_shared";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { validarValorAlteracaoAditivo } from "@/server/contratos/aditivo-valores";
import { RegrasHorasSchema } from "./condicoes-horas-schema";
import { OcorrenciaHorasSchema } from "./ocorrencia-horas";
import { apurarFechamentoHoras, type EntradaFechamentoHoras } from "./fechamento-horas";

const DecimalCanonico = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);
const ReferenciaAditivo = z.object({ id: z.string().min(1), versao: z.number().int().positive(), condicoesHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const Memoria = z.object({ matriculaId: z.string(), ocorrenciaId: z.string(), condicoesId: z.string(), regras: RegrasHorasSchema,
  classificacao: z.object({ origem: OcorrenciaHorasSchema }), minutos: z.number().int().positive(), valorApurado: DecimalCanonico, moeda: z.string(),
  // Ausentes nos fatos anteriores ao aditivo. A referência, quando existe, é
  // uma identidade preservada do preço já conferido, não uma consulta de preço atual.
  precoHoraAplicado: DecimalCanonico.optional(), aditivo: ReferenciaAditivo.nullable().optional() });

function precoDaVersaoPreservada(v: { condicoes: Prisma.JsonValue; condicoesHash: string }, base: string, moeda: string) {
  if (hashSubstituicao(v.condicoes) !== v.condicoesHash || v.condicoes === null || Array.isArray(v.condicoes) || typeof v.condicoes !== "object") {
    throw new ErroRegra("Versão de aditivo preservada diverge de sua integridade.");
  }
  const condicoes = v.condicoes as Record<string, unknown>;
  if (condicoes.REGIME !== undefined) {
    const regime = validarValorAlteracaoAditivo("REGIME", condicoes.REGIME);
    if (regime.tipo !== "REGIME" || regime.regime !== "HORA_PARTICULAR") throw new ErroRegra("Regime da versão preservada não permite cobrança por hora.");
  }
  if (condicoes.MOEDA !== undefined) {
    const moedaAditivo = validarValorAlteracaoAditivo("MOEDA", condicoes.MOEDA);
    if (moedaAditivo.tipo !== "MOEDA" || moedaAditivo.moeda !== moeda) throw new ErroRegra("Moeda da versão preservada diverge da matrícula.");
  }
  if (condicoes.HORA_VALOR === undefined) return base;
  const hora = validarValorAlteracaoAditivo("HORA_VALOR", condicoes.HORA_VALOR);
  if (hora.tipo !== "DINHEIRO" || hora.moeda !== moeda) throw new ErroRegra("Preço por hora da versão preservada diverge da matrícula.");
  return hora.valor;
}

/** Leitura interna. O chamador fornece período/vencimento contratuais e trava agenda/matrícula.
 * Nenhum informe não conferido é promovido a ocorrência cobrável por este leitor.
 */
export async function carregarApuracaoHorasTx(tx: Prisma.TransactionClient, d: Omit<EntradaFechamentoHoras, "encontros" | "moeda"> & { alunoId: string }) {
  const m = await tx.matricula.findFirst({ where: { id: d.matriculaId, alunoId: d.alunoId }, select: { moeda: true, preparacaoComercial: { select: { regime: true } } } });
  if (!m) throw new ErroRegra("Matrícula não encontrada para este aluno.");
  if (m.preparacaoComercial && m.preparacaoComercial.regime !== "HORA_PARTICULAR") throw new ErroRegra("Matrícula não contratada por hora.");
  // Valida os limites antes de consultar; entradas de período malformadas não viram filtros abertos.
  apurarFechamentoHoras({ matriculaId: d.matriculaId, moeda: m.moeda, periodo: d.periodo, vencimento: d.vencimento, escolha: d.escolha, encontros: [] });
  const encontros = await tx.encontroAgenda.findMany({ where: { finalidade: "AULA", matriculaId: d.matriculaId, turmaId: null, status: { not: "RASCUNHO" },
    inicio: { gte: new Date(d.periodo.inicio), lt: new Date(d.periodo.fimExclusivo) } }, orderBy: [{ inicio: "asc" }, { id: "asc" }],
    include: { conferenciaOcorrenciaHoras: { include: { itemFaturado: { include: { emissao: { select: { cobrancaId: true } } } }, consumoAntecipacao: { select: { id: true, reservaId: true } }, aplicacaoNaoCobravel: { select: { id: true } }, condicoes: { select: { regras: true } }, ocorrencia: true } },
      ocorrenciasParticulares: { orderBy: { versao: "desc" }, take: 1, select: { id: true } },
      reservasHoras: { select: { id: true, consumo: { select: { id: true } }, decisoesLiberacao: { where: { aprovada: true }, select: { id: true, proposta: { select: { destino: true } } } } } } } });
  const itens: EntradaFechamentoHoras["encontros"] = [];
  const origens: { encontroId: string; inicio: string; fim: string; status: string; conferenciaId: string | null; informeId: string | null }[] = [];
  for (const e of encontros) {
    const c = e.conferenciaOcorrenciaHoras;
    origens.push({ encontroId: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), status: e.status,
      conferenciaId: c?.id ?? null, informeId: e.ocorrenciasParticulares[0]?.id ?? null });
    const base = { encontroId: e.id, matriculaId: d.matriculaId, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), moeda: m.moeda };
    if (!c) {
      const reserva = e.reservasHoras[0];
      const destinoConferido = reserva?.consumo?.id ?? reserva?.decisoesLiberacao[0]?.id;
      itens.push({ ...base, contratoVersaoId: null, valorHoraContratado: null, ocorrencia: null,
        destinacao: destinoConferido ? { tipo: "ANTECIPACAO_CONFERIDA", registroId: destinoConferido }
          : reserva ? { tipo: "ANTECIPACAO_PENDENTE", reservaId: reserva.id } : { tipo: "SEM_DESTINACAO" } });
      continue;
    }
    const parse = Memoria.safeParse(c.snapshot);
    if (!parse.success) throw new ErroRegra("Memória da conferência financeira exige conciliação.");
    const s = parse.data, o = s.classificacao.origem;
    const reserva = e.reservasHoras[0];
    const consumoAntecipacao = c.consumoAntecipacao;
    const conferenciaConsomeAntecipacao = !!consumoAntecipacao && !!reserva && reserva.id === consumoAntecipacao.reservaId && reserva.consumo?.id === consumoAntecipacao.id
      && ["FALTA_COBRAVEL", "CANCELAMENTO_TARDIO"].includes(c.desfecho);
    if ((e.reservasHoras.length && !conferenciaConsomeAntecipacao) || c.ocorrenciaId !== e.ocorrenciasParticulares[0]?.id || s.ocorrenciaId !== c.ocorrenciaId || s.condicoesId !== c.condicoesId
      || s.matriculaId !== d.matriculaId || s.moeda !== c.moeda || c.moeda !== m.moeda || s.minutos !== c.minutos
      || !new Prisma.Decimal(s.valorApurado).equals(c.valor) || !isDeepStrictEqual(s.regras, c.condicoes.regras)
      || c.ocorrencia.encontroId !== e.id || o.referenciaEncontro !== e.id || c.ocorrencia.inicio.getTime() !== e.inicio.getTime()
      || c.ocorrencia.fim.getTime() !== e.fim.getTime() || !!consumoAntecipacao !== conferenciaConsomeAntecipacao) throw new ErroRegra("Origem da conferência financeira diverge do encontro.");
    let valorHoraContratado = s.regras.valorHora;
    if (s.aditivo) {
      // Não resolve a versão vigente hoje: uma conferência já registrada deve
      // continuar ligada à versão, hash e vigência que ela preservou.
      if (!s.precoHoraAplicado) throw new ErroRegra("Memória da conferência não preserva o preço do aditivo.");
      const v = await tx.versaoCondicoesAditivo.findUnique({ where: { id: s.aditivo.id }, select: {
        matriculaId: true, versao: true, condicoesHash: true, condicoes: true, vigenciaInicio: true,
      } });
      if (!v || v.matriculaId !== d.matriculaId || v.versao !== s.aditivo.versao || v.condicoesHash !== s.aditivo.condicoesHash
        || v.vigenciaInicio.getTime() > e.inicio.getTime()) throw new ErroRegra("Referência de aditivo da conferência diverge da versão formalizada.");
      const precoPreservado = precoDaVersaoPreservada(v, s.regras.valorHora, m.moeda);
      if (!new Prisma.Decimal(s.precoHoraAplicado).equals(precoPreservado)) throw new ErroRegra("Preço preservado diverge da versão de aditivo.");
      valorHoraContratado = s.precoHoraAplicado;
    } else if (s.precoHoraAplicado && !new Prisma.Decimal(s.precoHoraAplicado).equals(s.regras.valorHora)) {
      // A nova memória sem versão ainda pode explicitar o preço-base, mas não
      // pode introduzir um preço alternativo sem uma referência formalizada.
      throw new ErroRegra("Preço preservado sem referência de aditivo diverge das condições-base.");
    }
    itens.push({ ...base, contratoVersaoId: c.condicoesId, valorHoraContratado, ocorrencia: o,
      destinacao: c.itemFaturado ? { tipo: "FATURADA", cobrancaId: c.itemFaturado.emissao.cobrancaId, itemId: c.itemFaturado.id }
        // Q175: aula declarada não cobrável antes de ser fechada nunca entra em cobrança; a conferência permanece como histórico.
        : c.aplicacaoNaoCobravel ? { tipo: "NAO_COBRAVEL_CORRECAO", aplicacaoId: c.aplicacaoNaoCobravel.id }
        : consumoAntecipacao ? { tipo: "ANTECIPACAO_CONFERIDA", registroId: consumoAntecipacao.id } : { tipo: "SEM_DESTINACAO" } });
  }
  const apuracao = apurarFechamentoHoras({ matriculaId: d.matriculaId, moeda: m.moeda, periodo: d.periodo, vencimento: d.vencimento, escolha: d.escolha, encontros: itens });
  // Confronta a recomposição com os valores efetivamente conferidos, sem reprecificar pelo catálogo.
  for (const e of encontros) {
    const c = e.conferenciaOcorrenciaHoras;
    if (!c || c.itemFaturado || c.consumoAntecipacao || c.aplicacaoNaoCobravel) continue;
    const item = apuracao.itens.find(i => i.encontroId === e.id), semCobranca = apuracao.semCobranca.find(i => i.encontroId === e.id);
    if ((item?.desfecho ?? semCobranca?.desfecho) !== c.desfecho || !new Prisma.Decimal(item?.valor ?? "0").equals(c.valor)) throw new ErroRegra("Cálculo diverge da conferência preservada.");
  }
  return { ...apuracao, origens };
}
