import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { conferirTurmaParaReserva } from "./reserva-disponibilidade";

/** Chamador mantém calendário e matrícula bloqueados durante decisões/execuções. */
export async function carregarContinuidadeReserva(tx: Prisma.TransactionClient, reservaId: string) {
  const r = await tx.reservaVagaMatricula.findUnique({ where: { id: reservaId }, include: { turma: true, janela: true,
    matricula: { select: { status: true, codigo: true, aluno: { select: { id: true, primeiroNome: true, sobrenome: true } }, preparacaoComercial: { select: { id: true } }, condicoesEntradaPreparacao: { orderBy: { versao: "desc" }, take: 1, select: { id: true } } } } } });
  if (!r || !["ATIVA", "MANTIDA_PENDENCIA"].includes(r.status) || (r.status === "ATIVA" && r.expiraEm <= new Date())) throw new ErroRegra("Regularize a reserva antes de conferir o ingresso.");
  if (!["RASCUNHO", "AGUARDANDO"].includes(r.matricula.status)) throw new ErroRegra("A exceção exige matrícula ainda em preparação.");
  await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${r.turmaId} FOR UPDATE`;
  const atual = await conferirTurmaParaReserva(tx, r.turma, r.id);
  const dentroDaJanelaOriginal = dataCivilInstitucional(r.criadaEm, r.janela.fusoAdmissao) <= r.janela.limiteEntrada.toISOString().slice(0, 10);
  const encontros = await tx.encontroAgenda.findMany({ where: { turmaId: r.turmaId, status: "PREVISTO", inicio: { gt: atual.agora } }, orderBy: { id: "asc" },
    select: { id: true, inicio: true, fim: true, professorId: true, propostaGradeId: true } });
  const snapshot = JSON.parse(JSON.stringify({ reservaId: r.id, matriculaId: r.matriculaId, turmaId: r.turmaId, statusReserva: r.status, expiraEm: r.expiraEm,
    identificacao: { alunoId: r.matricula.aluno.id, aluno: [r.matricula.aluno.primeiroNome, r.matricula.aluno.sobrenome].filter(Boolean).join(" "), matricula: r.matricula.codigo, turma: r.turma.codigo ?? r.turma.nome },
    janelaOriginalId: r.janelaId, criadaEm: r.criadaEm, janelaAtual: atual.janela, preparacaoId: r.matricula.preparacaoComercial?.id ?? null,
    condicoesId: r.matricula.condicoesEntradaPreparacao[0]?.id ?? null, encontros })) as Prisma.InputJsonObject;
  return { reserva: r, atual, dentroDaJanelaOriginal, snapshot, estadoHash: hashPrevia(snapshot) };
}

export function exigirCasoExcecao(d: Awaited<ReturnType<typeof carregarContinuidadeReserva>>) {
  if (!d.dentroDaJanelaOriginal) throw new ErroRegra("A reserva precisa ter sido criada dentro da janela então aprovada.");
  if (!d.atual.conferencia.impedimentos.includes("JANELA_ENCERRADA")) throw new ErroRegra("A admissão não exige exceção de prazo neste momento.");
  const demais = d.atual.conferencia.impedimentos.filter((p) => p !== "JANELA_ENCERRADA");
  if (demais.length) throw new ErroRegra(`A exceção de prazo não dispensa os demais requisitos: ${demais.join(", ")}.`);
}

/** Q110 só remove o impedimento de prazo da reserva identificada. Nunca libera nova reserva. */
export async function conferirContinuidadeReserva(tx: Prisma.TransactionClient, reservaId: string) {
  const d = await carregarContinuidadeReserva(tx, reservaId);
  if (!d.atual.conferencia.impedimentos.includes("JANELA_ENCERRADA")) return { ...d.atual, excecaoId: null };
  if (!d.dentroDaJanelaOriginal) return { ...d.atual, excecaoId: null };
  const aprovada = await tx.propostaExcecaoAdmissao.findFirst({ where: { reservaId, estadoHash: d.estadoHash, decisao: { aprovada: true } }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], select: { id: true } });
  if (!aprovada) return { ...d.atual, excecaoId: null };
  const impedimentos = d.atual.conferencia.impedimentos.filter((p) => p !== "JANELA_ENCERRADA");
  return { ...d.atual, excecaoId: aprovada.id, conferencia: { ...d.atual.conferencia, impedimentos, elegivel: !impedimentos.length } };
}
