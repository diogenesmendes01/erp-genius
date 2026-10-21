"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { hashFechamento } from "./fechamento-estado-tx";
import { bloquearResolucaoProgressaoTx, carregarResolucaoProgressaoTx, decidirResolucaoRevisaoProgressaoTx } from "./resolucao-revisao-progressao-tx";

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const consultaSchema = z.object({ solicitacaoId: z.string().trim().min(1).max(100),
  acao: z.enum(["REGISTRAR_CANCELAMENTO", "RECONFIRMAR_EXECUTADA", "ENCAMINHAR_REGULARIZACAO"]),
}).strict();
const propostaSchema = consultaSchema.extend({ estadoHash: hashSchema, versaoEsperada: z.number().int().min(0).safe(),
  motivo: z.string().trim().min(5).max(3000), chaveIdempotencia: z.string().trim().min(1).max(100),
}).strict();
const decisaoSchema = z.object({ propostaId: z.string().trim().min(1).max(100), estadoHash: hashSchema,
  aprovada: z.boolean(), motivo: z.string().trim().min(5).max(3000),
}).strict();

export async function revisarResolucaoRevisaoProgressao(entrada: z.input<typeof consultaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = consultaSchema.parse(entrada);
    return prisma.$transaction(tx => carregarResolucaoProgressaoTx(tx, usuario.id, d.solicitacaoId, d.acao));
  });
}

export async function listarPropostasResolucaoRevisaoProgressao(entrada: { solicitacaoId: string; pagina?: number }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ solicitacaoId: z.string().trim().min(1).max(100), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(entrada);
    return prisma.$transaction(async tx => {
      await bloquearResolucaoProgressaoTx(tx, usuario.id, d.solicitacaoId);
      const ultima = await tx.propostaResolucaoRevisaoProgressao.findFirst({ where: { solicitacaoId: d.solicitacaoId }, orderBy: { versao: "desc" }, select: { id: true } });
      const propostas = await tx.propostaResolucaoRevisaoProgressao.findMany({ where: { solicitacaoId: d.solicitacaoId },
        orderBy: [{ versao: "desc" }, { id: "desc" }], skip: (d.pagina - 1) * 20, take: 21,
        select: { id: true, versao: true, acao: true, motivo: true, estadoHash: true, criadaEm: true,
          preparador: { select: { id: true, nome: true, ativo: true, papeis: true } },
          itens: { orderBy: { casoId: "asc" }, select: { casoId: true } },
          decisao: { select: { id: true, aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } },
        },
      });
      return { pagina: d.pagina, temMais: propostas.length > 20, itens: propostas.slice(0, 20).map(p => ({
        id: p.id, versao: p.versao, acao: p.acao, motivo: p.motivo, estadoHash: p.estadoHash, criadaEm: p.criadaEm,
        preparador: { id: p.preparador.id, nome: p.preparador.nome }, casos: p.itens.map(i => ({ id: i.casoId })), decisao: p.decisao,
        superada: p.id !== ultima?.id && !p.decisao,
        podeDecidir: p.id === ultima?.id && !p.decisao && p.preparador.id !== usuario.id && p.preparador.ativo
          && p.preparador.papeis.some(papel => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR),
      })) };
    });
  });
}

export async function proporResolucaoRevisaoProgressao(entrada: z.input<typeof propostaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = propostaSchema.parse(entrada), entradaHash = hashFechamento(d);
    return prisma.$transaction(async tx => {
      await bloquearResolucaoProgressaoTx(tx, usuario.id, d.solicitacaoId);
      const repetida = await tx.propostaResolucaoRevisaoProgressao.findUnique({ where: {
        preparadorId_chaveIdempotencia: { preparadorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia },
      } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Esta chave já foi usada em outra proposta.");
        return { id: repetida.id, versao: repetida.versao };
      }
      const estado = await carregarResolucaoProgressaoTx(tx, usuario.id, d.solicitacaoId, d.acao);
      if (estado.estadoHash !== d.estadoHash || estado.versaoAtual !== d.versaoEsperada) throw new ErroRegra("A revisão mudou. Confira novamente os casos e a proposta atual.");
      const proposta = await tx.propostaResolucaoRevisaoProgressao.create({ data: {
        matriculaId: estado.matriculaId, solicitacaoId: d.solicitacaoId, versao: d.versaoEsperada + 1,
        acao: d.acao, snapshot: estado.snapshot as Prisma.InputJsonValue, estadoHash: estado.estadoHash,
        motivo: d.motivo, preparadorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia, entradaHash,
        itens: { create: estado.casos.map(c => ({ casoId: c.id, casoHash: c.casoHash })) },
      } });
      await registrarEvento(tx, { tipo: "ResolucaoRevisaoProgressaoProposta", agregadoTipo: "Matricula", agregadoId: estado.matriculaId, autorId: usuario.id,
        payload: { propostaId: proposta.id, solicitacaoId: d.solicitacaoId, acao: d.acao, casos: estado.casos.map(c => c.id), estadoHash: estado.estadoHash } });
      return { id: proposta.id, versao: proposta.versao };
    });
  });
}

export async function decidirResolucaoRevisaoProgressao(entrada: z.input<typeof decisaoSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = decisaoSchema.parse(entrada);
    return prisma.$transaction(tx => decidirResolucaoRevisaoProgressaoTx(tx, usuario.id, d));
  });
}
