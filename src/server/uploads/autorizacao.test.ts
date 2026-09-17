import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoriaDocumento, Papel } from "@prisma/client";
const db = vi.hoisted(() => ({
  cobranca: { findFirst: vi.fn(), findUnique: vi.fn() }, pagamentoInformado: { findFirst: vi.fn() },
  registroUpload: { findUnique: vi.fn(), updateMany: vi.fn() }, documento: { findFirst: vi.fn() },
  lead: { findFirst: vi.fn() }, matricula: { findUnique: vi.fn(), count: vi.fn() }, aluno: { findUnique: vi.fn() }, coberturaCarteira: { findMany: vi.fn() }, usuario: { findMany: vi.fn() },
  mensagemWhatsApp: { findFirst: vi.fn() }, intencaoMensagem: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/whatsapp/escopo", () => ({ escopoAtendimentos: async () => ({ id: "atendimento-autorizado" }) }));
import { exigirArquivoVinculavel, podeLerArquivo, urlCanonica } from "./autorizacao";
const segmentos = ["arquivo.pdf"];
const url = "/api/files/arquivo.pdf";
const u = (...papeis: Papel[]) => ({ id: "autor", papeis });
const registro = () => ({ id: "upload", url, autorId: "autor", leadId: null, matriculaId: null, alunoId: null, cobrancaId: null, categoriaDocumento: null });
beforeEach(() => {
  vi.clearAllMocks();
  db.matricula.count.mockResolvedValue(0);
  db.cobranca.findFirst.mockResolvedValue(null); db.pagamentoInformado.findFirst.mockResolvedValue(null);
  db.registroUpload.findUnique.mockResolvedValue(null); db.documento.findFirst.mockResolvedValue(null);
  db.mensagemWhatsApp.findFirst.mockResolvedValue(null); db.intencaoMensagem.findFirst.mockResolvedValue(null);
  db.coberturaCarteira.findMany.mockResolvedValue([]); db.usuario.findMany.mockResolvedValue([]);
  db.lead.findFirst.mockResolvedValue({ id: "lead", matricula: null });
  db.cobranca.findUnique.mockResolvedValue({ matricula: { id: "matricula", alunoId: "aluno", leadId: "lead" } });
  db.matricula.findUnique.mockResolvedValue({ alunoId: "aluno", secretariaAssumiuEm: new Date() });
  db.registroUpload.updateMany.mockResolvedValue({ count: 1 });
});

describe("download privado por finalidade", () => {
  it("URL canônica mantém caminho privado", () => expect(urlCanonica(segmentos)).toBe(url));
  it.each([Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.ADMINISTRADOR])("comprovante informado ainda pendente é legível por %s", async (papel) => {
    db.pagamentoInformado.findFirst.mockResolvedValue({ id: "informe" });
    expect(await podeLerArquivo(u(papel), segmentos)).toBe(true);
  });
  it.each([Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO])("%s não recebe comprovante financeiro", async (papel) => {
    db.cobranca.findFirst.mockResolvedValue({ id: "cobranca" });
    expect(await podeLerArquivo(u(papel), segmentos)).toBe(false);
  });
  it("professor só lê teste de nível na experimental atribuída", async () => {
    db.documento.findFirst.mockResolvedValue({ leadId: "lead", categoria: "TESTE_NIVEL", lead: { professorExperimentalId: "autor", matricula: null } });
    expect(await podeLerArquivo(u(Papel.PROFESSOR), segmentos)).toBe(true);
    expect(await podeLerArquivo({ id: "outro", papeis: [Papel.PROFESSOR] }, segmentos)).toBe(false);
  });
  it("vendedor perde contrato administrativo depois da secretaria assumir", async () => {
    db.documento.findFirst.mockResolvedValue({ leadId: "lead", categoria: "CONTRATO", lead: { professorExperimentalId: null, matricula: { secretariaAssumiuEm: new Date() } } });
    expect(await podeLerArquivo(u(Papel.VENDEDOR), segmentos)).toBe(false);
    expect(await podeLerArquivo(u(Papel.VENDEDOR, Papel.SECRETARIA_ACADEMICA), segmentos)).toBe(true);
  });
  it("mídia exige atendimento, mesmo que o número seja conhecido", async () => {
    expect(await podeLerArquivo(u(Papel.VENDEDOR), segmentos)).toBe(false);
    expect(db.mensagemWhatsApp.findFirst.mock.calls[0][0].where).toEqual({ midiaPath: url, atendimento: { is: { id: "atendimento-autorizado" } } });
  });
  it("arquivo sem agregado não é servível nem ao admin", async () => {
    expect(await podeLerArquivo(u(Papel.ADMINISTRADOR), segmentos)).toBe(false);
  });
  it("documento de matrícula sem lead segue a projeção administrativa", async () => {
    db.documento.findFirst.mockResolvedValue({ leadId: null, matriculaId: "matricula", categoria: "CONTRATO", lead: null });
    expect(await podeLerArquivo(u(Papel.SECRETARIA_ACADEMICA), segmentos)).toBe(true);
    expect(await podeLerArquivo(u(Papel.PROFESSOR), segmentos)).toBe(false);
    expect(await podeLerArquivo(u(Papel.GERENTE_PEDAGOGICO), segmentos)).toBe(false);
    expect(await podeLerArquivo(u(Papel.FINANCEIRO), segmentos)).toBe(false);
  });
  it("registro de finalidade incompatível com o documento bloqueia download", async () => {
    db.registroUpload.findUnique.mockResolvedValue({ categoriaDocumento: CategoriaDocumento.CONTRATO, leadId: "lead", matriculaId: null, cobrancaId: null });
    db.documento.findFirst.mockResolvedValue({ leadId: "lead", matriculaId: null, categoria: "TESTE_NIVEL", lead: { professorExperimentalId: "autor", matricula: null } });
    expect(await podeLerArquivo(u(Papel.PROFESSOR), segmentos)).toBe(false);
  });
  it("Financeiro exige o documento exato como contrato confirmado da matrícula", async () => {
    db.documento.findFirst.mockResolvedValue({ id: "contrato", matriculaId: "matricula", leadId: null, categoria: "CONTRATO", lead: null });
    db.matricula.count.mockResolvedValue(1);
    expect(await podeLerArquivo(u(Papel.FINANCEIRO), segmentos)).toBe(true);
    expect(db.matricula.count).toHaveBeenCalledWith({ where: { contratoDocumentoId: "contrato", contratoOk: true, confirmacaoContratoEm: { not: null }, OR: [{ id: "matricula" }] } });
  });
});

describe("associação de uploads não permite reutilizar arquivo alheio", () => {
  it("autor fixa contexto real e só altera registro ainda na versão lida", async () => {
    db.registroUpload.findUnique.mockResolvedValue(registro());
    await exigirArquivoVinculavel(u(Papel.FINANCEIRO), url, { cobrancaId: "c1" });
    expect(db.registroUpload.updateMany).toHaveBeenCalledWith({ where: { id: "upload", leadId: null, matriculaId: null, alunoId: null, cobrancaId: null, categoriaDocumento: null }, data: { cobrancaId: "c1", matriculaId: "matricula", alunoId: "aluno", leadId: "lead", categoriaDocumento: CategoriaDocumento.COMPROVANTE } });
  });
  it("nega primeiro vínculo de upload feito por outra pessoa", async () => {
    db.registroUpload.findUnique.mockResolvedValue({ ...registro(), autorId: "outro" });
    await expect(exigirArquivoVinculavel(u(Papel.FINANCEIRO), url, { cobrancaId: "c1" })).rejects.toThrow("outro usuário");
    expect(db.registroUpload.updateMany).not.toHaveBeenCalled();
  });
  it("mesmo autor não reutiliza prova vinculada a outra cobrança", async () => {
    db.registroUpload.findUnique.mockResolvedValue({ ...registro(), cobrancaId: "c2", alunoId: "aluno", leadId: "lead" });
    await expect(exigirArquivoVinculavel(u(Papel.FINANCEIRO), url, { cobrancaId: "c1" })).rejects.toThrow("outro objeto");
  });
  it("vínculo concorrente perde sem sobrescrever o vencedor", async () => {
    db.registroUpload.findUnique.mockResolvedValue(registro()); db.registroUpload.updateMany.mockResolvedValue({ count: 0 });
    await expect(exigirArquivoVinculavel(u(Papel.FINANCEIRO), url, { cobrancaId: "c1" })).rejects.toThrow("outra operação");
  });
  it("mesmo contexto permite confirmação independente sem trocar autor", async () => {
    db.registroUpload.findUnique.mockResolvedValue({ ...registro(), autorId: "secretaria", cobrancaId: "c1", matriculaId: "matricula", alunoId: "aluno", leadId: "lead", categoriaDocumento: CategoriaDocumento.COMPROVANTE });
    await exigirArquivoVinculavel(u(Papel.FINANCEIRO), url, { cobrancaId: "c1" });
    expect(db.registroUpload.updateMany).not.toHaveBeenCalled();
  });
  it("nega URL externa e metadado de outro aluno", async () => {
    await expect(exigirArquivoVinculavel(u(Papel.FINANCEIRO), "https://example.com/prova.pdf", { cobrancaId: "c1" })).rejects.toThrow("sistema");
    await expect(exigirArquivoVinculavel(u(Papel.FINANCEIRO), url, { cobrancaId: "c1", alunoId: "terceiro" })).rejects.toThrow("mesmo atendimento");
  });
  it("a finalidade fixada no upload impede recategorizar o mesmo arquivo", async () => {
    db.registroUpload.findUnique.mockResolvedValue({ ...registro(), leadId: "lead", categoriaDocumento: CategoriaDocumento.CONTRATO });
    await expect(exigirArquivoVinculavel(u(Papel.VENDEDOR), url, { leadId: "lead", categoriaDocumento: CategoriaDocumento.TESTE_NIVEL })).rejects.toThrow("outro objeto ou finalidade");
    expect(db.registroUpload.updateMany).not.toHaveBeenCalled();
  });
  it("legado precisa comprovar categoria no objeto original", async () => {
    await expect(exigirArquivoVinculavel(u(Papel.VENDEDOR), url, { leadId: "lead", categoriaDocumento: CategoriaDocumento.TESTE_NIVEL })).rejects.toThrow("Envie o arquivo novamente");
    expect(db.documento.findFirst).toHaveBeenCalledWith({ where: { leadId: "lead", url, arquivado: false, categoria: CategoriaDocumento.TESTE_NIVEL }, select: { id: true } });
  });
});

describe("comprovante de antecipação por contrato", () => {
  it("Financeiro vincula prova ao contrato sem cobrança", async () => {
    db.registroUpload.findUnique.mockResolvedValue(registro());
    await exigirArquivoVinculavel(u(Papel.FINANCEIRO), url, { matriculaId: "matricula", categoriaDocumento: CategoriaDocumento.COMPROVANTE });
    expect(db.registroUpload.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { matriculaId: "matricula", alunoId: "aluno", leadId: null, cobrancaId: null, categoriaDocumento: CategoriaDocumento.COMPROVANTE } }));
  });
  it("não amplia o acesso financeiro a documentos administrativos", async () => {
    await expect(exigirArquivoVinculavel(u(Papel.FINANCEIRO), url, { matriculaId: "matricula", categoriaDocumento: CategoriaDocumento.CONTRATO })).rejects.toThrow();
    expect(db.registroUpload.updateMany).not.toHaveBeenCalled();
  });
  it("não aceita comprovação de outro contrato do mesmo aluno", async () => {
    db.registroUpload.findUnique.mockResolvedValue({ ...registro(), matriculaId: "outro-contrato", alunoId: "aluno", categoriaDocumento: CategoriaDocumento.COMPROVANTE });
    await expect(exigirArquivoVinculavel(u(Papel.FINANCEIRO), url, { matriculaId: "matricula", categoriaDocumento: CategoriaDocumento.COMPROVANTE })).rejects.toThrow("outro objeto");
  });
  it.each([Papel.VENDEDOR, Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO])("%s não associa nem consulta a prova", async papel => {
    db.registroUpload.findUnique.mockResolvedValue({ ...registro(), matriculaId: "matricula", categoriaDocumento: CategoriaDocumento.COMPROVANTE });
    await expect(exigirArquivoVinculavel(u(papel), url, { matriculaId: "matricula", categoriaDocumento: CategoriaDocumento.COMPROVANTE })).rejects.toThrow();
    expect(await podeLerArquivo(u(papel), segmentos)).toBe(false);
  });
  it("a equipe financeira lê apenas prova com matrícula existente", async () => {
    db.registroUpload.findUnique.mockResolvedValue({ ...registro(), matriculaId: "matricula", categoriaDocumento: CategoriaDocumento.COMPROVANTE });
    expect(await podeLerArquivo(u(Papel.FINANCEIRO), segmentos)).toBe(true);
    db.matricula.findUnique.mockResolvedValue(null);
    expect(await podeLerArquivo(u(Papel.FINANCEIRO), segmentos)).toBe(false);
  });
});

it("comprovante por matrícula não recategoriza documento administrativo existente", async () => {
  db.registroUpload.findUnique.mockResolvedValue({ ...registro(), matriculaId: "matricula", categoriaDocumento: CategoriaDocumento.COMPROVANTE });
  db.documento.findFirst.mockResolvedValue({ matriculaId: "matricula", leadId: null, categoria: CategoriaDocumento.CONTRATO });
  expect(await podeLerArquivo(u(Papel.FINANCEIRO), segmentos)).toBe(false);
});
