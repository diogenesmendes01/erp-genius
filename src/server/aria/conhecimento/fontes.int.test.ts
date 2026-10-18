import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR } from "@/lib/uploads";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import type { PedidoIA, ProvedorIA } from "../provedor";
import { arquivarFonte, criarFonteArquivo, criarFonteTexto } from "./fontes";

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
let admin: Usuario;
let vendedor: Usuario;
const logado = (u: Usuario) => authMock.mockResolvedValue({ user: { id: u.id } });
const escritos: string[] = [];
const idDe = (r: { ok: boolean; dado?: { id: string } }) => r.dado!.id;

async function upload(nome: string, conteudo: string | Buffer | null) {
  const arquivo = `fonte-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(nome)}`;
  if (conteudo !== null) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, arquivo), conteudo);
    escritos.push(arquivo);
  }
  return prisma.registroUpload.create({
    data: { url: `/api/files/${arquivo}`, nome, mime: "application/octet-stream", tamanho: 10, autorId: admin.id },
  });
}

function provedorQueExtrai(texto: string, recusa = false): ProvedorIA & { pedidos: PedidoIA[] } {
  const pedidos: PedidoIA[] = [];
  return {
    nome: "simulado",
    pedidos,
    async gerar(p) {
      pedidos.push(p);
      return {
        texto: JSON.stringify({ texto }),
        modelo: "claude-sonnet-5-5",
        provedor: "anthropic",
        recusa,
        tokensEntrada: 1000,
        tokensSaida: 200,
        tokensCache: 0,
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
});

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
    expect((await arquivarFonte(id)).ok).toBe(false);
  });

  it("vendedor_nao_cria_fonte", async () => {
    logado(vendedor);
    expect((await criarFonteTexto({ nome: "x", texto: "y", enviavelAoLead: false })).ok).toBe(false);
    expect(await prisma.fonteConhecimento.count()).toBe(0);
  });
});
