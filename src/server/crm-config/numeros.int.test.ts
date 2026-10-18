import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR, resolverCaminhoUpload } from "@/lib/uploads";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { ErroMotor } from "@/server/whatsapp/motor/cliente";
import { ErroMotorParcial, type ClienteMotorNumero } from "@/server/whatsapp/motor/numero";
import { salvarSetoresNumero } from "@/server/whatsapp/acoes-numero";
import { atualizarPerfilNumero, atualizarPrivacidadeNumero, definirTemporariasNumero } from "./perfil-numero";

let admin: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let sec: Awaited<ReturnType<typeof criarUsuario>>;
let numeroId: string;
const logado = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const arquivos: string[] = [];

const chamadas: string[] = [];
const motor: ClienteMotorNumero = {
  atualizarPerfil: vi.fn(async () => void chamadas.push("perfil")),
  atualizarPrivacidade: vi.fn(async () => void chamadas.push("privacidade")),
  definirTemporarias: vi.fn(async () => void chamadas.push("temporarias")),
};
const deps = { motor };
const motorQueFalha: ClienteMotorNumero = {
  atualizarPerfil: async () => { throw new ErroMotor("HTTP", 500); },
  atualizarPrivacidade: async () => { throw new ErroMotor("HTTP", 500); },
  definirTemporarias: async () => { throw new ErroMotor("ACAO_NAO_DISPONIVEL", 403); },
};
const numero = () => prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: numeroId } });
const ultimoEvento = async (tipo: string) => (await eventosDo("NumeroWhatsApp", numeroId)).filter((e) => e.tipo === tipo).at(-1)!;
const priv = { vistoPorUltimo: "CONTATOS", foto: "TODOS", recado: "CONTATOS", grupos: "CONTATOS" } as const;

beforeEach(async () => {
  await truncarBanco();
  chamadas.length = 0;
  vi.clearAllMocks();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  const n = await criarNumeroSetor({ telefoneE164: "+5511900000038", setores: ["COMERCIAL"] });
  await prisma.numeroWhatsApp.update({ where: { id: n.id }, data: { sessao: "CONECTADO" } });
  numeroId = n.id;
  logado(admin);
});

afterEach(async () => {
  for (const a of arquivos.splice(0)) await unlink(a).catch(() => undefined);
});

describe("Configurações › Números", () => {
  it("so_admin", async () => {
    logado(gerente);
    const rs = [
      await salvarSetoresNumero({ numeroId, setores: ["COMERCIAL"], triagemResponsavelId: null }),
      await atualizarPerfilNumero({ numeroId, nome: "Escola" }, deps),
      await atualizarPrivacidadeNumero({ numeroId, privacidade: priv }, deps),
      await definirTemporariasNumero({ numeroId, segundos: 86400, confirmacao: "ativar temporárias" }, deps),
    ];
    for (const r of rs) expect(r.ok).toBe(false);
    expect(chamadas).toEqual([]);
  });

  // Setores e triagem: uma só ação (salvarSetoresNumero, a que a tela usa); C4 da revisão do #233.
  const setores = (lista: ("COMERCIAL" | "SECRETARIA" | "FINANCEIRO" | "PEDAGOGICO")[], triagemResponsavelId: string | null = null) =>
    salvarSetoresNumero({ numeroId, setores: lista, triagemResponsavelId });

  it("setores_ao_menos_um_e_evento", async () => {
    expect((await setores([])).ok).toBe(false);
    expect((await setores(["COMERCIAL", "FINANCEIRO"])).ok).toBe(true);
    expect((await ultimoEvento("NumeroSetoresAlterados")).payload).toMatchObject({ de: ["COMERCIAL"], para: ["COMERCIAL", "FINANCEIRO"] });
  });

  it("triagem_so_com_mais_de_um_setor_e_usuario_ativo", async () => {
    // Com 1 setor a triagem é ignorada (fica com o administrador).
    expect((await setores(["COMERCIAL"], sec.id)).ok).toBe(true);
    expect((await numero()).triagemResponsavelId).toBeNull();
    expect((await setores(["SECRETARIA", "FINANCEIRO"], admin.id)).ok).toBe(false);
    expect((await setores(["SECRETARIA", "FINANCEIRO"], sec.id)).ok).toBe(true);
    expect((await numero()).triagemResponsavelId).toBe(sec.id);
    expect((await ultimoEvento("NumeroTriagemAlterada")).payload).toMatchObject({ de: null, para: sec.id });
    // voltar a 1 setor limpa a triagem
    await setores(["SECRETARIA"], sec.id);
    expect((await numero()).triagemResponsavelId).toBeNull();
    // usuário inativo
    await prisma.usuario.update({ where: { id: sec.id }, data: { ativo: false } });
    expect((await setores(["SECRETARIA", "FINANCEIRO"], sec.id)).ok).toBe(false);
  });

  it("troca_de_setores_recusa_triagem_que_perdeu_o_papel", async () => {
    await setores(["SECRETARIA", "FINANCEIRO"], sec.id);
    expect((await setores(["COMERCIAL", "PEDAGOGICO"], sec.id)).ok).toBe(false);
    expect((await numero()).triagemResponsavelId).toBe(sec.id);
    expect((await setores(["COMERCIAL", "PEDAGOGICO"], null)).ok).toBe(true);
    expect((await numero()).triagemResponsavelId).toBeNull();
    expect((await ultimoEvento("NumeroTriagemAlterada")).payload).toEqual({ de: sec.id, para: null });
    // responsável que segue válido é mantido
    await setores(["SECRETARIA", "FINANCEIRO"], sec.id);
    await setores(["SECRETARIA", "COMERCIAL"], sec.id);
    expect((await numero()).triagemResponsavelId).toBe(sec.id);
  });

  it("temporarias_desligadas_por_padrao", async () => expect((await numero()).temporariasSegundos).toBe(0));

  it("ligar_temporarias_exige_digitar", async () => {
    expect((await definirTemporariasNumero({ numeroId, segundos: 86400, confirmacao: "sim" }, deps)).ok).toBe(false);
    expect((await numero()).temporariasSegundos).toBe(0);
    expect((await definirTemporariasNumero({ numeroId, segundos: 86400, confirmacao: "ativar temporárias" }, deps)).ok).toBe(true);
    expect((await numero()).temporariasSegundos).toBe(86400);
    expect((await ultimoEvento("NumeroTemporariasAlteradas")).payload).toEqual({ de: 0, para: 86400 });
    expect((await definirTemporariasNumero({ numeroId, segundos: 0, confirmacao: "" }, deps)).ok).toBe(true);
    expect((await numero()).temporariasSegundos).toBe(0);
  });

  it("falha_no_motor_nao_grava", async () => {
    const r = await atualizarPerfilNumero({ numeroId, nome: "Escola" }, { motor: motorQueFalha });
    expect(r.ok).toBe(false);
    expect((await numero()).perfilNome).toBeNull();
    expect(await eventosDo("NumeroWhatsApp", numeroId).then((e) => e.filter((x) => x.tipo === "NumeroPerfilAlterado"))).toHaveLength(0);
    expect((await atualizarPrivacidadeNumero({ numeroId, privacidade: priv }, { motor: motorQueFalha })).ok).toBe(false);
    expect((await numero()).privacidade).toBeNull();
    const t = await definirTemporariasNumero({ numeroId, segundos: 86400, confirmacao: "ativar temporárias" }, { motor: motorQueFalha });
    expect(t).toEqual({ ok: false, erro: "Recurso ainda não disponível no motor." });
    expect((await numero()).temporariasSegundos).toBe(0);
  });

  it("recado_ate_139_e_nome_1_a_25", async () => {
    expect((await atualizarPerfilNumero({ numeroId, recado: "x".repeat(140) }, deps)).ok).toBe(false);
    expect((await atualizarPerfilNumero({ numeroId, nome: "x".repeat(26) }, deps)).ok).toBe(false);
    expect((await atualizarPerfilNumero({ numeroId, nome: "" }, deps)).ok).toBe(false);
    expect((await atualizarPerfilNumero({ numeroId, nome: "Escola", recado: "x".repeat(139) }, deps)).ok).toBe(true);
    const n = await numero();
    expect(n.perfilNome).toBe("Escola");
    expect((await ultimoEvento("NumeroPerfilAlterado")).payload).toMatchObject({ de: { nome: null }, para: { nome: "Escola" } });
  });

  it("foto_jpeg_png_ate_128kb", async () => {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const nome = `${randomUUID()}.png`;
    const caminho = resolverCaminhoUpload([nome])!;
    arquivos.push(caminho);
    await writeFile(caminho, Buffer.from("png"));
    const ok = await prisma.registroUpload.create({ data: { url: `/api/files/${nome}`, autorId: admin.id, nome: "f.png", mime: "image/png", tamanho: 3 } });
    const pdf = await prisma.registroUpload.create({ data: { url: `/api/files/${randomUUID()}.pdf`, autorId: admin.id, nome: "f.pdf", mime: "application/pdf", tamanho: 3 } });
    const grande = await prisma.registroUpload.create({ data: { url: `/api/files/${randomUUID()}.png`, autorId: admin.id, nome: "g.png", mime: "image/png", tamanho: 128 * 1024 + 1 } });
    expect((await atualizarPerfilNumero({ numeroId, fotoUploadId: pdf.id }, deps)).ok).toBe(false);
    expect(await atualizarPerfilNumero({ numeroId, fotoUploadId: grande.id }, deps)).toEqual({ ok: false, erro: "A foto pode ter no máximo 128 KB. Reduza a imagem e tente de novo." });
    expect(motor.atualizarPerfil).not.toHaveBeenCalled();
    expect((await atualizarPerfilNumero({ numeroId, fotoUploadId: ok.id }, deps)).ok).toBe(true);
    expect((await numero()).perfilFotoUploadId).toBe(ok.id);
    expect(motor.atualizarPerfil).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ fotoDataUri: expect.stringMatching(/^data:image\/png;base64,/) }));
  });

  it("falha_parcial_no_motor_grava_so_o_que_foi_aplicado", async () => {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const nome = `${randomUUID()}.png`;
    const caminho = resolverCaminhoUpload([nome])!;
    arquivos.push(caminho);
    await writeFile(caminho, Buffer.from("png"));
    const foto = await prisma.registroUpload.create({ data: { url: `/api/files/${nome}`, autorId: admin.id, nome: "f.png", mime: "image/png", tamanho: 3 } });
    const parcial: ClienteMotorNumero = {
      ...motor,
      atualizarPerfil: async () => { throw new ErroMotorParcial({ foto: true }, new Error("500")); },
      atualizarPrivacidade: async () => { throw new ErroMotorParcial({ privacidade: { vistoPorUltimo: "CONTATOS" } }, new Error("500")); },
    };
    const r = await atualizarPerfilNumero({ numeroId, nome: "Escola", fotoUploadId: foto.id }, { motor: parcial });
    expect(r.ok).toBe(false);
    expect(await numero()).toMatchObject({ perfilNome: null, perfilFotoUploadId: foto.id });
    expect((await ultimoEvento("NumeroPerfilAlterado")).payload).toMatchObject({ parcial: true, para: { nome: null, fotoUploadId: foto.id } });
    expect((await atualizarPrivacidadeNumero({ numeroId, privacidade: priv }, { motor: parcial })).ok).toBe(false);
    expect((await numero()).privacidade).toEqual({ vistoPorUltimo: "CONTATOS" });
    expect((await ultimoEvento("NumeroPrivacidadeAlterada")).payload).toMatchObject({ parcial: true });
  });

  it("privacidade_grava_e_nao_aceita_ninguem_em_grupos", async () => {
    expect((await atualizarPrivacidadeNumero({ numeroId, privacidade: { ...priv, grupos: "NINGUEM" } }, deps)).ok).toBe(false);
    expect((await atualizarPrivacidadeNumero({ numeroId, privacidade: priv }, deps)).ok).toBe(true);
    expect((await numero()).privacidade).toEqual(priv);
    expect((await ultimoEvento("NumeroPrivacidadeAlterada")).payload).toMatchObject({ de: null, para: priv });
  });
});
