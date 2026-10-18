import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Falha simulada na atribuição (C9 da revisão do #233): erro de banco DENTRO da transação do inbound.
const falha = vi.hoisted(() => ({ atribuicao: false }));
vi.mock("@/server/crm-config/distribuicao", async (orig) => {
  const real = await orig<typeof import("@/server/crm-config/distribuicao")>();
  return {
    ...real,
    atribuirAutomaticamente: async (tx: import("@prisma/client").Prisma.TransactionClient, id: string) => {
      if (falha.atribuicao) await tx.$executeRawUnsafe("SELECT 1/0");
      return real.atribuirAutomaticamente(tx, id);
    },
  };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { abrirAtendimentoDoSetor, atendimentoDoInbound } from "@/server/whatsapp/atendimentos";
import { processarMensagemNormalizada } from "@/server/whatsapp/inbound";
import { salvarDistribuicaoSetor } from "./distribuicao";
import { salvarConfigSetor, salvarSlaSetor } from "./sla";

type U = Awaited<ReturnType<typeof criarUsuario>>;
let admin: U, gerente: U, financeiro: U, v1: U, v2: U;
let numeroId: string;
let seq = 0;
const logado = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const sla = { finalidade: "COMERCIAL", prazoPrimeiraRespostaMin: 30, alertarResponsavel: true, alertarGerente: false, contarSoNoHorario: true } as const;
const config = async (finalidade: "COMERCIAL", regra: "RODIZIO" | "MENOR_CARGA" | "MANUAL", ids: string[]) => {
  logado(admin);
  expect((await salvarDistribuicaoSetor({ finalidade, regra, participantesIds: ids })).ok).toBe(true);
};
async function novoInboundComercial(leadId?: string) {
  seq += 1;
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+5069000${String(seq).padStart(4, "0")}`, ...(leadId ? { leadId } : {}) } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId: contato.id } });
  const id = await prisma.$transaction((tx) => atendimentoDoInbound(tx, conversa.id, { atribuir: true }));
  return prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: id! } });
}
const eventos = async () => (await eventosDo("ConfigSetorAtendimento", "COMERCIAL"));
const ultimoEvento = async (tipo: string) => (await eventos()).filter((e) => e.tipo === tipo).at(-1)!;

beforeEach(async () => {
  falha.atribuicao = false;
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Fin");
  v1 = await criarUsuario([Papel.VENDEDOR], "V1");
  v2 = await criarUsuario([Papel.VENDEDOR], "V2");
  numeroId = (await criarNumeroSetor({ telefoneE164: "+5511900000039", setores: ["COMERCIAL"] })).id;
  logado(admin);
});

describe("Distribuição e SLA por setor", () => {
  it("participante_de_outro_setor_rejeitado", async () => {
    logado(admin);
    expect((await salvarDistribuicaoSetor({ finalidade: "COMERCIAL", regra: "RODIZIO", participantesIds: [financeiro.id] })).ok).toBe(false);
  });

  it("gerente_comercial_so_o_proprio_setor", async () => {
    logado(gerente);
    expect((await salvarSlaSetor({ ...sla, finalidade: "FINANCEIRO" })).ok).toBe(false);
    expect((await salvarSlaSetor({ ...sla, finalidade: "COMERCIAL" })).ok).toBe(true);
    expect((await ultimoEvento("SlaAlterado")).payload).toMatchObject({ para: { minutos: 30 } });
  });

  it("vendedor_nao_configura", async () => {
    logado(v1);
    expect((await salvarSlaSetor(sla)).ok).toBe(false);
  });

  it("atribuicao_automatica_grava_motivo", async () => {
    await config("COMERCIAL", "RODIZIO", [v1.id, v2.id]);
    expect((await ultimoEvento("DistribuicaoAlterada"))).toBeTruthy();
    const a1 = await novoInboundComercial();
    const a2 = await novoInboundComercial();
    const a3 = await novoInboundComercial();
    expect([a1.responsavelId, a2.responsavelId, a3.responsavelId]).toEqual([v1.id, v2.id, v1.id]);
    expect(a1.status).toBe("EM_ATENDIMENTO");
    expect((await ultimoEvento("AtendimentoAtribuido")).payload).toMatchObject({ motivo: "RODIZIO" });
  });

  it("menor_carga_e_manual", async () => {
    await config("COMERCIAL", "MENOR_CARGA", [v1.id, v2.id]);
    const a1 = await novoInboundComercial();
    const a2 = await novoInboundComercial();
    expect(a1.responsavelId).toBe(v1.id);
    expect(a2.responsavelId).toBe(v2.id);
    expect((await ultimoEvento("AtendimentoAtribuido")).payload).toMatchObject({ motivo: "MENOR_CARGA" });
    await config("COMERCIAL", "MANUAL", []);
    const a3 = await novoInboundComercial();
    expect(a3.responsavelId).toBeNull();
    expect(a3.status).toBe("ABERTO_SEM_RESPONSAVEL");
  });

  it("carteira_do_lead_vem_primeiro", async () => {
    await config("COMERCIAL", "RODIZIO", [v1.id]);
    const lead = await prisma.oportunidade.create({ data: { nome: "Lead", vendedorDonoId: v2.id, etapa: "NOVO" } });
    const a = await novoInboundComercial(lead.id);
    expect(a.responsavelId).toBe(v2.id);
    expect((await ultimoEvento("AtendimentoAtribuido")).payload).toMatchObject({ motivo: "CARTEIRA" });
  });

  it("carteira_vale_mesmo_em_setor_manual", async () => {
    await config("COMERCIAL", "MANUAL", []);
    const lead = await prisma.oportunidade.create({ data: { nome: "Lead", vendedorDonoId: v2.id, etapa: "NOVO" } });
    const a = await novoInboundComercial(lead.id);
    expect(a.responsavelId).toBe(v2.id);
    expect(a.status).toBe("EM_ATENDIMENTO");
    expect((await ultimoEvento("AtendimentoAtribuido")).payload).toMatchObject({ motivo: "CARTEIRA" });
    const semDono = await novoInboundComercial();
    expect(semDono.responsavelId).toBeNull();
  });

  it("salvar_so_a_distribuicao_preserva_sla_de_24h_sem_SlaAlterado", async () => {
    await prisma.prazoRespostaSetor.create({ data: { finalidade: "PEDAGOGICO", minutos: 1440 } });
    logado(admin);
    const r = await salvarConfigSetor({
      distribuicao: { finalidade: "PEDAGOGICO", regra: "RODIZIO", participantesIds: [] },
      sla: { prazoPrimeiraRespostaMin: 1440, alertarResponsavel: true, alertarGerente: false, contarSoNoHorario: true },
    });
    expect(r.ok).toBe(true);
    const cfg = await prisma.prazoRespostaSetor.findUniqueOrThrow({ where: { finalidade: "PEDAGOGICO" } });
    expect(cfg).toMatchObject({ minutos: 1440, regraDistribuicao: "RODIZIO" });
    const ev = await eventosDo("ConfigSetorAtendimento", "PEDAGOGICO");
    expect(ev.map((e) => e.tipo)).toEqual(["DistribuicaoAlterada"]);
  });

  it("prazo_fora_da_lista_e_diferente_do_gravado_nao_salva_nada", async () => {
    await prisma.prazoRespostaSetor.create({ data: { finalidade: "COMERCIAL", minutos: 60 } });
    logado(admin);
    const r = await salvarConfigSetor({
      distribuicao: { finalidade: "COMERCIAL", regra: "RODIZIO", participantesIds: [v1.id] },
      sla: { prazoPrimeiraRespostaMin: 45, alertarResponsavel: true, alertarGerente: false, contarSoNoHorario: true },
    });
    expect(r.ok).toBe(false);
    const cfg = await prisma.prazoRespostaSetor.findUniqueOrThrow({ where: { finalidade: "COMERCIAL" } });
    expect(cfg).toMatchObject({ minutos: 60, regraDistribuicao: "MANUAL", participantesIds: [] });
    expect(await eventos()).toEqual([]);
  });

  it("mensagem_fromMe_do_celular_nao_atribui_nem_consome_rodizio", async () => {
    await config("COMERCIAL", "RODIZIO", [v1.id, v2.id]);
    const numero = await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: numeroId } });
    const msg = (id: string, fromMe: boolean, quando: Date) => processarMensagemNormalizada({
      numeroProviderRef: numero.providerRef, contatoWaId: "50691110001", providerMessageId: id,
      corpo: fromMe ? "Olá, aqui é a escola" : "Oi!", tipo: "TEXTO", driver: "MOTOR", fromMe, quando,
    });
    expect(await msg("wamid.fromme.1", true, new Date(Date.now() - 60_000))).toBe("gravada");
    const atendimento = await prisma.atendimentoWhatsApp.findFirstOrThrow({ where: { conversa: { numeroId } } });
    expect(atendimento.responsavelId).toBeNull();
    expect((await eventos()).some((e) => e.tipo === "AtendimentoAtribuido")).toBe(false);
    expect((await prisma.prazoRespostaSetor.findUniqueOrThrow({ where: { finalidade: "COMERCIAL" } })).ultimoAtribuidoId).toBeNull();
  });

  // Ponto comum de abertura por setor: a triagem da Aria (5C) abre direto por aqui, sem passar por
  // atendimentoDoInbound, e também entra no rodízio.
  it("abrir_atendimento_do_setor_entra_no_rodizio", async () => {
    await config("COMERCIAL", "RODIZIO", [v1.id, v2.id]);
    const abrir = async (atribuir?: boolean) => {
      seq += 1;
      const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+5069100${String(seq).padStart(4, "0")}` } });
      const a = await prisma.$transaction((tx) => abrirAtendimentoDoSetor(
        tx, { numeroId, contatoId: contato.id, contato: { leadId: null, alunoId: null } }, "COMERCIAL",
        ...(atribuir === undefined ? [] : [{ atribuir }]),
      ));
      return prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a!.id } });
    };
    const a1 = await abrir();
    const a2 = await abrir();
    expect([a1.responsavelId, a2.responsavelId]).toEqual([v1.id, v2.id]);
    expect((await ultimoEvento("AtendimentoAtribuido")).payload).toMatchObject({ atendimentoId: a2.id, motivo: "RODIZIO" });
    const semAtribuir = await abrir(false);
    expect(semAtribuir.responsavelId).toBeNull();
    expect((await prisma.prazoRespostaSetor.findUniqueOrThrow({ where: { finalidade: "COMERCIAL" } })).ultimoAtribuidoId).toBe(v2.id);
  });

  it("falha_de_banco_na_atribuicao_do_inbound_nao_derruba_a_transacao_e_fica_na_fila_do_setor", async () => {
    await config("COMERCIAL", "RODIZIO", [v1.id, v2.id]);
    falha.atribuicao = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const numero = await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: numeroId } });
      expect(await processarMensagemNormalizada({
        numeroProviderRef: numero.providerRef, contatoWaId: "50691110002", providerMessageId: "wamid.falha.atribuicao",
        corpo: "Oi, quero saber dos cursos", tipo: "TEXTO", driver: "MOTOR", fromMe: false, quando: new Date(),
      })).toBe("gravada");
      // A mensagem foi gravada e ligada ao atendimento, que ficou na fila do setor, sem responsável.
      const m = await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "wamid.falha.atribuicao" } });
      expect(m.atendimentoId).not.toBeNull();
      expect(await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: m.atendimentoId! } })).toMatchObject({ finalidade: "COMERCIAL", responsavelId: null });
      expect((await eventos()).some((e) => e.tipo === "AtendimentoAtribuido")).toBe(false);
      expect((await prisma.prazoRespostaSetor.findUniqueOrThrow({ where: { finalidade: "COMERCIAL" } })).ultimoAtribuidoId).toBeNull();
      expect(log).toHaveBeenCalledWith(expect.stringContaining("[distribuicao]"), expect.objectContaining({ atendimentoId: m.atendimentoId }));
    } finally {
      log.mockRestore();
    }
  });
});
