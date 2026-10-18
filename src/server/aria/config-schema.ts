import type { AcaoAgenteIATipo, EtapaLead } from "@prisma/client";
import { z } from "zod";
import { ACOES_MATRIZ, ETAPAS_ARIA, PREDEFINICOES, type ModoAcao } from "./matriz";

export { ACOES_MATRIZ, ETAPAS_ARIA, PREDEFINICOES };
export type { Matriz, ModoAcao } from "./matriz";

const TONS = ["AMIGAVEL", "PROFISSIONAL", "DIRETO", "ENTUSIASMADO", "FORMAL", "ACOLHEDOR"] as const;
const MODOS = z.enum(["EXECUTA", "SUGERE", "NAO_FAZ"]);

const pct = z.number().min(0).max(100);
const politicaDesconto = z
  .object({ descontoSemAprovacaoPct: pct, descontoComAprovacaoPct: pct })
  .refine((p) => p.descontoComAprovacaoPct >= p.descontoSemAprovacaoPct, {
    message: "desconto com aprovação deve ser maior ou igual ao sem aprovação",
    path: ["descontoComAprovacaoPct"],
  });

const passo5 = (min: number, max: number) =>
  z
    .number()
    .int()
    .min(min)
    .max(max)
    .refine((n) => n % 5 === 0, { message: "deve ser múltiplo de 5" });

const celulaMatriz = z.object(
  Object.fromEntries(ACOES_MATRIZ.map((a) => [a, MODOS.optional()])) as Record<
    AcaoAgenteIATipo,
    z.ZodOptional<typeof MODOS>
  >,
).partial();

const matrizSchema = z
  .object(
    Object.fromEntries(ETAPAS_ARIA.map((e) => [e, celulaMatriz.optional()])) as Record<
      EtapaLead,
      z.ZodOptional<typeof celulaMatriz>
    >,
  )
  .partial();

export const ConfigAriaSchema = z.object({
  versaoSchema: z.literal(1),
  nome: z.string().trim().min(1).max(40),
  funcao: z.string().trim().min(1).max(80),
  tons: z.array(z.enum(TONS)).min(1).max(2),
  tamanho: z.enum(["CURTA", "MEDIA", "DETALHADA"]),
  instrucoes: z.string().max(2500),
  prioridades: z.array(z.string().trim().min(1).max(200)).max(10),
  nuncas: z.array(z.string().trim().min(1).max(200)).max(20),
  exemplos: z
    .array(
      z.object({
        fala: z.string().trim().min(1).max(500),
        assim: z.string().trim().min(1).max(1000),
        evite: z.string().trim().max(1000).optional(),
        prioritario: z.boolean(),
      }),
    )
    .max(20),
  faq: z
    .array(
      z.object({
        id: z.string().min(1),
        pergunta: z.string().trim().min(1).max(300),
        resposta: z.string().trim().min(1).max(2000),
        ativa: z.boolean(),
      }),
    )
    .max(100),
  fontesAtivas: z.array(z.string()),
  citarFontesNaNota: z.boolean(),
  politicas: z.object({
    MATRICULA: politicaDesconto,
    MENSALIDADE: politicaDesconto,
    parcelasMax: z.number().int().min(1).max(12),
    validadePropostaDias: z.number().int().min(1).max(30),
  }),
  handoff: z.object({
    gatilhos: z.object({
      pedidoHumano: z.boolean(),
      confiancaBaixa: z.boolean(),
      palavrasChave: z.boolean(),
      humor: z.boolean(),
      etapa: z.boolean(),
      valor: z.boolean(),
      foraPolitica: z.boolean(),
      semAvanco: z.boolean(),
    }),
    palavrasChave: z.array(z.string().trim().min(1).max(60)).max(50),
    etapaGatilho: z.enum(ETAPAS_ARIA as [EtapaLead, ...EtapaLead[]]).optional(),
    valorGatilho: z.number().nonnegative().optional(),
    destino: z.enum(["RESPONSAVEL", "FILA_SETOR", "USUARIO"]),
    destinoUsuarioId: z.string().min(1).optional(),
    foraHorario: z.enum(["AVISAR_E_AGUARDAR", "CONTINUAR"]),
    mensagem: z.string().trim().max(500),
    camposResumo: z.array(z.string()),
  }),
  confianca: z
    .object({
      executaAPartirDe: passo5(55, 100),
      transfereAbaixoDe: passo5(0, 75),
      expiracaoSugestaoMin: z.union([z.literal(30), z.literal(60), z.literal(120), z.literal(240)]),
      acaoExpiracao: z.enum(["HANDOFF", "DESCARTAR"]),
    })
    .refine((c) => c.executaAPartirDe >= c.transfereAbaixoDe + 5, {
      message: "executa deve ser pelo menos 5 acima de transfere",
      path: ["executaAPartirDe"],
    }),
  matriz: matrizSchema,
});

export type ConfigAria = z.infer<typeof ConfigAriaSchema>;

export function configPadrao(): ConfigAria {
  return {
    versaoSchema: 1,
    nome: "Aria",
    funcao: "Consultora de matrículas",
    tons: ["AMIGAVEL", "PROFISSIONAL"],
    tamanho: "MEDIA",
    instrucoes: "",
    prioridades: [],
    nuncas: [],
    exemplos: [],
    faq: [],
    fontesAtivas: [],
    citarFontesNaNota: true,
    politicas: {
      MATRICULA: { descontoSemAprovacaoPct: 10, descontoComAprovacaoPct: 20 },
      MENSALIDADE: { descontoSemAprovacaoPct: 10, descontoComAprovacaoPct: 20 },
      parcelasMax: 10,
      validadePropostaDias: 7,
    },
    handoff: {
      gatilhos: {
        pedidoHumano: true,
        confiancaBaixa: true,
        palavrasChave: true,
        humor: true,
        etapa: false,
        valor: false,
        foraPolitica: true,
        semAvanco: false,
      },
      palavrasChave: ["cancelar", "reclamação", "Procon", "reembolso", "advogado"],
      destino: "RESPONSAVEL",
      foraHorario: "AVISAR_E_AGUARDAR",
      mensagem: "Vou chamar uma pessoa da equipe para continuar com você.",
      camposResumo: [],
    },
    confianca: {
      executaAPartirDe: 80,
      transfereAbaixoDe: 50,
      expiracaoSugestaoMin: 60,
      acaoExpiracao: "HANDOFF",
    },
    matriz: structuredClone(PREDEFINICOES.EQUILIBRADO),
  };
}

export function modoDaAcao(
  config: ConfigAria,
  etapa: EtapaLead,
  acao: AcaoAgenteIATipo,
): ModoAcao | "SEMPRE" {
  if (acao === "HANDOFF" || acao === "CLASSIFICAR_SETOR") return "SEMPRE";
  return config.matriz[etapa]?.[acao] ?? "NAO_FAZ";
}
