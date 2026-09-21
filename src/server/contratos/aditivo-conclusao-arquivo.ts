import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";

export async function carregarArquivoConclusaoAditivo(input: { matriculaId: string; propostaId: string; conclusaoId: string; tipo: string }) {
  const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const d = z.object({ matriculaId: z.string().min(1).max(100), propostaId: z.string().min(1).max(100), conclusaoId: z.string().min(1).max(100), tipo: z.enum(["pdf", "evidencias"]) }).strict().parse(input);
  const arquivo = await prisma.$transaction(async tx => {
    await conferirAutor(tx, autor.id);
    const where = { id: d.conclusaoId, processo: { propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } } };
    return d.tipo === "pdf" ? tx.conclusaoAssinaturaAditivo.findFirst({ where, select: { id: true, pdfAssinado: true, pdfHash: true } }).then(r => r && { id: r.id, bytes: r.pdfAssinado, hash: r.pdfHash }) : tx.conclusaoAssinaturaAditivo.findFirst({ where, select: { id: true, evidencias: true, evidenciasHash: true } }).then(r => r && { id: r.id, bytes: r.evidencias, hash: r.evidenciasHash });
  });
  if (!arquivo) return null;
  if (createHash("sha256").update(arquivo.bytes).digest("hex") !== arquivo.hash) throw new ErroRegra("O arquivo diverge da evidência preservada e não será regenerado.");
  const pdf = arquivo.bytes.subarray(0, 5).toString() === "%PDF-";
  if (d.tipo === "pdf" && !pdf) throw new ErroRegra("PDF assinado indisponível para consulta.");
  return { id: arquivo.id, bytes: arquivo.bytes, contentType: pdf ? "application/pdf" : "application/octet-stream", extensao: pdf ? "pdf" : "bin", inline: d.tipo === "pdf" };
}
