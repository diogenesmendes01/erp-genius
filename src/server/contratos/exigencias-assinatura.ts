import { z } from "zod";
import { RegraAssinaturaSchema } from "./modelo-schema";

export const ContextoAssinaturaSchema = z.object({
  // Classificação conferida segundo a regra aplicável. Não presume idade legal
  // universal nem a calcula apenas pela data de nascimento.
  maioridade: z.enum(["MAIOR", "MENOR"]).nullable(),
  pagador: z.enum(["ALUNO", "RESPONSAVEL", "EMPRESA"]),
}).strict();

export const PlanoAssinaturasSchema = z.object({
  contexto: ContextoAssinaturaSchema,
  regras: z.array(RegraAssinaturaSchema.extend({ resultado: z.enum(["EXIGIDA", "NAO_APLICAVEL", "PENDENTE_CONFERENCIA"]) })),
  participantesExigidos: z.array(z.object({ papel: RegraAssinaturaSchema.shape.papel, etapa: z.enum(["CLIENTE", "ESCOLA"]) })),
  pendencias: z.array(z.string()),
}).strict();

/** Resolve exigências do modelo, não identidades, capacidade de representação,
 * convites ou evidências de assinatura. Nenhum papel financeiro concede outro. */
export function planejarExigenciasAssinatura(regrasInput: unknown, contextoInput: z.input<typeof ContextoAssinaturaSchema>) {
  const regras = z.array(RegraAssinaturaSchema).min(1).max(20).parse(regrasInput), contexto = ContextoAssinaturaSchema.parse(contextoInput);
  const resultado = regras.map((r) => {
    let aplica: boolean | null;
    switch (r.condicao) {
      case "SEMPRE": aplica = true; break;
      case "PAGADOR_DISTINTO": aplica = contexto.pagador !== "ALUNO"; break;
      case "PAGADOR_EMPRESA": aplica = contexto.pagador === "EMPRESA"; break;
      case "ALUNO_MAIOR": aplica = contexto.maioridade == null ? null : contexto.maioridade === "MAIOR"; break;
      case "ALUNO_MENOR": aplica = contexto.maioridade == null ? null : contexto.maioridade === "MENOR"; break;
    }
    return { ...r, resultado: aplica == null ? "PENDENTE_CONFERENCIA" as const : aplica ? "EXIGIDA" as const : "NAO_APLICAVEL" as const };
  });
  const papeis = [...new Set(resultado.filter((r) => r.resultado === "EXIGIDA").map((r) => r.papel))];
  const participantesExigidos = papeis.map((papel) => ({ papel, etapa: papel === "REPRESENTANTE_ESCOLA" ? "ESCOLA" as const : "CLIENTE" as const }))
    .sort((a, b) => a.etapa === b.etapa ? a.papel.localeCompare(b.papel) : a.etapa === "CLIENTE" ? -1 : 1);
  const pendencias: string[] = [];
  if (resultado.some((r) => r.resultado === "PENDENTE_CONFERENCIA")) pendencias.push("Conferir a maioridade do aluno segundo a regra aplicável antes de definir todos os signatários.");
  if (!participantesExigidos.some((p) => p.etapa === "CLIENTE") && !resultado.some((r) => r.resultado === "PENDENTE_CONFERENCIA" && r.papel !== "REPRESENTANTE_ESCOLA")) pendencias.push("O modelo não exige participante do cliente neste caso. Revise a aplicação ou publique um modelo adequado.");
  return PlanoAssinaturasSchema.parse({ contexto, regras: resultado, participantesExigidos, pendencias });
}
