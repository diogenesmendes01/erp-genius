"use server";

import { Papel, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { exigirSessaoComPapel, executarAcao, ErroPermissao, ErroRegra, registrarEvento, type Resultado } from "@/server/_shared";
import { DiarioSchema, type DiarioInput } from "./schema";
import { docenteAtual, vinculoCobre } from "./permissoes";
import { alocacaoCobreAula, alunosComVinculosSobrepostos } from "./alocacoes";
import { carregarSituacoesNaAula } from "./historico-contratual";
import { bloquearContextoDiario } from "./locks";
import { estadoDiario } from "./estado";
import { participacaoParaRegistro } from "./participacao";
import { exigirAcessoRegularizacaoAulaTx } from "./regularizacao-acesso";

export async function salvarAulaDiario(input: DiarioInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const dados = DiarioSchema.parse(input);
    const ocorridaEm = new Date(dados.ocorridaEm);
    const id = await prisma.$transaction(async (tx) => {
      const acessoRegularizacao = dados.encontroId
        ? await exigirAcessoRegularizacaoAulaTx(tx, { atorId: autor.id, encontroId: dados.encontroId })
        : null;
      // O guard do diário também usa a trava institucional. Obtê-la antes de
      // matrícula/turma evita inversão com a conclusão de encontros, inclusive
      // quando este lançamento ainda não está associado à agenda.
      if (!dados.encontroId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const atribuicao = await tx.turma.findUnique({ where: { id: dados.turmaId }, select: { professorId: true, status: true, vinculosDocentes: true } });
      if (!atribuicao || (!dados.encontroId && !docenteAtual(autor.id, atribuicao))) throw new ErroPermissao("Sem atribuição docente para esta turma.");
      await bloquearContextoDiario(tx, dados.turmaId, dados.registros.map((r) => r.alunoId));
      if (!dados.encontroId) {
        await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
        const atual = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
        if (!atual?.ativo || !atual.papeis.includes(Papel.PROFESSOR))
          throw new ErroPermissao("Seu acesso docente foi revogado.");
      }
      const agora = new Date();
      if (dados.encontroId) await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id = ${dados.encontroId} FOR UPDATE`;
      const encontro = dados.encontroId ? await tx.encontroAgenda.findUnique({ where: { id: dados.encontroId } }) : null;
      if (encontro && encontro.finalidade !== "AULA") throw new ErroRegra("Recuperação não recebe diário de aula.");
      if (dados.encontroId && (!encontro || encontro.turmaId !== dados.turmaId)) throw new ErroPermissao("Sem atribuição para este encontro.");
      if (encontro && (encontro.status !== "PREVISTO" || encontro.fim > agora || encontro.inicio.getTime() !== ocorridaEm.getTime())) throw new ErroRegra("Confira a data e o estado do encontro. O lançamento exige encontro previsto já terminado.");
      if (!encontro && await tx.encontroAgenda.count({ where: { turmaId: dados.turmaId, inicio: ocorridaEm, status: { not: "RASCUNHO" } } })) throw new ErroRegra("Identifique o encontro da agenda para registrar esta aula.");
      if (ocorridaEm > agora) throw new ErroRegra("Registre apenas aulas já ministradas.");
      const turma = await tx.turma.findUnique({
        where: { id: dados.turmaId },
        include: { vinculosDocentes: true, alocacoes: { where: { AND: [
          { OR: [{ ativa: true }, { encerradaEm: { not: null } }] },
          { OR: [{ matriculaId: null, aluno: { status: "ATIVO" } }, { matriculaId: { not: null } }] },
        ] }, include: { aluno: { select: { primeiroNome: true, sobrenome: true } } } } },
      });
      if (!turma || (!encontro && !docenteAtual(autor.id, turma, agora))) throw new ErroPermissao("O diário desta turma está disponível somente para leitura.");
      if (!encontro && !turma.vinculosDocentes.some((v) => v.professorId === autor.id && v.fim === null && vinculoCobre(v, ocorridaEm)))
        throw new ErroRegra("A data da aula precisa estar dentro do vínculo docente atual. Períodos encerrados permanecem somente para leitura.");
      const anterior = dados.aulaId ? await tx.aulaDiario.findUnique({ where: { id: dados.aulaId }, include: { registros: true } }) : null;
      if (dados.aulaId && (!anterior || anterior.professorId !== (encontro?.professorId ?? autor.id) || anterior.turmaId !== turma.id)) throw new ErroPermissao();
      if (anterior && anterior.encontroId !== (dados.encontroId ?? null)) throw new ErroRegra("O vínculo entre diário e encontro não pode ser alterado.");
      if (anterior?.encontroId && dados.estadoAnterior !== estadoDiario(anterior)) throw new ErroRegra("O diário mudou desde a consulta. Recarregue a chamada antes de salvar.");
      if (anterior && anterior.ocorridaEm.getTime() !== ocorridaEm.getTime()) throw new ErroRegra("A data de uma aula registrada não pode ser alterada.");

      // Primeira chamada usa o intervalo histórico. Edição existente conserva a proteção
      // dos registros de quem saiu; correções oficiais seguem seu fluxo independente.
      if (alunosComVinculosSobrepostos(turma.alocacoes.filter(a => alocacaoCobreAula(a, ocorridaEm))).size)
        throw new ErroRegra("Há vínculos históricos sobrepostos. Solicite conferência antes de registrar a chamada.");
      const situacoes = await carregarSituacoesNaAula(tx, turma.alocacoes.flatMap((a) => a.matriculaId ? [a.matriculaId] : []), ocorridaEm);
      if (!anterior && turma.alocacoes.some((a) => alocacaoCobreAula(a, ocorridaEm) && a.matriculaId && (!situacoes.has(a.matriculaId) || situacoes.get(a.matriculaId) === "A_CONFERIR")))
        throw new ErroRegra("Há vínculos com histórico incompleto. Solicite conferência antes de registrar a chamada.");
      const atuais = new Map(turma.alocacoes.filter((a) => alocacaoCobreAula(a, ocorridaEm) && (!anterior || a.ativa) &&
        (!a.matriculaId || situacoes.get(a.matriculaId) === "ATIVA")).map((a) => [a.alunoId, a]));
      const anteriores = new Map(anterior?.registros.map((r) => [r.alunoId, r]));
      for (const registro of dados.registros) {
        const antigo = anteriores.get(registro.alunoId);
        if (!atuais.has(registro.alunoId)) {
          if (!antigo) throw new ErroPermissao("O aluno não pertence à turma na data desta aula.");
          if (registro.presente !== antigo.presente || (registro.participacao !== undefined && registro.participacao !== antigo.participacao) || (registro.observacao?.trim() || null) !== antigo.observacao)
            throw new ErroPermissao("O registro de aluno que saiu da turma permanece somente para leitura.");
        }
      }
      const aula = anterior ?? await tx.aulaDiario.create({ data: { turmaId: turma.id, professorId: acessoRegularizacao?.professorOriginalId ?? autor.id, ocorridaEm, conteudo: dados.conteudo, encontroId: dados.encontroId } });
      if (anterior) await tx.aulaDiario.update({ where: { id: aula.id }, data: { conteudo: dados.conteudo } });
      for (const registro of dados.registros) {
        const alocacao = atuais.get(registro.alunoId);
        if (!alocacao) continue; // Preserva integralmente quem saiu, inclusive se omitido pelo formulário.
        const antigo = anteriores.get(registro.alunoId);
        const participacao = participacaoParaRegistro(registro, alocacao.matriculaId ?? null, antigo);
        await tx.registroAulaAluno.upsert({
          where: { aulaId_alunoId: { aulaId: aula.id, alunoId: registro.alunoId } },
          create: { aulaId: aula.id, alunoId: registro.alunoId, nomeAluno: nomeCompleto(alocacao.aluno), presente: registro.presente, observacao: registro.observacao || null, ...participacao },
          update: { presente: registro.presente, observacao: registro.observacao || null, ...participacao, ...(antigo ? {} : { nomeAluno: nomeCompleto(alocacao.aluno) }) },
        });
      }
      await registrarEvento(tx, {
        tipo: anterior ? "AulaDiarioAtualizada" : "AulaDiarioRegistrada", agregadoTipo: "Turma", agregadoId: turma.id, autorId: autor.id,
        payload: {
          aulaId: aula.id, ocorridaEm: ocorridaEm.toISOString(), conteudo: dados.conteudo,
          atorId: autor.id, designacaoId: acessoRegularizacao?.designacaoId ?? null,
          registros: dados.registros,
          ...(anterior ? { conteudoAnterior: anterior.conteudo, registrosAntes: anterior.registros.map((r) => ({ alunoId: r.alunoId, presente: r.presente, observacao: r.observacao, matriculaId: r.matriculaId, participacao: r.participacao })) } : {}),
        },
      });
      return aula.id;
    // Após esperar os locks, a consulta precisa ver o vínculo e os papéis recém-confirmados.
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    revalidatePath("/diario");
    return { id };
  });
}
