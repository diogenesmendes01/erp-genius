import { z } from "zod";
import { createHash } from "node:crypto";
import { ErroRegra } from "@/server/_shared";
import { RegraAssinaturaSchema } from "./modelo-schema";
import { IdentidadeSignatarioSchema } from "./participantes-schema";
import { hashPrevia } from "./previa-estado";
const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const ConclusaoAssinaturaSchema = z.object({ processoId: z.string().min(1).max(100), referenciaExterna: z.string().trim().min(1).max(200), originalHash: sha,
  concluidaEm: z.string().datetime({ offset: true }), assinaturas: z.array(z.object({ papel: RegraAssinaturaSchema.shape.papel, identidadeHash: sha, referenciaAssinatura: z.string().trim().min(1).max(200), assinadaEm: z.string().datetime({ offset: true }) }).strict()).min(1).max(5),
  pdfAssinado: z.instanceof(Buffer).refine(b => b.length > 5 && b.length <= 20 * 1024 * 1024 && b.subarray(0,5).toString() === "%PDF-", "PDF assinado inválido ou maior que 20 MiB."),
  evidencias: z.instanceof(Buffer).refine(b => b.length > 0 && b.length <= 20 * 1024 * 1024, "Evidências obrigatórias, até 20 MiB.") }).strict();
const participantesSchema = z.object({ participantes: z.array(z.object({ papel: RegraAssinaturaSchema.shape.papel, etapa: z.enum(["CLIENTE", "ESCOLA"]), identidade: IdentidadeSignatarioSchema })).min(1).max(5) });
export function validarConclusaoAssinatura(input: z.input<typeof ConclusaoAssinaturaSchema>, snapshotParticipantes: unknown, enviadaEm: Date, agora = new Date()) {
  const d = ConclusaoAssinaturaSchema.parse(input), participantes = participantesSchema.parse(snapshotParticipantes).participantes;
  if (new Set(d.assinaturas.map(a => a.papel)).size !== d.assinaturas.length || d.assinaturas.length !== participantes.length) throw new ErroRegra("A conclusão exige todas as assinaturas previstas, sem duplicar papéis.");
  const fim = new Date(d.concluidaEm);
  if (fim < enviadaEm || fim > agora) throw new ErroRegra("Data de conclusão incompatível com o envio.");
  const assinaturas = d.assinaturas.map(a => {
    const participante = participantes.find(p => p.papel === a.papel), data = new Date(a.assinadaEm);
    if (!participante || hashPrevia(participante.identidade) !== a.identidadeHash) throw new ErroRegra("A assinatura não corresponde ao participante conferido no original.");
    if (data < enviadaEm || data > fim) throw new ErroRegra("Assinatura fora do intervalo do processo.");
    return { ...a, assinadaEm: data.toISOString(), etapa: participante.etapa };
  }).sort((a,b) => a.papel.localeCompare(b.papel));
  const clientes = assinaturas.filter(a => a.etapa === "CLIENTE"), escola = assinaturas.filter(a => a.etapa === "ESCOLA");
  if (escola.some(a => clientes.some(c => a.assinadaEm < c.assinadaEm))) throw new ErroRegra("As assinaturas da escola devem ocorrer após as exigidas dos clientes.");
  const pdfHash = createHash("sha256").update(d.pdfAssinado).digest("hex"), evidenciasHash = createHash("sha256").update(d.evidencias).digest("hex");
  return { ...d, assinaturas, concluidaEm: fim, pdfHash, evidenciasHash,
    entradaHash: hashPrevia({ processoId: d.processoId, referenciaExterna: d.referenciaExterna, originalHash: d.originalHash, concluidaEm: fim.toISOString(), assinaturas, pdfHash, evidenciasHash }) };
}
