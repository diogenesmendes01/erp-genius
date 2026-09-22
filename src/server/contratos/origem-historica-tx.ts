import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { hashSubstituicao } from "./substituicao-estado";
import { projetarOrigemHistorica, TranscricaoOrigemHistoricaSchema } from "./origem-historica-transcricao";

const id = z.string().trim().min(1).max(100);
export const RegistrarOrigemHistoricaSchema = z.object({
  matriculaId: id, referencia: z.string().trim().min(2).max(200), assinadoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pdfAssinado: z.instanceof(Buffer).refine(b => b.length > 5 && b.length <= 20 * 1024 * 1024 && b.subarray(0, 5).toString() === "%PDF-", "PDF assinado inválido ou maior que 20 MiB."),
  transcricao: TranscricaoOrigemHistoricaSchema, motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().trim().min(8).max(200),
}).strict();
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.JsonObject;

export async function registrarOrigemContratualHistoricaTx(tx: Prisma.TransactionClient, autorId: string, input: unknown) {
  const d = RegistrarOrigemHistoricaSchema.parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${d.matriculaId} FOR UPDATE`;
  await conferirAutor(tx, autorId);
  const { transcricao, projecao } = projetarOrigemHistorica(d.transcricao);
  const pdfHash = createHash("sha256").update(d.pdfAssinado).digest("hex");
  const transcricaoHash = hashSubstituicao(json(transcricao)), projecaoHash = hashSubstituicao(json(projecao));
  const entradaHash = hashSubstituicao({ matriculaId: d.matriculaId, referencia: d.referencia, assinadoEm: d.assinadoEm, pdfHash, transcricaoHash, motivo: d.motivo });
  const anterior = await tx.propostaOrigemContratualHistorica.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (anterior) {
    if (anterior.entradaHash !== entradaHash) throw new ErroRegra("Chave já utilizada com outra origem histórica.");
    return { id: anterior.id, pdfHash: anterior.pdfHash, transcricaoHash: anterior.transcricaoHash };
  }
  const matricula = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { id: true, moeda: true, preparacaoComercial: { select: { regime: true } } } });
  if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
  if (matricula.moeda !== transcricao.moeda) throw new ErroRegra(`A matrícula está em ${matricula.moeda}; a transcrição declara ${transcricao.moeda}. Alinhe a moeda antes de registrar a origem.`);
  if (matricula.preparacaoComercial && matricula.preparacaoComercial.regime !== transcricao.aulas.regime) throw new ErroRegra("O regime transcrito diverge da preparação comercial da matrícula.");
  if (await tx.conclusaoAssinaturaContratual.count({ where: { processo: { matriculaId: d.matriculaId } } })) throw new ErroRegra("A matrícula já possui contrato assinado no sistema.");
  if (await tx.propostaOrigemContratualHistorica.count({ where: { matriculaId: d.matriculaId, decisao: { is: { aprovada: true } } } })) throw new ErroRegra("A matrícula já possui origem contratual histórica aprovada.");
  if (await tx.propostaOrigemContratualHistorica.count({ where: { matriculaId: d.matriculaId, decisao: null } })) throw new ErroRegra("Já existe origem contratual histórica aguardando conferência.");
  const p = await tx.propostaOrigemContratualHistorica.create({ data: {
    matriculaId: d.matriculaId, referencia: d.referencia, assinadoEm: new Date(`${d.assinadoEm}T00:00:00Z`), pdfAssinado: d.pdfAssinado, pdfHash,
    transcricao: json(transcricao), transcricaoHash, projecao: json(projecao), projecaoHash, preparadorId: autorId, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
  await registrarEvento(tx, { tipo: "OrigemContratualHistoricaRegistrada", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId, payload: { origemId: p.id, pdfHash, transcricaoHash, referencia: d.referencia } });
  return { id: p.id, pdfHash, transcricaoHash };
}

/** Sem Server Action: bytes só são entregues pela rota privada autenticada. */
export async function carregarArquivoOrigemHistorica(input: { matriculaId: string; origemId: string }) {
  const u = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
  const d = z.object({ matriculaId: id, origemId: id }).strict().parse(input);
  return prisma.$transaction(async tx => {
    await conferirAutor(tx, u.id);
    const a = await tx.propostaOrigemContratualHistorica.findFirst({ where: { id: d.origemId, matriculaId: d.matriculaId }, select: { id: true, pdfAssinado: true, pdfHash: true } });
    if (!a) return null;
    if (createHash("sha256").update(a.pdfAssinado).digest("hex") !== a.pdfHash) throw new ErroRegra("O arquivo diverge da evidência preservada. Solicite conferência.");
    return { id: a.id, bytes: a.pdfAssinado };
  });
}
