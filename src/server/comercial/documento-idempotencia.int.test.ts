import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoriaDocumento, Papel } from "@prisma/client";

// #166 (4º lote): documentos da oportunidade são idempotentes por natureza. O mesmo upload (a URL é única por
// envio) não vira um segundo documento nem um segundo Evento; arquivar o já arquivado não grava de novo.

// Sessão: só `exigirSessao` é trocada (mesmo motivo de criar-lead-idempotencia.int.test.ts).
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  return {
    ...o,
    exigirSessao: async () => {
      const u = await o.carregarUsuarioFresco(sessao.usuarioId);
      if (!u) throw new o.ErroAutenticacao();
      return u;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { anexarDocumentoLead, arquivarDocumentoLead } from "./acoes";

let leadId: string;
let vendedorId: string;

beforeEach(async () => {
  await truncarBanco();
  const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  vendedorId = vendedor.id;
  leadId = (await prisma.oportunidade.create({ data: { nome: "Ana", vendedorDonoId: vendedor.id } })).id;
  sessao.usuarioId = vendedor.id;
});

async function upload() {
  const url = `/api/files/${randomUUID()}.pdf`;
  await prisma.registroUpload.create({ data: { url, autorId: vendedorId, nome: "Proposta.pdf", mime: "application/pdf", tamanho: 30 } });
  return { url, nome: "Proposta.pdf", categoria: CategoriaDocumento.PROPOSTA };
}

const documentos = () => prisma.documento.count({ where: { leadId } });
const eventos = (tipo: string) => prisma.evento.count({ where: { tipo, agregadoTipo: "Lead", agregadoId: leadId } });

describe("anexarDocumentoLead: o mesmo upload anexa uma vez (#166)", () => {
  it("o reenvio, inclusive simultâneo, devolve ok com um documento e um Evento", async () => {
    const doc = await upload();
    const [a, b] = await Promise.all([anexarDocumentoLead(leadId, doc), anexarDocumentoLead(leadId, doc)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(await anexarDocumentoLead(leadId, doc)).toEqual(a);
    expect(await documentos()).toBe(1);
    expect(await eventos("DocumentoAnexado")).toBe(1);
  });

  it("o mesmo upload com outro nome é recusado, sem gravar; outro upload anexa normalmente", async () => {
    const doc = await upload();
    expect((await anexarDocumentoLead(leadId, doc)).ok).toBe(true);
    const outroNome = await anexarDocumentoLead(leadId, { ...doc, nome: "Outro nome.pdf" });
    expect(outroNome.ok).toBe(false);
    if (!outroNome.ok) expect(outroNome.erro).toMatch(/já está anexado/);
    expect(await documentos()).toBe(1);
    expect((await anexarDocumentoLead(leadId, await upload())).ok).toBe(true);
    expect(await documentos()).toBe(2);
    expect(await eventos("DocumentoAnexado")).toBe(2);
  });
});

describe("arquivarDocumentoLead: arquivar de novo não grava (#166)", () => {
  it("o reenvio devolve ok sem outro DocumentoArquivado", async () => {
    expect((await anexarDocumentoLead(leadId, await upload())).ok).toBe(true);
    const { id } = await prisma.documento.findFirstOrThrow({ where: { leadId } });
    const primeira = await arquivarDocumentoLead(id);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    expect(await arquivarDocumentoLead(id)).toEqual(primeira);
    expect(await eventos("DocumentoArquivado")).toBe(1);
  });
});
