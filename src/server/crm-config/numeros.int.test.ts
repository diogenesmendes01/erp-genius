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
import type { ClienteMotorNumero } from "@/server/whatsapp/motor/numero";
import { definirResponsavelTriagem, definirSetoresDoNumero } from "./numeros";
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
      await definirSetoresDoNumero({ numeroId, setores: ["COMERCIAL"] }),
      await definirResponsavelTriagem({ numeroId, usuarioId: null }),
      await atualizarPerfilNumero({ numeroId, nome: "Escola" }, deps),
      await atualizarPrivacidadeNumero({ numeroId, privacidade: priv }, deps),
      await definirTemporariasNumero({ numeroId, segundos: 86400, confirmacao: "ativar temporárias" }, deps),
    ];
    for (const r of rs) expect(r.ok).toBe(false);
    expect(chamadas).toEqual([]);
  });

  it("setores_ao_menos_um_e_evento", async () => {
    expect((await definirSetoresDoNumero({ numeroId, setores: [] })).ok).toBe(false);
    expect((await definirSetoresDoNumero({ numeroId, setores: ["COMERCIAL", "FINANCEIRO"] })).ok).toBe(true);
    expect((await ultimoEvento("NumeroSetoresAlterados")).payload).toMatchObject({ de: ["COMERCIAL"], para: ["COMERCIAL", "FINANCEIRO"] });
  });

  it("triagem_so_com_mais_de_um_setor_e_usuario_ativo", async () => {
    expect((await definirResponsavelTriagem({ numeroId, usuarioId: admin.id })).ok).toBe(false);
    expect((await definirResponsavelTriagem({ numeroId, usuarioId: sec.id })).ok).toBe(false);
    await definirSetoresDoNumero({ numeroId, setores: ["SECRETARIA", "FINANCEIRO"] });
    expect((await definirResponsavelTriagem({ numeroId, usuarioId: sec.id })).ok).toBe(true);
    expect((await numero()).triagemResponsavelId).toBe(sec.id);
    expect((await ultimoEvento("NumeroTriagemAlterada")).payload).toMatchObject({ de: null, para: sec.id });
    // voltar a 1 setor limpa a triagem
    await definirSetoresDoNumero({ numeroId, setores: ["SECRETARIA"] });
    expect((await numero()).triagemResponsavelId).toBeNull();
    // usuário inativo
    await definirSetoresDoNumero({ numeroId, setores: ["SECRETARIA", "FINANCEIRO"] });
    await prisma.usuario.update({ where: { id: sec.id }, data: { ativo: false } });
    expect((await definirResponsavelTriagem({ numeroId, usuarioId: sec.id })).ok).toBe(false);
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

  it("foto_jpeg_png_ate_2mb", async () => {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const nome = `${randomUUID()}.png`;
    const caminho = resolverCaminhoUpload([nome])!;
    arquivos.push(caminho);
    await writeFile(caminho, Buffer.from("png"));
    const ok = await prisma.registroUpload.create({ data: { url: `/api/files/${nome}`, autorId: admin.id, nome: "f.png", mime: "image/png", tamanho: 3 } });
    const pdf = await prisma.registroUpload.create({ data: { url: `/api/files/${randomUUID()}.pdf`, autorId: admin.id, nome: "f.pdf", mime: "application/pdf", tamanho: 3 } });
    const grande = await prisma.registroUpload.create({ data: { url: `/api/files/${randomUUID()}.png`, autorId: admin.id, nome: "g.png", mime: "image/png", tamanho: 2 * 1024 * 1024 + 1 } });
    expect((await atualizarPerfilNumero({ numeroId, fotoUploadId: pdf.id }, deps)).ok).toBe(false);
    expect((await atualizarPerfilNumero({ numeroId, fotoUploadId: grande.id }, deps)).ok).toBe(false);
    expect((await atualizarPerfilNumero({ numeroId, fotoUploadId: ok.id }, deps)).ok).toBe(true);
    expect((await numero()).perfilFotoUploadId).toBe(ok.id);
    expect(motor.atualizarPerfil).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ fotoDataUri: expect.stringMatching(/^data:image\/png;base64,/) }));
  });

  it("privacidade_grava_e_nao_aceita_ninguem_em_grupos", async () => {
    expect((await atualizarPrivacidadeNumero({ numeroId, privacidade: { ...priv, grupos: "NINGUEM" } }, deps)).ok).toBe(false);
    expect((await atualizarPrivacidadeNumero({ numeroId, privacidade: priv }, deps)).ok).toBe(true);
    expect((await numero()).privacidade).toEqual(priv);
    expect((await ultimoEvento("NumeroPrivacidadeAlterada")).payload).toMatchObject({ de: null, para: priv });
  });
});
