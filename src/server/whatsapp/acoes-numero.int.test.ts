import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { setoresDoNumero } from "./numero-setor";
import { salvarSetoresNumero } from "./acoes-numero";

let admin: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let sec: Awaited<ReturnType<typeof criarUsuario>>;
let n: Awaited<ReturnType<typeof criarNumeroSetor>>;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  n = await criarNumeroSetor({ telefoneE164: "+5511900000010", setores: ["COMERCIAL"] });
  authMock.mockResolvedValue({ user: { id: admin.id } });
});

describe("salvarSetoresNumero", () => {
  it("admin troca setores e responsável pela triagem, com Evento", async () => {
    const r = await salvarSetoresNumero({ numeroId: n.id, setores: ["SECRETARIA", "FINANCEIRO"], triagemResponsavelId: sec.id });
    expect(r.ok).toBe(true);
    expect(await setoresDoNumero(prisma, n.id)).toEqual(["FINANCEIRO", "SECRETARIA"]);
    const num = await prisma.numeroWhatsApp.findUnique({ where: { id: n.id } });
    expect(num?.triagemResponsavelId).toBe(sec.id);
    const ev = (await eventosDo("NumeroWhatsApp", n.id)).filter((e) => e.tipo === "SetoresNumeroAlterados");
    expect(ev).toHaveLength(1);
    expect(ev[0].payload).toEqual({ de: ["COMERCIAL"], para: ["FINANCEIRO", "SECRETARIA"], triagemResponsavelId: sec.id });
  });

  it("recusa lista vazia e quem não é admin", async () => {
    expect(await salvarSetoresNumero({ numeroId: n.id, setores: [], triagemResponsavelId: null })).toEqual({
      ok: false,
      erro: "Escolha ao menos um setor para o número.",
    });
    authMock.mockResolvedValue({ user: { id: gerente.id } });
    expect((await salvarSetoresNumero({ numeroId: n.id, setores: ["COMERCIAL"], triagemResponsavelId: null })).ok).toBe(false);
    expect(await setoresDoNumero(prisma, n.id)).toEqual(["COMERCIAL"]);
  });

  it("com um único setor a triagem é descartada (null = administrador)", async () => {
    await prisma.numeroWhatsApp.update({ where: { id: n.id }, data: { triagemResponsavelId: sec.id } });
    const r = await salvarSetoresNumero({ numeroId: n.id, setores: ["FINANCEIRO"], triagemResponsavelId: sec.id });
    expect(r.ok).toBe(true);
    expect((await prisma.numeroWhatsApp.findUnique({ where: { id: n.id } }))?.triagemResponsavelId).toBeNull();
  });

  it("recusa setor desconhecido, número inexistente e responsável inativo", async () => {
    expect((await salvarSetoresNumero({ numeroId: n.id, setores: ["XPTO" as never], triagemResponsavelId: null })).ok).toBe(false);
    expect(await salvarSetoresNumero({ numeroId: "nao-existe", setores: ["COMERCIAL"], triagemResponsavelId: null })).toEqual({ ok: false, erro: "Número não encontrado." });
    await prisma.usuario.update({ where: { id: sec.id }, data: { ativo: false } });
    const r = await salvarSetoresNumero({ numeroId: n.id, setores: ["COMERCIAL", "FINANCEIRO"], triagemResponsavelId: sec.id });
    expect(r.ok).toBe(false);
    expect(await setoresDoNumero(prisma, n.id)).toEqual(["COMERCIAL"]);
  });

  it("repetir o mesmo setor na lista não duplica linhas", async () => {
    const r = await salvarSetoresNumero({ numeroId: n.id, setores: ["COMERCIAL", "COMERCIAL"], triagemResponsavelId: null });
    expect(r.ok).toBe(true);
    expect(await prisma.numeroSetorWhatsApp.count({ where: { numeroId: n.id } })).toBe(1);
  });
});
