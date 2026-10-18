import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { modelosDasReguas } from "@/server/whatsapp/modelos-regua";
import { arquivarRespostaRapida, listarRespostasRapidas, salvarRespostaRapida, VARIAVEIS_RESPOSTA } from "./respostas-rapidas";

type U = Awaited<ReturnType<typeof criarUsuario>>;
let admin: U, gerente: U, financeiro: U;
const logado = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const r = { atalho: "/preco", titulo: "Preço", corpo: "Oi {nome}, o valor é este.", setor: null, ariaPodeUsar: false } as const;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Fin");
  logado(admin);
});

describe("Respostas rápidas", () => {
  it("atalho_comeca_com_barra_e_unico", async () => {
    logado(gerente);
    expect((await salvarRespostaRapida({ ...r, atalho: "preco" })).ok).toBe(false);
    expect((await salvarRespostaRapida(r)).ok).toBe(true);
    expect((await salvarRespostaRapida({ ...r, titulo: "outra" })).ok).toBe(false);
  });

  it("variavel_no_formato_do_erp", async () => {
    expect(await salvarRespostaRapida({ ...r, corpo: "Oi {{nome}}" })).toEqual({ ok: false, erro: "Use variáveis no formato {nome}." });
  });

  it("variavel_desconhecida_rejeitada", async () => {
    expect((await salvarRespostaRapida({ ...r, corpo: "Oi {cpf}" })).ok).toBe(false);
    expect(VARIAVEIS_RESPOSTA).toEqual(["{nome}", "{responsavel}", "{curso}"]);
    expect((await salvarRespostaRapida({ ...r, corpo: "{nome} {responsavel} {curso}" })).ok).toBe(true);
  });

  it("tipo_resposta_rapida_nao_aparece_nas_reguas", async () => {
    const x = await salvarRespostaRapida(r);
    if (!x.ok || !x.dado) throw new Error("falha");
    const t = await prisma.templateWhatsApp.findUniqueOrThrow({ where: { id: x.dado.id } });
    expect(t).toMatchObject({ tipo: "RESPOSTA_RAPIDA", nome: "rr:/preco", atalho: "/preco" });
    expect((await modelosDasReguas()).some((m) => m.nome === t.nome)).toBe(false);
  });

  it("financeiro_ve_so_do_setor_e_gerais", async () => {
    await salvarRespostaRapida({ ...r, atalho: "/geral" });
    await salvarRespostaRapida({ ...r, atalho: "/fin", setor: "FINANCEIRO" });
    await salvarRespostaRapida({ ...r, atalho: "/com", setor: "COMERCIAL" });
    const lista = await listarRespostasRapidas({ id: financeiro.id, nome: "Fin", papeis: [Papel.FINANCEIRO] });
    expect(lista.map((x) => x.atalho).sort()).toEqual(["/fin", "/geral"]);
    expect(lista.every((x) => x.setor === null || x.setor === "FINANCEIRO")).toBe(true);
  });

  it("gerente_comercial_so_cria_no_comercial_ou_geral", async () => {
    logado(gerente);
    expect((await salvarRespostaRapida({ ...r, setor: "FINANCEIRO" })).ok).toBe(false);
    expect((await salvarRespostaRapida({ ...r, setor: "COMERCIAL" })).ok).toBe(true);
  });

  it("edita_arquiva_com_eventos_e_sai_da_lista", async () => {
    const x = await salvarRespostaRapida({ ...r, ariaPodeUsar: true });
    if (!x.ok || !x.dado) throw new Error("falha");
    expect((await salvarRespostaRapida({ ...r, id: x.dado.id, titulo: "Preço 2" })).ok).toBe(true);
    expect((await arquivarRespostaRapida(x.dado.id)).ok).toBe(true);
    expect((await arquivarRespostaRapida(x.dado.id)).ok).toBe(false);
    expect((await salvarRespostaRapida({ ...r, id: x.dado.id })).ok).toBe(false);
    expect(await listarRespostasRapidas({ id: admin.id, nome: "A", papeis: [Papel.ADMINISTRADOR] })).toEqual([]);
    const ev = await eventosDo("TemplateWhatsApp", x.dado.id);
    expect(ev.map((e) => e.tipo)).toEqual(["RespostaRapidaSalva", "RespostaRapidaSalva", "RespostaRapidaArquivada"]);
    expect(ev[1].payload).toMatchObject({ de: { titulo: "Preço", ariaPodeUsar: true }, para: { titulo: "Preço 2" } });
  });

  it("so_admin_e_gerente_comercial_salvam", async () => {
    logado(financeiro);
    expect((await salvarRespostaRapida(r)).ok).toBe(false);
  });
});
