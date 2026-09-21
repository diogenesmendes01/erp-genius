import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { carregarContextoSubstituicaoTx, hashSubstituicao } from "./substituicao-estado";

const Iniciar = z.object({ propostaId: z.string().min(1).max(100), propostaHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const Observar = z.object({ intencaoId: z.string().min(1).max(100), processoId: z.string().min(1).max(100), propostaId: z.string().min(1).max(100),
  chave: z.string().trim().min(8).max(200), resultado: z.enum(["INCERTO", "CONFIRMADO"]), referenciaExterna: z.string().trim().min(1).max(200), evidenciaHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

/** Interna: persistir e COMMITAR a intenção antes de qualquer chamada remota.
 * `nova: false` exige conciliação da mesma intenção, nunca repetir a solicitação.
 * Nenhuma destas primitivas constitui um adaptador autenticado do fornecedor. */
export async function iniciarCancelamentoAssinaturaTx(tx: Prisma.TransactionClient, executorId: string, entrada: unknown) {
  const d = Iniciar.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const proposta = await tx.propostaSubstituicaoContratual.findUnique({ where: { id: d.propostaId }, include: { decisao: true, processoFonte: true } });
  if (!proposta) throw new ErroRegra("Proposta de substituição não encontrada.");
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${proposta.matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id = ${proposta.processoFonteId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${executorId} FOR SHARE`;
  await conferirAutor(tx, executorId);
  if (d.propostaHash !== proposta.entradaHash || hashSubstituicao(proposta.snapshot) !== proposta.entradaHash) throw new ErroRegra("Confira a proposta exata antes do cancelamento.");
  const decisao = proposta.decisao;
  if (!decisao?.aprovada || decisao.propostaHash !== proposta.entradaHash || decisao.decisorId === proposta.preparadaPorId) throw new ErroRegra("Cancelamento exige aprovação independente da proposta exata.");
  const anterior = await tx.intencaoCancelamentoAssinatura.findUnique({ where: { processoId: proposta.processoFonteId } });
  if (anterior) {
    if (anterior.propostaId !== proposta.id || !anterior.decisaoId || anterior.pedidoDesistenciaId || anterior.decisaoAdministrativaDesistenciaId || anterior.executorId !== executorId || anterior.propostaHash !== d.propostaHash) throw new ErroRegra("Há intenção anterior de cancelamento. Concilie o resultado antes de outra operação.");
    return { id: anterior.id, nova: false, referenciaExterna: anterior.referenciaExterna, fornecedor: proposta.processoFonte.fornecedor, ambiente: proposta.processoFonte.ambiente };
  }
  if (await tx.propostaSubstituicaoContratual.count({ where: { processoFonteId: proposta.processoFonteId, versao: { gt: proposta.versao } } })) throw new ErroRegra("Existe proposta mais recente para este processo.");
  const snapshot = proposta.snapshot as Prisma.JsonObject;
  const contexto = await carregarContextoSubstituicaoTx(tx, snapshot.entrada);
  const atual = JSON.parse(JSON.stringify({ ...contexto, versao: proposta.versao, preparadaPorId: proposta.preparadaPorId, motivo: proposta.motivo, entrada: snapshot.entrada })) as Prisma.JsonValue;
  if (hashSubstituicao(atual) !== proposta.entradaHash) throw new ErroRegra("As condições mudaram após a aprovação. Não solicite cancelamento.");
  const intencao = await tx.intencaoCancelamentoAssinatura.create({ data: { processoId: proposta.processoFonteId, propostaId: proposta.id, decisaoId: decisao.id, executorId, propostaHash: proposta.entradaHash, referenciaExterna: contexto.referenciaExternaFonte } });
  await registrarEvento(tx, { tipo: "CancelamentoAssinaturaIniciado", agregadoTipo: "Matricula", agregadoId: proposta.matriculaId, autorId: executorId,
    payload: { intencaoId: intencao.id, processoId: proposta.processoFonteId, propostaId: proposta.id, decisaoId: decisao.id } });
  return { id: intencao.id, nova: true, referenciaExterna: intencao.referenciaExterna, fornecedor: proposta.processoFonte.fornecedor, ambiente: proposta.processoFonte.ambiente };
}

/** Somente resultado previamente autenticado pelo adaptador/conciliador futuro.
 * A evidência externa é preservada mesmo se surgirem mudanças locais ou conclusão
 * concorrente. Não marca processo CANCELADO nem autoriza um contrato substituto. */
export async function registrarObservacaoCancelamentoTx(tx: Prisma.TransactionClient, entrada: unknown) {
  const d = Observar.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const intencao = await tx.intencaoCancelamentoAssinatura.findUnique({ where: { id: d.intencaoId }, include: { processo: { select: { matriculaId: true } } } });
  if (!intencao || intencao.processoId !== d.processoId || intencao.propostaId !== d.propostaId || !intencao.decisaoId || intencao.pedidoDesistenciaId || intencao.decisaoAdministrativaDesistenciaId || intencao.referenciaExterna !== d.referenciaExterna) throw new ErroRegra("Observação incompatível com a intenção, proposta ou processo.");
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${intencao.processo.matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id = ${intencao.processoId} FOR UPDATE`;
  let observacao = await tx.observacaoCancelamentoAssinatura.findUnique({ where: { intencaoId_chave: { intencaoId: intencao.id, chave: d.chave } } });
  if (observacao) {
    if (observacao.resultado !== d.resultado || observacao.referenciaExterna !== d.referenciaExterna || observacao.evidenciaHash !== d.evidenciaHash) throw new ErroRegra("Chave de observação reutilizada com outro resultado.");
  } else {
    observacao = await tx.observacaoCancelamentoAssinatura.create({ data: { intencaoId: intencao.id, chave: d.chave, resultado: d.resultado, referenciaExterna: d.referenciaExterna, evidenciaHash: d.evidenciaHash } });
    await registrarEvento(tx, { tipo: "ResultadoCancelamentoAssinaturaPreservado", agregadoTipo: "Matricula", agregadoId: intencao.processo.matriculaId,
      payload: { intencaoId: intencao.id, observacaoId: observacao.id, processoId: intencao.processoId, resultado: d.resultado } });
  }
  const confirmado = await tx.observacaoCancelamentoAssinatura.count({ where: { intencaoId: intencao.id, resultado: "CONFIRMADO" } });
  const conclusao = await tx.conclusaoAssinaturaContratual.count({ where: { processoId: intencao.processoId } });
  return { id: observacao.id, cancelamentoConfirmado: confirmado > 0, conclusaoConcorrente: conclusao > 0, liberacaoSubstituto: false as const };
}

const IniciarDesistencia = z.object({ pedidoId: z.string().min(1).max(100), processoId: z.string().min(1).max(100), estadoHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const ObservarDesistencia = z.object({ intencaoId: z.string().min(1).max(100), processoId: z.string().min(1).max(100), pedidoId: z.string().min(1).max(100), chave: z.string().trim().min(8).max(200), resultado: z.enum(["INCERTO", "CONFIRMADO"]), referenciaExterna: z.string().trim().min(1).max(200), evidenciaHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

/** Cancela um envio externo por desistência já autorizada. Não cria artefato ou
 * processo substituto: o pedido, a decisão administrativa e a aplicação Q165
 * são a origem auditável desse ato. */
export async function iniciarCancelamentoAssinaturaDesistenciaTx(tx: Prisma.TransactionClient, executorId: string, entrada: unknown) {
  const d = IniciarDesistencia.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const pedido = await tx.pedidoDesistenciaPreparacao.findUnique({ where: { id: d.pedidoId }, include: { decisaoAdministrativa: true } });
  const processo = await tx.processoAssinaturaContratual.findUnique({ where: { id: d.processoId } });
  if (!pedido || !processo || processo.matriculaId !== pedido.matriculaId) throw new ErroRegra("Pedido e processo de assinatura não correspondem.");
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${pedido.matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id=${processo.id} FOR UPDATE`;
  await conferirAutor(tx, executorId);
  const decisao = pedido.decisaoAdministrativa;
  const administrador = decisao && await tx.usuario.findUnique({ where: { id: decisao.decisorId }, select: { ativo: true, papeis: true } });
  const aplicacao = await tx.aplicacaoAcertoDesistenciaContratual.findFirst({ where: { decisao: { aprovada: true, proposta: { pedidoId: pedido.id, estadoHash: pedido.estadoHash } } }, select: { id: true } });
  if (pedido.estadoHash !== d.estadoHash || !decisao?.aprovada || decisao.estadoHash !== pedido.estadoHash || decisao.decisorId === pedido.registradorId || !administrador?.ativo || !administrador.papeis.includes("ADMINISTRADOR") || !aplicacao || !processo.referenciaExterna || await tx.conclusaoAssinaturaContratual.count({ where: { processoId: processo.id } })) throw new ErroRegra("Cancelamento exige pedido Q121, decisão administrativa e aplicação Q165 aprovados para envio ainda aberto.");
  const anterior = await tx.intencaoCancelamentoAssinatura.findUnique({ where: { processoId: processo.id } });
  if (anterior) {
    if (anterior.pedidoDesistenciaId !== pedido.id || anterior.decisaoAdministrativaDesistenciaId !== decisao.id || anterior.executorId !== executorId || anterior.propostaHash !== d.estadoHash || anterior.referenciaExterna !== processo.referenciaExterna) throw new ErroRegra("Há intenção anterior de cancelamento. Concilie o resultado antes de outra operação.");
    return { id: anterior.id, nova: false, referenciaExterna: anterior.referenciaExterna, fornecedor: processo.fornecedor, ambiente: processo.ambiente };
  }
  if (processo.estado !== "ENVIADO") throw new ErroRegra("O envio não está aberto para cancelamento; concilie seu resultado antes de iniciar nova solicitação.");
  const intencao = await tx.intencaoCancelamentoAssinatura.create({ data: { processoId: processo.id, pedidoDesistenciaId: pedido.id, decisaoAdministrativaDesistenciaId: decisao.id, executorId, propostaHash: d.estadoHash, referenciaExterna: processo.referenciaExterna } });
  await registrarEvento(tx, { tipo: "CancelamentoAssinaturaDesistenciaIniciado", agregadoTipo: "Matricula", agregadoId: pedido.matriculaId, autorId: executorId, payload: { intencaoId: intencao.id, processoId: processo.id, pedidoId: pedido.id, decisaoAdministrativaId: decisao.id } });
  return { id: intencao.id, nova: true, referenciaExterna: processo.referenciaExterna, fornecedor: processo.fornecedor, ambiente: processo.ambiente };
}

export async function registrarObservacaoCancelamentoDesistenciaTx(tx: Prisma.TransactionClient, entrada: unknown) {
  const d = ObservarDesistencia.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const intencao = await tx.intencaoCancelamentoAssinatura.findUnique({ where: { id: d.intencaoId }, include: { processo: { select: { matriculaId: true } } } });
  if (!intencao || intencao.processoId !== d.processoId || intencao.pedidoDesistenciaId !== d.pedidoId || !intencao.decisaoAdministrativaDesistenciaId || intencao.propostaId || intencao.decisaoId || intencao.referenciaExterna !== d.referenciaExterna) throw new ErroRegra("Observação incompatível com a intenção de desistência.");
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${intencao.processo.matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id=${intencao.processoId} FOR UPDATE`;
  let observacao = await tx.observacaoCancelamentoAssinatura.findUnique({ where: { intencaoId_chave: { intencaoId: intencao.id, chave: d.chave } } });
  if (observacao) { if (observacao.resultado !== d.resultado || observacao.referenciaExterna !== d.referenciaExterna || observacao.evidenciaHash !== d.evidenciaHash) throw new ErroRegra("Chave de observação reutilizada com outro resultado."); }
  else { observacao = await tx.observacaoCancelamentoAssinatura.create({ data: { intencaoId: intencao.id, chave: d.chave, resultado: d.resultado, referenciaExterna: d.referenciaExterna, evidenciaHash: d.evidenciaHash } }); await registrarEvento(tx, { tipo: "ResultadoCancelamentoAssinaturaDesistenciaPreservado", agregadoTipo: "Matricula", agregadoId: intencao.processo.matriculaId, payload: { intencaoId: intencao.id, observacaoId: observacao.id, processoId: intencao.processoId, resultado: d.resultado } }); }
  if (d.resultado === "CONFIRMADO") {
    if (await tx.conclusaoAssinaturaContratual.count({ where: { processoId: intencao.processoId } })) throw new ErroRegra("A assinatura foi concluída; não é possível encerrá-la como cancelada.");
    await tx.processoAssinaturaContratual.update({ where: { id: intencao.processoId }, data: { estado: "CANCELADO" } });
  }
  const confirmado = await tx.observacaoCancelamentoAssinatura.count({ where: { intencaoId: intencao.id, resultado: "CONFIRMADO" } });
  return { id: observacao.id, cancelamentoConfirmado: confirmado > 0 };
}
