import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";

/** Sem Server Action: bytes só são entregues pela rota privada autenticada. */
export async function carregarArquivoConclusao(input: { matriculaId: string; conclusaoId: string; tipo: string }) {
  const u = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
  const d = z.object({ matriculaId: z.string().min(1).max(100), conclusaoId: z.string().min(1).max(100), tipo: z.enum(["pdf", "auditoria"]) }).strict().parse(input);
  return prisma.$transaction(async tx => {
    await conferirAutor(tx,u.id);
    const where = { id: d.conclusaoId, processo: { matriculaId: d.matriculaId } };
    const a = d.tipo === "pdf"
      ? await tx.conclusaoAssinaturaContratual.findFirst({ where, select: { id: true, pdfAssinado: true, pdfHash: true } }).then(r => r ? { id: r.id, bytes: r.pdfAssinado, hash: r.pdfHash } : null)
      : await tx.conclusaoAssinaturaContratual.findFirst({ where, select: { id: true, evidencias: true, evidenciasHash: true } }).then(r => r ? { id: r.id, bytes: r.evidencias, hash: r.evidenciasHash } : null);
    if (!a) return null;
    if (createHash("sha256").update(a.bytes).digest("hex") !== a.hash) throw new ErroRegra("O arquivo diverge da evidência preservada. Solicite conferência.");
    const pdf = a.bytes.subarray(0,5).toString() === "%PDF-";
    if (d.tipo === "pdf" && !pdf) throw new ErroRegra("PDF assinado indisponível para conferência.");
    return { id: a.id, bytes: a.bytes, contentType: pdf ? "application/pdf" : "application/octet-stream", extensao: pdf ? "pdf" : "bin", inline: d.tipo === "pdf" };
  });
}
