import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { instanteDaGrade } from "@/server/agenda/grade";
import { prepararContratacao } from "./preparacao-comercial";
import { registrarPagadorPreparacao } from "@/server/secretaria/pagador-preparacao";
import { registrarCondicoesEntrada } from "@/server/secretaria/condicoes-entrada";
import { conferirEEmitirEntrada, consultarRevisaoEmissao } from "@/server/secretaria/conferencia-emissao";
import { consultarEncontrosDocente } from "@/server/agenda/encontros-docente";

describe("CT-06: cobertura, vencimento e agenda preservam seus fusos próprios", () => {
  let secretariaId: string, professorId: string, alunoId: string, produtoId: string, paisId: string, turmaId: string, encontroId: string;

  beforeEach(async () => {
    await truncarBanco();
    await prisma.configuracaoOperacional.create({ data: { prazoReservaMinutos: 60, exigirPrimeiraMensalidade: true, fusoInstitucional: "America/Costa_Rica" } });
    const catalogo = await seedCatalogoMinimo();
    await prisma.produtoPais.update({ where: { produtoId_paisId: { produtoId: catalogo.produto.id, paisId: catalogo.pais.id } }, data: { formaAgenda: "TURMA", taxaPreviaAssinatura: false, adiantamentoHoraExigido: false } });
    const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria CT-06");
    const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão CT-06");
    const professor = await criarUsuario([Papel.PROFESSOR], "Docente CT-06");
    secretariaId = secretaria.id; professorId = professor.id;
    authMock.mockResolvedValue({ user: { id: secretariaId } });

    const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "CT06", ordem: 1 } });
    const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professorId, capacidade: 2 } });
    turmaId = turma.id;
    await prisma.janelaAdmissaoTurma.create({ data: { turmaId, preparadorId: secretariaId, versao: 1, limiteEntrada: new Date("2100-01-01T00:00:00Z"), fusoAdmissao: "America/Costa_Rica", motivo: "Janela futura para CT-06", chaveIdempotencia: "ct06-janela", entradaHash: "ct06" } }).then((janela) =>
      prisma.decisaoJanelaAdmissao.create({ data: { propostaId: janela.id, decisorId: gestor.id, aprovada: true, motivo: "Janela aprovada para CT-06" } }));
    const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: secretariaId, fusoInstitucional: "America/Costa_Rica", periodos: [], motivo: "Calendário CT-06", chaveIdempotencia: "ct06-calendario", entradaHash: "ct06" } });
    await prisma.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId: gestor.id, aprovada: true, motivo: "Calendário aprovado para CT-06" } });
    const grade = await prisma.propostaGradeTurma.create({ data: { turmaId, calendarioId: calendario.id, preparadorId: secretariaId, versao: 1, fusoOrigem: "America/Sao_Paulo", motivo: "Grade CT-06", chaveIdempotencia: "ct06-grade", entradaHash: "ct06", snapshot: {} } });
    await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: gestor.id, aprovada: true, motivo: "Grade aprovada para CT-06" } });
    const inicio = instanteDaGrade("2099-01-31", "23:30", "America/Sao_Paulo");
    const encontro = await prisma.encontroAgenda.create({ data: { turmaId, propostaGradeId: grade.id, professorId, preparadorId: secretariaId, inicio, fim: new Date(inicio.getTime() + 60 * 60_000), fusoOrigem: "America/Sao_Paulo", status: "PREVISTO", motivo: "Aula CT-06 que cruza meia-noite", chaveIdempotencia: "ct06-encontro", entradaHash: "ct06" } });
    encontroId = encontro.id;

    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna", sobrenome: "CT-06", paisId: catalogo.pais.id, telefoneE164: "+50689990001" } });
    alunoId = aluno.id; produtoId = catalogo.produto.id; paisId = catalogo.pais.id;
  });

  it("emite uma vez a cobertura curta do ciclo, sem alterar a aula no fuso da grade", async () => {
    const lead = await prisma.lead.create({ data: { nome: "Negociação CT-06", telefoneE164: "+50689990001", vendedorDonoId: secretariaId } });
    const preparada = await prepararContratacao({ leadId: lead.id, alunoId, produtoId, paisId, turmaId, regime: "MENSALIDADE", taxaProposta: "20000", valorServicoProposto: "85000", motivo: "Identidade e oferta conferidas para CT-06", chaveIdempotencia: "ct06-preparacao", identidadeConferida: true });
    if (!preparada.ok || !preparada.dado) throw new Error(preparada.ok ? "Preparação CT-06 sem retorno." : preparada.erro);
    const matriculaId = preparada.dado.matriculaId;
    await prisma.matricula.update({ where: { id: matriculaId }, data: { secretariaAssumiuEm: new Date() } });
    const pagador = await registrarPagadorPreparacao({ matriculaId, versaoEsperada: 0, pagador: { tipo: "ALUNO" }, motivo: "Pagador do próprio contrato CT-06", chaveIdempotencia: "ct06-pagador" });
    if (!pagador.ok || !pagador.dado) throw new Error(pagador.ok ? "Pagador CT-06 sem retorno." : pagador.erro);
    const condicoes = await registrarCondicoesEntrada({ matriculaId, pagadorRegistroId: pagador.dado.id, versaoEsperada: 0, taxaVencimento: "2099-01-31", aulas: { regime: "MENSALIDADE", cobertura: { referencia: "CICLO_MATRICULA", inicio: "2099-01-31" }, primeiroVencimento: "2099-02-28", diaVencimentoContratado: 31 }, motivo: "Cobertura e vencimento CT-06 conferidos", chaveIdempotencia: "ct06-condicoes" });
    if (!condicoes.ok || !condicoes.dado) throw new Error(condicoes.ok ? "Condições CT-06 sem retorno." : condicoes.erro);

    const revisao = await consultarRevisaoEmissao(matriculaId);
    if (!revisao.ok || !revisao.dado) throw new Error(revisao.ok ? "Revisão CT-06 sem retorno." : revisao.erro);
    const conferencia = { matriculaId, revisaoHash: revisao.dado.hash, cadastroDocumentosConferidos: true as const, condicoesConferidas: true as const, motivo: "Secretaria conferiu a emissão CT-06", chaveIdempotencia: "ct06-emissao" };
    const emitida = await conferirEEmitirEntrada(conferencia);
    expect(emitida.ok).toBe(true);
    expect(await conferirEEmitirEntrada(conferencia)).toEqual(emitida);

    const cobrancas = await prisma.cobranca.findMany({ where: { matriculaId }, orderBy: { tipo: "asc" } });
    expect(cobrancas).toHaveLength(2);
    const mensalidade = cobrancas.find((c) => c.tipo === "MENSALIDADE");
    if (!mensalidade?.coberturaInicio || !mensalidade.coberturaFim) throw new Error("Mensalidade CT-06 sem cobertura persistida.");
    expect(mensalidade).toMatchObject({ competencia: "2099-02" });
    expect(mensalidade.coberturaInicio.toISOString()).toBe("2099-01-31T00:00:00.000Z");
    expect(mensalidade.coberturaFim.toISOString()).toBe("2099-02-27T00:00:00.000Z");
    expect(mensalidade.vencimento.toISOString()).toBe("2099-02-28T18:00:00.000Z");
    expect(cobrancas.filter((c) => c.coberturaInicio && c.coberturaFim)).toHaveLength(1);
    expect(await prisma.emissaoCobrancasEntrada.count({ where: { matriculaId } })).toBe(1);
    expect(await prisma.itemEmissaoEntrada.count({ where: { matriculaId } })).toBe(2);

    authMock.mockResolvedValue({ user: { id: professorId } });
    const agenda = await consultarEncontrosDocente({ encontroId });
    expect(agenda).toMatchObject({ ok: true, dado: { encontros: [{ id: encontroId, inicio: "2099-02-01T02:30:00.000Z", fim: "2099-02-01T03:30:00.000Z", fusoOrigem: "America/Sao_Paulo", status: "PREVISTO" }] } });
    const encontro = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontroId } });
    expect(encontro).toMatchObject({ inicio: new Date("2099-02-01T02:30:00.000Z"), fim: new Date("2099-02-01T03:30:00.000Z"), fusoOrigem: "America/Sao_Paulo", status: "PREVISTO", turmaId });
  });
});
