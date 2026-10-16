import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { classificarMensagemWhatsApp, listarTriagemWhatsApp } from "./operacoes-atendimento";

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
let recepcao: Usuario, vendedor: Usuario, admin: Usuario;
let msgNumeroDela: { id: string }, msgOutroNumero: { id: string };
let aDela: { id: string }, aOutro: { id: string };
const comoUsuario = (u: Usuario) => authMock.mockResolvedValue({ user: { id: u.id } });

async function cenario(telefone: string, numeroId: string, leadTel: string) {
  const lead = await prisma.lead.create({ data: { nome: `Lead ${leadTel}`, telefoneE164: leadTel, vendedorDonoId: vendedor.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: leadTel, leadId: lead.id } });
  const atendimento = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id, responsavelId: vendedor.id }));
  const msg = await prisma.mensagemWhatsApp.create({ data: { numeroId, conversaId: atendimento.conversaId, direcao: "ENTRADA", driver: "META_CLOUD", corpo: `Mensagem ${telefone}` } });
  return { atendimento, msg };
}

beforeEach(async () => {
  await truncarBanco();
  [recepcao, vendedor, admin] = await Promise.all([
    criarUsuario([Papel.SECRETARIA_ACADEMICA], "Recepção"), criarUsuario([Papel.VENDEDOR], "Vendedor"), criarUsuario([Papel.ADMINISTRADOR], "Admin"),
  ]);
  const dela = await criarNumeroSetor({ telefoneE164: "+5511900000101", setores: ["COMERCIAL", "SECRETARIA"], triagemResponsavelId: recepcao.id });
  const outro = await criarNumeroSetor({ telefoneE164: "+5511900000102", setores: ["COMERCIAL", "SECRETARIA"] });
  const c1 = await cenario("dela", dela.id, "+50688880101");
  const c2 = await cenario("outro", outro.id, "+50688880102");
  ({ msg: msgNumeroDela, atendimento: aDela } = c1);
  ({ msg: msgOutroNumero, atendimento: aOutro } = c2);
});

describe("triagem do número (E4.3)", () => {
  it("responsável pela triagem vê e classifica só o próprio número", async () => {
    comoUsuario(recepcao);
    expect((await listarTriagemWhatsApp()).map((t) => t.id)).toEqual([msgNumeroDela.id]);
    expect((await classificarMensagemWhatsApp({ mensagemId: msgOutroNumero.id, atendimentoId: aOutro.id, motivo: "classificação de teste" })).ok).toBe(false);
    expect((await classificarMensagemWhatsApp({ mensagemId: msgNumeroDela.id, atendimentoId: aDela.id, motivo: "classificação de teste" })).ok).toBe(true);
    const ev = (await eventosDo("AtendimentoWhatsApp", aDela.id)).filter((e) => e.tipo === "MensagemClassificada");
    expect(ev).toHaveLength(1);
    expect((await prisma.mensagemWhatsApp.findUnique({ where: { id: msgOutroNumero.id } }))?.atendimentoId).toBeNull();
  });

  it("administrador continua vendo e classificando todos os números", async () => {
    comoUsuario(admin);
    expect((await listarTriagemWhatsApp()).map((t) => t.id).sort()).toEqual([msgNumeroDela.id, msgOutroNumero.id].sort());
    expect((await classificarMensagemWhatsApp({ mensagemId: msgOutroNumero.id, atendimentoId: aOutro.id, motivo: "classificação de teste" })).ok).toBe(true);
  });

  it("quem não é admin nem responsável pela triagem recebe erro de permissão", async () => {
    comoUsuario(vendedor);
    await expect(listarTriagemWhatsApp()).rejects.toThrow();
    expect((await classificarMensagemWhatsApp({ mensagemId: msgNumeroDela.id, atendimentoId: aDela.id, motivo: "classificação de teste" })).ok).toBe(false);
  });
});
