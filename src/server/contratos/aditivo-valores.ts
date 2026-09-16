import { z } from "zod";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { OrigemCampoSchema, type OrigemCampo } from "./campos";

// Limites monetários seguem financeiro/uso-credito-proposta.ts. Não convertemos
// vírgula, locale ou número JavaScript: o snapshot guarda o decimal canônico.
const DecimalCanonicoSchema = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, "Informe decimal canônico com até duas casas.");
const MoedaSchema = z.string().regex(/^[A-Z]{3}$/, "Informe a moeda ISO em três letras maiúsculas.");
const TextoSchema = z.string().trim().min(1).max(4000);

export const ValorAlteracaoAditivoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("TEXT"), texto: TextoSchema }).strict(),
  z.object({ tipo: z.literal("EMAIL"), email: z.string().trim().email().max(254) }).strict(),
  z.object({ tipo: z.literal("DINHEIRO"), valor: DecimalCanonicoSchema, moeda: MoedaSchema }).strict(),
  z.object({ tipo: z.literal("DATA"), data: DataCivilSchema }).strict(),
  // Mesmo teto usado para minutos comprados em matricula/compra-horas.ts.
  z.object({ tipo: z.literal("MINUTOS"), minutos: z.number().int().positive().max(5_256_000) }).strict(),
  z.object({ tipo: z.literal("MOEDA"), moeda: MoedaSchema }).strict(),
  z.object({ tipo: z.literal("REGIME"), regime: z.enum(["MENSALIDADE", "HORA_PARTICULAR"]) }).strict(),
  z.object({ tipo: z.literal("AGENDA"), propostaAgendaId: z.string().trim().min(1).max(100) }).strict(),
]);
export type ValorAlteracaoAditivo = z.infer<typeof ValorAlteracaoAditivoSchema>;

const tipos: Record<Exclude<OrigemCampo, `ADITIVO_${string}`>, ValorAlteracaoAditivo["tipo"]> = {
  ALUNO_NOME: "TEXT", ALUNO_DOCUMENTO: "TEXT", ALUNO_EMAIL: "EMAIL", ALUNO_ENDERECO: "TEXT",
  PAGADOR_NOME: "TEXT", PAGADOR_DOCUMENTO: "TEXT", PAGADOR_EMAIL: "EMAIL", PAGADOR_ENDERECO: "TEXT",
  TAXA_VALOR: "DINHEIRO", MENSALIDADE_VALOR: "DINHEIRO", HORA_VALOR: "DINHEIRO", ADIANTAMENTO_VALOR: "DINHEIRO",
  TAXA_VENCIMENTO: "DATA", PRIMEIRA_MENSALIDADE_VENCIMENTO: "DATA", COBERTURA_INICIO: "DATA", COBERTURA_FIM: "DATA", ADIANTAMENTO_VENCIMENTO: "DATA",
  ADIANTAMENTO_MINUTOS: "MINUTOS", MOEDA: "MOEDA", REGIME: "REGIME", AGENDA_PARTICULAR: "AGENDA",
};

/** Valida somente a forma estruturada da alteração. Aprovação, moeda vigente e aplicação pertencem a fluxos posteriores. */
export function validarValorAlteracaoAditivo(campo: OrigemCampo, valor: unknown): ValorAlteracaoAditivo {
  const origem = OrigemCampoSchema.parse(campo);
  if (origem.startsWith("ADITIVO_")) throw new Error("Campos derivados de aditivo não aceitam valor estruturado.");
  const esperado = tipos[origem as Exclude<OrigemCampo, `ADITIVO_${string}`>];
  const recebido = ValorAlteracaoAditivoSchema.parse(valor);
  if (recebido.tipo !== esperado) throw new Error(`O campo ${origem} exige valor do tipo ${esperado}.`);
  return recebido;
}

/** Texto canônico que deve constar no documento quando a alteração é estruturada. */
export function representarValorAlteracaoAditivo(valor: unknown): string {
  const d = ValorAlteracaoAditivoSchema.parse(valor);
  switch (d.tipo) {
    case "TEXT": return d.texto;
    case "EMAIL": return d.email;
    case "DATA": return d.data;
    case "MINUTOS": return String(d.minutos);
    case "MOEDA": return d.moeda;
    case "REGIME": return d.regime === "MENSALIDADE" ? "Mensalidade" : "Particular por hora";
    case "DINHEIRO": {
      const [inteiro, fracao = ""] = d.valor.split(".");
      return `${inteiro}.${fracao.padEnd(2, "0")} ${d.moeda}`;
    }
    case "AGENDA": throw new Error("A proposta de agenda estruturada ainda exige integração própria antes de constar no aditivo.");
  }
}
