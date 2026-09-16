import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararAlteracaoQuantidadeAulasModalidade, decidirAlteracaoQuantidadeAulasModalidade } from "./modalidade-quantidade";
import { carregarPreviaQuantidadeAulasTx } from "./modalidade-quantidade-tx";
import { decidirGradeInicialTurma } from "./grade-decisao";

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

async function turmaComGrade(status: "PLANEJADA" | "ABERTA" | "EM_ANDAMENTO" | "CONCLUIDA" = "ABERTA", publicada = true) {
 const professorId = (await criarUsuario(["PROFESSOR"])).id;
 const turma = await prisma.turma.create({ data: { modalidadeId, nivelId, professorId, status, diasSemana: [1], horarioInicio: "10:00", dataInicio: new Date("2099-01-05T00:00:00Z") } });
 const encontros = ["2099-01-05T10:00:00.000Z", "2099-01-12T10:00:00.000Z"].map((inicio, indice) => ({ inicio, fim: new Date(Date.parse(inicio) + 3600000).toISOString() }));
 const snapshot = { origem: { quantidadeAulas: 2, dataInicial: "2099-01-05", diasSemana: [1], horario: "10:00", duracaoMinutos: 60 }, grade: { dataInicialInformada: "2099-01-05", primeiraAula: encontros[0].inicio, previsaoTermino: encontros[1].fim, encontros } };
 const grade = await prisma.propostaGradeTurma.create({ data: { turmaId: turma.id, calendarioId, preparadorId: secretariaId, versao: 1, fusoOrigem: "UTC", motivo: "Grade de origem aprovada", chaveIdempotencia: `grade-${turma.id}`, entradaHash: "b".repeat(64), snapshot } });
 if (publicada) await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: gerenteId, aprovada: true, motivo: "Grade aprovada para teste" } });
 if (publicada) await prisma.encontroAgenda.createMany({ data: encontros.map((e, indice) => ({ turmaId: turma.id, professorId, propostaGradeId: grade.id, preparadorId: secretariaId, inicio: new Date(e.inicio), fim: new Date(e.fim), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Grade publicada", chaveIdempotencia: `encontro-${turma.id}-${indice}`, entradaHash: "c".repeat(64) })) });
 return { turma, grade };
}

it("aprova aumento publicado e aplica modalidade e encontros no mesmo callback", async () => {
 const { turma } = await turmaComGrade();
 const proposta = await prepararAlteracaoQuantidadeAulasModalidade({ modalidadeId, quantidadeNova: 3, versaoAnterior: 0, motivo: "Aumento regular de meta", chaveIdempotencia: "quantidade-publicada-1" });
 expect(proposta).toMatchObject({ ok: true }); if (!proposta.ok || !proposta.dado) throw new Error("proposta ausente");
 expect((await decidirAlteracaoQuantidadeAulasModalidade({ propostaId: proposta.dado.id, aprovar: true, motivo: "Autoaprovação deve ser recusada" })).ok).toBe(false);
 expect(await prisma.decisaoQuantidadeAulasModalidade.count()).toBe(0);
 authMock.mockResolvedValue({ user: { id: gerenteId } });
 const salva = await prisma.propostaQuantidadeAulasModalidade.findUniqueOrThrow({ where: { id: proposta.dado.id } });
 const atual = await prisma.$transaction((tx) => carregarPreviaQuantidadeAulasTx(tx, { modalidadeId, quantidadeNova: 3 }));
 expect(atual.estadoHash).toBe(salva.estadoHash);
 if (!atual.podeAplicar) throw new Error(JSON.stringify({ recursos: atual.recursos, pendencias: atual.impactos.map((i) => i.pendencias) }));
 const decidida = await decidirAlteracaoQuantidadeAulasModalidade({ propostaId: proposta.dado.id, aprovar: true, motivo: "Aprovação conjunta do aumento" });
 if (!decidida.ok) throw new Error(decidida.erro);
 expect(decidida).toMatchObject({ ok: true, dado: { aprovada: true, aplicada: true } });
 expect(await decidirAlteracaoQuantidadeAulasModalidade({ propostaId: proposta.dado.id, aprovar: true, motivo: "Aprovação conjunta do aumento" })).toEqual(decidida);
 expect((await prisma.modalidade.findUniqueOrThrow({ where: { id: modalidadeId } })).aulasPorNivel).toBe(3);
 expect(await prisma.aplicacaoQuantidadeAulasModalidade.count()).toBe(1);
  expect(await prisma.encontroAgenda.count({ where: { turmaId: turma.id, status: "PREVISTO" } })).toBe(3);
});

it("usa a última grade aprovada, não uma proposta posterior ainda sem decisão, como meta vigente", async () => {
 const { turma, grade } = await turmaComGrade();
 const snapshot = structuredClone(grade.snapshot) as { origem: { quantidadeAulas: number } };
 snapshot.origem.quantidadeAulas = 1;
 await prisma.propostaGradeTurma.create({ data: {
   turmaId: turma.id, calendarioId, preparadorId: secretariaId, versao: 2, fusoOrigem: "UTC",
   motivo: "Rascunho posterior ainda não aprovado", chaveIdempotencia: `grade-pendente-${turma.id}`,
   entradaHash: "d".repeat(64), snapshot,
 } });
 const previa = await prisma.$transaction((tx) => carregarPreviaQuantidadeAulasTx(tx, { modalidadeId, quantidadeNova: 3 }));
 expect(previa.impactos).toEqual([expect.objectContaining({ turmaId: turma.id, quantidadeVigente: 2, quantidadeNova: 3 })]);
});

it("rejeita no constraint trigger a fotografia que duplica A e omite B", async () => {
 const primeira = await turmaComGrade();
 const segunda = await turmaComGrade();
 const snapshotImpacto = (turmaId: string) => ({ turmaId, alcance: "AUMENTO_NAO_INICIADA", quantidadeAnterior: 2, quantidadeNova: 3, publicada: true, excecoesQ37: [], agendaAntes: [], agendaDepois: [] });
 await expect(prisma.$transaction(async (tx) => {
   const proposta = await tx.propostaQuantidadeAulasModalidade.create({ data: {
     modalidadeId, preparadorId: secretariaId, versao: 1, quantidadeAnterior: 2, quantidadeNova: 3,
     motivo: "Fotografia SQL adversarial para conjunto", chaveIdempotencia: "sql-duplicado-omitido", entradaHash: "e".repeat(64), estadoHash: "f".repeat(64),
     snapshot: { impactos: [snapshotImpacto(primeira.turma.id), snapshotImpacto(primeira.turma.id)] },
     impactos: { create: [
       { turmaId: primeira.turma.id, alcance: "AUMENTO_NAO_INICIADA", quantidadeAnterior: 2, quantidadeNova: 3, publicada: true, excecoesQ37: [], snapshot: {} },
       { turmaId: segunda.turma.id, alcance: "AUMENTO_NAO_INICIADA", quantidadeAnterior: 2, quantidadeNova: 3, publicada: true, excecoesQ37: [], snapshot: {} },
     ] },
   } });
   const decisao = await tx.decisaoQuantidadeAulasModalidade.create({ data: { propostaId: proposta.id, decisorId: gerenteId, aprovada: true, motivo: "Decisão SQL adversarial independente", estadoHash: "f".repeat(64) } });
   await tx.propostaQuantidadeAulasModalidade.update({ where: { id: proposta.id }, data: { situacao: "APROVADA" } });
   await tx.modalidade.update({ where: { id: modalidadeId }, data: { aulasPorNivel: 3 } });
   await tx.aplicacaoQuantidadeAulasModalidade.create({ data: { propostaId: proposta.id, aplicadorId: gerenteId, estadoHash: "f".repeat(64) } });
   await tx.propostaQuantidadeAulasModalidade.update({ where: { id: proposta.id }, data: { situacao: "APLICADA" } });
   await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
   void decisao;
 })).rejects.toThrow("bijeção completa de impactos");
 expect(await prisma.aplicacaoQuantidadeAulasModalidade.count()).toBe(0);
 expect((await prisma.modalidade.findUniqueOrThrow({ where: { id: modalidadeId } })).aulasPorNivel).toBe(2);
});

it("aumenta rascunho por nova versão de grade, sem publicar nem duplicar encontros", async () => {
 const { turma } = await turmaComGrade("PLANEJADA", false);
 const proposta = await prepararAlteracaoQuantidadeAulasModalidade({ modalidadeId, quantidadeNova: 3, versaoAnterior: 0, motivo: "Aumento de rascunho regular", chaveIdempotencia: "quantidade-rascunho-1" });
 if (!proposta.ok || !proposta.dado) throw new Error("Proposta de rascunho ausente.");
 authMock.mockResolvedValue({ user: { id: gerenteId } });
 const decidida = await decidirAlteracaoQuantidadeAulasModalidade({ propostaId: proposta.dado.id, aprovar: true, motivo: "Aprovação conjunta do rascunho" });
 expect(decidida).toMatchObject({ ok: true, dado: { aplicada: true } });
 expect(await prisma.encontroAgenda.count({ where: { turmaId: turma.id } })).toBe(0);
 const grades = await prisma.propostaGradeTurma.findMany({ where: { turmaId: turma.id }, orderBy: { versao: "asc" } });
 expect(grades).toHaveLength(2);
 expect(grades[1].snapshot).toMatchObject({ origem: { quantidadeAulas: 3 }, grade: { encontros: expect.arrayContaining([expect.any(Object), expect.any(Object), expect.any(Object)]) } });
 const publicada = await decidirGradeInicialTurma({ propostaId: grades[1].id, aprovar: true, motivo: "Publicação da grade recalculada" });
 if (!publicada.ok) throw new Error(publicada.erro);
 expect(publicada).toMatchObject({ ok: true, dado: { publicada: true } });
 expect(await prisma.encontroAgenda.count({ where: { turmaId: turma.id, status: "PREVISTO" } })).toBe(3);
});

it("redução preserva turmas iniciada e finalizada, mas reduz turma ainda não iniciada", async () => {
 const iniciada = await turmaComGrade("EM_ANDAMENTO");
 const finalizada = await turmaComGrade("CONCLUIDA");
 const futura = await turmaComGrade("ABERTA");
 const passado = new Date("2020-01-06T10:00:00.000Z");
 await prisma.turma.updateMany({ where: { id: { in: [iniciada.turma.id, finalizada.turma.id] } }, data: { dataInicio: passado } });
 await prisma.encontroAgenda.updateMany({ where: { turmaId: { in: [iniciada.turma.id, finalizada.turma.id] } }, data: { inicio: passado, fim: new Date(passado.getTime() + 3_600_000) } });
 const proposta = await prepararAlteracaoQuantidadeAulasModalidade({ modalidadeId, quantidadeNova: 1, versaoAnterior: 0, motivo: "Redução com preservação histórica", chaveIdempotencia: "quantidade-reducao-1" });
 if (!proposta.ok || !proposta.dado) throw new Error("Proposta de redução ausente.");
 const impactos = await prisma.impactoQuantidadeAulasModalidade.findMany({ where: { propostaId: proposta.dado.id }, orderBy: { turmaId: "asc" } });
 expect(impactos.find(i => i.turmaId === iniciada.turma.id)).toMatchObject({ alcance: "REDUCAO_INICIADA_PRESERVADA", quantidadeNova: 2 });
 expect(impactos.find(i => i.turmaId === finalizada.turma.id)).toMatchObject({ alcance: "FINALIZADA_PRESERVADA", quantidadeNova: 2 });
 expect(impactos.find(i => i.turmaId === futura.turma.id)).toMatchObject({ alcance: "REDUCAO_NAO_INICIADA", quantidadeNova: 1 });
 authMock.mockResolvedValue({ user: { id: gerenteId } });
 expect((await decidirAlteracaoQuantidadeAulasModalidade({ propostaId: proposta.dado.id, aprovar: true, motivo: "Aprovação independente da redução" })).ok).toBe(true);
 expect(await prisma.encontroAgenda.count({ where: { turmaId: iniciada.turma.id } })).toBe(2);
 expect(await prisma.encontroAgenda.count({ where: { turmaId: finalizada.turma.id } })).toBe(2);
 expect(await prisma.encontroAgenda.count({ where: { turmaId: futura.turma.id, status: "PREVISTO" } })).toBe(1);
});

it("permite atualizar a meta sem turmas e invalida proposta antiga após outra revisão", async () => {
 const primeira = await prepararAlteracaoQuantidadeAulasModalidade({ modalidadeId, quantidadeNova: 3, versaoAnterior: 0, motivo: "Meta futura sem turma existente", chaveIdempotencia: "quantidade-sem-turma-1" });
 if (!primeira.ok || !primeira.dado) throw new Error("Primeira proposta ausente.");
 authMock.mockResolvedValue({ user: { id: gerenteId } });
 expect(await decidirAlteracaoQuantidadeAulasModalidade({ propostaId: primeira.dado.id, aprovar: true, motivo: "Aplicação de meta sem turma" })).toMatchObject({ ok: true, dado: { aplicada: true } });
 expect((await prisma.modalidade.findUniqueOrThrow({ where: { id: modalidadeId } })).aulasPorNivel).toBe(3);
 expect(await prisma.impactoQuantidadeAulasModalidade.count()).toBe(0);
 authMock.mockResolvedValue({ user: { id: secretariaId } });
 const antiga = await prepararAlteracaoQuantidadeAulasModalidade({ modalidadeId, quantidadeNova: 4, versaoAnterior: 1, motivo: "Proposta que ficará obsoleta", chaveIdempotencia: "quantidade-obsoleta-1" });
 const atual = await prepararAlteracaoQuantidadeAulasModalidade({ modalidadeId, quantidadeNova: 5, versaoAnterior: 2, motivo: "Revisão posterior da meta futura", chaveIdempotencia: "quantidade-atual-1" });
 if (!antiga.ok || !antiga.dado || !atual.ok || !atual.dado) throw new Error("Propostas para replay ausentes.");
 authMock.mockResolvedValue({ user: { id: gerenteId } });
 expect((await decidirAlteracaoQuantidadeAulasModalidade({ propostaId: antiga.dado.id, aprovar: true, motivo: "Tentativa de aprovar versão superada" })).ok).toBe(false);
 expect(await prisma.decisaoQuantidadeAulasModalidade.count({ where: { propostaId: antiga.dado.id } })).toBe(0);
 expect(await decidirAlteracaoQuantidadeAulasModalidade({ propostaId: atual.dado.id, aprovar: true, motivo: "Aprovação da versão vigente" })).toMatchObject({ ok: true, dado: { aplicada: true } });
 expect((await prisma.modalidade.findUniqueOrThrow({ where: { id: modalidadeId } })).aulasPorNivel).toBe(5);
});

it("não persiste decisão nem meta quando um conflito bloqueia o conjunto", async () => {
 const { turma } = await turmaComGrade();
 const ocupado = await turmaComGrade();
 const encontro = await prisma.encontroAgenda.findFirstOrThrow({ where: { turmaId: ocupado.turma.id }, orderBy: { inicio: "asc" } });
 await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { inicio: new Date("2099-01-19T10:00:00.000Z"), fim: new Date("2099-01-19T11:00:00.000Z"), professorId: turma.professorId } });
 const proposta = await prepararAlteracaoQuantidadeAulasModalidade({ modalidadeId, quantidadeNova: 3, versaoAnterior: 0, motivo: "Aumento que encontra conflito", chaveIdempotencia: "quantidade-conflito-1" });
 if (!proposta.ok || !proposta.dado) throw new Error("Proposta com conflito ausente.");
 authMock.mockResolvedValue({ user: { id: gerenteId } });
 expect((await decidirAlteracaoQuantidadeAulasModalidade({ propostaId: proposta.dado.id, aprovar: true, motivo: "Não aprovar conjunto conflituoso" })).ok).toBe(false);
 expect(await prisma.decisaoQuantidadeAulasModalidade.count()).toBe(0);
 expect(await prisma.aplicacaoQuantidadeAulasModalidade.count()).toBe(0);
 expect((await prisma.modalidade.findUniqueOrThrow({ where: { id: modalidadeId } })).aulasPorNivel).toBe(2);
});
