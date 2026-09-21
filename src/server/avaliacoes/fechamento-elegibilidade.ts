import { z } from "zod";
import { HABILIDADES } from "./calculo";

const id = z.string().min(1).max(100);
const fracao = z.object({ numerador: z.string(), denominador: z.string() }).strict();
const contexto = z.object({ matriculaId: id, nivelId: id, regraVersao: id }).strict();
const pendenciasOperacionais = z.object({
  correcoesRegulares: z.number().int().min(0),
  correcoesRecuperacao: z.number().int().min(0),
  planosAguardandoDecisao: z.number().int().min(0),
  planosSemDisponibilizacao: z.number().int().min(0),
  tentativasAguardandoRealizacao: z.number().int().min(0),
  habilidadesSemTentativa: z.number().int().min(0),
  extrasRecuperacaoAguardandoDecisao: z.number().int().min(0),
}).strict();
const pendenciasSegundaChamada = z.object({
  propostasAguardandoDecisao: z.number().int().min(0),
  autorizacoesAguardandoAgenda: z.number().int().min(0),
  reservasAguardandoRealizacao: z.number().int().min(0),
  ocorrenciasAguardandoEscola: z.number().int().min(0),
  realizacoesSemNotaOficial: z.number().int().min(0),
  extrasAguardandoDecisao: z.number().int().min(0),
}).strict();

const entradaSchema = z.object({
  /** Resultado vindo de `calcularNotasNivel`; este módulo não recalcula pesos. */
  notas: contexto.extend({
    completa: z.boolean(), recuperacoesPendentes: z.boolean(), geral: fracao.nullable(),
    atendeGeral: z.boolean().nullable(), atendeRequisitosNotas: z.boolean().nullable(),
    habilidades: z.array(z.object({
      habilidade: z.enum(HABILIDADES), resultado: fracao.nullable(), atendeMinimo: z.boolean().nullable(),
    }).passthrough()).length(4),
  }).passthrough(),
  frequencia: contexto.extend({
    fonteHash: z.string().regex(/^[a-f0-9]{64}$/),
    atendeMinimo: z.boolean().nullable(),
    pendenciasHistoricas: z.number().int().min(0),
    pendenciasChamada: z.number().int().min(0),
  }).strict(),
  /** Q131: só uma decisão independente, ligada ao mesmo snapshot, pode suprir frequência insuficiente. */
  excecaoFrequencia: contexto.extend({
    fonteHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), proponenteId: id, decisorId: id,
  }).strict().optional(),
  equivalencia: z.enum(["NAO_NECESSARIA", "APROVADA", "PENDENTE"]),
  excecaoFrequenciaPendente: z.boolean().optional(),
  pendenciasOperacionais,
  pendenciasSegundaChamada,
}).strict();

export type EntradaElegibilidadeFechamento = z.input<typeof entradaSchema>;

export type PendenciaFechamento =
  | "NOTAS_INCOMPLETAS"
  | "RECUPERACAO_PENDENTE"
  | "FREQUENCIA_NAO_APURADA"
  | "FREQUENCIA_HISTORICA_PENDENTE"
  | "CHAMADA_PENDENTE"
  | "EQUIVALENCIA_PENDENTE"
  | "CORRECAO_PENDENTE"
  | "PLANO_PENDENTE"
  | "TENTATIVA_PENDENTE"
  | "OPORTUNIDADE_EXTRA_PENDENTE"
  | "SEGUNDA_CHAMADA_PENDENTE"
  | "EXTRA_SEGUNDA_CHAMADA_PENDENTE"
  | "EXCECAO_FREQUENCIA_PENDENTE";

export type InsuficienciaFechamento = "MINIMO_POR_HABILIDADE" | "MINIMO_GERAL" | "FREQUENCIA_MINIMA";

/**
 * Classifica um snapshot acadêmico já autorizado. Pendência impede criar ou
 * confirmar uma versão de fechamento; insuficiência permite confirmar o
 * resultado final insuficiente, mas nunca torna a progressão elegível.
 */
export function avaliarElegibilidadeFechamento(entrada: EntradaElegibilidadeFechamento) {
  const dados = entradaSchema.parse(entrada);
  const mesmoContexto = (fonte: z.infer<typeof contexto>) =>
    fonte.matriculaId === dados.notas.matriculaId
    && fonte.nivelId === dados.notas.nivelId
    && fonte.regraVersao === dados.notas.regraVersao;
  if (!mesmoContexto(dados.frequencia)) throw new Error("Frequência pertence a outro contexto acadêmico.");
  if (dados.excecaoFrequencia && !mesmoContexto(dados.excecaoFrequencia)) throw new Error("Exceção de frequência pertence a outro contexto acadêmico.");
  if (new Set(dados.notas.habilidades.map((habilidade) => habilidade.habilidade)).size !== HABILIDADES.length) {
    throw new Error("Snapshot de notas não contém as quatro habilidades únicas.");
  }
  const habilidadesCompletas = dados.notas.habilidades.every((habilidade) => habilidade.resultado !== null && habilidade.atendeMinimo !== null);
  if (dados.notas.completa && (!habilidadesCompletas || dados.notas.geral === null || dados.notas.atendeGeral === null)) {
    throw new Error("Snapshot de notas completo é contraditório.");
  }
  if (dados.notas.atendeRequisitosNotas === true && (!dados.notas.completa || dados.notas.atendeGeral !== true || dados.notas.habilidades.some((habilidade) => habilidade.atendeMinimo !== true))) {
    throw new Error("Resultado suficiente é contraditório.");
  }
  if (dados.notas.atendeRequisitosNotas === false && !dados.notas.habilidades.some((habilidade) => habilidade.atendeMinimo === false) && dados.notas.atendeGeral !== false) {
    throw new Error("Resultado insuficiente não possui mínimo não atendido.");
  }

  const pendencias: PendenciaFechamento[] = [];
  const insuficiencias: InsuficienciaFechamento[] = [];
  if (!dados.notas.completa || dados.notas.atendeRequisitosNotas === null) pendencias.push("NOTAS_INCOMPLETAS");
  if (dados.notas.recuperacoesPendentes) pendencias.push("RECUPERACAO_PENDENTE");
  if (dados.equivalencia === "PENDENTE") pendencias.push("EQUIVALENCIA_PENDENTE");
  if (dados.excecaoFrequenciaPendente) pendencias.push("EXCECAO_FREQUENCIA_PENDENTE");

  const operacionais = dados.pendenciasOperacionais;
  if (operacionais.correcoesRegulares || operacionais.correcoesRecuperacao) pendencias.push("CORRECAO_PENDENTE");
  if (operacionais.planosAguardandoDecisao || operacionais.planosSemDisponibilizacao || operacionais.habilidadesSemTentativa) pendencias.push("PLANO_PENDENTE");
  if (operacionais.tentativasAguardandoRealizacao) pendencias.push("TENTATIVA_PENDENTE");
  if (operacionais.extrasRecuperacaoAguardandoDecisao) pendencias.push("OPORTUNIDADE_EXTRA_PENDENTE");
  const segunda = dados.pendenciasSegundaChamada;
  if (segunda.propostasAguardandoDecisao || segunda.autorizacoesAguardandoAgenda || segunda.reservasAguardandoRealizacao || segunda.ocorrenciasAguardandoEscola || segunda.realizacoesSemNotaOficial) {
    pendencias.push("SEGUNDA_CHAMADA_PENDENTE");
  }
  if (segunda.extrasAguardandoDecisao) pendencias.push("EXTRA_SEGUNDA_CHAMADA_PENDENTE");

  const excecaoAplicada = dados.frequencia.atendeMinimo === false
    && dados.excecaoFrequencia?.aprovada === true
    && dados.excecaoFrequencia.proponenteId !== dados.excecaoFrequencia.decisorId
    && dados.excecaoFrequencia.fonteHash === dados.frequencia.fonteHash;
  if (dados.frequencia.pendenciasHistoricas) pendencias.push("FREQUENCIA_HISTORICA_PENDENTE");
  if (dados.frequencia.pendenciasChamada) pendencias.push("CHAMADA_PENDENTE");
  if (dados.frequencia.atendeMinimo === null) pendencias.push("FREQUENCIA_NAO_APURADA");
  else if (dados.frequencia.atendeMinimo === false && !excecaoAplicada) insuficiencias.push("FREQUENCIA_MINIMA");

  if (dados.notas.atendeRequisitosNotas === false) {
    if (dados.notas.habilidades.some((habilidade) => habilidade.atendeMinimo === false)) insuficiencias.push("MINIMO_POR_HABILIDADE");
    if (dados.notas.atendeGeral === false) insuficiencias.push("MINIMO_GERAL");
  }
  const bloqueado = pendencias.length > 0;
  const suficiente = !bloqueado && insuficiencias.length === 0;
  return {
    contexto: { matriculaId: dados.notas.matriculaId, nivelId: dados.notas.nivelId, regraVersao: dados.notas.regraVersao },
    pendencias, insuficiencias,
    situacao: bloqueado ? "PENDENTE" as const : suficiente ? "SUFICIENTE" as const : "INSUFICIENTE" as const,
    podeFechar: !bloqueado,
    podeProgredir: suficiente,
    frequencia: { atendeMinimoReal: dados.frequencia.atendeMinimo, excecaoAplicada },
  };
}
