import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroPermissao, ErroRegra } from "@/server/_shared";
import { disponibilidadeRecuperacaoTx } from "@/server/avaliacoes/disponibilidade-recuperacao-tx";
import { PeriodosCalendarioSchema } from "@/server/agenda/calendario-schema";
import { conferirDiasNaoLetivos } from "@/server/agenda/calendario-intervalo";
import { dataCivilInstitucional } from "@/server/operacao/fuso";

export const textoAgendaReposicao = z.string().trim().min(5).max(2000);
export const hashAgendaReposicao = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");
export const instanteUtcAgendaReposicao = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;
export const dataSql = (valor: string) => Prisma.sql`${valor}::date`;

export type RegraBeneficio = {
  id: string; referencia: "CIVIL" | "CICLO_MATRICULA"; unidade: "DIAS" | "MESES"; duracaoPeriodo: number;
  quantidadePorPeriodo: number; antecedenciaCancelamentoMinutos: number; referenciaCiclo: Date | null; vigenteAPartirDe: Date;
};

type ReposicaoAgenda = { id: string; matriculaId: string; aulaOriginalId: string; modalidade: "PARTICULAR" | "GRAVACAO"; alunoId: string; status: string };

function civilDate(data: Date) { return data.toISOString().slice(0, 10); }
function adicionarMeses(data: string, meses: number) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const bruto = ano * 12 + mes - 1 + meses, novoAno = Math.floor(bruto / 12), novoMes = bruto % 12 + 1;
  const ultimo = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate();
  return `${String(novoAno).padStart(4, "0")}-${String(novoMes).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}
function adicionarDias(data: string, dias: number) {
  const valor = new Date(`${data}T00:00:00.000Z`); valor.setUTCDate(valor.getUTCDate() + dias); return civilDate(valor);
}

/** Q49: o intervalo é calculado da regra persistida; não existe duração padrão. */
export function periodoBeneficioReposicao(regra: RegraBeneficio, dataAgendada: string) {
  const data = new Date(`${dataAgendada}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgendada) || !Number.isFinite(data.getTime()) || civilDate(data) !== dataAgendada
    || !Number.isSafeInteger(regra.duracaoPeriodo) || regra.duracaoPeriodo <= 0) {
    throw new ErroRegra("Data e duração do período precisam ser válidas.");
  }
  const referencia = regra.referencia === "CICLO_MATRICULA" ? regra.referenciaCiclo && civilDate(regra.referenciaCiclo) : "2000-01-01";
  const vigente = civilDate(regra.vigenteAPartirDe);
  if (!referencia || dataAgendada < referencia) throw new ErroRegra("A data está antes do ciclo configurado do benefício.");
  if (regra.unidade === "DIAS") {
    const dias = Math.floor((Date.parse(`${dataAgendada}T00:00:00Z`) - Date.parse(`${referencia}T00:00:00Z`)) / 86400000);
    const inicio = adicionarDias(referencia, Math.floor(dias / regra.duracaoPeriodo) * regra.duracaoPeriodo);
    return { inicio: inicio < vigente ? vigente : inicio, fimExclusivo: adicionarDias(inicio, regra.duracaoPeriodo) };
  }
  const [a, m] = dataAgendada.split("-").map(Number), [ar, mr] = referencia.split("-").map(Number);
  let bloco = Math.floor(((a - ar) * 12 + m - mr) / regra.duracaoPeriodo);
  let inicio = adicionarMeses(referencia, bloco * regra.duracaoPeriodo);
  if (inicio > dataAgendada) inicio = adicionarMeses(referencia, --bloco * regra.duracaoPeriodo);
  // Cada fronteira deriva da mesma referência. Fevereiro pode encurtar um
  // encontro de ciclo no dia 31, mas não deve deslocar março para o dia 28.
  return { inicio: inicio < vigente ? vigente : inicio, fimExclusivo: adicionarMeses(referencia, (bloco + 1) * regra.duracaoPeriodo) };
}

/** A primeira regra vale no período civil/cíclico atual. Uma regra posterior
 * só começa em limite próprio que não recorta o período já reservado. */
export function vigenciaNovoBeneficioReposicao(anterior: RegraBeneficio | null, novaRegra: RegraBeneficio, hoje: string) {
  if (!anterior) return periodoBeneficioReposicao({ ...novaRegra, vigenteAPartirDe: new Date("0001-01-01T00:00:00.000Z") }, hoje).inicio;
  const fimAnterior = periodoBeneficioReposicao(anterior, hoje).fimExclusivo;
  return fimAnterior;
}

export async function reposicaoAgendaTx(tx: Prisma.TransactionClient, reposicaoId: string) {
  const [r] = await tx.$queryRaw<ReposicaoAgenda[]>(Prisma.sql`
    SELECT r.id, r."matriculaId" AS "matriculaId", r."aulaOriginalId" AS "aulaOriginalId", r.modalidade::text AS modalidade,
      m."alunoId" AS "alunoId", m.status::text AS status
    FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id=r."matriculaId" WHERE r.id=${reposicaoId} FOR UPDATE
  `);
  if (!r) throw new ErroRegra("Reposição não encontrada.");
  return r;
}

async function conferirOrigemAtiva(tx: Prisma.TransactionClient, r: ReposicaoAgenda) {
  const [origem] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT e.id FROM "EncontroAgenda" e JOIN "AulaDiario" d ON d."encontroId"=e.id
      JOIN "RegistroAulaAluno" registro ON registro."aulaId"=d.id AND registro."matriculaId"=${r.matriculaId} AND registro."alunoId"=${r.alunoId}
    WHERE e.id=${r.aulaOriginalId} AND e.finalidade='AULA'::"FinalidadeEncontroAgenda" AND e."turmaId" IS NOT NULL
      AND e.status='MINISTRADO'::"StatusEncontroAgenda" AND e.fim <= NOW()
      AND participacao_aula_efetiva(registro.id) IN ('FALTA'::"ParticipacaoAula", 'IMPEDIDO_POR_RESTRICAO'::"ParticipacaoAula")
    FOR SHARE
  `);
  if (!origem || r.status !== "ATIVA") throw new ErroRegra("A matrícula ou a falta original não permite agendamento.");
  const [decisao] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId"=${r.id} AND aprovada FOR SHARE`);
  if (!decisao) throw new ErroRegra("A particular exige pedido autorizado pela gestão.");
}

export async function carregarRegraBeneficioTx(tx: Prisma.TransactionClient, matriculaId: string, dataAgendada: string) {
  const [regra] = await tx.$queryRaw<RegraBeneficio[]>(Prisma.sql`
    SELECT id, referencia::text AS referencia, unidade::text AS unidade, "duracaoPeriodo" AS "duracaoPeriodo",
      "quantidadePorPeriodo" AS "quantidadePorPeriodo", "antecedenciaCancelamentoMinutos" AS "antecedenciaCancelamentoMinutos",
      "referenciaCiclo" AS "referenciaCiclo", "vigenteAPartirDe" AS "vigenteAPartirDe"
    FROM "BeneficioReposicaoParticularMatricula" WHERE "matriculaId"=${matriculaId} AND "vigenteAPartirDe" <= ${dataSql(dataAgendada)}
    ORDER BY "vigenteAPartirDe" DESC LIMIT 1 FOR SHARE
  `);
  if (!regra || regra.quantidadePorPeriodo <= 0) throw new ErroRegra("Não há benefício particular explícito e vigente para esta matrícula.");
  return regra;
}

/** Contagem compartilhada por criação e remarcação. A agenda em alteração não
 * ocupa uma vaga contra si mesma; agendas de snapshots antigos no intervalo
 * continuam contando para não reabrir saldo na transição Q50. */
export async function contarReservasBeneficioReposicaoTx(tx: Prisma.TransactionClient, input: {
  matriculaId: string; inicio: string; fimExclusivo: string; ignorarAgendaId?: string;
}) {
  const [linha] = await tx.$queryRaw<{ quantidade: bigint }[]>(Prisma.sql`
    SELECT count(*)::bigint AS quantidade
    FROM "AgendaReposicaoIndividual" a
    JOIN "ReposicaoIndividual" r ON r.id=a."reposicaoId"
    JOIN "EncontroAgenda" e ON e.id=a."encontroId"
    JOIN "ConfiguracaoOperacional" c ON c.id='escola'
    WHERE r."matriculaId"=${input.matriculaId}
      AND a."statusBeneficio" IN ('RESERVADA'::"StatusReservaBeneficioReposicao",'CONSUMIDA'::"StatusReservaBeneficioReposicao")
      AND (${input.ignorarAgendaId ?? null}::text IS NULL OR a.id <> ${input.ignorarAgendaId ?? null})
      AND ((e.inicio AT TIME ZONE 'UTC') AT TIME ZONE c."fusoInstitucional")::date >= ${dataSql(input.inicio)}
      AND ((e.inicio AT TIME ZONE 'UTC') AT TIME ZONE c."fusoInstitucional")::date < ${dataSql(input.fimExclusivo)}
  `);
  return Number(linha?.quantidade ?? 0);
}

/** Conferência usada tanto na prévia quanto no comando. O chamador mantém os locks. */
export async function conferirAgendaReposicaoIndividualTx(tx: Prisma.TransactionClient, input: {
  reposicaoId: string; professorId: string; inicio: Date; fim: Date; fuso: string;
  permitirSemBeneficio?: boolean; ignorarAgendaId?: string;
}) {
  const r = await reposicaoAgendaTx(tx, input.reposicaoId);
  if (r.modalidade !== "PARTICULAR") throw new ErroRegra("Somente reposição particular recebe agenda presencial.");
  if (!Number.isFinite(input.inicio.getTime()) || !Number.isFinite(input.fim.getTime()) || input.inicio <= new Date() || input.fim <= input.inicio) throw new ErroRegra("Informe um intervalo futuro válido.");
  await conferirOrigemAtiva(tx, r);
  const professor = await tx.usuario.findUnique({ where: { id: input.professorId }, select: { id: true, nome: true, ativo: true, papeis: true } });
  if (!professor?.ativo || !professor.papeis.includes("PROFESSOR")) throw new ErroRegra("Professor não está ativo para a reposição.");
  const calendario = await tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
  const operacao = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  if (!calendario || !operacao || calendario.fusoInstitucional !== operacao.fusoInstitucional) throw new ErroRegra("Calendário aprovado e fuso institucional são necessários para agendar.");
  const dataAgendada = dataCivilInstitucional(input.inicio, calendario.fusoInstitucional);
  let regra: RegraBeneficio | null = null;
  try { regra = await carregarRegraBeneficioTx(tx, r.matriculaId, dataAgendada); }
  catch (erro) { if (!input.permitirSemBeneficio || !(erro instanceof ErroRegra)) throw erro; }
  const periodo = regra ? periodoBeneficioReposicao(regra, dataAgendada) : null;
  const periodos = PeriodosCalendarioSchema.parse(calendario.periodos).map(({ id, inicio, fim }) => ({ id, inicio, fim }));
  const diasNaoLetivos = conferirDiasNaoLetivos({ inicio: input.inicio.toISOString(), fim: input.fim.toISOString(), fusoEscola: calendario.fusoInstitucional, periodos }).periodosAfetados;
  const disponibilidade = await disponibilidadeRecuperacaoTx(tx, { alunoId: r.alunoId, professorId: input.professorId, inicio: input.inicio, fim: input.fim });
  const ocupadas = periodo ? await contarReservasBeneficioReposicaoTx(tx, {
    matriculaId: r.matriculaId, inicio: periodo.inicio, fimExclusivo: periodo.fimExclusivo,
    ignorarAgendaId: input.ignorarAgendaId,
  }) : 0;
  const [agendada] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "AgendaReposicaoIndividual" WHERE "reposicaoId"=${r.id} FOR SHARE`);
  return { reposicao: r, professor: { id: professor.id, nome: professor.nome }, calendarioId: calendario.id, fusoInstitucional: calendario.fusoInstitucional,
    dataAgendada, regra, periodo, diasNaoLetivos, disponibilidade, saldo: regra ? regra.quantidadePorPeriodo - ocupadas : null, jaAgendada: !!agendada };
}

export async function exigirAtorAgendaAtual(tx: Prisma.TransactionClient, id: string, papeis: string[]) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${id} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id }, select: { id: true, ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => papeis.includes(p))) throw new ErroPermissao("A autorização do usuário mudou.");
  return u;
}
