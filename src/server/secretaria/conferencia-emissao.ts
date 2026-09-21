"use server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { emitirEntradaTx } from "@/server/matricula/emissao-entrada-tx";
import { carregarRevisaoEmissao } from "./conferencia-emissao-estado";

export async function consultarRevisaoEmissao(matriculaId: string) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    z.string().min(1).parse(matriculaId);
    return prisma.$transaction((tx) => carregarRevisaoEmissao(tx, matriculaId), { isolationLevel: "RepeatableRead" });
  });
}

const Entrada = z.object({ matriculaId: z.string().min(1), revisaoHash: z.string().regex(/^[a-f0-9]{64}$/),
  cadastroDocumentosConferidos: z.literal(true), condicoesConferidas: z.literal(true), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();
export async function conferirEEmitirEntrada(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Entrada.parse(input);
    const hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [d.matriculaId]);
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const anterior = await tx.conferenciaEmissaoInicial.findUnique({ where: { autorId_chaveIdempotencia: { autorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== hash) throw new ErroRegra("Chave utilizada para outra conferência.");
        return { id: anterior.id, emissaoId: anterior.emissaoId };
      }
      if (await tx.emissaoCobrancasEntrada.count({ where: { matriculaId: d.matriculaId, etapa: "CONFERENCIA_SECRETARIA" } })) throw new ErroRegra("A emissão inicial já foi realizada. Consulte o registro existente.");
      const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { alunoId: true } });
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${m.alunoId} FOR SHARE`;
      const revisao = await carregarRevisaoEmissao(tx, d.matriculaId);
      if (revisao.hash !== d.revisaoHash) throw new ErroRegra("Os dados mudaram desde a revisão. Atualize e confira novamente antes de emitir.");
      const emissao = await emitirEntradaTx(tx, { matriculaId: d.matriculaId, condicoesId: revisao.condicoesId, executorId: autor.id, etapa: "CONFERENCIA_SECRETARIA" });
      const c = await tx.conferenciaEmissaoInicial.create({ data: { matriculaId: d.matriculaId, emissaoId: emissao.id, autorId: autor.id, revisaoHash: revisao.hash, entradaHash: hash, chaveIdempotencia: d.chaveIdempotencia, motivo: d.motivo,
        snapshot: { revisao: revisao.snapshot, cadastroDocumentosConferidos: true, condicoesConferidas: true, avisos: revisao.avisos } } });
      await registrarEvento(tx, { tipo: "ConferenciaEmissaoInicialRegistrada", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { conferenciaId: c.id, emissaoId: emissao.id, motivo: d.motivo } });
      return { id: c.id, emissaoId: emissao.id };
    }, { timeout: 20000 });
  });
}

export async function consultarTelaEmissao(matriculaId: string) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    z.string().min(1).parse(matriculaId);
    return prisma.$transaction(async (tx) => {
      const existente = await tx.conferenciaEmissaoInicial.findUnique({ where: { matriculaId }, select: { id: true, criadaEm: true, motivo: true, autor: { select: { nome: true } }, emissao: { select: { memoria: true } } } });
      if (existente) {
        const memoria = z.object({ agendaParticular: z.unknown().optional(), cobrancas: z.array(z.object({ id: z.string(), tipo: z.string(), valor: z.string(), moeda: z.string(), vencimento: z.string() })) }).parse(existente.emissao.memoria);
        return { estado: "EMITIDA" as const, particular: Boolean(memoria.agendaParticular), registro: { id: existente.id, criadaEm: existente.criadaEm, motivo: existente.motivo, autor: existente.autor, cobrancas: memoria.cobrancas } };
      }
      const r = await carregarRevisaoEmissao(tx, matriculaId);
      return { estado: "REVISAO" as const, revisao: { hash: r.hash, avisos: r.avisos, plano: r.plano, dados: r.dadosVisiveis } };
    }, { isolationLevel: "RepeatableRead" });
  });
}
