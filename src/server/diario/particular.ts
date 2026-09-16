"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, executarAcao, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { DiarioSchema } from "./schema";
import { carregarAlunoParticularTx } from "./particular-contexto";
import { estadoDiario } from "./estado";
import { participacaoParaRegistro } from "./participacao";
import { exigirAcessoRegularizacaoAulaTx } from "./regularizacao-acesso";

const Entrada = DiarioSchema.innerType().omit({ turmaId: true }).extend({ encontroId: z.string().min(1), registros: DiarioSchema.innerType().shape.registros.max(1) }).strict();
export async function salvarDiarioParticular(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO), d = Entrada.parse(input);
    const resultado = await prisma.$transaction(async tx => {
      const acessoRegularizacao = await exigirAcessoRegularizacaoAulaTx(tx, { atorId: autor.id, encontroId: d.encontroId });
      const inicial = await tx.encontroAgenda.findUnique({ where: { id: d.encontroId }, select: { matriculaId: true, professorId: true } });
      if (!inicial?.matriculaId) throw new ErroPermissao("Sem atribuição para esta particular.");
      await bloquearMatriculas(tx, [inicial.matriculaId]);
      const e = await tx.encontroAgenda.findUniqueOrThrow({ where: { id: d.encontroId }, include: { diario: { include: { registros: true } } } });
      if (e.finalidade !== "AULA") throw new ErroRegra("Recuperação não recebe diário de aula particular.");
      if (e.matriculaId !== inicial.matriculaId || e.turmaId) throw new ErroPermissao();
      if (e.status !== "PREVISTO" || e.fim > new Date() || e.inicio.toISOString() !== new Date(d.ocorridaEm).toISOString()) throw new ErroRegra("Confira a data: a particular precisa estar prevista e já terminada.");
      const anterior = e.diario;
      if (await tx.consumoHorasCompradas.count({ where: { reserva: { encontroId: e.id } } })) throw new ErroRegra("As horas desta aula já foram conferidas. Solicite correção com revisão dos efeitos financeiros.");
      if (anterior?.professorId && anterior.professorId !== e.professorId) throw new ErroPermissao("O diário possui autoria diferente do professor original.");
      if ((anterior?.id ?? null) !== (d.aulaId ?? null) || (anterior && d.estadoAnterior !== estadoDiario(anterior))) throw new ErroRegra("O diário mudou. Recarregue antes de salvar.");
      const chamada = await carregarAlunoParticularTx(tx, inicial.matriculaId, e.inicio);
      if (chamada.exigeConferencia || chamada.alunos.length !== 1) throw new ErroRegra("Confira o histórico da matrícula na data da particular.");
      const aluno = chamada.alunos[0], registro = d.registros[0];
      const participacao = participacaoParaRegistro(registro, inicial.matriculaId, anterior?.registros.find(r => r.alunoId === aluno.alunoId));
      if (registro.alunoId !== aluno.alunoId) throw new ErroPermissao("O aluno não pertence a esta contratação.");
      const aula = anterior ? await tx.aulaDiario.update({ where: { id: anterior.id }, data: { conteudo: d.conteudo } }) : await tx.aulaDiario.create({ data: { encontroId: e.id, professorId: acessoRegularizacao.professorOriginalId, ocorridaEm: e.inicio, conteudo: d.conteudo } });
      await tx.registroAulaAluno.upsert({ where: { aulaId_alunoId: { aulaId: aula.id, alunoId: aluno.alunoId } },
        create: { aulaId: aula.id, ...aluno, presente: registro.presente, observacao: registro.observacao || null, ...participacao },
        update: { presente: registro.presente, observacao: registro.observacao || null, ...participacao } });
      await registrarEvento(tx, { tipo: anterior ? "AulaDiarioAtualizada" : "AulaDiarioRegistrada", agregadoTipo: "Matricula", agregadoId: inicial.matriculaId, autorId: autor.id,
        payload: { aulaId: aula.id, encontroId: e.id, conteudo: d.conteudo, registros: d.registros, atorId: autor.id, designacaoId: acessoRegularizacao.designacaoId, estadoAnterior: anterior ? estadoDiario(anterior) : null,
          conteudoAnterior: anterior?.conteudo ?? null, registrosAntes: anterior?.registros ?? [] } });
      return { id: aula.id };
    });
    revalidatePath("/diario"); revalidatePath(`/diario/encontros/${d.encontroId}`);
    return resultado;
  });
}
