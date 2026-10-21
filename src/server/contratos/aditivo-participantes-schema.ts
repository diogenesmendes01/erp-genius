import { z } from "zod";
import { ContextoAssinaturaSchema, planejarExigenciasAssinatura } from "./exigencias-assinatura";
import { RegraAssinaturaSchema } from "./modelo-schema";
import { ConferirParticipantesSchema, IdentidadeSignatarioSchema } from "./participantes-schema";

const campos = ConferirParticipantesSchema.innerType().shape;
export const ConferirParticipantesAditivoSchema = z.object({
  propostaId: z.string().trim().min(1).max(100),
  propostaHashEsperado: z.string().regex(/^[a-f0-9]{64}$/),
  versaoEsperada: campos.versaoEsperada,
  maioridade: campos.maioridade,
  participantes: campos.participantes,
  identificacoesConferidas: campos.identificacoesConferidas,
  motivo: campos.motivo,
  chaveIdempotencia: campos.chaveIdempotencia,
}).strict().superRefine((d, ctx) => {
  if (new Set(d.participantes.map(p => p.papel)).size !== d.participantes.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Identifique cada papel uma única vez." });
});

type Contexto = z.infer<typeof ContextoAssinaturaSchema>;
type Participante = z.infer<typeof campos.participantes.element>;
type Identidade = z.infer<typeof IdentidadeSignatarioSchema>;
const igual = (a: Identidade, b: Identidade) => a.nome === b.nome && a.email === b.email && a.documento === b.documento;
function falhar(mensagem: string): never { throw new Error(mensagem); }

/** Confere apenas fatos já resolvidos pelo serviço. Não herda assinaturas do original. */
export function conferirParticipantesAditivo(input: {
  regras: readonly z.input<typeof RegraAssinaturaSchema>[];
  contexto: Contexto;
  maioridade: z.infer<typeof campos.maioridade>;
  participantes: readonly Participante[];
  identidadesEsperadas: { aluno: unknown; pagador: unknown | null };
  evidenciasDisponiveisIds: readonly string[];
  assinaturasHerdadas?: readonly string[];
}) {
  if (input.assinaturasHerdadas?.length) falhar("Aditivo não pode herdar assinaturas do documento anterior.");
  if (input.contexto.maioridade === null && input.maioridade !== null) falhar("A maioridade informada diverge do contexto do aditivo.");
  const plano = planejarExigenciasAssinatura(input.regras, input.contexto);
  if (plano.pendencias.length) falhar(plano.pendencias.join(" "));
  const recebidos = input.participantes;
  if (new Set(recebidos.map(p => p.papel)).size !== recebidos.length || recebidos.length !== plano.participantesExigidos.length
    || plano.participantesExigidos.some(exigido => !recebidos.some(p => p.papel === exigido.papel))) falhar("Identifique exatamente os papéis exigidos pelo modelo neste caso.");
  const evidencias = new Set(input.evidenciasDisponiveisIds);
  const conferirDocumento = (id: string) => { if (!evidencias.has(id)) falhar("A evidência precisa ser um documento disponível desta contratação."); };
  if (input.contexto.maioridade !== null) {
    const maioridade = input.maioridade;
    if (!maioridade || maioridade.classificacao !== input.contexto.maioridade) falhar("A maioridade conferida não corresponde ao contexto do aditivo.");
    conferirDocumento(maioridade.evidenciaDocumentoId);
  }
  const participantes = plano.participantesExigidos.map(exigido => {
    const participante = recebidos.find(p => p.papel === exigido.papel)!;
    const usaAluno = participante.papel === "ALUNO";
    const usaPagador = participante.papel === "RESPONSAVEL_FINANCEIRO" && input.contexto.pagador !== "EMPRESA";
    if (usaAluno || usaPagador) {
      if (participante.representacao) falhar("Representação não substitui os dados do aluno ou pagador identificado.");
      const esperado = IdentidadeSignatarioSchema.strip().safeParse(usaAluno ? input.identidadesEsperadas.aluno : input.identidadesEsperadas.pagador);
      const identidade = IdentidadeSignatarioSchema.strip().safeParse(participante.identidade);
      if (!esperado.success) falhar("Complete nome, documento e e-mail do aluno/pagador antes da conferência.");
      if (!identidade.success) falhar("Complete nome, documento e e-mail do aluno/pagador antes da conferência.");
      if (!igual(identidade.data, esperado.data)) falhar("A identificação revisada difere do aluno/pagador registrado.");
      return { ...participante, etapa: exigido.etapa, origem: usaAluno ? "ALUNO" as const : "PAGADOR" as const };
    }
    if (!participante.representacao) falhar("Registre a representação e sua evidência para a pessoa identificada.");
    conferirDocumento(participante.representacao.evidenciaDocumentoId);
    return { ...participante, etapa: exigido.etapa, origem: "REPRESENTANTE_CONFERIDO" as const };
  });
  return { plano, participantes, assinaturasHerdadas: [] as const };
}
