import { z } from "zod";

export const MOTIVOS_HANDOFF = [
  "PEDIDO_HUMANO",
  "CONFIANCA",
  "PALAVRA_CHAVE",
  "HUMOR",
  "ETAPA",
  "VALOR",
  "FORA_POLITICA",
  "SEM_AVANCO",
  "RECUSA",
  "VALOR_NAO_AUTORIZADO",
  "SEM_PRECO",
  "SEM_PERMISSAO",
  "ERRO_PROVEDOR",
] as const;
/** Motivos que só o sistema usa (fora do esquema de saída do modelo). */
export type MotivoHandoffSistema = "TURNO_INTERROMPIDO";
export type MotivoHandoff = (typeof MOTIVOS_HANDOFF)[number] | MotivoHandoffSistema;

const ETAPAS = [
  "NOVO",
  "EM_ATENDIMENTO",
  "QUALIFICADO",
  "EXPERIMENTAL_AGENDADA",
  "EXPERIMENTAL_REALIZADA",
  "PROPOSTA",
  "AGUARDANDO_MATRICULA",
  "MATRICULADO",
  "NO_SHOW",
  "PERDIDO",
] as const;
const MOTIVOS_PERDA = [
  "NAO_RESPONDEU",
  "PRECO",
  "TEMPO",
  "CONCORRENCIA",
  "INTERESSE",
  "LOCALIZACAO",
  "EMPRESA",
  "QUALIFICACAO",
  "OUTRO",
] as const;

const justificativa = z.string().min(1).max(500);
const iso = z.string().datetime({ offset: true });

export const AcaoPropostaSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("ATUALIZAR_CAMPO"), campo: z.string().min(1).max(100), valor: z.string().max(500), justificativa }),
  z.object({ acao: z.literal("TAG"), tagId: z.string().min(1), justificativa }),
  z.object({ acao: z.literal("MOVER_ETAPA"), para: z.enum(ETAPAS), justificativa }),
  z.object({ acao: z.literal("MARCAR_PERDIDO"), motivo: z.enum(MOTIVOS_PERDA), justificativa }),
  z.object({ acao: z.literal("CRIAR_TAREFA"), titulo: z.string().min(1).max(200), venceEmISO: iso, justificativa }),
  z.object({ acao: z.literal("AGENDAR_MENSAGEM"), texto: z.string().min(1).max(1000), enviarEmISO: iso, justificativa }),
  z.object({ acao: z.literal("NOTA_INTERNA"), texto: z.string().min(1).max(1000), justificativa }),
  z.object({
    acao: z.literal("CONDICAO_COMERCIAL"),
    tipoCobranca: z.enum(["MATRICULA", "MENSALIDADE"]),
    descontoPct: z.number().min(0).max(100),
    parcelas: z.number().int().min(1).max(60),
    justificativa,
  }),
]);
export type AcaoProposta = z.infer<typeof AcaoPropostaSchema>;

export const SaidaModeloSchema = z.object({
  resposta: z.string().max(1000).nullable(),
  documentoId: z.string().nullable(),
  acoes: z.array(AcaoPropostaSchema).max(5),
  confianca: z.number().int().min(0).max(100),
  handoff: z.object({ motivo: z.enum(MOTIVOS_HANDOFF) }).nullable(),
  fontes: z.array(z.object({ tipo: z.enum(["FAQ", "TRECHO", "PRECO"]), id: z.string() })),
  humor: z.enum(["NEUTRO", "IRRITADO"]).nullable(),
});
export type SaidaModelo = z.infer<typeof SaidaModeloSchema>;

// Raiz: acoes aceita itens desconhecidos, que são filtrados um a um.
const RaizBrutaSchema = SaidaModeloSchema.extend({ acoes: z.array(z.unknown()).max(5) });

/** Texto bruto do modelo -> saída validada; ações inválidas são descartadas, raiz inválida -> null. */
export function normalizarSaida(texto: string): SaidaModelo | null {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return null;
  }
  const raiz = RaizBrutaSchema.safeParse(bruto);
  if (!raiz.success) return null;
  const acoes: AcaoProposta[] = [];
  for (const item of raiz.data.acoes) {
    const a = AcaoPropostaSchema.safeParse(item);
    if (a.success) acoes.push(a.data);
  }
  return { ...raiz.data, acoes };
}

const str = (extra: Record<string, unknown> = {}) => ({ type: "string", ...extra });
const nullavel = (s: Record<string, unknown>) => ({ anyOf: [s, { type: "null" }] });
const objeto = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const acaoJson = (acao: string, props: Record<string, unknown>) =>
  objeto({ acao: { type: "string", enum: [acao] }, ...props, justificativa: str() });

export const ESQUEMA_SAIDA_CONVERSA: Record<string, unknown> = objeto({
  resposta: nullavel(str()),
  documentoId: nullavel(str()),
  acoes: {
    type: "array",
    items: {
      anyOf: [
        acaoJson("ATUALIZAR_CAMPO", { campo: str(), valor: str() }),
        acaoJson("TAG", { tagId: str() }),
        acaoJson("MOVER_ETAPA", { para: str({ enum: [...ETAPAS] }) }),
        acaoJson("MARCAR_PERDIDO", { motivo: str({ enum: [...MOTIVOS_PERDA] }) }),
        acaoJson("CRIAR_TAREFA", { titulo: str(), venceEmISO: str() }),
        acaoJson("AGENDAR_MENSAGEM", { texto: str(), enviarEmISO: str() }),
        acaoJson("NOTA_INTERNA", { texto: str() }),
        acaoJson("CONDICAO_COMERCIAL", {
          tipoCobranca: str({ enum: ["MATRICULA", "MENSALIDADE"] }),
          descontoPct: { type: "number" },
          parcelas: { type: "integer" },
        }),
      ],
    },
  },
  confianca: { type: "integer" },
  handoff: nullavel(objeto({ motivo: str({ enum: [...MOTIVOS_HANDOFF] }) })),
  fontes: {
    type: "array",
    items: objeto({ tipo: str({ enum: ["FAQ", "TRECHO", "PRECO"] }), id: str() }),
  },
  humor: nullavel(str({ enum: ["NEUTRO", "IRRITADO"] })),
});
