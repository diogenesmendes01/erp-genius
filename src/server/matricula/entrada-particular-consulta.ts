"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { exigirPrecoPreparacaoAutorizado } from "./preco-autorizado";
import { conferirPagamentosEntradaParticular } from "./entrada-particular-pagamentos";

export async function consultarPagamentosEntradaParticular(matriculaId: string) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO), id = z.string().min(1).max(100).parse(matriculaId);
    return prisma.$transaction(async tx => {
      await bloquearMatriculas(tx, [id]);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const usuario = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${id} ORDER BY id FOR SHARE`;
      const m = await tx.matricula.findUnique({ where: { id }, include: { aluno: { select: { primeiroNome: true, sobrenome: true } }, preparacaoComercial: true,
        condicoesEntradaPreparacao: { orderBy: { versao: "desc" }, take: 1 }, pagadoresPreparacao: { orderBy: { versao: "desc" }, take: 1 },
        emissoesEntrada: { include: { itens: { select: { cobrancaId: true } }, conferenciaInicial: { select: { id: true } } } }, cobrancas: true } });
      if (!m?.secretariaAssumiuEm || !m.preparacaoComercial?.reservaParticularId || !["RASCUNHO", "AGUARDANDO"].includes(m.status)) throw new ErroRegra("Confira uma particular em preparação assumida pela Secretaria.");
      const condicoes = m.condicoesEntradaPreparacao[0], emissao = m.emissoesEntrada.find(e => e.etapa === "CONFERENCIA_SECRETARIA");
      if (!condicoes || !emissao?.conferenciaInicial || emissao.condicoesId !== condicoes.id || m.emissoesEntrada.length !== 1) throw new ErroRegra("Conclua a emissão conferida nas condições atuais antes de verificar a entrada.");
      const refs = z.object({ preparacaoId: z.string(), pagadorRegistroId: z.string() }).parse(condicoes.dados);
      if (refs.preparacaoId !== m.preparacaoComercial.id || refs.pagadorRegistroId !== m.pagadoresPreparacao[0]?.id) throw new ErroRegra("A preparação ou o pagador mudou. Confira novamente as condições.");
      await exigirPrecoPreparacaoAutorizado(tx, m.id);
      return { matriculaId: m.id, codigo: m.codigo, aluno: m.aluno, condicoesId: condicoes.id, versaoCondicoes: condicoes.versao,
        ...conferirPagamentosEntradaParticular(condicoes.dados, emissao.memoria, m.cobrancas, emissao.itens.map(i => i.cobrancaId)) };
    });
  });
}
