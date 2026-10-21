import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { chamar } = vi.hoisted(() => ({ chamar: vi.fn() }));
vi.mock("./motor/cliente", async (orig) => ({ ...(await orig<typeof import("./motor/cliente")>()), chamarMotor: chamar }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { setoresDoNumero } from "./numero-setor";
import { salvarSetoresNumero } from "./acoes-numero";
import { conectarNumeroQr, consultarSessaoNumero, desconectarNumero, parearNumeroPorCodigo, salvarNumeroWhatsApp } from "./acoes";
import { ErroMotor } from "./motor/cliente";
import { listarResponsaveisTriagem } from "./consultas";

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
    const ev = (await eventosDo("NumeroWhatsApp", n.id)).filter((e) => e.tipo === "NumeroSetoresAlterados");
    expect(ev).toHaveLength(1);
    expect(ev[0].payload).toEqual({ de: ["COMERCIAL"], para: ["FINANCEIRO", "SECRETARIA"] });
    const tri = (await eventosDo("NumeroWhatsApp", n.id)).filter((e) => e.tipo === "NumeroTriagemAlterada");
    expect(tri).toHaveLength(1);
    expect(tri[0].payload).toEqual({ de: null, para: sec.id });
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
    const r = await salvarSetoresNumero({ numeroId: n.id, setores: ["SECRETARIA", "FINANCEIRO"], triagemResponsavelId: sec.id });
    expect(r.ok).toBe(false);
    expect(await setoresDoNumero(prisma, n.id)).toEqual(["COMERCIAL"]);
  });

  it("repetir o mesmo setor na lista não duplica linhas", async () => {
    const r = await salvarSetoresNumero({ numeroId: n.id, setores: ["COMERCIAL", "COMERCIAL"], triagemResponsavelId: null });
    expect(r.ok).toBe(true);
    expect(await prisma.numeroSetorWhatsApp.count({ where: { numeroId: n.id } })).toBe(1);
  });

  it("recusa responsável pela triagem sem papel de um dos setores do número", async () => {
    const r = await salvarSetoresNumero({ numeroId: n.id, setores: ["COMERCIAL", "FINANCEIRO"], triagemResponsavelId: sec.id });
    expect(r).toEqual({ ok: false, erro: "O responsável pela triagem precisa ter papel de um dos setores do número." });
    expect(await setoresDoNumero(prisma, n.id)).toEqual(["COMERCIAL"]);
    expect((await salvarSetoresNumero({ numeroId: n.id, setores: ["COMERCIAL", "FINANCEIRO"], triagemResponsavelId: gerente.id })).ok).toBe(true);
  });
});

describe("listarResponsaveisTriagem", () => {
  it("lista só usuários ativos com papel de setor, filtrando pelos setores pedidos", async () => {
    await criarUsuario([Papel.ALUNO], "Aluno");
    await criarUsuario([Papel.PROFESSOR], "Professora");
    const gp = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gerente pedagógica");
    const inativo = await criarUsuario([Papel.FINANCEIRO], "Financeiro inativo");
    await prisma.usuario.update({ where: { id: inativo.id }, data: { ativo: false } });

    const todos = await listarResponsaveisTriagem();
    expect(todos.map((u) => u.nome)).toEqual(["Gerente", "Gerente pedagógica", "Secretaria"]);
    expect(todos.find((u) => u.id === gp.id)?.papeis).toEqual([Papel.GERENTE_PEDAGOGICO]);

    expect((await listarResponsaveisTriagem(["SECRETARIA", "FINANCEIRO"])).map((u) => u.id)).toEqual([sec.id]);
    expect((await listarResponsaveisTriagem(["COMERCIAL", "PEDAGOGICO"])).map((u) => u.id)).toEqual([gerente.id, gp.id]);

    authMock.mockResolvedValue({ user: { id: gerente.id } });
    await expect(listarResponsaveisTriagem()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
function dadoDe<T>(r: { ok: boolean; dado?: T; erro?: string }): T {
  if (!r.ok) throw new Error(r.erro);
  return r.dado as T;
}

// Task 18 — ciclo do número no motor (motor simulado: nenhuma chamada real)
// ---------------------------------------------------------------------------
describe("ciclo do número no motor", () => {
  beforeEach(async () => {
    chamar.mockReset();
    chamar.mockResolvedValue({});
    authMock.mockResolvedValue({ user: { id: admin.id } });
  });

  it("número novo nasce MOTOR com providerRef = id e é cadastrado no motor", async () => {
    const r = await salvarNumeroWhatsApp({ telefoneE164: "+5511999990001", rotulo: "Secretaria", finalidade: "COBRANCA" });
    expect(r.ok, r.ok ? "" : r.erro).toBe(true);
    const num = await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: dadoDe(r).id } });
    expect(num).toMatchObject({ driver: "MOTOR", providerRef: num.id });
    expect(chamar).toHaveBeenCalledWith(`/v1/numeros/${num.id}`, expect.objectContaining({ metodo: "PUT", json: { rotulo: "Secretaria" } }));
  });

  it("editar número legado preserva driver e providerRef e não o cadastra no motor", async () => {
    const legado = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511999990010", rotulo: "Antigo", driver: DriverWhatsApp.META_CLOUD, providerRef: "phone-number-id-123", finalidade: "COBRANCA" },
    });
    const r = await salvarNumeroWhatsApp({ id: legado.id, telefoneE164: "+5511999990010", rotulo: "Renomeado", finalidade: "COBRANCA" });
    expect(r.ok, r.ok ? "" : r.erro).toBe(true);
    const depois = await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: legado.id } });
    expect(depois).toMatchObject({ driver: DriverWhatsApp.META_CLOUD, providerRef: "phone-number-id-123", rotulo: "Renomeado" });
    expect(chamar).not.toHaveBeenCalled();
  });

  it("motor fora do ar ao salvar não desfaz o número (cadastro refeito no conectar)", async () => {
    chamar.mockRejectedValue(new ErroMotor("INDISPONIVEL", 0));
    const r = await salvarNumeroWhatsApp({ telefoneE164: "+5511999990002", rotulo: "Vendas", finalidade: "VENDAS" });
    expect(r.ok).toBe(true);
    expect(await prisma.numeroWhatsApp.count({ where: { id: dadoDe(r).id } })).toBe(1);
    chamar.mockReset();
    chamar.mockImplementation(async (_rota: string, init: { metodo: string }) =>
      init.metodo === "GET" ? { sessao: { status: "qr", qr: "data:image/png;base64,QUFB" } } : {},
    );
    const c = await conectarNumeroQr(dadoDe(r).id);
    expect(c.ok).toBe(true);
    expect(chamar).toHaveBeenCalledWith(`/v1/numeros/${dadoDe(r).id}`, expect.objectContaining({ metodo: "PUT" }));
  });

  it("conectar devolve QR data URL do GET e grava AGUARDANDO_QR", async () => {
    const num = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990003", rotulo: "Cobrança", driver: "MOTOR", finalidade: "COBRANCA" } });
    chamar.mockImplementation(async (_rota: string, init: { metodo: string }) =>
      init.metodo === "GET" ? { sessao: { status: "qr", qr: "data:image/png;base64,QUFB" } } : {},
    );
    const r = await conectarNumeroQr(num.id);
    expect(r.ok, r.ok ? "" : r.erro).toBe(true);
    expect(dadoDe(r)).toMatchObject({ qrBase64: "data:image/png;base64,QUFB", estado: "AGUARDANDO_QR", erro: null });
    expect((await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: num.id } })).sessao).toBe("AGUARDANDO_QR");
  });

  it("pareamento por código devolve codigoPareamento", async () => {
    const num = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990004", rotulo: "Cobrança", driver: "MOTOR", finalidade: "COBRANCA" } });
    chamar.mockImplementation(async (rota: string) => (rota.endsWith("/pareamento") ? { codigoPareamento: "ABCD-1234" } : {}));
    const r = await parearNumeroPorCodigo(num.id, "+5511999990004");
    expect(r.ok, r.ok ? "" : r.erro).toBe(true);
    expect(dadoDe(r)).toMatchObject({ codigoPareamento: "ABCD-1234", estado: "AGUARDANDO_QR" });
  });

  it("consultar devolve a sessão do motor", async () => {
    const num = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990006", rotulo: "Cobrança", driver: "MOTOR", finalidade: "COBRANCA", sessao: "AGUARDANDO_QR" } });
    chamar.mockResolvedValue({ sessao: { status: "connected" } });
    const r = await consultarSessaoNumero(num.id);
    expect(dadoDe(r)).toMatchObject({ sessao: "CONECTADO" });
  });

  it("desconectar grava Evento e sessão DESCONECTADO", async () => {
    const num = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990005", rotulo: "Cobrança", driver: "MOTOR", finalidade: "COBRANCA", sessao: "CONECTADO" } });
    const r = await desconectarNumero(num.id);
    expect(r.ok, r.ok ? "" : r.erro).toBe(true);
    expect(chamar).toHaveBeenCalledWith(`/v1/numeros/${num.id}/desconectar`, expect.objectContaining({ metodo: "POST" }));
    expect((await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: num.id } })).sessao).toBe("DESCONECTADO");
    expect((await eventosDo("NumeroWhatsApp", num.id)).map((e) => e.tipo)).toContain("NumeroWhatsAppDesconectado");
  });

  it("não-ADMINISTRADOR é recusado", async () => {
    const num = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990007", rotulo: "Cobrança", driver: "MOTOR", finalidade: "COBRANCA" } });
    authMock.mockResolvedValue({ user: { id: gerente.id } });
    expect((await salvarNumeroWhatsApp({ telefoneE164: "+5511999990008", rotulo: "Outro", finalidade: "COBRANCA" })).ok).toBe(false);
    expect((await conectarNumeroQr(num.id)).ok).toBe(false);
    expect((await parearNumeroPorCodigo(num.id, "+5511999990007")).ok).toBe(false);
    expect((await consultarSessaoNumero(num.id)).ok).toBe(false);
    expect((await desconectarNumero(num.id)).ok).toBe(false);
    expect(chamar).not.toHaveBeenCalled();
  });
});
