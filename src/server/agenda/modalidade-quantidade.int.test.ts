import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararAlteracaoQuantidadeAulasModalidade, decidirAlteracaoQuantidadeAulasModalidade } from "./modalidade-quantidade";
import { carregarPreviaQuantidadeAulasTx } from "./modalidade-quantidade-tx";

let secretariaId: string, gerenteId: string, modalidadeId: string, nivelId: string, calendarioId: string;
beforeEach(async () => {
 await truncarBanco(); const c = await seedCatalogoMinimo(); modalidadeId = c.modalidade.id;
 await prisma.modalidade.update({ where: { id: modalidadeId }, data: { aulasPorNivel: 2, horasAula: 1, frequencia: "1x/semana" } });
 nivelId = (await prisma.nivel.create({ data: { idiomaId: c.idioma.id, codigo: "A1", ordem: 1 } })).id;
 const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]); secretariaId = secretaria.id;
 gerenteId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
 await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
 const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: secretariaId, fusoInstitucional: "UTC", periodos: [], motivo: "Calendário para revisão de quantidade", chaveIdempotencia: "calendario-quantidade", entradaHash: "a".repeat(64) } }); calendarioId = calendario.id;
 await prisma.decisaoCalendarioEscolar.create({ data: { calendarioId, decisorId: gerenteId, aprovada: true, motivo: "Calendário aprovado para a grade" } });
 authMock.mockResolvedValue({ user: { id: secretariaId } });
});

async function turmaComGrade(status: "PLANEJADA" | "ABERTA" | "EM_ANDAMENTO" | "CONCLUIDA" = "ABERTA") {
 const professorId = (await criarUsuario(["PROFESSOR"])).id;
 const turma = await prisma.turma.create({ data: { modalidadeId, nivelId, professorId, status, diasSemana: [1], horarioInicio: "10:00", dataInicio: new Date("2099-01-05T00:00:00Z") } });
 const encontros = ["2099-01-05T10:00:00.000Z", "2099-01-12T10:00:00.000Z"].map((inicio, indice) => ({ inicio, fim: new Date(Date.parse(inicio) + 3600000).toISOString() }));
 const snapshot = { origem: { quantidadeAulas: 2, dataInicial: "2099-01-05", diasSemana: [1], horario: "10:00", duracaoMinutos: 60 }, grade: { dataInicialInformada: "2099-01-05", primeiraAula: encontros[0].inicio, previsaoTermino: encontros[1].fim, encontros } };
 const grade = await prisma.propostaGradeTurma.create({ data: { turmaId: turma.id, calendarioId, preparadorId: secretariaId, versao: 1, fusoOrigem: "UTC", motivo: "Grade de origem aprovada", chaveIdempotencia: `grade-${turma.id}`, entradaHash: "b".repeat(64), snapshot } });
 await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: gerenteId, aprovada: true, motivo: "Grade aprovada para teste" } });
 await prisma.encontroAgenda.createMany({ data: encontros.map((e, indice) => ({ turmaId: turma.id, professorId, propostaGradeId: grade.id, preparadorId: secretariaId, inicio: new Date(e.inicio), fim: new Date(e.fim), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Grade publicada", chaveIdempotencia: `encontro-${turma.id}-${indice}`, entradaHash: "c".repeat(64) })) });
 return { turma, grade };
}

it("aprova aumento publicado e aplica modalidade e encontros no mesmo callback", async () => {
 const { turma } = await turmaComGrade();
 const proposta = await prepararAlteracaoQuantidadeAulasModalidade({ modalidadeId, quantidadeNova: 3, versaoAnterior: 0, motivo: "Aumento regular de meta", chaveIdempotencia: "quantidade-publicada-1" });
 expect(proposta).toMatchObject({ ok: true }); if (!proposta.ok || !proposta.dado) throw new Error("proposta ausente");
 authMock.mockResolvedValue({ user: { id: gerenteId } });
 const salva = await prisma.propostaQuantidadeAulasModalidade.findUniqueOrThrow({ where: { id: proposta.dado.id } });
 const atual = await prisma.$transaction((tx) => carregarPreviaQuantidadeAulasTx(tx, { modalidadeId, quantidadeNova: 3 }));
 expect(atual.estadoHash).toBe(salva.estadoHash);
 if (!atual.podeAplicar) throw new Error(JSON.stringify({ recursos: atual.recursos, pendencias: atual.impactos.map((i) => i.pendencias) }));
 const decidida = await decidirAlteracaoQuantidadeAulasModalidade({ propostaId: proposta.dado.id, aprovar: true, motivo: "Aprovação conjunta do aumento" });
 if (!decidida.ok) throw new Error(decidida.erro);
 expect(decidida).toMatchObject({ ok: true, dado: { aprovada: true, aplicada: true } });
 expect((await prisma.modalidade.findUniqueOrThrow({ where: { id: modalidadeId } })).aulasPorNivel).toBe(3);
 expect(await prisma.aplicacaoQuantidadeAulasModalidade.count()).toBe(1);
 expect(await prisma.encontroAgenda.count({ where: { turmaId: turma.id, status: "PREVISTO" } })).toBe(3);
});
