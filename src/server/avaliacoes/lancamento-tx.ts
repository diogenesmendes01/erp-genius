import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarSituacoesNaAula } from "@/server/diario/historico-contratual";
import { docenteAtual, vinculoCobre } from "@/server/diario/permissoes";
import { alocacaoCobreAula } from "@/server/diario/alocacoes";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { NotasLancamentoSchema, OficializarLancamentoSchema, SalvarLancamentoSchema } from "./lancamento-schema";
import { conferirGestorAvaliacao } from "./regras-tx";
import { autorizacaoEspecialSegundaChamadaVigente } from "./segunda-chamada-autorizacao-especial";
import { instanteUtcSql } from "./segunda-chamada-utc";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
function conteudoLancamento(v: { realizadaEm: Date; notas: unknown; submetida: boolean; realizadaPorId: string | null; motivoRegularizacao: string | null; evidenciasRegularizacao: string | null }) {
  return { realizadaEm: v.realizadaEm.toISOString(), notas: v.notas, submetida: v.submetida,
    ...(v.realizadaPorId ? { realizadaPorId: v.realizadaPorId, motivoRegularizacao: v.motivoRegularizacao, evidenciasRegularizacao: v.evidenciasRegularizacao } : {}) };
}
export async function bloquearLancamento(tx: Prisma.TransactionClient, alocacaoId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const a = await tx.alocacaoTurma.findUnique({ where: { id: alocacaoId } });
  if (!a?.matriculaId) throw new ErroRegra("A alocação precisa de matrícula identificada e conferida.");
  await bloquearMatriculas(tx, [a.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${a.turmaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "AlocacaoTurma" WHERE id = ${alocacaoId} FOR SHARE`;
  const atual = await tx.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId } });
  if (atual.matriculaId !== a.matriculaId || atual.turmaId !== a.turmaId) throw new ErroRegra("O vínculo mudou. Atualize o lançamento.");
  return { ...atual, matriculaId: a.matriculaId };
}

/** Contextos internos, construídos por actions que já bloquearam e conferiram a origem.
 * Eles não fazem parte de `SalvarLancamentoSchema`, portanto o cliente nunca escolhe uma realização. */
export type ContextoInternoLancamento = {
  segundaChamada?: { realizacaoId: string; realizadaEm: Date; realizadaPorId: string };
};

export async function salvarLancamentoTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof SalvarLancamentoSchema>, contexto: ContextoInternoLancamento = {}) {
  const d = SalvarLancamentoSchema.parse(input), a = await bloquearLancamento(tx, d.alocacaoId);
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  const autor = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
  const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true, regraAvaliacao: true } });
  let registro = await tx.registroAvaliacaoMatricula.findUnique({ where: { matriculaId_turmaId_codigoAvaliacao: { matriculaId: a.matriculaId, turmaId: a.turmaId, codigoAvaliacao: d.codigoAvaliacao } } });
  const designacao = registro ? await tx.designacaoAvaliacao.findFirst({ where: { registroId: registro.id }, orderBy: { versao: "desc" } }) : null;
  const designado = designacao?.professorId === autorId;
  const quando = new Date(d.realizadaEm);
  const realizadaPorId = d.realizadaPorId ?? autorId;
  const segundaChamada = contexto.segundaChamada;
  let designadoSegunda = false, realizadorDesignadoSegundaHistoricamente = false;
  if (segundaChamada && (segundaChamada.realizadaEm.getTime() !== quando.getTime() || segundaChamada.realizadaPorId !== realizadaPorId)) {
    throw new ErroRegra("A nota original precisa reproduzir a realização de segunda chamada já conferida.");
  }
  let segundaEspecial = false;
  const situacao = (await carregarSituacoesNaAula(tx, [a.matriculaId], quando)).get(a.matriculaId);
  if (segundaChamada) {
    const [origem] = await tx.$queryRaw<{ propostaId: string }[]>`SELECT p.id AS "propostaId" FROM "RealizacaoSegundaChamada" sc
      JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId"
      JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId"
      WHERE sc.id=${segundaChamada.realizacaoId} AND p."alocacaoId"=${a.id} AND p."matriculaId"=${a.matriculaId}
      AND p."regraId"=${t.regraAvaliacaoId} AND p."codigoAvaliacao"=${d.codigoAvaliacao}
      AND sc."professorId"=${realizadaPorId} AND sc."realizadaEm"=${instanteUtcSql(quando)} AND rs.status='CONSUMIDA_REALIZACAO' FOR SHARE OF sc,rs,p`;
    if (!origem) throw new ErroRegra("A realização de segunda chamada não corresponde à nota e ao vínculo informados.");
    const [atual] = await tx.$queryRaw<{ professorId: string | null }[]>`SELECT professor_segunda_chamada_no_instante(${origem.propostaId},(clock_timestamp() AT TIME ZONE 'UTC')) AS "professorId"`;
    const [historica] = await tx.$queryRaw<{ professorId: string | null }[]>`SELECT professor_segunda_chamada_no_instante(${origem.propostaId},${instanteUtcSql(quando)}) AS "professorId"`;
    designadoSegunda = atual?.professorId === autorId && historica?.professorId === autorId && autorId === realizadaPorId;
    realizadorDesignadoSegundaHistoricamente = historica?.professorId === realizadaPorId;
    segundaEspecial = (situacao === "PAUSADA" || situacao === "ENCERRADA") && await autorizacaoEspecialSegundaChamadaVigente(tx, a.id, d.codigoAvaliacao, quando);
  }
  if (!autor?.ativo || !autor.papeis.includes(Papel.PROFESSOR) || (!docenteAtual(autorId, t) && !designado && !designadoSegunda)) throw new ErroPermissao("Somente o professor com atribuição vigente pode lançar esta avaliação.");
  const repetida = await tx.versaoLancamentoAvaliacao.findUnique({ where: { autorId_chaveIdempotencia: { autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (repetida) {
    if (repetida.entradaHash !== hash(d)) throw new ErroRegra("Chave já utilizada com outro lançamento.");
    return { id: repetida.id, registroId: repetida.registroId, versao: repetida.versao };
  }
  const inicioVinculo = a.provenienciaVinculo === "MIGRACAO" ? a.inicioVigencia : a.criadoEm;
  if (quando > new Date() || !inicioVinculo || quando < inicioVinculo || (!segundaEspecial && !alocacaoCobreAula(a, quando))) throw new ErroRegra("A data da avaliação precisa estar no vínculo histórico conferido do aluno e não pode ser futura.");
  const regularizacao = realizadaPorId !== autorId;
  if (regularizacao && (!designado || !d.motivoRegularizacao || !d.evidenciasRegularizacao)) throw new ErroRegra("Regularização de outra pessoa exige designação vigente, motivo e evidências.");
  if (!regularizacao && (d.motivoRegularizacao || d.evidenciasRegularizacao)) throw new ErroRegra("Informe regularização somente para avaliação realizada por outra pessoa.");
  const designacaoHistorica = registro ? await tx.designacaoAvaliacao.findFirst({ where: { registroId: registro.id, criadaEm: { lte: quando } }, orderBy: { versao: "desc" } }) : null;
  if (!designadoSegunda && !(regularizacao && realizadorDesignadoSegundaHistoricamente) && !t.vinculosDocentes.some(v => v.professorId === realizadaPorId && vinculoCobre(v, quando)) && designacaoHistorica?.professorId !== realizadaPorId) throw new ErroRegra("A data não pertence à atribuição docente. Regularize a autoria antes do lançamento.");
  if (situacao !== "ATIVA" && !segundaEspecial) throw new ErroRegra("Confira a situação contratual na data da avaliação. Não presumir realização durante pausa ou encerramento.");
  if (!t.regraAvaliacao) throw new ErroRegra("A turma precisa de regra de avaliação vinculada.");
  const regra = ConteudoRegraAvaliacaoSchema.parse(t.regraAvaliacao.conteudo);
  const avaliacao = regra.avaliacoes.find(av => av.codigo === d.codigoAvaliacao);
  if (!avaliacao || avaliacao.habilidades.length !== d.notas.length || d.notas.some(n => !avaliacao.habilidades.includes(n.habilidade))) throw new ErroRegra("As habilidades precisam corresponder à avaliação prevista na regra.");
  for (const n of d.notas) {
    if (n.nota !== null && (new Prisma.Decimal(n.nota).lt(regra.escala.minimo) || new Prisma.Decimal(n.nota).gt(regra.escala.maximo))) throw new ErroRegra("Nota fora da escala configurada.");
    if (d.submetida && n.nota === null) throw new ErroRegra("Preencha as notas desta avaliação realizada antes de submeter. Avaliação não realizada permanece pendente, sem zero.");
  }
  if (registro && (registro.alocacaoId !== a.id || registro.regraId !== t.regraAvaliacao.id)) throw new ErroRegra("Existe resultado de outro vínculo ou regra. Exige conferência de aproveitamento.");
  const ultima = registro ? await tx.versaoLancamentoAvaliacao.findFirst({ where: { registroId: registro.id }, orderBy: { versao: "desc" } }) : null;
  if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe lançamento mais recente. Atualize a versão.");
  if (registro && await tx.versaoLancamentoAvaliacao.count({ where: { registroId: registro.id, decisao: { aprovada: true } } })) throw new ErroRegra("Nota oficial exige o fluxo de correção, com aprovação independente.");
  registro ??= await tx.registroAvaliacaoMatricula.create({ data: { matriculaId: a.matriculaId, turmaId: a.turmaId, alocacaoId: a.id, regraId: t.regraAvaliacao.id, codigoAvaliacao: d.codigoAvaliacao } });
  const autoria = { realizadaPorId, motivoRegularizacao: d.motivoRegularizacao ?? null, evidenciasRegularizacao: d.evidenciasRegularizacao ?? null };
  const conteudo = conteudoLancamento({ realizadaEm: quando, notas: d.notas, submetida: d.submetida, ...autoria });
  const v = await tx.versaoLancamentoAvaliacao.create({ data: { registroId: registro.id, versao: d.versaoEsperada + 1, autorId, realizadaEm: quando,
    ...autoria, notas: d.notas, submetida: d.submetida, segundaChamadaRealizacaoId: segundaChamada?.realizacaoId, conteudoHash: hash(conteudo), chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash(d) } });
  await registrarEvento(tx, { tipo: d.submetida ? "AvaliacaoSubmetida" : "AvaliacaoRascunhoRegistrado", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId,
    payload: { registroId: registro.id, lancamentoId: v.id, turmaId: a.turmaId, regraId: registro.regraId, codigoAvaliacao: d.codigoAvaliacao, versao: v.versao, realizadaPorId, regularizacao } });
  return { id: v.id, registroId: registro.id, versao: v.versao };
}

export async function oficializarLancamentoTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof OficializarLancamentoSchema>) {
  const d = OficializarLancamentoSchema.parse(input);
  const ref = await tx.versaoLancamentoAvaliacao.findUnique({ where: { id: d.lancamentoId }, select: { registro: { select: { alocacaoId: true } } } });
  if (!ref) throw new ErroRegra("Lançamento não encontrado.");
  await bloquearLancamento(tx, ref.registro.alocacaoId); await conferirGestorAvaliacao(tx, autorId);
  const v = await tx.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: d.lancamentoId }, include: { decisao: true, registro: true } });
  if (v.autorId === autorId || v.realizadaPorId === autorId) throw new ErroRegra("Outra pessoa da Gestão Pedagógica/Administração precisa conferir.");
  const notas = NotasLancamentoSchema.parse(v.notas);
  if (v.conteudoHash !== d.conteudoHash || v.conteudoHash !== hash(conteudoLancamento({ ...v, notas }))) throw new ErroRegra("Confira a versão exata das notas.");
  if (v.decisao) {
    if (v.decisao.decisorId === autorId && v.decisao.aprovada === d.aprovada && v.decisao.motivo === d.motivo) return { id: v.decisao.id };
    throw new ErroRegra("O lançamento já possui decisão.");
  }
  if (!v.submetida) throw new ErroRegra("Rascunho não pode ser oficializado. Aguarde a submissão docente.");
  if (d.aprovada) {
    const ultima = await tx.versaoLancamentoAvaliacao.findFirstOrThrow({ where: { registroId: v.registroId }, orderBy: { versao: "desc" } });
    if (ultima.id !== v.id) throw new ErroRegra("Confira o lançamento mais recente.");
    if (await tx.versaoLancamentoAvaliacao.count({ where: { registroId: v.registroId, decisao: { aprovada: true } } })) throw new ErroRegra("Já existe resultado oficial. Use o fluxo de correção.");
    if (notas.some(n => n.nota === null)) throw new ErroRegra("Notas incompletas não podem ser oficializadas.");
  }
  const decisao = await tx.decisaoLancamentoAvaliacao.create({ data: { lancamentoId: v.id, decisorId: autorId, aprovada: d.aprovada, motivo: d.motivo } });
  await registrarEvento(tx, { tipo: d.aprovada ? "AvaliacaoOficializada" : "AvaliacaoDevolvida", agregadoTipo: "Matricula", agregadoId: v.registro.matriculaId, autorId,
    payload: { registroId: v.registroId, lancamentoId: v.id, decisaoId: decisao.id, motivo: d.motivo } });
  return { id: decisao.id };
}
