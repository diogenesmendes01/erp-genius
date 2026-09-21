"use server";

import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, type Resultado } from "@/server/_shared";
import { carregarEstadoRetomada } from "./estado";
import { impedimentoFluxoGlobal } from "@/server/matricula/limite-legado";
import { SnapshotRetomadaSchema, impedimentoRetomada, parcelasElegiveisRetomada, dataMinimaReprogramacao } from "./regras";
import type { ContextoRetomada, PropostaRetomadaResumo } from "./schema";

export type { ContextoRetomada, PropostaRetomadaResumo, ParcelaRetomada } from "./schema";

export async function listarContextoRetomada(alunoId: string): Promise<Resultado<ContextoRetomada>> {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
    if (!alunoId.trim()) throw new ErroRegra("Aluno obrigatório.");
    const estado = await carregarEstadoRetomada(prisma, alunoId);
    const impedimentoGlobal = await impedimentoFluxoGlobal(prisma, alunoId);
    const pendente = await prisma.propostaRetomada.findFirst({ where: { alunoId, status: "PENDENTE" }, select: { id: true } });
    return {
      alunoId, alunoNome: nomeCompleto(estado.aluno), status: estado.aluno.status,
      dataMinimaReprogramacao: dataMinimaReprogramacao(),
      pausa: estado.pausa ? { ...estado.pausa, criadoEm: estado.pausa.criadoEm.toISOString() } : null,
      propostaPendenteId: pendente?.id ?? null,
      impedimento: impedimentoGlobal ?? impedimentoRetomada(estado.aluno.status, estado.pausa?.id ?? null, estado.pausaRastreada, estado.matriculas),
      parcelas: !impedimentoGlobal && estado.pausa ? parcelasElegiveisRetomada(estado.matriculas, estado.pausa.id) : [],
    };
  });
}

export async function listarPropostasRetomada(alunoId?: string): Promise<Resultado<PropostaRetomadaResumo[]>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
    const podeAprovar = autor.papeis.some((papel) => papel === Papel.FINANCEIRO || papel === Papel.ADMINISTRADOR);
    if (alunoId !== undefined && !alunoId.trim()) throw new ErroRegra("Aluno obrigatório.");
    if (!alunoId && !podeAprovar) throw new ErroPermissao("Consulte retomadas na ficha individual do aluno.");
    const propostas = await prisma.propostaRetomada.findMany({
      where: alunoId ? { alunoId } : { status: "PENDENTE" }, orderBy: { criadoEm: "desc" }, take: 100,
      select: {
        id: true, alunoId: true, pausaId: true, opcao: true, status: true, motivo: true, criadoEm: true, decididoEm: true, motivoDecisao: true, snapshot: true,
        aluno: { select: { primeiroNome: true, sobrenome: true } }, solicitante: { select: { id: true, nome: true } }, aprovador: { select: { id: true, nome: true } },
      },
    });
    const impedimentos = new Map(await Promise.all([...new Set(propostas.filter(p => p.status === "PENDENTE").map(p => p.alunoId))]
      .map(async id => [id, await impedimentoFluxoGlobal(prisma, id)] as const)));
    return propostas.map((proposta) => {
      const snapshot = SnapshotRetomadaSchema.safeParse(proposta.snapshot);
      const parcelas = snapshot.success ? parcelasElegiveisRetomada(snapshot.data.matriculas.map((m) => ({ ...m,
        cobrancas: m.cobrancas.map((c) => ({ ...c, vencimento: new Date(c.vencimento), pagoEm: c.pagoEm ? new Date(c.pagoEm) : null })),
      })), proposta.pausaId) : [];
      return {
        id: proposta.id, alunoId: proposta.alunoId, alunoNome: nomeCompleto(proposta.aluno), pausaId: proposta.pausaId,
        opcao: proposta.opcao, status: proposta.status, motivo: proposta.motivo, solicitante: proposta.solicitante, aprovador: proposta.aprovador,
        criadoEm: proposta.criadoEm.toISOString(), decididoEm: proposta.decididoEm?.toISOString() ?? null, motivoDecisao: proposta.motivoDecisao,
        podeDecidir: podeAprovar && proposta.status === "PENDENTE" && proposta.solicitante.id !== autor.id,
        impedimentoAprovacao: impedimentos.get(proposta.alunoId) ?? null,
        parcelas: parcelas.map((p) => ({ ...p, novoVencimento: snapshot.success ? snapshot.data.alvos.find((alvo) => alvo.cobrancaId === p.cobrancaId)?.novoVencimento ?? p.vencimento : p.vencimento })),
      };
    });
  });
}
