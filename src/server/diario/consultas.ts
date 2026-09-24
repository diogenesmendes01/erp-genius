import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { docenteAtual, ehGestaoDiario, escopoTurmasDocente, vinculoCobre } from "./permissoes";
import { alocacaoCobreAula } from "./alocacoes";
import { carregarHistoricosContratuais } from "./historico-contratual";
import { situacaoMatriculaNaAula } from "@/server/matricula/historico-situacao";
import { carregarCorrecoesAulaEfetivasTx } from "./correcao-aula-efetiva-tx";
import { whereBuscaAulas } from "./busca-diario";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

export async function listarTurmasParaDiario(usuario: UsuarioSessao) {
  if (!usuario?.papeis.includes(Papel.PROFESSOR)) return [];
  const turmas = await prisma.turma.findMany({
    where: escopoTurmasDocente(usuario.id), orderBy: { codigo: "asc" },
    select: { id: true, codigo: true, nome: true },
  });
  return turmas.map((t) => ({ id: t.id, label: [t.codigo, t.nome].filter(Boolean).join(" · ") }));
}

/** Histórico do diário, 50 por vez (cursor `antesDe`). `busca` filtra no servidor, em AND com o escopo (E4). */
export async function listarAulasDiario(usuario: UsuarioSessao, antesDe?: string, busca = "") {
  if (!usuario?.id || (!ehGestaoDiario(usuario) && !usuario.papeis.includes(Papel.PROFESSOR))) return { aulas: [], proximo: null };
  const preferencia = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, fusoExibicao: true } });
  if (!preferencia?.ativo) return { aulas: [], proximo: null };
  const escopo = ehGestaoDiario(usuario) ? {} : { professorId: usuario.id };
  const filtroBusca = whereBuscaAulas(busca);
  const where = Object.keys(filtroBusca).length ? { AND: [escopo, filtroBusca] } : escopo;
  let cursor: { id: string } | undefined;
  if (antesDe) {
    // O cursor também precisa atender à busca: um link antigo com outra busca não abre página alheia.
    const autorizado = await prisma.aulaDiario.findFirst({ where: Object.keys(filtroBusca).length ? { AND: [where, { id: antesDe }] } : { ...escopo, id: antesDe }, select: { id: true } });
    if (!autorizado) return { aulas: [], proximo: null };
    cursor = autorizado;
  }
  const registros = await prisma.aulaDiario.findMany({
    where, orderBy: [{ ocorridaEm: "desc" }, { id: "desc" }], take: 51, ...(cursor ? { cursor, skip: 1 } : {}),
    select: {
      id: true, turmaId: true, professorId: true, ocorridaEm: true, conteudo: true, atualizadoEm: true,
      encontroId: true, encontro: { select: { professorId: true, status: true, fim: true, finalidade: true, matriculaId: true, fusoOrigem: true,
        publicacaoGravacao: { select: { id: true } }, excecoesGravacao: { where: { decisao: { aprovada: true } }, take: 1, select: { id: true } } } },
      professor: { select: { nome: true } },
      turma: { select: { codigo: true, professorId: true, status: true, vinculosDocentes: true, alocacoes: { where: { OR: [
        // O bloco legado é intencionalmente idêntico ao anterior.
        { provenienciaVinculo: null, ativa: true, OR: [{ matriculaId: null, aluno: { status: "ATIVO" } }, { matricula: { status: { in: ["ATIVA", "PAUSADA"] } } }] },
        // Histórico migrado depende da matrícula âncora e será limitado pela vigência abaixo.
        { provenienciaVinculo: "MIGRACAO", matriculaId: { not: null } },
      ] }, select: { alunoId: true, matriculaId: true, criadoEm: true, encerradaEm: true, ativa: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true } } } },
      // O histórico usa exclusivamente nome capturado na aula, nunca a ficha atual do aluno.
      registros: { select: { alunoId: true, nomeAluno: true, presente: true, observacao: true, participacao: true }, orderBy: { nomeAluno: "asc" } },
    },
  });
  const pagina = registros.slice(0, 50);
  const correcoesEfetivas = await carregarCorrecoesAulaEfetivasTx(prisma, pagina.flatMap((a) => a.encontroId && a.encontro?.finalidade === "AULA" ? [a.encontroId] : []));
  const ids = [...new Set(pagina.flatMap((a) => (a.turma?.alocacoes ?? []).flatMap((v) => v.matriculaId ? [v.matriculaId] : [])))];
  const historicos = await carregarHistoricosContratuais(prisma, ids);
  const aulas = pagina.map((a) => {
    const correcaoEfetiva = a.encontroId ? correcoesEfetivas.get(a.encontroId) : undefined;
    const podeEditar = !!a.turma && !a.encontroId && usuario.papeis.includes(Papel.PROFESSOR) && a.professorId === usuario.id && docenteAtual(usuario.id, a.turma) && a.turma.vinculosDocentes.some((v) => v.professorId === usuario.id && v.fim === null && vinculoCobre(v, a.ocorridaEm));
    const podeAbrirEncontro = usuario.papeis.includes(Papel.PROFESSOR) && a.professorId === usuario.id && a.encontro?.professorId === usuario.id && a.encontro.status === "PREVISTO" && a.encontro.fim <= new Date();
    const docenteVigente = usuario.papeis.includes(Papel.PROFESSOR) && a.professorId === usuario.id && a.encontro?.professorId === usuario.id
      && (a.turma ? a.turma.professorId === usuario.id && a.turma.vinculosDocentes.some(v => v.professorId === usuario.id && v.fim === null && v.inicio <= a.ocorridaEm)
        : !!a.encontro.matriculaId);
    const podeProporCorrecao = a.encontro?.finalidade === "AULA" && a.encontro.status === "MINISTRADO" && a.encontro.fim <= new Date()
      && (ehGestaoDiario(usuario) || docenteVigente);
    const podeLerCorrecao = a.encontro?.finalidade === "AULA" && a.encontro.status === "MINISTRADO" && a.encontro.fim <= new Date()
      && (ehGestaoDiario(usuario) || (usuario.papeis.includes(Papel.PROFESSOR) && a.professorId === usuario.id && a.encontro.professorId === usuario.id));
    const atuais = new Set((a.turma?.alocacoes ?? []).filter((v) => {
      if (!alocacaoCobreAula(v, a.ocorridaEm)) return false;
      if (!v.matriculaId) return true;
      const h = historicos.get(v.matriculaId);
      return h && situacaoMatriculaNaAula(h, a.ocorridaEm) === "ATIVA";
    }).map((v) => v.alunoId));
    return {
      id: a.id, turmaId: a.turmaId, turma: a.turma?.codigo ?? (a.turmaId ? "Turma" : "Particular"), professor: a.professor.nome,
      encontroParaEditar: podeAbrirEncontro ? a.encontroId : null,
      encontroParaCorrecao: podeProporCorrecao ? a.encontroId : null,
      encontroParaHistoricoCorrecao: podeLerCorrecao ? a.encontroId : null,
      encontroParaGravacao: podeLerCorrecao && a.encontro?.publicacaoGravacao && !a.encontro.excecoesGravacao.length
        && (!correcaoEfetiva || correcaoEfetiva.snapshot.gravacao?.tipo === "OFICIAL") ? a.encontroId : null,
      ocorridaEm: a.ocorridaEm.toISOString(), fusoExibicao: resolverFusoExibicao(preferencia.fusoExibicao, a.encontro?.fusoOrigem ?? "UTC"), conteudo: correcaoEfetiva?.snapshot.conteudo ?? a.conteudo, atualizadoEm: a.atualizadoEm.toISOString(), podeEditar,
      correcaoPublicada: correcaoEfetiva ? { versao: correcaoEfetiva.versao } : null,
      registros: (correcaoEfetiva?.snapshot.registros ?? a.registros).slice().sort((x, y) => x.nomeAluno.localeCompare(y.nomeAluno)).map((r) => ({ alunoId: r.alunoId, nomeAluno: r.nomeAluno, presente: r.presente, observacao: r.observacao, participacao: r.participacao, podeEditar: podeEditar && atuais.has(r.alunoId) })),
    };
  });
  return { aulas, proximo: registros.length > 50 ? aulas.at(-1)?.id ?? null : null };
}
export type TurmaDiario = Awaited<ReturnType<typeof listarTurmasParaDiario>>[number];
export type AulaDiarioView = Awaited<ReturnType<typeof listarAulasDiario>>["aulas"][number];
