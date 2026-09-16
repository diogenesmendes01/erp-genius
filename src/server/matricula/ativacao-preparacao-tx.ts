import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { resolverComissao } from "@/server/financeiro/politica";
import { exigirContratoAceito } from "./ativacao";
import { exigirCondicoesMensaisAceitas } from "./condicoes-aceitas";
import { conferirPagamentosEntradaParticular } from "./entrada-particular-pagamentos";
import { conferirContinuidadeReserva } from "./excecao-admissao-estado";
import { emitirEntradaTx } from "./emissao-entrada-tx";
import { carregarAgendaParticularContratual } from "@/server/contratos/agenda-particular";
import { hashPrevia } from "@/server/contratos/previa-estado";

/** Ativação da contratação preparada. Recebimentos são confirmados pelo fluxo financeiro. */
export async function ativarPreparacaoTx(tx: Prisma.TransactionClient, matriculaId: string, autorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  const autor = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
  if (!autor?.ativo || !autor.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
  const m = await tx.matricula.findUnique({ where: { id: matriculaId }, include: {
    preparacaoComercial: true, produto: true, lead: { select: { etapa: true } },
    condicoesEntradaPreparacao: { orderBy: { versao: "desc" }, take: 1 }, cobrancas: { orderBy: { id: "asc" } },
    emissoesEntrada: { include: { itens: { select: { cobrancaId: true } }, conferenciaInicial: { select: { id: true } } } },
  } });
  const p = m?.preparacaoComercial;
  if (!m || !p) throw new ErroRegra("Preparação comercial não encontrada.");
  if (!p.reservaParticularId && p.regime !== "MENSALIDADE") throw new ErroRegra("A contratação por hora exige horários reservados.");
  if (m.status === "ATIVA") {
    const evento = await tx.evento.findFirst({ where: { agregadoTipo: "Matricula", agregadoId: m.id, tipo: "MatriculaAtivada" }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { payload: true } });
    if (z.object({ preparacaoId: z.literal(p.id) }).safeParse(evento?.payload).success) return { leadId: m.leadId };
    throw new ErroRegra("Confira a origem da ativação antes de repetir a operação.");
  }
  if (!["RASCUNHO", "AGUARDANDO"].includes(m.status) || !m.secretariaAssumiuEm) throw new ErroRegra("A matrícula precisa estar em preparação assumida pela Secretaria.");
  const documentoId = await exigirContratoAceito(tx, m);
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${m.id} ORDER BY id FOR UPDATE`;
  const cobrancas = await tx.cobranca.findMany({ where: { matriculaId: m.id }, orderBy: { id: "asc" } });
  await exigirCondicoesMensaisAceitas(tx, { ...m, cobrancas });
  if (await tx.aprovacao.count({ where: { alvoTipo: "Matricula", alvoId: m.id, status: "PENDENTE" } })) throw new ErroRegra("A matrícula aguarda aprovação comercial.");
  const condicoes = m.condicoesEntradaPreparacao[0], emissao = m.emissoesEntrada[0];
  if (!condicoes || m.emissoesEntrada.length !== 1 || !emissao?.conferenciaInicial || emissao.condicoesId !== condicoes.id) throw new ErroRegra("Confira a emissão inicial das condições aceitas.");
  const entrada = conferirPagamentosEntradaParticular(condicoes.dados, emissao.memoria, cobrancas, emissao.itens.map(i => i.cobrancaId));
  if (!entrada.pagamentosExigidosConfirmados) throw new ErroRegra("Confirme no Financeiro todos os pagamentos exigidos antes da ativação.");
  if (entrada.regime !== p.regime) throw new ErroRegra("O regime de entrada diverge da contratação.");
  const regra = p.regime === "MENSALIDADE" ? z.object({ aulas: z.object({ regime: z.literal("MENSALIDADE"), diaVencimentoContratado: z.number().int(), cobertura: z.object({ referencia: z.enum(["MES_CIVIL", "CICLO_MATRICULA"]), inicio: z.string() }) }) }).parse(condicoes.dados).aulas : null;
  const particular = p.reservaParticularId ? await carregarAgendaParticularContratual(tx, m.id, p.reservaParticularId) : null;
  if (particular) {
    if (await tx.alocacaoTurma.count({ where: { matriculaId: m.id, ativa: true } })) throw new ErroRegra("A preparação particular já possui alocação de turma. Confira o vínculo antes de ativar.");
    const docentes = [...new Set(particular.snapshot.horarios.map(h => h.professorId))].sort();
    await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id IN (${Prisma.join(docentes)}) ORDER BY id FOR SHARE`;
    // A inativação pode ter ocorrido entre a leitura inicial e a aquisição do bloqueio.
    await carregarAgendaParticularContratual(tx, m.id, p.reservaParticularId!);
    if (await tx.encontroAgenda.count({ where: { matriculaId: m.id } })) throw new ErroRegra("Confira os encontros já registrados nesta preparação.");
  }
  const reserva = !particular && p.reservaId ? await tx.reservaVagaMatricula.findFirst({ where: { id: p.reservaId, matriculaId: m.id }, include: { turma: { include: { nivel: true } } } }) : null;
  const disponibilidade = reserva ? await conferirContinuidadeReserva(tx, reserva.id) : null;
  if (!particular && (!reserva || !disponibilidade)) throw new ErroRegra("Reserva não pertence à contratação.");
  if (disponibilidade && !disponibilidade.conferencia.elegivel) throw new ErroRegra(`Regularize o ingresso: ${disponibilidade.conferencia.impedimentos.join(", ")}.`);
  if (reserva && (reserva.turma.modalidadeId !== m.produto.modalidadeId || reserva.turma.nivel.idiomaId !== m.produto.idiomaId)) throw new ErroRegra("A turma não corresponde ao produto contratado.");
  await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${m.alunoId} FOR UPDATE`;
  if (await tx.alocacaoTurma.count({ where: { alunoId: m.alunoId, matriculaId: null, ativa: true } })) throw new ErroRegra("Confira o vínculo legado sem matrícula antes do novo ingresso.");
  if (!particular && await tx.alocacaoTurma.count({ where: { matriculaId: m.id, ativa: true } })) throw new ErroRegra("A matrícula já possui vínculo ativo. Confira sua movimentação antes de ativar.");
  if (await tx.comissao.count({ where: { matriculaId: m.id } })) throw new ErroRegra("Confira a comissão já registrada nesta preparação antes de ativar.");
  const responsavel = z.object({ vendedorResponsavelId: z.string().min(1) }).parse(p.referencias).vendedorResponsavelId;
  const taxa = cobrancas.find(c => c.tipo === "MATRICULA")!;
  // A política é da data da contratação, preservando sua vigência; não usa uma tabela nova por conveniência.
  const comissao = await resolverComissao(tx, { paisId: m.paisId, produtoId: m.produtoId, taxa: taxa.valorNegociado.toNumber(), moeda: m.moeda, agora: m.criadoEm });
  const agora = new Date();
  // A reserva deixa a contagem e o vínculo entra sob o mesmo bloqueio da turma e transação.
  let alocacaoId: string | null = null;
  const encontros: { horarioReservaId: string; encontroId: string }[] = [];
  if (particular) {
    await tx.reservaAgendaParticular.update({ where: { id: particular.snapshot.reservaId }, data: { status: "UTILIZADA" } });
    for (const h of particular.snapshot.horarios) {
      const encontro = await tx.encontroAgenda.create({ data: { matriculaId: m.id, professorId: h.professorId, preparadorId: autorId,
        inicio: new Date(h.inicio), fim: new Date(h.fim), fusoOrigem: particular.snapshot.fusoOrigem, status: "PREVISTO",
        motivo: "Horário contratado convertido na ativação", chaveIdempotencia: `ativacao-particular:${h.id}`,
        entradaHash: hashPrevia({ matriculaId: m.id, reservaId: particular.snapshot.reservaId, horario: h }) } });
      encontros.push({ horarioReservaId: h.id, encontroId: encontro.id });
    }
  } else if (reserva) {
    await tx.reservaVagaMatricula.update({ where: { id: reserva.id }, data: { status: "UTILIZADA" } });
    const alocacao = await tx.alocacaoTurma.create({ data: { matriculaId: m.id, alunoId: m.alunoId, turmaId: reserva.turmaId, criadoEm: agora } });
    alocacaoId = alocacao.id;
  }
  await tx.matricula.update({ where: { id: m.id }, data: { status: "ATIVA", ativadaEm: agora, pagamentoTaxaOk: true,
    primeiraMensalidadeOk: entrada.itens.some(i => i.tipo === "MENSALIDADE" && i.confirmada), ativadaComPendencia: false,
    ...(regra ? { diaVencimento: regra.diaVencimentoContratado, referenciaCobertura: regra.cobertura.referencia,
    dataReferenciaCobertura: regra.cobertura.referencia === "CICLO_MATRICULA" ? new Date(`${regra.cobertura.inicio}T00:00:00Z`) : null } : {}) } });
  const emitida = await emitirEntradaTx(tx, { matriculaId: m.id, condicoesId: condicoes.id, executorId: autorId, etapa: "ATIVACAO" });
  const calculada = await tx.comissao.create({ data: { matriculaId: m.id, vendedorId: responsavel, politicaId: comissao.regra.id, tipo: comissao.regra.tipo,
    percentual: comissao.regra.percentual ?? 0, valorFixo: comissao.regra.valorFixo, valorBase: taxa.valorNegociado, valor: comissao.valor, moeda: m.moeda,
    memoriaCalculo: { ...comissao.memoria, vendedorId: responsavel }, calculadaEm: agora, status: "APROVADA" } });
  await tx.movimentacaoAluno.create({ data: { matriculaId: m.id, alunoId: m.alunoId, tipo: "MATRICULA", turmaDestinoId: reserva?.turmaId ?? null, usuarioId: autorId, motivo: "Ingresso da contratação preparada" } });
  if (m.leadId && m.lead?.etapa !== "MATRICULADO") {
    await tx.lead.update({ where: { id: m.leadId }, data: { etapa: "MATRICULADO" } });
    await registrarEvento(tx, { tipo: "EtapaAlterada", agregadoTipo: "Lead", agregadoId: m.leadId, autorId, payload: { de: m.lead?.etapa ?? null, para: "MATRICULADO" } });
  }
  await registrarEvento(tx, { tipo: "MatriculaAtivada", agregadoTipo: "Matricula", agregadoId: m.id, autorId,
    payload: { preparacaoId: p.id, reservaId: reserva?.id ?? null, reservaParticularId: particular?.snapshot.reservaId ?? null, encontros, alocacaoId, condicoesId: condicoes.id, emissaoAtivacaoId: emitida.id, contratoDocumentoId: documentoId, excecaoAdmissaoId: disponibilidade?.excecaoId ?? null, ativadaEm: agora.toISOString() } });
  await registrarEvento(tx, { tipo: "ComissaoAprovada", agregadoTipo: "Matricula", agregadoId: m.id, autorId, payload: { comissaoId: calculada.id, vendedorId: responsavel, ...comissao.memoria } });
  return { leadId: m.leadId };
}
