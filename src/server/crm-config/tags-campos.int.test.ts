import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { arquivarCampo, arquivarTag, salvarCampo, salvarTag } from "./tags-campos";

type U = Awaited<ReturnType<typeof criarUsuario>>;
let admin: U, gerente: U, vend1: U;
const logado = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const t = { nome: "Inglês", grupo: "Interesse", cor: "INFO" } as const;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vend1 = await criarUsuario([Papel.VENDEDOR], "V1");
  logado(admin);
});

async function campoTexto() {
  const r = await salvarCampo({ nome: "Observação", tipo: "TEXTO", opcoes: [], alvo: "PESSOA", obrigatorio: false });
  if (!r.ok || !r.dado) throw new Error("falha");
  return prisma.campoPersonalizado.findUniqueOrThrow({ where: { id: r.dado!.id } });
}
async function valorPreenchido(campoId: string) {
  const pessoa = await prisma.pessoa.create({ data: { nome: "Fulano" } });
  await prisma.valorCampoPersonalizado.create({ data: { campoId, pessoaId: pessoa.id, valor: "x" } });
}

describe("Tags e campos personalizados", () => {
  it("nome_unico_sem_caixa_e_acento", async () => {
    logado(gerente);
    expect((await salvarTag(t)).ok).toBe(true);
    expect((await salvarTag({ nome: "ingles", grupo: "Interesse", cor: "ALERTA" })).ok).toBe(false);
  });

  it("edita_tag_com_evento_de_para_e_arquiva", async () => {
    const r = await salvarTag(t);
    if (!r.ok || !r.dado) throw new Error("falha");
    expect((await salvarTag({ id: r.dado!.id, nome: "Inglês 2", grupo: "Interesse", cor: "SUCESSO" })).ok).toBe(true);
    expect((await arquivarTag(r.dado!.id)).ok).toBe(true);
    expect((await prisma.tag.findUniqueOrThrow({ where: { id: r.dado!.id } })).ativo).toBe(false);
    const ev = await eventosDo("Tag", r.dado!.id);
    expect(ev.map((e) => e.tipo)).toEqual(["TagSalva", "TagSalva", "TagArquivada"]);
    expect(ev[1].payload).toMatchObject({ de: { nome: "Inglês" }, para: { nome: "Inglês 2", cor: "SUCESSO" } });
  });

  it("cor_invalida_rejeitada", async () => {
    expect((await salvarTag({ ...t, cor: "#zzz" as never })).ok).toBe(false);
  });

  it("lista_exige_opcao", async () => {
    expect((await salvarCampo({ nome: "Nível", tipo: "SELECAO", opcoes: [], alvo: "PESSOA", obrigatorio: false })).ok).toBe(false);
    expect((await salvarCampo({ nome: "Nível", tipo: "SELECAO", opcoes: ["A1", "A2"], alvo: "PESSOA", obrigatorio: false })).ok).toBe(true);
  });

  it("trocar_tipo_com_valores_bloqueado", async () => {
    const campo = await campoTexto();
    const igual = { id: campo.id, nome: campo.nome, tipo: campo.tipo, opcoes: [], alvo: campo.alvo, obrigatorio: false };
    expect((await salvarCampo({ ...igual, tipo: "NUMERO" })).ok).toBe(true);
    await salvarCampo({ ...igual, tipo: "TEXTO" });
    await valorPreenchido(campo.id);
    expect((await salvarCampo({ ...igual, tipo: "NUMERO" })).ok).toBe(false);
    expect((await salvarCampo({ ...igual, obrigatorio: true })).ok).toBe(true);
  });

  it("arquivar_campo_exige_digitar_nome_e_nao_apaga_valores", async () => {
    const campo = await campoTexto();
    await valorPreenchido(campo.id);
    expect((await arquivarCampo(campo.id, "x")).ok).toBe(false);
    expect((await arquivarCampo(campo.id, campo.nome)).ok).toBe(true);
    expect(await prisma.valorCampoPersonalizado.count({ where: { campoId: campo.id } })).toBe(1);
    expect((await prisma.campoPersonalizado.findUniqueOrThrow({ where: { id: campo.id } })).arquivadoEm).not.toBeNull();
    const ev = await eventosDo("CampoPersonalizado", campo.id);
    expect(ev.map((e) => e.tipo)).toEqual(["CampoSalvo", "CampoArquivado"]);
  });

  it("vendedor_nao_configura", async () => {
    logado(vend1);
    expect((await salvarTag(t)).ok).toBe(false);
    expect((await salvarCampo({ nome: "X", tipo: "TEXTO", opcoes: [], alvo: "PESSOA", obrigatorio: false })).ok).toBe(false);
    expect(await prisma.tag.count()).toBe(0);
  });
});
