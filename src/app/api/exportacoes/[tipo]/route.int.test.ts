import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { Papel } from "@prisma/client";

const { authMock, ordenarAlunosMock } = vi.hoisted(() => ({ authMock: vi.fn(), ordenarAlunosMock: vi.fn((alunos: unknown) => alunos) }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/alunos/consultas", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/alunos/consultas")>();
  return { ...original, listarAlunos: async (...args: Parameters<typeof original.listarAlunos>) => ordenarAlunosMock(await original.listarAlunos(...args)) };
});
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const u = await sessao(); original.exigirPapel(u, ...papeis); return u;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { GET } from "./route";

let ven: Awaited<ReturnType<typeof criarUsuario>>, outro: typeof ven;
let lead: Awaited<ReturnType<typeof prisma.lead.create>>;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const exportar = (tipo = "leads", busca = "") => GET(new Request(`http://localhost/api/exportacoes/${tipo}${busca}`), { params: Promise.resolve({ tipo }) });
async function linhas(resposta: Response) {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(await resposta.arrayBuffer());
  const folha = livro.worksheets[0];
  const resultado: ExcelJS.CellValue[][] = [];
  folha.eachRow((linha) => resultado.push((linha.values as ExcelJS.CellValue[]).slice(1)));
  return resultado;
}
function duranteGeracao(operacao: () => Promise<unknown>) {
  const escritor = Object.getPrototypeOf(new ExcelJS.Workbook().xlsx) as ExcelJS.Xlsx;
  const original = escritor.writeBuffer;
  vi.spyOn(escritor, "writeBuffer").mockImplementation(async function (this: ExcelJS.Xlsx, options) {
    const arquivo = await original.call(this, options);
    await operacao();
    return arquivo;
  });
}

beforeEach(async () => {
  await truncarBanco();
  ordenarAlunosMock.mockReset();
  ordenarAlunosMock.mockImplementation((alunos: unknown) => alunos);
  [ven, outro] = await Promise.all([criarUsuario([Papel.VENDEDOR]), criarUsuario([Papel.VENDEDOR])]);
  lead = await prisma.lead.create({ data: { codigo: "L-000001", nome: "Carteira autorizada", vendedorDonoId: ven.id, telefoneE164: "+5511999999999", orcamento: "Informação privada", valorPrevisto: 98765 } });
  await prisma.lead.create({ data: { codigo: "L-000002", nome: "Carteira alheia", vendedorDonoId: outro.id } });
  entrar(ven.id);
});
afterEach(() => vi.restoreAllMocks());

describe("D09: geração/download de XLSX com escopo e campos autorizados", () => {
  it("sem concessão específica nega e não registra exportação", async () => {
    const res = await exportar();
    expect(res.status).toBe(403);
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(0);
    expect((await exportar("usuarios")).status).toBe(404);
  });

  it("arquivo real ignora tentativa de aumentar colunas/IDs e contém só carteira/projeção permitida", async () => {
    await prisma.usuario.update({ where: { id: ven.id }, data: { permissoes: ["dados.exportar_leads"] } });
    const res = await exportar("leads", `?vendedorId=${outro.id}&colunas=telefoneE164,orcamento,valorPrevisto&ids=outro`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(await linhas(res)).toEqual([["Código", "Nome", "Tipo", "Segmento", "Etapa", "Temperatura", "País", "Dono"], ["L-000001", "Carteira autorizada", "PF", "ADULTO", "NOVO", "MORNO", "", ven.nome]]);
    const evento = await prisma.evento.findFirstOrThrow({ where: { tipo: "DadosExportados" } });
    expect(evento.autorId).toBe(ven.id);
    expect(evento.payload).toMatchObject({ conjunto: "leads", quantidade: 1, colunas: ["Código", "Nome", "Tipo", "Segmento", "Etapa", "Temperatura", "País", "Dono"], filtros: {} });
    expect(JSON.stringify(evento.payload)).not.toContain("Carteira autorizada");
    expect(JSON.stringify(evento.payload)).not.toContain(lead.telefoneE164);
  });

  it("E4: ?status=ATIVO exporta só o recorte da tela e registra o filtro aplicado", async () => {
    const cat = await seedCatalogoMinimo();
    const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA]);
    await prisma.usuario.update({ where: { id: secretaria.id }, data: { permissoes: ["dados.exportar_alunos"] } });
    await prisma.aluno.create({ data: { codigo: "A-000010", primeiroNome: "Aluna ativa", paisId: cat.pais.id, status: "ATIVO" } });
    await prisma.aluno.create({ data: { codigo: "A-000011", primeiroNome: "Aluna pausada", paisId: cat.pais.id, status: "PAUSADO" } });
    entrar(secretaria.id);
    const res = await exportar("alunos", "?status=ATIVO&colunas=email");
    expect(res.status).toBe(200);
    const dados = await linhas(res);
    expect(dados.map((l) => l[1])).toEqual(["Nome", "Aluna ativa"]);
    const evento = await prisma.evento.findFirstOrThrow({ where: { tipo: "DadosExportados" } });
    expect(evento.payload).toMatchObject({ conjunto: "alunos", quantidade: 1, filtros: { status: "ATIVO" } });
  });

  it("alunos exportados por professor mantêm vínculo atual e não entregam campos financeiros/contato", async () => {
    const cat = await seedCatalogoMinimo();
    const professor = await criarUsuario([Papel.PROFESSOR, Papel.VENDEDOR]);
    await prisma.usuario.update({ where: { id: professor.id }, data: { permissoes: ["dados.exportar_alunos"] } });
    const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
    const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: cat.modalidade.id, professorId: professor.id } });
    await prisma.vinculoDocente.create({ data: { turmaId: turma.id, professorId: professor.id, inicio: new Date(Date.now() - 60000) } });
    const aluno = await prisma.aluno.create({ data: { codigo: "A-000001", primeiroNome: "Ana", paisId: cat.pais.id, telefoneE164: "+50688887777", email: "pessoal@genius.test", documento: "segredo-documento" } });
    await prisma.aluno.create({ data: { primeiroNome: "Aluna de outra turma", paisId: cat.pais.id } });
    await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id } });
    await prisma.matricula.create({ data: { alunoId: aluno.id, paisId: cat.pais.id, produtoId: cat.produto.id, moeda: "CRC", cobrancas: { create: { tipo: "MATRICULA", valorOriginal: 999, valorNegociado: 999, saldo: 999, moeda: "CRC", vencimento: new Date() } } } });
    entrar(professor.id);
    const res = await exportar("alunos", "?colunas=email,documento,telefoneE164,financeiro");
    expect(res.status).toBe(200);
    const dados = await linhas(res);
    expect(dados).toHaveLength(2);
    expect(dados[0]).toEqual(["Código", "Nome", "Situação", "País", "Turma"]);
    expect(dados[1]).toEqual(["A-000001", "Ana", aluno.status, cat.pais.nome, "Regular A1"]);
    expect(JSON.stringify(dados)).not.toMatch(/pessoal@|88887777|segredo|999|outra turma/);
  });

  it("nomes iniciados com igual são texto no XLSX, sem fórmula executável", async () => {
    await prisma.usuario.update({ where: { id: ven.id }, data: { permissoes: ["dados.exportar_leads"] } });
    await prisma.lead.update({ where: { id: lead.id }, data: { nome: "=1+1" } });
    const res = await exportar();
    const livro = new ExcelJS.Workbook(); await livro.xlsx.load(await res.arrayBuffer());
    const celula = livro.worksheets[0].getCell("B2");
    expect(celula.type).toBe(ExcelJS.ValueType.String); expect(celula.value).toBe("=1+1");
  });
});

describe("D09: revalidação depois da geração e antes da resposta", () => {
  beforeEach(async () => {
    await prisma.usuario.update({ where: { id: ven.id }, data: { permissoes: ["dados.exportar_leads"] } });
  });

  it("revogar a concessão durante geração bloqueia entrega e auditoria de sucesso", async () => {
    duranteGeracao(() => prisma.usuario.update({ where: { id: ven.id }, data: { permissoes: [] } }));
    expect((await exportar()).status).toBe(403);
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(0);
  });

  it("transferir carteira durante geração impede download dos registros antigos", async () => {
    duranteGeracao(() => prisma.lead.update({ where: { id: lead.id }, data: { vendedorDonoId: outro.id } }));
    const res = await exportar();
    expect(res.status).toBe(403); expect(await res.json()).toMatchObject({ erro: expect.stringContaining("acesso aos registros mudou") });
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(0);
  });

  it("desativar usuário depois da geração rejeita até cookie anterior", async () => {
    duranteGeracao(() => prisma.usuario.update({ where: { id: ven.id }, data: { ativo: false } }));
    expect((await exportar()).status).toBe(401);
  });

  it("revogação de cobertura durante geração impede exportar a carteira coberta", async () => {
    await prisma.usuario.update({ where: { id: outro.id }, data: { permissoes: ["dados.exportar_leads"] } });
    const cobertura = await prisma.coberturaCarteira.create({ data: { titularId: ven.id, substitutoId: outro.id, concedenteId: ven.id, inicio: new Date(Date.now() - 60000), fim: new Date(Date.now() + 60000), motivo: "Cobertura autorizada no cenário de teste" } });
    entrar(outro.id);
    duranteGeracao(() => prisma.coberturaCarteira.update({ where: { id: cobertura.id }, data: { revogadaEm: new Date() } }));
    expect((await exportar()).status).toBe(403);
  });

  it("transferir aluno durante a geração invalida o XLSX e preserva o histórico fora do novo escopo docente", async () => {
    const cat = await seedCatalogoMinimo();
    const professor = await criarUsuario([Papel.PROFESSOR]);
    await prisma.usuario.update({ where: { id: professor.id }, data: { permissoes: ["dados.exportar_alunos"] } });
    const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "CT03", ordem: 3 } });
    const turmaOrigem = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: cat.modalidade.id, professorId: professor.id } });
    const turmaDestino = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: cat.modalidade.id } });
    await prisma.vinculoDocente.create({ data: { turmaId: turmaOrigem.id, professorId: professor.id, inicio: new Date(Date.now() - 60_000) } });
    const aluno = await prisma.aluno.create({ data: { codigo: "CT03-ALUNO", primeiroNome: "Aluno transferido", paisId: cat.pais.id } });
    const origem = await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turmaOrigem.id } });
    entrar(professor.id);

    duranteGeracao(async () => {
      await prisma.alocacaoTurma.update({ where: { id: origem.id }, data: { ativa: false, encerradaEm: new Date() } });
      await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turmaDestino.id } });
    });
    const interrompida = await exportar("alunos");
    expect(interrompida.status).toBe(403);
    expect(await interrompida.json()).toMatchObject({ erro: expect.stringContaining("acesso aos registros mudou") });
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(0);
    expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: origem.id } })).toMatchObject({ ativa: false, turmaId: turmaOrigem.id, encerradaEm: expect.any(Date) });
    expect(await prisma.alocacaoTurma.findFirstOrThrow({ where: { alunoId: aluno.id, ativa: true } })).toMatchObject({ turmaId: turmaDestino.id });

    vi.restoreAllMocks();
    const posterior = await exportar("alunos");
    expect(posterior.status).toBe(200);
    expect(await linhas(posterior)).toEqual([["Código", "Nome", "Situação", "País", "Turma"]]);
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(1);
  });

  it("não entrega o rótulo de turma perdido quando o aluno ainda permanece visível por outro contrato", async () => {
    const cat = await seedCatalogoMinimo();
    const professor = await criarUsuario([Papel.PROFESSOR]);
    await prisma.usuario.update({ where: { id: professor.id }, data: { permissoes: ["dados.exportar_alunos"] } });
    const [nivelA, nivelB, nivelC] = await Promise.all(["CT03-A", "CT03-B", "CT03-C"].map((codigo, ordem) => prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo, ordem: ordem + 10 } })));
    const [turmaA, turmaB, turmaC] = await Promise.all([
      prisma.turma.create({ data: { nivelId: nivelA.id, modalidadeId: cat.modalidade.id, professorId: professor.id } }),
      prisma.turma.create({ data: { nivelId: nivelB.id, modalidadeId: cat.modalidade.id, professorId: professor.id } }),
      prisma.turma.create({ data: { nivelId: nivelC.id, modalidadeId: cat.modalidade.id } }),
    ]);
    await prisma.vinculoDocente.createMany({ data: [{ turmaId: turmaA.id, professorId: professor.id, inicio: new Date(Date.now() - 60_000) }, { turmaId: turmaB.id, professorId: professor.id, inicio: new Date(Date.now() - 60_000) }] });
    const aluno = await prisma.aluno.create({ data: { codigo: "CT03-DUPLO", primeiroNome: "Aluno com contratos", paisId: cat.pais.id } });
    const [matriculaA, matriculaB] = await Promise.all([0, 1].map(() => prisma.matricula.create({ data: { alunoId: aluno.id, paisId: cat.pais.id, produtoId: cat.produto.id, moeda: "CRC" } })));
    const origem = await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matriculaA.id, turmaId: turmaA.id } });
    await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matriculaB.id, turmaId: turmaB.id } });
    entrar(professor.id);

    duranteGeracao(async () => {
      await prisma.alocacaoTurma.update({ where: { id: origem.id }, data: { ativa: false, encerradaEm: new Date() } });
      await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matriculaA.id, turmaId: turmaC.id } });
    });
    const interrompida = await exportar("alunos");
    expect(interrompida.status).toBe(403);
    expect(await interrompida.json()).toMatchObject({ erro: expect.stringContaining("acesso aos registros mudou") });
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(0);
  });

  it("revogar visão ampla para professor retém o XLSX que ainda contém turma fora da atribuição", async () => {
    const cat = await seedCatalogoMinimo();
    const operador = await criarUsuario([Papel.SECRETARIA_ACADEMICA, Papel.PROFESSOR]);
    await prisma.usuario.update({ where: { id: operador.id }, data: { permissoes: ["dados.exportar_alunos"] } });
    const [nivelAmplo, nivelDocente] = await Promise.all(["CT03-AMPLO", "CT03-DOCENTE"].map((codigo, ordem) => prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo, ordem: ordem + 20 } })));
    const [turmaAmpla, turmaDocente] = await Promise.all([
      prisma.turma.create({ data: { nivelId: nivelAmplo.id, modalidadeId: cat.modalidade.id } }),
      prisma.turma.create({ data: { nivelId: nivelDocente.id, modalidadeId: cat.modalidade.id, professorId: operador.id } }),
    ]);
    await prisma.vinculoDocente.create({ data: { turmaId: turmaDocente.id, professorId: operador.id, inicio: new Date(Date.now() - 60_000) } });
    const aluno = await prisma.aluno.create({ data: { codigo: "CT03-PAPEL", primeiroNome: "Aluno visível após revogação", paisId: cat.pais.id } });
    const [matriculaAmpla, matriculaDocente] = await Promise.all([0, 1].map(() => prisma.matricula.create({ data: { alunoId: aluno.id, paisId: cat.pais.id, produtoId: cat.produto.id, moeda: "CRC" } })));
    await prisma.alocacaoTurma.createMany({ data: [{ alunoId: aluno.id, matriculaId: matriculaAmpla.id, turmaId: turmaAmpla.id }, { alunoId: aluno.id, matriculaId: matriculaDocente.id, turmaId: turmaDocente.id }] });
    entrar(operador.id);

    duranteGeracao(() => prisma.usuario.update({ where: { id: operador.id }, data: { papeis: [Papel.PROFESSOR] } }));
    const interrompida = await exportar("alunos");
    expect(interrompida.status).toBe(403);
    expect(await interrompida.json()).toMatchObject({ erro: expect.stringContaining("acesso aos registros mudou") });
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(0);
  });

  it("não rejeita a mesma projeção de alunos homônimos quando a leitura posterior muda somente de ordem", async () => {
    const cat = await seedCatalogoMinimo();
    const professor = await criarUsuario([Papel.PROFESSOR]);
    await prisma.usuario.update({ where: { id: professor.id }, data: { permissoes: ["dados.exportar_alunos"] } });
    const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "CT03-ORDEM", ordem: 30 } });
    const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: cat.modalidade.id, professorId: professor.id } });
    await prisma.vinculoDocente.create({ data: { turmaId: turma.id, professorId: professor.id, inicio: new Date(Date.now() - 60_000) } });
    const alunos = await Promise.all([0, 1].map(() => prisma.aluno.create({ data: { primeiroNome: "Aluno", sobrenome: "Homônimo", paisId: cat.pais.id } })));
    await prisma.alocacaoTurma.createMany({ data: alunos.map((aluno) => ({ alunoId: aluno.id, turmaId: turma.id })) });
    entrar(professor.id);
    let leituras = 0;
    ordenarAlunosMock.mockImplementation((dados: unknown) => ++leituras === 2 && Array.isArray(dados) ? [...dados].reverse() : dados);

    const resposta = await exportar("alunos");
    expect(resposta.status).toBe(200);
    expect(await linhas(resposta)).toHaveLength(3);
    expect(await prisma.evento.count({ where: { tipo: "DadosExportados" } })).toBe(1);
  });
});
