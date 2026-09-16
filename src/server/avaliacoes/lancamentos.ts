"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { DataHoraAvaliacaoSchema, instanteAvaliacaoLocal } from "./tempo";
import { docenteAtual } from "@/server/diario/permissoes";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { notaVigente } from "./nota-vigente";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { avaliacoesDesignadas } from "./designacao-acesso";
import { SalvarLancamentoSchema, OficializarLancamentoSchema, NotasLancamentoSchema } from "./lancamento-schema";
import { salvarLancamentoTx, oficializarLancamentoTx, bloquearLancamento } from "./lancamento-tx";
export async function salvarLancamentoAvaliacao(input: z.input<typeof SalvarLancamentoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR);
    return prisma.$transaction(tx => salvarLancamentoTx(tx, u.id, input));
  });
}
export async function salvarLancamentoAvaliacaoLocal(input: Omit<z.input<typeof SalvarLancamentoSchema>, "realizadaEm"> & { realizadaLocal: string; fuso: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR);
    const { realizadaLocal, fuso, ...d } = SalvarLancamentoSchema.omit({ realizadaEm: true }).extend({ realizadaLocal: DataHoraAvaliacaoSchema, fuso: FusoInstitucionalSchema }).strict().parse(input);
    let realizadaEm: string;
    try { realizadaEm = instanteAvaliacaoLocal(realizadaLocal, fuso).toISOString(); }
    catch { throw new ErroRegra("Confira data, horário e fuso. Horário inexistente ou ambíguo não será escolhido automaticamente; informe um horário inequívoco ou seu equivalente conferido em UTC."); }
    return prisma.$transaction(tx => salvarLancamentoTx(tx, u.id, { ...d, realizadaEm }));
  });
}
export async function oficializarLancamentoAvaliacao(input: z.input<typeof OficializarLancamentoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    return prisma.$transaction(tx => oficializarLancamentoTx(tx, u.id, input));
  });
}

export async function consultarLancamentosAvaliacao(input: { alocacaoId: string; codigoAvaliacao: string; pagina?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ alocacaoId: SalvarLancamentoSchema.shape.alocacaoId, codigoAvaliacao: SalvarLancamentoSchema.shape.codigoAvaliacao,
      pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const a = await bloquearLancamento(tx, d.alocacaoId);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      if (!fresco?.ativo) throw new ErroPermissao();
      const gestao = fresco.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true, regraAvaliacao: true } });
      const professorAtual = fresco.papeis.includes(Papel.PROFESSOR) && docenteAtual(u.id, t);
      const registro = await tx.registroAvaliacaoMatricula.findUnique({ where: { matriculaId_turmaId_codigoAvaliacao: { matriculaId: a.matriculaId, turmaId: a.turmaId, codigoAvaliacao: d.codigoAvaliacao } } });
      const autoriaPropria = { OR: [{ autorId: u.id }, { realizadaPorId: u.id }] };
      const historicoProprio = fresco.papeis.includes(Papel.PROFESSOR) && registro && await tx.versaoLancamentoAvaliacao.count({ where: { registroId: registro.id, ...autoriaPropria } }) > 0;
      const designado = fresco.papeis.includes(Papel.PROFESSOR) && !!registro && (await avaliacoesDesignadas(tx, a.id, u.id)).some(r => r.id === registro.id);
      if (!gestao && !professorAtual && !historicoProprio && !designado) throw new ErroPermissao();
      const regra = t.regraAvaliacao ? ConteudoRegraAvaliacaoSchema.parse(t.regraAvaliacao.conteudo) : null;
      const avaliacao = regra?.avaliacoes.find(av => av.codigo === d.codigoAvaliacao) ?? null;
      const ultima = registro ? await tx.versaoLancamentoAvaliacao.findFirst({ where: { registroId: registro.id }, orderBy: { versao: "desc" }, select: { id: true, versao: true } }) : null;
      const oficial = registro ? await tx.versaoLancamentoAvaliacao.count({ where: { registroId: registro.id, decisao: { aprovada: true } } }) > 0 : false;
      const filtroAutor = gestao || professorAtual || designado ? {} : autoriaPropria;
      const versoes = registro ? await tx.versaoLancamentoAvaliacao.findMany({ where: { registroId: registro.id, ...filtroAutor }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 20, take: 21,
        select: { id: true, versao: true, realizadaEm: true, notas: true, submetida: true, conteudoHash: true, criadaEm: true,
          realizadaPor: { select: { id: true, nome: true } }, motivoRegularizacao: true, evidenciasRegularizacao: true,
          autor: { select: { id: true, nome: true } }, decisao: { select: { aprovada: true, motivo: true, criadaEm: true, decisor: { select: { id: true, nome: true } } } } } }) : [];
      const historicoDesignacoes = designado && registro ? await tx.designacaoAvaliacao.findMany({ where: { registroId: registro.id, professorId: { not: null } }, select: { professorId: true }, distinct: ["professorId"] }) : [];
      const realizadores = designado ? await tx.usuario.findMany({ where: { id: { in: [...new Set([u.id, ...t.vinculosDocentes.map(v => v.professorId), ...historicoDesignacoes.flatMap(d => d.professorId ? [d.professorId] : [])])] } }, select: { id: true, nome: true }, orderBy: [{ nome: "asc" }, { id: "asc" }] }) : [];
      return { registro: registro ? { id: registro.id, matriculaId: registro.matriculaId, turmaId: registro.turmaId, regraId: registro.regraId, codigoAvaliacao: registro.codigoAvaliacao } : null,
        identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId, a.turmaId),
        contexto: { turma: t.nome ?? t.codigo ?? "Turma", regraVersao: t.regraAvaliacao?.versao ?? null, escala: regra?.escala ?? null, avaliacao },
        versaoEsperada: ultima?.versao ?? 0, oficial, podeGerirDesignacao: gestao,
        podeLancar: (professorAtual || designado) && !!avaliacao && !oficial, realizadores, registradorId: u.id,
        versoes: await Promise.all(versoes.slice(0, 20).map(async v => ({ ...v, notas: NotasLancamentoSchema.parse(v.notas),
          vigente: (gestao || professorAtual) && v.decisao?.aprovada ? await notaVigente(tx, v) : null,
          podeDecidir: gestao && v.autor.id !== u.id && v.realizadaPor?.id !== u.id && v.submetida && !v.decisao,
          podeAprovar: gestao && v.autor.id !== u.id && v.realizadaPor?.id !== u.id && v.submetida && !v.decisao && ultima?.id === v.id && !oficial,
        }))), pagina: d.pagina, temProxima: versoes.length > 20 };
    });
  });
}

export async function listarAvaliacoesAlocacao(alocacaoId: string) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const id = SalvarLancamentoSchema.shape.alocacaoId.parse(alocacaoId);
    return prisma.$transaction(async tx => {
      const a = await bloquearLancamento(tx, id);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${u.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } });
      if (!fresco?.ativo) throw new ErroPermissao();
      const gestao = fresco.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true, regraAvaliacao: true } });
      const atual = fresco.papeis.includes(Papel.PROFESSOR) && docenteAtual(u.id, t);
      const proprios = fresco.papeis.includes(Papel.PROFESSOR) ? await tx.registroAvaliacaoMatricula.findMany({ where: { matriculaId: a.matriculaId, turmaId: a.turmaId, versoes: { some: { OR: [{ autorId: u.id }, { realizadaPorId: u.id }] } } }, select: { codigoAvaliacao: true } }) : [];
      const designadas = fresco.papeis.includes(Papel.PROFESSOR) ? await avaliacoesDesignadas(tx, a.id, u.id) : [];
      if (!gestao && !atual && !proprios.length && !designadas.length) throw new ErroPermissao();
      const regra = t.regraAvaliacao ? ConteudoRegraAvaliacaoSchema.parse(t.regraAvaliacao.conteudo) : null;
      return { turma: t.nome ?? t.codigo ?? "Turma", regraVersao: t.regraAvaliacao?.versao ?? null,
        avaliacoes: (regra?.avaliacoes ?? []).filter(av => gestao || atual || [...proprios, ...designadas].some(p => p.codigoAvaliacao === av.codigo)).map(av => ({ codigo: av.codigo, titulo: av.titulo, etapa: av.etapa })),
      };
    });
  });
}
