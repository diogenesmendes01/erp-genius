import { instanteDaGrade } from "@/server/agenda/grade";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { planejarCobrancasEntrada } from "./plano-cobrancas-entrada";
import { exigirPrecoPreparacaoAutorizado } from "./preco-autorizado";
import { conferirContinuidadeReserva } from "./excecao-admissao-estado";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { carregarAgendaParticularContratual } from "@/server/contratos/agenda-particular";

/** Primitiva interna, não Server Action. Chamador deve conferir cadastro/documentos e
 * autorização da etapa na mesma transação; este executor não os aprova implicitamente. */
export async function emitirEntradaTx(tx: Prisma.TransactionClient, input: { matriculaId: string; condicoesId: string; executorId: string; etapa: "CONFERENCIA_SECRETARIA" | "ATIVACAO" }) {
  const d = z.object({ matriculaId: z.string().min(1), condicoesId: z.string().min(1), executorId: z.string().min(1), etapa: z.enum(["CONFERENCIA_SECRETARIA", "ATIVACAO"]) }).strict().parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [d.matriculaId]);
  const autor = await tx.usuario.findUnique({ where: { id: d.executorId }, select: { ativo: true, papeis: true } });
  if (!autor?.ativo || !autor.papeis.some((p) => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR || (d.etapa === "ATIVACAO" && p === Papel.FINANCEIRO))) throw new ErroPermissao();
  const anterior = await tx.emissaoCobrancasEntrada.findUnique({ where: { matriculaId_etapa: { matriculaId: d.matriculaId, etapa: d.etapa } } });
  if (anterior) {
    if (anterior.condicoesId !== d.condicoesId) throw new ErroRegra("A etapa já foi emitida com outras condições.");
    return { id: anterior.id };
  }
  const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, include: {
    preparacaoComercial: true, condicoesEntradaPreparacao: { orderBy: { versao: "desc" }, take: 1 },
    pagadoresPreparacao: { orderBy: { versao: "desc" }, take: 1 }, emissoesEntrada: true,
    reservasVaga: { where: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, include: { turma: true } }, cobrancas: { select: { id: true } },
  } });
  if (!m?.secretariaAssumiuEm || !m.preparacaoComercial || m.condicoesEntradaPreparacao[0]?.id !== d.condicoesId) throw new ErroRegra("Confira a preparação e a versão atual das condições.");
  if (d.etapa === "CONFERENCIA_SECRETARIA" ? !["RASCUNHO", "AGUARDANDO"].includes(m.status) : m.status !== "ATIVA") throw new ErroRegra("Estado incompatível com a etapa de emissão.");
  if (d.etapa === "ATIVACAO" && !m.emissoesEntrada.some((e) => e.etapa === "CONFERENCIA_SECRETARIA" && e.condicoesId === d.condicoesId)) throw new ErroRegra("A emissão da conferência precisa estar concluída.");
  const idsEmitidos = m.emissoesEntrada.flatMap((e) => z.object({ cobrancas: z.array(z.object({ id: z.string() })) }).parse(e.memoria).cobrancas.map((c) => c.id));
  if (m.cobrancas.some((c) => !idsEmitidos.includes(c.id))) throw new ErroRegra("Existem cobranças fora deste fluxo. Concilie antes de emitir.");
  const condicoes = m.condicoesEntradaPreparacao[0];
  const referencias = z.object({ preparacaoId: z.string(), pagadorRegistroId: z.string() }).parse(condicoes.dados);
  if (referencias.preparacaoId !== m.preparacaoComercial.id || referencias.pagadorRegistroId !== m.pagadoresPreparacao[0]?.id) throw new ErroRegra("Proposta ou pagador mudou. Confira novamente as condições.");
  await exigirPrecoPreparacaoAutorizado(tx, m.id);
  const reserva = m.reservasVaga[0];
  let excecaoAdmissaoId: string | null = null;
  let agendaParticular: Awaited<ReturnType<typeof carregarAgendaParticularContratual>>["snapshot"] | null = null;
  if (d.etapa === "CONFERENCIA_SECRETARIA") {
    if (m.preparacaoComercial.reservaParticularId) {
      agendaParticular = (await carregarAgendaParticularContratual(tx, m.id, m.preparacaoComercial.reservaParticularId)).snapshot;
    } else {
    if (!reserva || reserva.status !== "ATIVA" || reserva.expiraEm <= new Date()) throw new ErroRegra("Regularize a reserva antes da emissão.");
    await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${reserva.turmaId} FOR UPDATE`;
    const continuidade = await conferirContinuidadeReserva(tx, reserva.id);
    if (!continuidade.conferencia.elegivel) throw new ErroRegra("A disponibilidade da turma mudou. Confira a reserva, a agenda e eventual exceção de prazo.");
    excecaoAdmissaoId = continuidade.excecaoId;
    }
  }
  const plano = planejarCobrancasEntrada(condicoes.dados).filter((c) => c.etapa === d.etapa);
  const precos = z.object({ precos: z.array(z.object({ tipoCobranca: z.string(), moeda: z.string(), valor: z.string() })) }).parse(m.preparacaoComercial.referencias).precos;
  const fuso = await carregarFusoInstitucionalTx(tx);
  if (!fuso) throw new ErroRegra("Configure o fuso institucional antes de emitir.");
  const hoje = dataCivilInstitucional(new Date(), fuso), cobrancas = [];
  for (const item of plano) {
    const refs = precos.filter((p) => p.tipoCobranca === item.tipo && p.moeda === item.moeda);
    let original = refs.length === 1 ? new Prisma.Decimal(refs[0].valor) : new Prisma.Decimal(item.valor);
    if (refs.length === 1 && item.minutos) original = original.mul(item.minutos).div(60).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const c = await tx.cobranca.create({ data: { matriculaId: m.id, tipo: item.tipo, moeda: item.moeda, valorOriginal: original, valorNegociado: item.valor, saldo: item.valor,
      vencimento: instanteDaGrade(item.vencimento, "12:00", fuso), competencia: item.tipo === "MENSALIDADE" ? item.vencimento.slice(0, 7) : null,
      coberturaInicio: item.cobertura ? new Date(`${item.cobertura.inicio}T00:00:00Z`) : null, coberturaFim: item.cobertura ? new Date(`${item.cobertura.fim}T00:00:00Z`) : null,
      status: item.vencimento < hoje ? "ATRASADO" : "PENDENTE" } });
    cobrancas.push({ ...item, id: c.id, valorOriginal: original.toString() });
  }
  const emissao = await tx.emissaoCobrancasEntrada.create({ data: { matriculaId: m.id, condicoesId: condicoes.id, executorId: d.executorId, etapa: d.etapa, memoria: { cobrancas, fusoInstitucional: fuso, pagadorRegistroId: referencias.pagadorRegistroId, excecaoAdmissaoId, ...(agendaParticular ? { agendaParticular } : {}) } } });
  await tx.itemEmissaoEntrada.createMany({ data: cobrancas.map((c) => ({ matriculaId: m.id, emissaoId: emissao.id, cobrancaId: c.id })) });
  await registrarEvento(tx, { tipo: "CobrancasEntradaEmitidas", agregadoTipo: "Matricula", agregadoId: m.id, autorId: d.executorId, payload: { emissaoId: emissao.id, etapa: d.etapa, condicoesId: d.condicoesId, cobrancaIds: cobrancas.map((c) => c.id) } });
  return { id: emissao.id };
}
