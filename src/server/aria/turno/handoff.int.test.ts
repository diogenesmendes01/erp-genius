import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { configPadrao, type ConfigAria } from "../config-schema";
import { montarContextoTurno } from "./contexto";
import { executarHandoff } from "./handoff";
import type { MotivoHandoff } from "./tipos";

beforeEach(truncarBanco);

let seq = 0;
async function cenario(comDono: boolean) {
  const cat = await seedCatalogoMinimo();
  const dono = await criarUsuario([], "Camila Souza");
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const op = await prisma.oportunidade.create({
    data: { nome: "Ana Lima", paisId: cat.pais.id, telefoneE164: "+50677777777", vendedorDonoId: comDono ? dono.id : null },
  });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50677777777", leadId: op.id, nomeExibicao: "Ana Lima" } });
  const at = await prisma.$transaction((tx) =>
    garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }),
  );
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } });
  const ancora = await prisma.mensagemWhatsApp.create({
    data: {
      atendimentoId: at.id, conversaId: conv.conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo: "quero falar com alguém",
      driver: "MOTOR", status: "ENTREGUE", providerMessageId: `ho-${++seq}`,
    },
  });
  const turno = await prisma.turnoAgenteIA.create({
    data: { ancoraMensagemId: ancora.id, atendimentoId: at.id, tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO" },
  });
  return { at, turno, dono, op };
}

function configHandoff(extra: Partial<ConfigAria["handoff"]> = {}): ConfigAria {
  const c = configPadrao();
  return {
    ...c,
    handoff: {
      ...c.handoff,
      mensagem: "{nome}, vou te passar para {responsavel}, que continua daqui.",
      camposResumo: ["motivo", "resumo", "proximoPasso"],
      ...extra,
    },
  };
}

describe("executarHandoff", () => {
  async function handoff(
    c: Awaited<ReturnType<typeof cenario>>,
    motivo: MotivoHandoff,
    o: { resumo?: { motivo: string; resumo: string; proximoPasso: string } | null; simulado?: boolean; config?: ConfigAria } = {},
  ) {
    return prisma.$transaction(async (tx) => {
      const ctx = { ...(await montarContextoTurno(c.at.id, tx)), primeiraDaAria: false };
      return executarHandoff(tx, { turnoId: c.turno.id, ctx, motivo, config: o.config ?? configHandoff(), simulado: o.simulado ?? false, resumo: o.resumo ?? null });
    });
  }
  const atendimento = (c: { at: { id: string } }) => prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.at.id } });
  const ultimaIntencao = () => prisma.intencaoMensagem.findFirstOrThrow({ orderBy: { criadaEm: "desc" } });
  const ultimaNota = async () => {
    const e = await prisma.evento.findFirstOrThrow({ where: { tipo: "NotaInterna" }, orderBy: { criadoEm: "desc" } });
    return { corpo: (e.payload as { nota: string }).nota, autorId: e.autorId };
  };

  it("destino_responsavel_da_oportunidade", async () => {
    const c = await cenario(true);
    await handoff(c, "PEDIDO_HUMANO");
    expect(await atendimento(c)).toMatchObject({ responsavelId: c.dono.id, iaPausaMotivo: "HANDOFF", status: "EM_ATENDIMENTO" });
    const ev = await prisma.evento.findFirstOrThrow({ where: { tipo: "AriaHandoff" } });
    expect(ev).toMatchObject({ agregadoTipo: "AtendimentoWhatsApp", agregadoId: c.at.id, autorId: null });
    expect(ev.payload).toMatchObject({ motivo: "PEDIDO_HUMANO", destino: "RESPONSAVEL", responsavelId: c.dono.id });
  });

  it("sem_dono_vai_para_fila", async () => {
    const c = await cenario(false);
    await handoff(c, "PEDIDO_HUMANO");
    expect(await atendimento(c)).toMatchObject({ responsavelId: null, status: "ABERTO_SEM_RESPONSAVEL", iaPausaMotivo: "HANDOFF" });
    expect((await ultimaIntencao()).corpoRenderizado).toBe("Ana, vou te passar para nossa equipe, que continua daqui.");
  });

  it("destino_usuario_fixo", async () => {
    const c = await cenario(true);
    const outro = await criarUsuario([], "Bruno Reis");
    await handoff(c, "PEDIDO_HUMANO", { config: configHandoff({ destino: "USUARIO", destinoUsuarioId: outro.id }) });
    expect(await atendimento(c)).toMatchObject({ responsavelId: outro.id });
    expect((await ultimaIntencao()).corpoRenderizado).toBe("Ana, vou te passar para Bruno, que continua daqui.");
  });

  it("mensagem_ao_lead_com_variaveis", async () => {
    const c = await cenario(true);
    await handoff(c, "PEDIDO_HUMANO");
    expect(await ultimaIntencao()).toMatchObject({
      origem: "IA", reativa: true, status: "PENDENTE", corpoRenderizado: "Ana, vou te passar para Camila, que continua daqui.",
    });
  });

  it("mensagem_padrao_quando_vazia", async () => {
    const c = await cenario(true);
    await handoff(c, "PEDIDO_HUMANO", { config: configHandoff({ mensagem: "" }) });
    expect((await ultimaIntencao()).corpoRenderizado).toBe("Ana, vou te passar para Camila, que continua daqui.");
  });

  it("nota_interna_com_resumo", async () => {
    const c = await cenario(true);
    await handoff(c, "CONFIANCA", { resumo: { motivo: "Dúvida de preço", resumo: "Quer noite", proximoPasso: "Ligar" } });
    const n = await ultimaNota();
    expect(n.corpo).toContain("Motivo: Dúvida de preço");
    expect(n.corpo).toContain("Resumo: Quer noite");
    expect(n.autorId).toBeNull();
  });

  it("nota_so_com_campos_escolhidos", async () => {
    const c = await cenario(true);
    await handoff(c, "CONFIANCA", {
      config: configHandoff({ camposResumo: ["motivo"] }),
      resumo: { motivo: "Dúvida de preço", resumo: "Quer noite", proximoPasso: "Ligar" },
    });
    const n = await ultimaNota();
    expect(n.corpo).toBe("Motivo: Dúvida de preço");
  });

  it("irreversivel", async () => {
    const c = await cenario(true);
    expect(await handoff(c, "PEDIDO_HUMANO")).toMatchObject({
      acao: "HANDOFF", status: "EXECUTADA", reversivel: false, motivoIrreversivel: "Handoff já comunicado ao contato",
    });
  });

  it("shadow_simula_sem_mudar_atendimento", async () => {
    const c = await cenario(true);
    const r = await handoff(c, "PEDIDO_HUMANO", { simulado: true, resumo: { motivo: "a", resumo: "b", proximoPasso: "c" } });
    expect(r).toMatchObject({ acao: "HANDOFF", status: "SIMULADA" });
    expect(await atendimento(c)).toMatchObject({ responsavelId: null, iaPausadaEm: null, status: "ABERTO_SEM_RESPONSAVEL" });
    expect((await ultimaIntencao()).status).toBe("SIMULADA");
    expect(await prisma.evento.count({ where: { tipo: { in: ["AriaHandoff", "NotaInterna", "AriaPausadaNoAtendimento"] } } })).toBe(0);
  });
});
