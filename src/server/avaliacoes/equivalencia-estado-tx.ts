import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { bloquearEstadoAcademico, carregarEstadoAcademico } from "@/server/academico/estado";
import { classificarDestinoAcademico, impedimentoEstadoAcademico, montarSnapshotMudancaAcademica } from "@/server/academico/regras";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { carregarFontesEquivalenciaTx } from "./fontes-equivalencia-tx";
import { projetarEquivalenciaTransferencia, type EntradaEquivalenciaTransferencia } from "./equivalencia-transferencia";

/** Estado interno: nunca retornar este objeto à Secretaria. O fluxo chamador
 * autoriza o papel antes da leitura e revalida o usuário após os locks. */
export async function conferirEstadoEquivalenciaTx(tx: Prisma.TransactionClient, entrada: {
  matriculaId: string; alocacaoOrigemId: string; turmaDestinoId: string;
  mapeamentos: EntradaEquivalenciaTransferencia["mapeamentos"];
}) {
  const matricula = await tx.matricula.findUnique({ where: { id: entrada.matriculaId }, select: { alunoId: true } });
  if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
  await bloquearEstadoAcademico(tx, matricula.alunoId, entrada.turmaDestinoId);
  const estado = await carregarEstadoAcademico(tx, matricula.alunoId, entrada.turmaDestinoId, entrada.matriculaId);
  const impedimento = impedimentoEstadoAcademico(estado);
  if (impedimento) throw new ErroRegra(impedimento);
  const mudancaAberta = await tx.solicitacaoMudancaAcademica.findFirst({ where: {
    alunoId: matricula.alunoId, matriculaId: entrada.matriculaId, status: { in: ["PENDENTE", "APROVADA"] },
  }, select: { id: true } });
  if (mudancaAberta) throw new ErroRegra("Há uma mudança de nível em aberto nesta matrícula. Resolva a solicitação antes de transferir.");
  if (!estado.origem || !estado.destino || estado.origem.id !== entrada.alocacaoOrigemId) {
    throw new ErroRegra("A alocação de origem mudou. Confira novamente a transferência.");
  }
  if (classificarDestinoAcademico(estado.origem.turma, estado.destino) !== "EQUIVALENTE") {
    throw new ErroRegra("O aproveitamento desta transferência exige turmas equivalentes do mesmo nível.");
  }
  const turmas = await tx.turma.findMany({ where: { id: { in: [estado.origem.turmaId, estado.destino.id] } },
    select: { id: true, regraAvaliacao: { select: { id: true, versao: true, conteudo: true } } } });
  const origem = turmas.find(t => t.id === estado.origem!.turmaId)?.regraAvaliacao;
  const destino = turmas.find(t => t.id === estado.destino!.id)?.regraAvaliacao;
  if (!origem || !destino) throw new ErroRegra("As duas turmas precisam de regras de avaliação conferidas para o aproveitamento.");
  const regraOrigem = ConteudoRegraAvaliacaoSchema.parse(origem.conteudo);
  const regraDestino = ConteudoRegraAvaliacaoSchema.parse(destino.conteudo);
  const contexto = { matriculaId: entrada.matriculaId, nivelOrigemId: estado.origem.turma.nivelId,
    nivelDestinoId: estado.destino.nivelId, alocacaoOrigemId: estado.origem.id,
    turmaOrigemId: estado.origem.turmaId, turmaDestinoId: estado.destino.id,
    regraOrigemId: origem.id, regraDestinoId: destino.id };
  const fontesOficiais = await carregarFontesEquivalenciaTx(tx, {
    matriculaId: entrada.matriculaId, alocacaoId: estado.origem.id, turmaId: estado.origem.turmaId,
    nivelId: contexto.nivelOrigemId, regraId: origem.id,
  });
  const projecao = projetarEquivalenciaTransferencia({ contexto, fontesOficiais,
    requisitosDestino: regraDestino.avaliacoes.flatMap(a => a.habilidades.map(habilidade => ({
      codigoAvaliacao: a.codigo, habilidade, pesoAvaliacao: a.peso,
    }))), mapeamentos: entrada.mapeamentos });
  const snapshot = {
    versao: 1, academico: montarSnapshotMudancaAcademica(estado), contexto,
    regraOrigem: { id: origem.id, versao: origem.versao, conteudo: regraOrigem },
    regraDestino: { id: destino.id, versao: destino.versao, conteudo: regraDestino },
    fontesOficiais, projecao,
  };
  // Ordem de propriedades de JSONB não é estável. Arrays mantêm sua ordem
  // semântica; objetos são serializados por chave antes da comparação.
  function canon(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, valor]) => [k, canon(valor)]));
    return v;
  }
  const estadoHash = createHash("sha256").update(JSON.stringify(canon(snapshot))).digest("hex");
  return { alunoId: matricula.alunoId, snapshot, estadoHash, projecao };
}
