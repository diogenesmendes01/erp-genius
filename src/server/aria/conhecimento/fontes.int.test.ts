import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoriaDocumento, Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Trava do teto de trechos (C6): com os demais tetos, o divisor real não passa de ~340 trechos, então
// um texto-marcador força a saída acima do teto para exercitar a recusa.
vi.mock("./trechos", async (original) => {
  const real = await original<typeof import("./trechos")>();
  return {
    ...real,
    dividirEmTrechos: (texto: string, ...resto: [number?, number?]) =>
      texto.includes("§MUITOS-TRECHOS§") ? Array.from({ length: 401 }, (_, i) => `trecho ${i}`) : real.dividirEmTrechos(texto, ...resto),
  };
});

import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR } from "@/lib/uploads";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { provedorSimulado, type PedidoIA, type ProvedorIA } from "../provedor";
import { arquivarFonte, criarFonteArquivo, criarFonteTexto } from "./fontes";

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
let admin: Usuario;
let vendedor: Usuario;
let gerente: Usuario;
const logado = (u: Usuario) => authMock.mockResolvedValue({ user: { id: u.id } });
const escritos: string[] = [];
const idDe = (r: { ok: boolean; dado?: { id: string } }) => r.dado!.id;

async function upload(
  nome: string,
  conteudo: string | Buffer | null,
  extra: { autorId?: string; leadId?: string; alunoId?: string; cobrancaId?: string; matriculaId?: string; categoriaDocumento?: CategoriaDocumento } = {},
) {
  const arquivo = `fonte-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(nome)}`;
  if (conteudo !== null) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, arquivo), conteudo);
    escritos.push(arquivo);
  }
  return prisma.registroUpload.create({
    data: { url: `/api/files/${arquivo}`, nome, mime: "application/octet-stream", tamanho: 10, autorId: admin.id, ...extra },
  });
}

function provedorQueExtrai(texto: string, recusa = false): ProvedorIA & { pedidos: PedidoIA[] } {
  const pedidos: PedidoIA[] = [];
  return {
    nome: "simulado",
    pedidos,
    async gerar(p) {
      pedidos.push(p);
      // Parte de uma resposta real do provedor simulado: campos novos de RespostaIA (ex.: tokensEscritaCache)
      // chegam pelo espalhamento sem quebrar o tipo.
      return {
        ...(await provedorSimulado.gerar(p)),
        texto: JSON.stringify({ texto }),
        modelo: "claude-sonnet-5-5",
        provedor: "anthropic",
        recusa,
        tokensEntrada: 1000,
        tokensSaida: 200,
        latenciaMs: 5,
      };
    },
  };
}

beforeEach(async () => {
  await truncarBanco();
  authMock.mockReset();
  admin = await criarUsuario([Papel.ADMINISTRADOR]);
  vendedor = await criarUsuario([Papel.VENDEDOR]);
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL]);
});

const nadaGravado = async () => {
  expect(await prisma.fonteConhecimento.count()).toBe(0);
  expect(await prisma.trechoConhecimento.count()).toBe(0);
  expect(await prisma.evento.count({ where: { tipo: "FonteConhecimentoCriada" } })).toBe(0);
};

afterAll(async () => {
  for (const a of escritos) await unlink(path.join(UPLOAD_DIR, a)).catch(() => undefined);
});

describe("fontes de conhecimento", () => {
  it("texto_vira_fonte_pronta_com_trechos", async () => {
    logado(admin);
    const r = await criarFonteTexto({ nome: "Horários", texto: "Turmas à noite de segunda a quinta.", enviavelAoLead: false });
    expect(await prisma.fonteConhecimento.findUnique({ where: { id: idDe(r) } })).toMatchObject({ status: "PRONTA" });
    expect(await prisma.trechoConhecimento.count({ where: { fonteId: idDe(r) } })).toBe(1);
    const ev = await eventosDo("FonteConhecimento", idDe(r));
    expect(ev.map((e) => e.tipo)).toContain("FonteConhecimentoCriada");
  });

  it("busca_textual_portugues_encontra_trecho", async () => {
    logado(admin);
    const r = await criarFonteTexto({ nome: "Horários", texto: "Turmas à noite de segunda a quinta.", enviavelAoLead: false });
    const achados = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "TrechoConhecimento" WHERE "fonteId" = ${idDe(r)}
      AND "busca" @@ plainto_tsquery('portuguese', 'turmas noite')`;
    expect(achados).toHaveLength(1);
  });

  it("docx_recusado", async () => {
    logado(admin);
    const uploadDocx = await upload("contrato.docx", "x");
    const r = await criarFonteArquivo({ registroUploadId: uploadDocx.id, enviavelAoLead: false });
    expect(r.ok).toBe(false);
    expect(await prisma.fonteConhecimento.count()).toBe(0);
  });

  it("txt_e_lido_sem_chamar_provedor", async () => {
    logado(admin);
    const up = await upload("faq.txt", "Mensalidade vence dia 10.\n\nAulas começam em fevereiro.");
    const r = await criarFonteArquivo({ registroUploadId: up.id, enviavelAoLead: true });
    expect(r.ok).toBe(true);
    expect(await prisma.fonteConhecimento.findUnique({ where: { id: idDe(r) } })).toMatchObject({
      status: "PRONTA",
      tipo: "ARQUIVO",
      enviavelAoLead: true,
      registroUploadId: up.id,
    });
    expect(await prisma.chamadaIA.count()).toBe(0);
  });

  it("pdf_extraido_pelo_provedor_e_custo_registrado", async () => {
    logado(admin);
    const uploadPdf = await upload("tabela.pdf", Buffer.from("%PDF-1.4 falso"));
    const provedor = provedorQueExtrai("Tabela de horários");
    const r = await criarFonteArquivo({ registroUploadId: uploadPdf.id, enviavelAoLead: true }, { provedor });
    expect(r.ok).toBe(true);
    expect(await prisma.chamadaIA.count({ where: { origem: "INDEXACAO" } })).toBe(1);
    expect(provedor.pedidos[0]).toMatchObject({ tarefa: "extracao", maxTokens: 16000 });
    expect(provedor.pedidos[0].pdfBase64).toBe(Buffer.from("%PDF-1.4 falso").toString("base64"));
    expect(await prisma.fonteConhecimento.findUnique({ where: { id: idDe(r) } })).toMatchObject({ status: "PRONTA" });
    expect(await prisma.trechoConhecimento.count({ where: { fonteId: idDe(r) } })).toBe(1);
  });

  it("pdf_com_extracao_vazia_ou_recusa_vira_erro_legivel", async () => {
    logado(admin);
    const up = await upload("vazio.pdf", Buffer.from("%PDF"));
    const vazio = await criarFonteArquivo({ registroUploadId: up.id, enviavelAoLead: false }, { provedor: provedorQueExtrai("  ") });
    expect(await prisma.fonteConhecimento.findUnique({ where: { id: idDe(vazio) } })).toMatchObject({ status: "ERRO", erro: expect.stringContaining("PDF") });
    const recusado = await criarFonteArquivo({ registroUploadId: up.id, enviavelAoLead: false }, { provedor: provedorQueExtrai("x", true) });
    expect(await prisma.fonteConhecimento.findUnique({ where: { id: idDe(recusado) } })).toMatchObject({ status: "ERRO", erro: expect.stringContaining("recusou") });
    expect(await prisma.trechoConhecimento.count()).toBe(0);
  });

  it("arquivo_ausente_no_armazenamento_vira_erro", async () => {
    logado(admin);
    const up = await upload("sumiu.txt", null);
    const r = await criarFonteArquivo({ registroUploadId: up.id, enviavelAoLead: false });
    expect(await prisma.fonteConhecimento.findUnique({ where: { id: idDe(r) } })).toMatchObject({ status: "ERRO" });
  });

  it("arquivar_nao_apaga", async () => {
    logado(admin);
    const id = idDe(await criarFonteTexto({ nome: "A", texto: "conteúdo", enviavelAoLead: false }));
    expect((await arquivarFonte(id)).ok).toBe(true);
    expect(await prisma.fonteConhecimento.findUnique({ where: { id } })).toMatchObject({ arquivadaEm: expect.any(Date) });
    expect(await prisma.trechoConhecimento.count({ where: { fonteId: id } })).toBe(1);
    expect((await eventosDo("FonteConhecimento", id)).map((e) => e.tipo)).toContain("FonteConhecimentoArquivada");
    // #166 (5º lote): o reenvio de quem arquivou devolve ok sem outro Evento; outra pessoa segue recusada.
    expect((await arquivarFonte(id)).ok).toBe(true);
    expect((await eventosDo("FonteConhecimento", id)).filter((e) => e.tipo === "FonteConhecimentoArquivada")).toHaveLength(1);
    logado(await criarUsuario([Papel.ADMINISTRADOR], "Outra administração"));
    expect(await arquivarFonte(id)).toEqual({ ok: false, erro: "A fonte já está arquivada." });
  });

  it("vendedor_nao_cria_fonte", async () => {
    logado(vendedor);
    expect((await criarFonteTexto({ nome: "x", texto: "y", enviavelAoLead: false })).ok).toBe(false);
    expect(await prisma.fonteConhecimento.count()).toBe(0);
  });
});

describe("fontes de arquivo: autorização por objeto (B1)", () => {
  const recusado = { ok: false, erro: "Arquivo não encontrado." };

  it("gerente_nao_usa_comprovante_de_cobranca", async () => {
    logado(gerente);
    const proprio = await upload("comprovante.txt", "Pago via PIX.", { autorId: gerente.id, cobrancaId: "cob-x", categoriaDocumento: CategoriaDocumento.COMPROVANTE });
    const doFinanceiro = await upload("comprovante2.txt", "Pago via PIX.", { cobrancaId: "cob-y", categoriaDocumento: CategoriaDocumento.COMPROVANTE });
    expect(await criarFonteArquivo({ registroUploadId: proprio.id, enviavelAoLead: true })).toEqual(recusado);
    expect(await criarFonteArquivo({ registroUploadId: doFinanceiro.id, enviavelAoLead: true })).toEqual(recusado);
    await nadaGravado();
  });

  it("gerente_nao_usa_documento_de_aluno_lead_ou_matricula", async () => {
    logado(gerente);
    for (const vinculo of [{ alunoId: "aluno-x" }, { leadId: "lead-x" }, { matriculaId: "mat-x" }]) {
      const up = await upload("rg.txt", "RG 12.345.678-9", { autorId: gerente.id, ...vinculo, categoriaDocumento: CategoriaDocumento.OUTRO });
      expect(await criarFonteArquivo({ registroUploadId: up.id, enviavelAoLead: true })).toEqual(recusado);
    }
    await nadaGravado();
  });

  it("nao_usa_upload_de_outro_autor_nem_referenciado", async () => {
    logado(gerente);
    const deOutro = await upload("faq.txt", "Mensalidade vence dia 10.");
    expect(await criarFonteArquivo({ registroUploadId: deOutro.id, enviavelAoLead: false })).toEqual(recusado);
    const referenciado = await upload("contrato.txt", "Cláusula 1.", { autorId: gerente.id });
    // Mesmo um documento que o gerente pode ler (lead dele) não vira fonte: o arquivo já tem finalidade.
    const lead = await prisma.oportunidade.create({ data: { nome: "Lead do gerente", vendedorDonoId: gerente.id } });
    await prisma.documento.create({ data: { categoria: CategoriaDocumento.PROPOSTA, nome: "contrato.txt", url: referenciado.url, leadId: lead.id } });
    expect(await criarFonteArquivo({ registroUploadId: referenciado.id, enviavelAoLead: false })).toEqual(recusado);
    await nadaGravado();
  });

  it("upload_proprio_livre_continua_aceito", async () => {
    logado(gerente);
    const up = await upload("faq.txt", "Mensalidade vence dia 10.", { autorId: gerente.id });
    expect((await criarFonteArquivo({ registroUploadId: up.id, enviavelAoLead: true })).ok).toBe(true);
    expect(await prisma.trechoConhecimento.count()).toBe(1);
  });
});

describe("validade das fontes (C2)", () => {
  it("recusa_validade_no_passado_ou_invalida", async () => {
    logado(admin);
    const passado = new Date(Date.now() - 60_000);
    const msg = { ok: false, erro: "A validade da fonte precisa ser uma data futura." };
    expect(await criarFonteTexto({ nome: "A", texto: "x", enviavelAoLead: false, validoAte: passado })).toEqual(msg);
    expect(await criarFonteTexto({ nome: "A", texto: "x", enviavelAoLead: false, validoAte: new Date("x") })).toEqual(msg);
    const up = await upload("faq.txt", "Mensalidade vence dia 10.");
    expect(await criarFonteArquivo({ registroUploadId: up.id, enviavelAoLead: false, validoAte: passado })).toEqual(msg);
    await nadaGravado();
    expect((await criarFonteTexto({ nome: "A", texto: "x", enviavelAoLead: false, validoAte: new Date(Date.now() + 864e5) })).ok).toBe(true);
  });
});

describe("tetos de tamanho (C6)", () => {
  it("texto_acima_de_200_mil_caracteres_recusado", async () => {
    logado(admin);
    expect(await criarFonteTexto({ nome: "Grande", texto: "a".repeat(200_001), enviavelAoLead: false })).toEqual({
      ok: false,
      erro: "O texto da fonte aceita até 200 mil caracteres.",
    });
    const up = await upload("grande.txt", "b".repeat(200_001));
    expect(await criarFonteArquivo({ registroUploadId: up.id, enviavelAoLead: false })).toEqual({
      ok: false,
      erro: "O texto da fonte aceita até 200 mil caracteres.",
    });
    await nadaGravado();
    expect((await criarFonteTexto({ nome: "No limite", texto: "a ".repeat(100_000), enviavelAoLead: false })).ok).toBe(true);
  });

  it("pdf_acima_de_10_mb_nao_vai_ao_provedor", async () => {
    logado(admin);
    const up = await upload("enorme.pdf", Buffer.alloc(10 * 1024 * 1024 + 1, 0x20));
    const provedor = provedorQueExtrai("nunca");
    expect(await criarFonteArquivo({ registroUploadId: up.id, enviavelAoLead: false }, { provedor })).toEqual({
      ok: false,
      erro: "O PDF aceita até 10 MB.",
    });
    expect(provedor.pedidos).toHaveLength(0);
    expect(await prisma.chamadaIA.count()).toBe(0);
    await nadaGravado();
  });

  it("texto_extraido_do_pdf_acima_do_teto_vira_erro", async () => {
    logado(admin);
    const up = await upload("longo.pdf", Buffer.from("%PDF"));
    const r = await criarFonteArquivo({ registroUploadId: up.id, enviavelAoLead: false }, { provedor: provedorQueExtrai("c".repeat(200_001)) });
    expect(await prisma.fonteConhecimento.findUnique({ where: { id: idDe(r) } })).toMatchObject({
      status: "ERRO",
      erro: "O texto extraído do PDF passa de 200 mil caracteres. Divida o documento em partes menores.",
    });
    expect(await prisma.trechoConhecimento.count()).toBe(0);
  });

  it("fonte_acima_do_teto_de_trechos_recusada", async () => {
    logado(admin);
    expect(await criarFonteTexto({ nome: "Muitos", texto: "§MUITOS-TRECHOS§", enviavelAoLead: false })).toEqual({
      ok: false,
      erro: "A fonte gera mais de 400 trechos. Divida o conteúdo em fontes menores.",
    });
    await nadaGravado();
  });
});
