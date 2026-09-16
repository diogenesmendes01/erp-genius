import { z } from "zod";
import { HABILIDADES } from "./calculo";

const id = z.string().trim().min(1).max(100).refine((valor) => !valor.includes("\u0000"), "Identificador não pode conter NUL.");
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/).max(100);
const habilidade = z.enum(HABILIDADES);

function pesoPositivo(valor: string) {
  if (valor.startsWith("-")) return false;
  const digitos = valor.replace(".", "").replace(/^0+/, "");
  return digitos !== "" && BigInt(digitos) > 0n;
}

function pesoCanonico(valor: string) {
  const [inteiro, fracao = ""] = valor.split(".");
  const base = BigInt(inteiro).toString();
  const casas = fracao.replace(/0+$/, "");
  return casas ? base + "." + casas : base;
}

const contextoSchema = z.object({
  matriculaId: id, nivelOrigemId: id, nivelDestinoId: id, alocacaoOrigemId: id,
  turmaOrigemId: id, turmaDestinoId: id, regraOrigemId: id, regraDestinoId: id,
}).strict();

const fonteComumSchema = z.object({
  referenciaId: id, matriculaId: id, nivelId: id, alocacaoId: id, turmaId: id, regraId: id,
  habilidade,
  // Só impede que ausência seja apresentada como aproveitamento. A projeção
  // retornada não replica a nota: ela mantém a referência da fonte oficial.
  nota: decimal, oficial: z.literal(true),
  fonteHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

// Regular continua aceitando a forma antiga sem tipoFonte. Isso preserva os
// mapeamentos já guardados e os consumidores que só conhecem lançamentos.
const fonteRegularSchema = fonteComumSchema.extend({
  tipoFonte: z.literal("REGULAR").default("REGULAR"),
  codigoAvaliacao: id, registroId: id, lancamentoId: id, decisaoLancamentoId: id,
  autorLancamentoId: id, realizadaPorId: id.nullable().optional(),
  versaoLancamento: z.number().int().positive().safe(),
  correcaoId: id.nullable().optional(), decisaoCorrecaoId: id.nullable().optional(), versaoCorrecao: z.number().int().positive().safe().nullable().optional(),
}).strict().superRefine((fonte, ctx) => {
  if ((fonte.correcaoId != null) !== (fonte.versaoCorrecao != null) || (fonte.correcaoId != null) !== (fonte.decisaoCorrecaoId != null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Correção efetiva exige identificador e versão." });
  }
});

// Recuperação é resultado por habilidade, não uma avaliação regular disfarçada.
// A ausência deliberada de codigoAvaliacao obriga o mapa aprovado a declarar
// qual requisito de destino será suprido.
const fonteRecuperacaoSchema = fonteComumSchema.extend({
  tipoFonte: z.literal("RECUPERACAO"), escopoFonte: z.literal("HABILIDADE"),
  codigoAvaliacao: z.null(),
  realizacaoId: id, itemReservaId: id, reservaId: id, planoId: id, decisaoPlanoId: id,
  notaRecuperacaoId: id, decisaoNotaRecuperacaoId: id, autorNotaRecuperacaoId: id,
  professorRealizacaoId: id, registradaPorId: id.nullable().optional(),
  versaoNotaRecuperacao: z.number().int().positive().safe(),
  correcaoRecuperacaoId: id.nullable().optional(), decisaoCorrecaoRecuperacaoId: id.nullable().optional(), versaoCorrecaoRecuperacao: z.number().int().positive().safe().nullable().optional(),
}).strict().superRefine((fonte, ctx) => {
  if ((fonte.correcaoRecuperacaoId != null) !== (fonte.versaoCorrecaoRecuperacao != null)
    || (fonte.correcaoRecuperacaoId != null) !== (fonte.decisaoCorrecaoRecuperacaoId != null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Correção efetiva da recuperação exige identificador e versão." });
  }
});

// Uma aplicação anterior conserva a fonte de que depende. Ela não transforma
// o aproveitamento em lançamento local nem perde a cadeia que o sustenta.
const fonteAproveitamentoSchema = fonteComumSchema.extend({
  tipoFonte: z.literal("APROVEITAMENTO"), escopoFonte: z.literal("REQUISITO_DESTINO"),
  codigoAvaliacao: id,
  aplicacaoId: id, aplicacaoHash: z.string().regex(/^[a-f0-9]{64}$/),
  alocacaoOrigemAplicacaoId: id, alocacaoDestinoAplicacaoId: id,
  referenciaFonteAplicadaId: id,
  fonteAplicadaHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const FonteOficialEquivalenciaSchema = z.union([
  fonteRegularSchema,
  fonteRecuperacaoSchema,
  fonteAproveitamentoSchema,
]);

const requisitoSchema = z.object({
  codigoAvaliacao: id, habilidade, pesoAvaliacao: decimal,
}).strict();

const mapeamentoSchema = z.object({
  referenciaFonteId: id, codigoAvaliacaoDestino: id, habilidadeDestino: habilidade,
}).strict();

export const EntradaEquivalenciaTransferenciaSchema = z.object({
  contexto: contextoSchema,
  fontesOficiais: z.array(FonteOficialEquivalenciaSchema).max(2000),
  requisitosDestino: z.array(requisitoSchema).min(1).max(200),
  mapeamentos: z.array(mapeamentoSchema).max(200),
}).strict();

export type EntradaEquivalenciaTransferencia = z.input<typeof EntradaEquivalenciaTransferenciaSchema>;
export type FonteOficialEquivalencia = z.output<typeof FonteOficialEquivalenciaSchema>;
export type RequisitoDestinoEquivalencia = z.output<typeof requisitoSchema>;

type ReferenciaFonteProjetada =
  | Pick<z.output<typeof fonteRegularSchema>, "tipoFonte" | "referenciaId" | "registroId" | "lancamentoId" | "decisaoLancamentoId" | "autorLancamentoId" | "realizadaPorId"
    | "versaoLancamento" | "correcaoId" | "decisaoCorrecaoId" | "versaoCorrecao" | "fonteHash">
    & { codigoAvaliacaoOrigem: string; habilidadeOrigem: z.infer<typeof habilidade> }
  | Pick<z.output<typeof fonteRecuperacaoSchema>, "tipoFonte" | "escopoFonte" | "referenciaId" | "realizacaoId" | "itemReservaId" | "reservaId" | "planoId" | "decisaoPlanoId"
    | "notaRecuperacaoId" | "decisaoNotaRecuperacaoId" | "autorNotaRecuperacaoId" | "professorRealizacaoId" | "registradaPorId"
    | "versaoNotaRecuperacao" | "correcaoRecuperacaoId" | "decisaoCorrecaoRecuperacaoId" | "versaoCorrecaoRecuperacao" | "fonteHash">
    & { codigoAvaliacaoOrigem: null; habilidadeOrigem: z.infer<typeof habilidade> }
  | Pick<z.output<typeof fonteAproveitamentoSchema>, "tipoFonte" | "escopoFonte" | "referenciaId" | "aplicacaoId" | "aplicacaoHash"
    | "alocacaoOrigemAplicacaoId" | "alocacaoDestinoAplicacaoId" | "referenciaFonteAplicadaId" | "fonteAplicadaHash" | "fonteHash">
    & { codigoAvaliacaoOrigem: string; habilidadeOrigem: z.infer<typeof habilidade> };

function referenciaProjetada(fonte: FonteOficialEquivalencia): ReferenciaFonteProjetada {
  if (fonte.tipoFonte === "REGULAR") {
    return {
      tipoFonte: fonte.tipoFonte, referenciaId: fonte.referenciaId, registroId: fonte.registroId, lancamentoId: fonte.lancamentoId,
      decisaoLancamentoId: fonte.decisaoLancamentoId, autorLancamentoId: fonte.autorLancamentoId, realizadaPorId: fonte.realizadaPorId ?? null,
      versaoLancamento: fonte.versaoLancamento, correcaoId: fonte.correcaoId ?? null,
      decisaoCorrecaoId: fonte.decisaoCorrecaoId ?? null, versaoCorrecao: fonte.versaoCorrecao ?? null, fonteHash: fonte.fonteHash,
      codigoAvaliacaoOrigem: fonte.codigoAvaliacao, habilidadeOrigem: fonte.habilidade,
    };
  }
  if (fonte.tipoFonte === "RECUPERACAO") return {
    tipoFonte: fonte.tipoFonte, escopoFonte: fonte.escopoFonte, referenciaId: fonte.referenciaId,
    realizacaoId: fonte.realizacaoId, itemReservaId: fonte.itemReservaId, reservaId: fonte.reservaId,
    planoId: fonte.planoId, decisaoPlanoId: fonte.decisaoPlanoId, notaRecuperacaoId: fonte.notaRecuperacaoId,
    decisaoNotaRecuperacaoId: fonte.decisaoNotaRecuperacaoId, autorNotaRecuperacaoId: fonte.autorNotaRecuperacaoId,
    professorRealizacaoId: fonte.professorRealizacaoId, registradaPorId: fonte.registradaPorId ?? null,
    versaoNotaRecuperacao: fonte.versaoNotaRecuperacao, correcaoRecuperacaoId: fonte.correcaoRecuperacaoId ?? null,
    decisaoCorrecaoRecuperacaoId: fonte.decisaoCorrecaoRecuperacaoId ?? null,
    versaoCorrecaoRecuperacao: fonte.versaoCorrecaoRecuperacao ?? null, fonteHash: fonte.fonteHash,
    codigoAvaliacaoOrigem: null, habilidadeOrigem: fonte.habilidade,
  };
  return {
    tipoFonte: fonte.tipoFonte, escopoFonte: fonte.escopoFonte, referenciaId: fonte.referenciaId,
    aplicacaoId: fonte.aplicacaoId, aplicacaoHash: fonte.aplicacaoHash,
    alocacaoOrigemAplicacaoId: fonte.alocacaoOrigemAplicacaoId,
    alocacaoDestinoAplicacaoId: fonte.alocacaoDestinoAplicacaoId,
    referenciaFonteAplicadaId: fonte.referenciaFonteAplicadaId, fonteAplicadaHash: fonte.fonteAplicadaHash,
    fonteHash: fonte.fonteHash, codigoAvaliacaoOrigem: fonte.codigoAvaliacao, habilidadeOrigem: fonte.habilidade,
  };
}

const chaveRequisito = (codigoAvaliacao: string, habilidadeDestino: string) => codigoAvaliacao + "\u0000" + habilidadeDestino;

/**
 * Projeta os requisitos da regra de destino que têm fonte oficial
 * aproveitável. Não cria lançamento, converte nota nem calcula média.
 */
export function projetarEquivalenciaTransferencia(entrada: unknown) {
  const dados = EntradaEquivalenciaTransferenciaSchema.parse(entrada);
  const { contexto } = dados;
  if (contexto.nivelOrigemId !== contexto.nivelDestinoId) throw new Error("Equivalência de transferência exige turmas do mesmo nível.");

  const fontes = new Map<string, FonteOficialEquivalencia>();
  for (const fonte of dados.fontesOficiais) {
    if (fontes.has(fonte.referenciaId)) throw new Error("A fonte oficial " + fonte.referenciaId + " foi informada mais de uma vez.");
    if (fonte.matriculaId !== contexto.matriculaId || fonte.nivelId !== contexto.nivelOrigemId
      || fonte.alocacaoId !== contexto.alocacaoOrigemId || fonte.turmaId !== contexto.turmaOrigemId || fonte.regraId !== contexto.regraOrigemId) {
      throw new Error("A fonte oficial não pertence à matrícula, vínculo, turma ou regra de origem.");
    }
    fontes.set(fonte.referenciaId, fonte);
  }

  const requisitos = new Map<string, RequisitoDestinoEquivalencia>();
  const pesoPorAvaliacao = new Map<string, string>();
  for (const requisito of dados.requisitosDestino) {
    if (!pesoPositivo(requisito.pesoAvaliacao)) throw new Error("Peso de avaliação deve ser positivo.");
    const peso = pesoCanonico(requisito.pesoAvaliacao);
    const pesoAnterior = pesoPorAvaliacao.get(requisito.codigoAvaliacao);
    if (pesoAnterior != null && pesoAnterior !== peso) {
      throw new Error("Todas as habilidades da avaliação destino precisam manter o mesmo peso.");
    }
    pesoPorAvaliacao.set(requisito.codigoAvaliacao, peso);
    const chave = chaveRequisito(requisito.codigoAvaliacao, requisito.habilidade);
    if (requisitos.has(chave)) throw new Error("O requisito destino " + requisito.codigoAvaliacao + "/" + requisito.habilidade + " foi informado mais de uma vez.");
    requisitos.set(chave, requisito);
  }

  const fontePorRequisito = new Map<string, FonteOficialEquivalencia>();
  for (const mapeamento of dados.mapeamentos) {
    const chave = chaveRequisito(mapeamento.codigoAvaliacaoDestino, mapeamento.habilidadeDestino);
    if (!requisitos.has(chave)) throw new Error("O requisito destino " + mapeamento.codigoAvaliacaoDestino + "/" + mapeamento.habilidadeDestino + " não existe na regra de destino.");
    const fonte = fontes.get(mapeamento.referenciaFonteId);
    if (!fonte) throw new Error("A fonte oficial " + mapeamento.referenciaFonteId + " não pertence à equivalência.");
    if (fonte.habilidade !== mapeamento.habilidadeDestino) {
      throw new Error("A fonte oficial da habilidade " + fonte.habilidade + " não pode suprir o requisito destino de " + mapeamento.habilidadeDestino + ".");
    }
    if (fontePorRequisito.has(chave)) {
      throw new Error("O requisito destino " + mapeamento.codigoAvaliacaoDestino + "/" + mapeamento.habilidadeDestino + " recebeu mais de uma fonte. Escolha uma fonte explícita para evitar ponderação duplicada.");
    }
    fontePorRequisito.set(chave, fonte);
  }

  const usosPorFonte = new Map<string, string[]>();
  const itens = [...requisitos.values()].map((requisito) => {
    const chave = chaveRequisito(requisito.codigoAvaliacao, requisito.habilidade);
    const fonte = fontePorRequisito.get(chave);
    if (!fonte) return { ...requisito, situacao: "PENDENTE" as const, motivoPendencia: "SEM_FONTE_EQUIVALENTE" as const, fonte: null };
    const requisitosDaFonte = usosPorFonte.get(fonte.referenciaId) ?? [];
    requisitosDaFonte.push(chave);
    usosPorFonte.set(fonte.referenciaId, requisitosDaFonte);
    return { ...requisito, situacao: "APROVEITADO" as const, fonte: referenciaProjetada(fonte) };
  });

  // Reutilização entre requisitos distintos é visível e depende da decisão
  // pedagógica; o consolidado conta cada requisito de destino uma única vez.
  const fontesReutilizadas = [...usosPorFonte.entries()].filter(([, chaves]) => chaves.length > 1)
    .map(([referenciaFonteId, chaves]) => ({
      referenciaFonteId,
      requisitosDestino: chaves.map((chave) => {
        const partes = chave.split("\u0000");
        return { codigoAvaliacao: partes[0]!, habilidade: partes[1]! };
      }),
    }));

  return {
    contexto,
    itens,
    pendencias: itens.filter((item) => item.situacao === "PENDENTE").map((item) => ({
      codigoAvaliacao: item.codigoAvaliacao, habilidade: item.habilidade, motivo: item.motivoPendencia,
    })),
    fontesReutilizadas,
  };
}

export type ProjecaoEquivalenciaTransferencia = ReturnType<typeof projetarEquivalenciaTransferencia>;
