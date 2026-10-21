import { Prisma } from "@prisma/client";
import { ErroPermissao, ErroRegra } from "@/server/_shared";
import { hashCorrecaoAula, snapshotCorrecaoAulaSchema, type SnapshotCorrecaoAula } from "./correcao-aula-schema";
import { carregarCorrecoesAulaEfetivasTx } from "./correcao-aula-efetiva-tx";
import { validarProjecaoCorrecaoAula } from "./correcao-aula-projecao";

/** Mesma ordem institucional usada para a agenda e suas correções. */
export async function carregarCorrecaoAulaTx(tx: Prisma.TransactionClient, usuarioId: string, encontroId: string,
  consulta?: { somenteLeitura: true; antesDaVersao?: number }) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id = ${encontroId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo) throw new ErroPermissao();
  const e = await tx.encontroAgenda.findUnique({ where: { id: encontroId }, include: {
    publicacaoGravacao: { select: { id: true } },
    turma: { include: { vinculosDocentes: true } }, diario: { include: { registros: { orderBy: { id: "asc" } } } },
    excecoesGravacao: { where: { decisao: { aprovada: true } }, include: { decisao: true }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 1 },
  } });
  if (!e || e.finalidade !== "AULA" || e.status !== "MINISTRADO" || !e.diario) {
    throw new ErroRegra("A correção exige uma aula ministrada com diário identificado.");
  }
  const gestao = usuario.papeis.some(p => p === "GERENTE_PEDAGOGICO" || p === "ADMINISTRADOR");
  const agora = new Date();
  if (e.fim > agora) throw new ErroRegra("Confira a data de conclusão da aula antes de corrigir.");
  const professorVinculado = usuario.papeis.includes("PROFESSOR") && e.professorId === usuarioId
    && (e.turma ? e.turma.professorId === usuarioId && e.turma.vinculosDocentes.some(v =>
      v.professorId === usuarioId && v.fim === null && v.inicio <= e.inicio && v.inicio <= agora) : !!e.matriculaId);
  const podePropor = gestao || professorVinculado;
  const professorDaAula = usuario.papeis.includes("PROFESSOR") && e.professorId === usuarioId && e.diario.professorId === usuarioId;
  if (!podePropor && !(consulta?.somenteLeitura && professorDaAula)) throw new ErroPermissao("Somente a gestão ou o professor ainda vinculado pode propor esta correção.");
  if (e.diario.professorId !== e.professorId || e.diario.turmaId !== e.turmaId || e.diario.ocorridaEm.getTime() !== e.inicio.getTime()) {
    throw new ErroRegra("Confira a autoria e os vínculos do diário antes de corrigir.");
  }
  if (!e.diario.registros.length || e.diario.registros.some(r => !r.matriculaId || !r.participacao || r.presente === null
    || r.presente !== (r.participacao === "PRESENTE"))) {
    throw new ErroRegra("Identifique os contratos e confira a participação de todos os registros antes de corrigir.");
  }
  const original: SnapshotCorrecaoAula = { versao: 1, encontroId: e.id, diarioId: e.diario.id, conteudo: e.diario.conteudo,
    registros: e.diario.registros.map(r => ({ registroId: r.id, alunoId: r.alunoId, matriculaId: r.matriculaId!, nomeAluno: r.nomeAluno,
      presente: r.presente!, participacao: r.participacao!, observacao: r.observacao })),
    gravacao: e.excecoesGravacao[0]?.decisao ? { tipo: "EXCECAO", decisaoId: e.excecoesGravacao[0].decisao.id }
      : e.publicacaoGravacao ? { tipo: "OFICIAL", publicacaoId: e.publicacaoGravacao.id } : null,
  };
  const correcao = (await carregarCorrecoesAulaEfetivasTx(tx, [encontroId])).get(encontroId);
  const snapshot = correcao ? validarProjecaoCorrecaoAula(original, correcao.snapshot).novo : original;
  const ultima = await tx.propostaCorrecaoAula.findFirst({ where: { encontroId }, orderBy: { versao: "desc" }, select: { versao: true } });
  const propostasPagina = await tx.propostaCorrecaoAula.findMany({ where: { encontroId,
    ...(consulta?.antesDaVersao !== undefined ? { versao: { lt: consulta.antesDaVersao } } : {}) }, orderBy: { versao: "desc" }, take: 21,
    select: { id: true, versao: true, motivo: true, evidencia: true, criadaEm: true, autorId: true, entradaHash: true,
      autor: { select: { nome: true } }, snapshotAnterior: true, snapshotNovo: true,
      aprovacao: { select: { id: true, motivo: true, criadaEm: true, decisor: { select: { nome: true } } } },
      rejeicao: { select: { id: true, motivo: true, criadaEm: true, decisor: { select: { nome: true } } } } } });
  const propostas = propostasPagina.slice(0, 20);
  const estadoHash = hashCorrecaoAula({ snapshot, professorId: e.professorId, turmaId: e.turmaId, matriculaId: e.matriculaId,
    inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), atualizadoEm: e.diario.atualizadoEm.toISOString(),
    ...(correcao ? { aprovacaoId: correcao.aprovacaoId } : {}) });
  return { snapshot, estadoHash, versaoAtual: ultima?.versao ?? 0, podePropor,
    proximaVersao: propostasPagina.length > 20 ? propostas.at(-1)!.versao : null,
    propostas: propostas.map(p => ({ id: p.id, versao: p.versao, motivo: p.motivo, evidencia: p.evidencia, autor: p.autor,
      criadaEm: p.criadaEm.toISOString(), propostaHash: p.entradaHash,
      podeRejeitar: gestao && p.autorId !== usuarioId && !p.rejeicao && !p.aprovacao && p.versao === ultima?.versao,
      aprovacao: p.aprovacao ? { ...p.aprovacao, criadaEm: p.aprovacao.criadaEm.toISOString() } : null,
      rejeicao: p.rejeicao ? { ...p.rejeicao, criadaEm: p.rejeicao.criadaEm.toISOString() } : null,
      snapshotAnterior: snapshotCorrecaoAulaSchema.parse(p.snapshotAnterior), snapshotNovo: snapshotCorrecaoAulaSchema.parse(p.snapshotNovo) })) };
}
