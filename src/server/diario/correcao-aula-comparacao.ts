import { validarProjecaoCorrecaoAula } from "./correcao-aula-projecao";

/** Compara a chamada, sem simular frequência global ou alterar cotas/financeiro. */
export function compararCorrecaoAula(anteriorJson: unknown, novoJson: unknown,
  reposicoes: { id: string; matriculaId: string; concluida: boolean; decisao?: { id: string; aprovada: boolean } | null }[]) {
  const { anterior, novo } = validarProjecaoCorrecaoAula(anteriorJson, novoJson);
  const registros = anterior.registros.map((antes, indice) => {
    const depois = novo.registros[indice]!;
    const participacaoAlterada = antes.participacao !== depois.participacao;
    return { registroId: antes.registroId, alunoId: antes.alunoId, matriculaId: antes.matriculaId, nomeAluno: antes.nomeAluno,
      antes: { participacao: antes.participacao, observacao: antes.observacao }, depois: { participacao: depois.participacao, observacao: depois.observacao },
      participacaoAlterada, observacaoAlterada: antes.observacao !== depois.observacao,
      reposicoesParaConferencia: participacaoAlterada ? reposicoes.filter(r => r.matriculaId === antes.matriculaId
        && !(r.decisao?.aprovada === false && !r.concluida)).map(r => ({
        id: r.id, conclusaoRegistrada: r.concluida,
        motivo: depois.participacao === "PRESENTE" ? "ORIGEM_PASSA_A_PRESENCA" as const : "CLASSIFICACAO_DA_ORIGEM_ALTERADA" as const,
      })) : [],
    };
  });
  return { conteudo: { antes: anterior.conteudo, depois: novo.conteudo, alterado: anterior.conteudo !== novo.conteudo }, registros };
}
