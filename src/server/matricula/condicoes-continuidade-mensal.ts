"use server";
import { impedimentoPreparacaoMensal } from "./condicoes-continuidade-fonte";
import { z } from "zod";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento, ChaveIdempotenciaSchema } from "@/server/_shared";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { RegrasContinuidadeMensalSchema } from "./continuidade-mensal-schema";




export async function consultarCondicoesContinuidadeMensal(matriculaId: string) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
    const id = z.string().min(1).parse(matriculaId);
    return prisma.$transaction(async tx => {
      await exigirAutor(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.ADMINISTRADOR]);
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: autor.id }, select: { papeis: true } });
      const m = await tx.matricula.findUnique({ where: { id }, select: { codigo: true, moeda: true, contratoOk: true, confirmacaoContratoEm: true, contratoDocumentoId: true,
        preparacaoComercial: { select: { regime: true } } } });
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      const versoes = await tx.condicoesContinuidadeMensalMatricula.findMany({ where: { matriculaId: id }, orderBy: { versao: "desc" },
        select: { id: true, versao: true, regras: true, documentoId: true, status: true, motivo: true, motivoDecisao: true, criadaEm: true, decididaEm: true,
          preparador: { select: { id: true, nome: true } }, decisor: { select: { nome: true } } } });

      const impedimento = !m.contratoOk || !m.confirmacaoContratoEm || !m.contratoDocumentoId ? "Confirme o contrato da matrícula antes de preparar as condições."
        : impedimentoPreparacaoMensal(m.preparacaoComercial?.regime);
      return { matriculaId: id, codigo: m.codigo, moeda: m.moeda, documentoId: m.contratoDocumentoId, impedimento,
        podePreparar: !impedimento && !versoes.some(v => v.status === "PENDENTE") && u.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR),
        versoes: versoes.map(v => ({ ...v, regras: RegrasContinuidadeMensalSchema.safeParse(v.regras).success ? RegrasContinuidadeMensalSchema.parse(v.regras) : null,
          naoConferida: !RegrasContinuidadeMensalSchema.safeParse(v.regras).success,
          podeDecidir: v.status === "PENDENTE" && v.preparador.id !== autor.id && u.papeis.includes(Papel.ADMINISTRADOR),
          criadaEm: v.criadaEm.toISOString(), decididaEm: v.decididaEm?.toISOString() ?? null })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

async function exigirFonte(tx: Prisma.TransactionClient, matriculaId: string, documentoId: string, regras: unknown) {
  const m = await tx.matricula.findUnique({ where: { id: matriculaId } });
  if (!m?.contratoOk || !m.confirmacaoContratoEm || m.contratoDocumentoId !== documentoId) throw new ErroRegra("Use o contrato confirmado da matrícula.");
  await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${documentoId} FOR SHARE`;
  const doc = await tx.documento.findFirst({ where: { id: documentoId, categoria: "CONTRATO", arquivado: false, OR: [{ matriculaId }, ...(m.leadId ? [{ leadId: m.leadId }] : [])] } });
  if (!doc) throw new ErroRegra("Documento contratual indisponível.");
  const r = RegrasContinuidadeMensalSchema.parse(regras);
  if (r.continuidadeContratada.evidenciaId !== documentoId) throw new ErroRegra("A evidência da continuidade deve ser o contrato conferido.");
  if (r.moeda !== m.moeda) throw new ErroRegra("A moeda precisa corresponder à matrícula.");
  const p = await tx.preparacaoComercialMatricula.findUnique({ where: { matriculaId }, select: { regime: true } });
  if (!p || p.regime !== "MENSALIDADE") throw new ErroRegra("Condições exigem contratação mensal preparada.");
}
async function exigirAutor(tx: Prisma.TransactionClient, id: string, papeis: Papel[]) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${id} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => papeis.includes(p))) throw new ErroPermissao();
}
const Preparar = z.object({ matriculaId: z.string().min(1), documentoId: z.string().min(1), regras: RegrasContinuidadeMensalSchema, motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: ChaveIdempotenciaSchema.optional() }).strict();
export async function prepararCondicoesContinuidadeMensal(input: z.input<typeof Preparar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const { chaveIdempotencia, ...d } = Preparar.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, d);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [d.matriculaId]);
      await exigirAutor(tx, autor.id, [Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR]);
      // Criação com chave (#166, 7º lote): a marca vai no `CondicoesContinuidadeMensalPreparadas`. O reenvio da mesma tentativa devolve
      // a versão já preparada, mesmo que ela tenha sido decidida no intervalo; a busca vem antes das validações de estado.
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, { tipo: "CondicoesContinuidadeMensalPreparadas", agregadoTipo: "Matricula", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada para outra proposta de condições. Recarregue a página antes de repetir." });
        if (repetido) { const p = repetido.payload as { condicoesId: string; versao: number }; return { id: p.condicoesId, versao: p.versao }; }
      }
      await exigirFonte(tx, d.matriculaId, d.documentoId, d.regras);
      if (await tx.condicoesContinuidadeMensalMatricula.count({ where: { matriculaId: d.matriculaId, status: "PENDENTE" } })) throw new ErroRegra("Já existe versão aguardando decisão.");
      const ultima = await tx.condicoesContinuidadeMensalMatricula.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const c = await tx.condicoesContinuidadeMensalMatricula.create({ data: { ...d, versao: (ultima?.versao ?? 0) + 1, preparadorId: autor.id } });
      await registrarEvento(tx, { tipo: "CondicoesContinuidadeMensalPreparadas", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { condicoesId: c.id, versao: c.versao, documentoId: d.documentoId, ...marca } });
      return { id: c.id, versao: c.versao };
    });
  });
}
export async function decidirCondicoesContinuidadeMensal(input: { id: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const d = z.object({ id: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const ref = await tx.condicoesContinuidadeMensalMatricula.findUnique({ where: { id: d.id }, select: { matriculaId: true } });
      if (!ref) throw new ErroRegra("Versão não encontrada.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [ref.matriculaId]);
      await exigirAutor(tx, autor.id, [Papel.ADMINISTRADOR]);
      const c = await tx.condicoesContinuidadeMensalMatricula.findUniqueOrThrow({ where: { id: d.id } });
      if (c.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a proposta.");
      if (c.status !== "PENDENTE") {
        // Idempotência por natureza (#166, 7º lote): a mesma decisão, de quem já decidiu e com o mesmo motivo, devolve ok
        // sem gravar de novo (a matrícula travada acima serializa o clique duplo). Outra decisão segue recusada.
        if (c.decisorId === autor.id && c.status === (d.aprovar ? "APROVADA" : "REJEITADA") && c.motivoDecisao === d.motivo) return;
        throw new ErroRegra("Esta versão já recebeu decisão.");
      }
      if (d.aprovar) await exigirFonte(tx, c.matriculaId, c.documentoId, c.regras);
      await tx.condicoesContinuidadeMensalMatricula.update({ where: { id: c.id }, data: { status: d.aprovar ? "APROVADA" : "REJEITADA", decisorId: autor.id, decididaEm: new Date(), motivoDecisao: d.motivo } });
      await registrarEvento(tx, { tipo: "CondicoesContinuidadeMensalDecididas", agregadoTipo: "Matricula", agregadoId: c.matriculaId, autorId: autor.id, payload: { condicoesId: c.id, aprovada: d.aprovar, motivo: d.motivo } });
    });
  });
}

