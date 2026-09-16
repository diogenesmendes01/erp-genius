"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { limitesAtuais, exigeAprovacaoComponente } from "@/server/financeiro/politica";
import { ConferenciaAlcadaSchema } from "./alcada-preparacao";
const Memoria = z.object({ exigeDirecao: z.boolean().default(true), alcada: ConferenciaAlcadaSchema });
export async function decidirPrecoPreparacao(input: { preparacaoId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    const d = z.object({ preparacaoId: z.string().min(1), aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const p = await tx.preparacaoComercialMatricula.findUnique({ where: { id: d.preparacaoId } });
      if (!p) throw new ErroRegra("Preparação não encontrada.");
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${p.matriculaId} FOR UPDATE`;
      const m = await tx.matricula.findUniqueOrThrow({ where: { id: p.matriculaId }, select: { status: true, leadId: true } });
      if (m.leadId) await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${m.leadId} FOR UPDATE`;
      const autor = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { id: true, nome: true, ativo: true, papeis: true } });
      if (!autor?.ativo || !autor.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.GERENTE_COMERCIAL)) throw new ErroPermissao();
      const admin = autor.papeis.includes(Papel.ADMINISTRADOR);
      if (!admin && (!m.leadId || !await tx.lead.findFirst({ where: { AND: [{ id: m.leadId }, await escopoComercialAtual(autor, tx)] }, select: { id: true } }))) throw new ErroPermissao();
      if (p.preparadorId === autor.id) throw new ErroPermissao("Outra pessoa autorizada deve decidir a proposta.");
      const memoria = Memoria.safeParse(p.referencias);
      if (!memoria.success) throw new ErroRegra("A preparação precisa de conferência da referência e alçada antes desta decisão.");
      if (memoria.data.exigeDirecao && !admin) throw new ErroPermissao("Esta proposta exige decisão da Administração.");
      const anterior = await tx.decisaoPrecoPreparacao.findUnique({ where: { preparacaoId: p.id } });
      if (anterior) {
        if (anterior.decisorId === autor.id && anterior.aprovada === d.aprovar && anterior.motivo === d.motivo) return { id: anterior.id, aprovada: anterior.aprovada };
        throw new ErroRegra("Preparação já decidida.");
      }
      if (!["RASCUNHO", "AGUARDANDO"].includes(m.status)) throw new ErroRegra("A matrícula não está em preparação.");
      if (memoria.data.alcada.componentes.every((c) => c.resultado === "DENTRO_ALCADA")) throw new ErroRegra("Esta preparação não exige exceção de preço. Prossiga com as conferências aplicáveis.");
      const limites = await limitesAtuais(tx, autor);
      if (d.aprovar && !admin) {
        if (limites.alcadaAlteradaEm && limites.alcadaAlteradaEm > p.criadaEm) throw new ErroPermissao("Alçada alterada após a preparação. Encaminhe à Administração.");
        for (const c of memoria.data.alcada.componentes) {
          if (c.referencia === null || c.resultado === "REFERENCIA_INSUFICIENTE" || exigeAprovacaoComponente(limites, c.tipo, c.referencia, c.proposto)) throw new ErroPermissao("Referência insuficiente ou desconto acima da sua alçada. Encaminhe à Administração.");
        }
      }
      const r = await tx.decisaoPrecoPreparacao.create({ data: { preparacaoId: p.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "PrecoPreparacaoDecidido", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id, payload: { preparacaoId: p.id, decisaoId: r.id, aprovada: r.aprovada } });
      return { id: r.id, aprovada: r.aprovada };
    }, { timeout: 20000 });
  });
}
