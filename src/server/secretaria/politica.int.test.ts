import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { CategoriaDocumento, Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { anexarDocumentoLead, arquivarDocumentoLead, editarLead, definirTemperatura } from "@/server/comercial/acoes";
import { assumirMatricula, solicitarCorrecaoCadastro, resolverCorrecaoCadastro, confirmarContratoMatricula, anexarDocumentoMatricula, arquivarDocumentoMatricula } from "./acoes";
import { conferirCoberturaInicial } from "./cobertura";

let sec: Awaited<ReturnType<typeof criarUsuario>>, outraSec: typeof sec, ven: typeof sec, alheio: typeof sec;
let cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let matricula: Awaited<ReturnType<typeof prisma.matricula.create>>, lead: Awaited<ReturnType<typeof prisma.lead.create>>;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const pedido = (campo: "primeiroNome" | "email" | "telefoneE164" | "documentos", valorProposto: string) => ({ matriculaId: matricula.id, campo, valorProposto, motivo: "Correção pedida pelo aluno" });
async function upload(autorId: string) {
  const url = `/api/files/${randomUUID()}.pdf`;
  await prisma.registroUpload.create({ data: { url, autorId, nome: "Documento.pdf", mime: "application/pdf", tamanho: 30 } });
  return { url, nome: "Documento.pdf" };
}
async function documentoLead(categoria: CategoriaDocumento = CategoriaDocumento.CONTRATO, leadId = lead.id, criadoEm?: Date) {
  const arquivo = await upload(sec.id);
  return prisma.documento.create({ data: { leadId, categoria, ...arquivo, ...(criadoEm ? { criadoEm } : {}) } });
}

beforeEach(async () => {
  await truncarBanco();
  [sec, outraSec, ven, alheio] = await Promise.all([criarUsuario([Papel.SECRETARIA_ACADEMICA]), criarUsuario([Papel.SECRETARIA_ACADEMICA]), criarUsuario([Papel.VENDEDOR]), criarUsuario([Papel.VENDEDOR])]);
  cat = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", sobrenome: "Silva", paisId: cat.pais.id, email: "ana@genius.test" } });
  lead = await prisma.lead.create({ data: { nome: "Ana Silva", paisId: cat.pais.id, vendedorDonoId: ven.id } });
  matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: "AGUARDANDO" } });
});

describe("D05: assunção e solicitação de correção", () => {
  it("aceite preserva as condições mensais conferidas e recusa cobertura incompleta", async () => {
    entrar(sec.id); await assumirMatricula(matricula.id);
    const contrato = await documentoLead();
    await prisma.matricula.update({ where: { id: matricula.id }, data: { referenciaCobertura: "MES_CIVIL" } });
    const c = await prisma.cobranca.create({ data: { matriculaId: matricula.id, tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 90, moeda: "CRC", vencimento: new Date("2028-02-15T12:00:00Z") } });
    expect((await confirmarContratoMatricula(matricula.id, contrato.id, [{ id: c.id, versao: c.versao }])).ok).toBe(false);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matricula.id } })).contratoOk).toBe(false);
    await prisma.cobranca.update({ where: { id: c.id }, data: { versao: { increment: 1 }, coberturaInicio: new Date("2028-02-01T00:00:00Z"), coberturaFim: new Date("2028-02-29T00:00:00Z") } });
    expect(await confirmarContratoMatricula(matricula.id, contrato.id, [{ id: c.id, versao: c.versao }])).toMatchObject({ ok: false, erro: expect.stringContaining("mudaram desde a consulta") });
    expect((await confirmarContratoMatricula(matricula.id, contrato.id, [{ id: c.id, versao: c.versao + 1 }])).ok).toBe(true);
    const eventos = (await eventosDo("Matricula", matricula.id)).filter((e) => e.tipo === "ContratoConfirmado");
    expect(eventos).toHaveLength(1);
    expect(eventos[0].payload).toMatchObject({ documentoId: contrato.id, condicoesMensais: { referenciaCobertura: "MES_CIVIL", mensalidades: [{ id: c.id, valorNegociado: "90", coberturaInicio: "2028-02-01T00:00:00.000Z", coberturaFim: "2028-02-29T00:00:00.000Z", vencimento: "2028-02-15T12:00:00.000Z" }] } });
  });
  it("confere cobertura e vencimento apenas na preparação autorizada, preservando valores", async () => {
    await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
    const vencimento = new Date("2028-01-05T00:00:00Z");
    const c = await prisma.cobranca.create({ data: { matriculaId: matricula.id, tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100, saldo: 100, moeda: "CRC", vencimento } });
    const dados = { matriculaId: matricula.id, cobrancaId: c.id, versaoEsperada: c.versao, primeiroVencimento: "2028-02-29", cobertura: { referencia: "CICLO_MATRICULA" as const, inicio: "2028-01-31" }, motivo: "Conferido com as condições contratadas" };
    entrar(ven.id); expect((await conferirCoberturaInicial(dados)).ok).toBe(false);
    entrar(sec.id); expect((await conferirCoberturaInicial(dados)).ok).toBe(false);
    await assumirMatricula(matricula.id);
    expect((await conferirCoberturaInicial(dados)).ok).toBe(true);
    const depois = await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } });
    expect(depois.coberturaInicio?.toISOString().slice(0, 10)).toBe("2028-01-31");
    expect(depois.coberturaFim?.toISOString().slice(0, 10)).toBe("2028-02-28");
    expect(depois.vencimento).toEqual(new Date(2028, 1, 29, 12));
    expect(depois.competencia).toBe("2028-02");
    expect(depois.status).toBe("PENDENTE");
    expect(Number(depois.valorNegociado)).toBe(100);
    expect(Number(depois.saldo)).toBe(100);
    expect((await eventosDo("Matricula", matricula.id)).filter((e) => e.tipo === "CoberturaInicialConferida")).toHaveLength(1);
    expect(await conferirCoberturaInicial({ ...dados, primeiroVencimento: "2028-03-01" })).toMatchObject({ ok: false, erro: expect.stringContaining("mudou desde a consulta") });
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).vencimento).toEqual(depois.vencimento);
    dados.versaoEsperada = depois.versao;
    await prisma.cobranca.update({ where: { id: c.id }, data: { valorRecebido: 10 } });
    expect((await conferirCoberturaInicial({ ...dados, cobertura: { ...dados.cobertura, inicio: "2028-02-01" } })).ok).toBe(false);
    await prisma.cobranca.update({ where: { id: c.id }, data: { valorRecebido: null } });
    await prisma.matricula.update({ where: { id: matricula.id }, data: { contratoOk: true } });
    expect((await conferirCoberturaInicial(dados)).ok).toBe(false);
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).coberturaInicio).toEqual(depois.coberturaInicio);
  });
  it("somente secretaria assume; repetição mantém autoria, dono comercial e comissão", async () => {
    await prisma.comissao.create({ data: { matriculaId: matricula.id, vendedorId: ven.id, percentual: 10, valor: 100, moeda: "CRC" } });
    entrar(ven.id); expect((await assumirMatricula(matricula.id)).ok).toBe(false);
    entrar(sec.id); expect((await assumirMatricula(matricula.id)).ok).toBe(true);
    const primeira = await prisma.matricula.findUniqueOrThrow({ where: { id: matricula.id } });
    entrar(outraSec.id); expect((await assumirMatricula(matricula.id)).ok).toBe(true);
    const atual = await prisma.matricula.findUniqueOrThrow({ where: { id: matricula.id } });
    expect(atual.secretariaResponsavelId).toBe(sec.id); expect(atual.secretariaAssumiuEm).toEqual(primeira.secretariaAssumiuEm);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).vendedorDonoId).toBe(ven.id);
    expect((await prisma.comissao.findFirstOrThrow()).vendedorId).toBe(ven.id);
    expect((await eventosDo("Matricula", matricula.id)).filter((e) => e.tipo === "MatriculaAssumida")).toHaveLength(1);
  });

  it("vendedor edita cadastro inicial; após assunção só contexto comercial e pedido de correção", async () => {
    entrar(ven.id);
    expect((await editarLead(lead.id, { nome: "Ana corrigida", paisId: cat.pais.id })).ok).toBe(true);
    const documento = await upload(ven.id);
    expect((await anexarDocumentoLead(lead.id, { ...documento, categoria: CategoriaDocumento.CONTRATO })).ok).toBe(true);
    entrar(sec.id); await assumirMatricula(matricula.id);
    entrar(ven.id);
    expect((await editarLead(lead.id, { nome: "Nova alteração indevida", paisId: cat.pais.id })).ok).toBe(false);
    expect((await anexarDocumentoLead(lead.id, { ...await upload(ven.id), categoria: CategoriaDocumento.CONTRATO })).ok).toBe(false);
    expect((await definirTemperatura(lead.id, "QUENTE")).ok).toBe(true);
    expect((await solicitarCorrecaoCadastro(pedido("primeiroNome", "Anabela"))).ok).toBe(true);
    const solicitacao = await prisma.solicitacaoCorrecaoCadastro.findFirstOrThrow();
    expect(solicitacao.autorId).toBe(ven.id); expect(solicitacao.status).toBe("PENDENTE");
    expect((await resolverCorrecaoCadastro(solicitacao.id, { aprovar: true, motivo: "Cadastro conferido" })).ok).toBe(false);
    entrar(sec.id);
    expect((await resolverCorrecaoCadastro(solicitacao.id, { aprovar: true, motivo: "Cadastro conferido" })).ok).toBe(true);
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: matricula.alunoId } })).primeiroNome).toBe("Anabela");
    const resolvida = await prisma.solicitacaoCorrecaoCadastro.findUniqueOrThrow({ where: { id: solicitacao.id } });
    expect(resolvida.autorId).toBe(ven.id); expect(resolvida.responsavelId).toBe(sec.id); expect(resolvida.status).toBe("CONCLUIDA");
    expect((await resolverCorrecaoCadastro(solicitacao.id, { aprovar: false, motivo: "Tentativa repetida" })).ok).toBe(false);
  });

  it("acumular secretaria não remove a coleta documental inicial da própria carteira", async () => {
    await prisma.usuario.update({ where: { id: ven.id }, data: { papeis: [Papel.VENDEDOR, Papel.SECRETARIA_ACADEMICA] } });
    entrar(ven.id);
    expect((await anexarDocumentoLead(lead.id, { ...await upload(ven.id), categoria: CategoriaDocumento.CONTRATO })).ok).toBe(true);
    const fora = await prisma.lead.create({ data: { nome: "Fora da carteira", vendedorDonoId: alheio.id } });
    expect((await anexarDocumentoLead(fora.id, { ...await upload(ven.id), categoria: CategoriaDocumento.CONTRATO })).ok).toBe(false);
  });

  it("nega carteira alheia e valores inviáveis antes de abrir pedido; rejeição não altera cadastro", async () => {
    entrar(ven.id); expect((await solicitarCorrecaoCadastro(pedido("email", "novo@genius.test"))).ok).toBe(false);
    entrar(sec.id); await assumirMatricula(matricula.id);
    entrar(alheio.id); expect((await solicitarCorrecaoCadastro(pedido("email", "novo@genius.test"))).ok).toBe(false);
    entrar(ven.id);
    for (const input of [pedido("email", "invalido"), pedido("telefoneE164", "88888888"), pedido("primeiroNome", ""), pedido("documentos", "")]) expect((await solicitarCorrecaoCadastro(input)).ok).toBe(false);
    expect(await prisma.solicitacaoCorrecaoCadastro.count()).toBe(0);
    await solicitarCorrecaoCadastro(pedido("email", "novo@genius.test"));
    const solicitacao = await prisma.solicitacaoCorrecaoCadastro.findFirstOrThrow();
    entrar(sec.id); expect((await resolverCorrecaoCadastro(solicitacao.id, { aprovar: false, motivo: "Aluno não confirmou o novo endereço" })).ok).toBe(true);
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: matricula.alunoId } })).email).toBe("ana@genius.test");
  });

  it("correção documental exige documento novo, vigente e do mesmo atendimento", async () => {
    const anterior = await documentoLead(CategoriaDocumento.CONTRATO, lead.id, new Date("2020-01-01"));
    entrar(sec.id); await assumirMatricula(matricula.id);
    entrar(ven.id); await solicitarCorrecaoCadastro(pedido("documentos", "Substituir o contrato sem assinatura"));
    const solicitacao = await prisma.solicitacaoCorrecaoCadastro.findFirstOrThrow();
    entrar(sec.id);
    for (const documentoId of [undefined, anterior.id]) expect((await resolverCorrecaoCadastro(solicitacao.id, { aprovar: true, motivo: "Documento conferido", documentoId })).ok).toBe(false);
    const outroLead = await prisma.lead.create({ data: { nome: "Outra pessoa", vendedorDonoId: alheio.id } });
    const outroDoc = await documentoLead(CategoriaDocumento.CONTRATO, outroLead.id);
    expect((await resolverCorrecaoCadastro(solicitacao.id, { aprovar: true, motivo: "Documento conferido", documentoId: outroDoc.id })).ok).toBe(false);
    const corrigido = await upload(sec.id);
    expect((await anexarDocumentoMatricula(matricula.id, { ...corrigido, categoria: CategoriaDocumento.CONTRATO })).ok).toBe(true);
    const evidencia = await prisma.documento.findFirstOrThrow({ where: { url: corrigido.url } });
    expect((await resolverCorrecaoCadastro(solicitacao.id, { aprovar: true, motivo: "Aceite assinado conferido", documentoId: evidencia.id })).ok).toBe(true);
    expect((await eventosDo("SolicitacaoCorrecaoCadastro", solicitacao.id)).find((e) => e.tipo === "CorrecaoCadastroResolvida")?.payload).toMatchObject({ documentoId: evidencia.id, aprovada: true });
  });
});

describe("evidência contratual e finalidade imutável (AC28)", () => {
  it("documento legado não pode ser republicado em categoria com outra finalidade", async () => {
    entrar(sec.id); await assumirMatricula(matricula.id);
    const legado = await prisma.documento.create({ data: { leadId: lead.id, categoria: CategoriaDocumento.CONTRATO, nome: "Contrato legado", url: "/api/files/contrato-legado.pdf" } });
    const r = await anexarDocumentoLead(lead.id, { nome: "Expor como proposta", url: legado.url, categoria: CategoriaDocumento.PROPOSTA });
    expect(r.ok).toBe(false);
    expect(await prisma.documento.count({ where: { url: legado.url } })).toBe(1);
  });

  it("confirma contrato vigente, preserva evidência e bloqueia arquivo até substituição", async () => {
    const contrato = await documentoLead();
    const proposta = await documentoLead(CategoriaDocumento.PROPOSTA);
    entrar(sec.id);
    expect((await confirmarContratoMatricula(matricula.id, contrato.id, [])).ok).toBe(false);
    await assumirMatricula(matricula.id);
    expect((await confirmarContratoMatricula(matricula.id, proposta.id, [])).ok).toBe(false);
    expect((await confirmarContratoMatricula(matricula.id, contrato.id, [])).ok).toBe(true);
    expect((await confirmarContratoMatricula(matricula.id, contrato.id, [])).ok).toBe(true);
    const atual = await prisma.matricula.findUniqueOrThrow({ where: { id: matricula.id } });
    expect(atual.contratoDocumentoId).toBe(contrato.id); expect(atual.confirmacaoContratoPorId).toBe(sec.id); expect(atual.contratoOk).toBe(true);
    expect(atual.status).toBe("AGUARDANDO"); expect(await prisma.recebimento.count()).toBe(0);
    expect((await eventosDo("Matricula", matricula.id)).filter((e) => e.tipo === "ContratoConfirmado")).toHaveLength(1);
    expect((await arquivarDocumentoLead(contrato.id)).ok).toBe(false);
    const novo = await documentoLead();
    expect((await confirmarContratoMatricula(matricula.id, novo.id, [])).ok).toBe(true);
    expect((await arquivarDocumentoLead(contrato.id)).ok).toBe(true);
    expect((await confirmarContratoMatricula(matricula.id, contrato.id, [])).ok).toBe(false);
  });

  it("matrícula sem lead tem anexo/aceite próprios e impede reutilização em outra matrícula do aluno", async () => {
    await prisma.matricula.update({ where: { id: matricula.id }, data: { leadId: null } });
    entrar(sec.id); await assumirMatricula(matricula.id);
    const arquivo = await upload(sec.id);
    expect((await anexarDocumentoMatricula(matricula.id, { ...arquivo, categoria: CategoriaDocumento.CONTRATO })).ok).toBe(true);
    const doc = await prisma.documento.findFirstOrThrow({ where: { url: arquivo.url } });
    expect(doc.leadId).toBeNull(); expect(doc.matriculaId).toBe(matricula.id);
    expect((await confirmarContratoMatricula(matricula.id, doc.id, [])).ok).toBe(true);
    expect((await arquivarDocumentoMatricula(doc.id)).ok).toBe(false);
    expect((await anexarDocumentoMatricula(matricula.id, { ...arquivo, categoria: CategoriaDocumento.PROPOSTA })).ok).toBe(false);
    const outra = await prisma.matricula.create({ data: { alunoId: matricula.alunoId, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", secretariaAssumiuEm: new Date(), secretariaResponsavelId: sec.id } });
    expect((await anexarDocumentoMatricula(outra.id, { ...arquivo, categoria: CategoriaDocumento.CONTRATO })).ok).toBe(false);
    expect((await confirmarContratoMatricula(outra.id, doc.id, [])).ok).toBe(false);
    entrar(ven.id); expect((await anexarDocumentoMatricula(matricula.id, { ...await upload(ven.id), categoria: CategoriaDocumento.CONTRATO })).ok).toBe(false);
    entrar(sec.id); await prisma.usuario.update({ where: { id: sec.id }, data: { papeis: [] } });
    expect((await confirmarContratoMatricula(matricula.id, doc.id, [])).ok).toBe(false);
  });

  it("confirmar e arquivar simultaneamente nunca deixam contrato confirmado com documento arquivado", async () => {
    entrar(sec.id); await assumirMatricula(matricula.id);
    const contrato = await documentoLead();
    const resultados = await Promise.all([confirmarContratoMatricula(matricula.id, contrato.id, []), arquivarDocumentoLead(contrato.id)]);
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    const atual = await prisma.matricula.findUniqueOrThrow({ where: { id: matricula.id } });
    const doc = await prisma.documento.findUniqueOrThrow({ where: { id: contrato.id } });
    expect(atual.contratoOk && doc.arquivado).toBe(false);
  });
});
