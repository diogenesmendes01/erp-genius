import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { configPadrao, type ConfigAria, type Matriz } from "../config-schema";
import { ErroProvedorIA, type PedidoIA, type ProvedorIA, type RespostaIA } from "../provedor/tipos";
import { agendarTurnoAria, processarTurnoAria, reprocessarTurnosPendentes } from "./orquestrador";

beforeEach(truncarBanco);

let seq = 0;

/** Provedor simulado deste teste: responde com confiança alta, a menos que a fala peça uma pessoa. */
const provedorSimulado: ProvedorIA = {
  nome: "simulado",
  async gerar(p: PedidoIA): Promise<RespostaIA> {
    const fala = [...p.mensagens].reverse().find((m) => m.papel === "usuario")?.texto.toLowerCase() ?? "";
    const humano = fala.includes("humano") || fala.includes("atendente");
    return {
      texto: JSON.stringify({
        resposta: humano ? "Certo, vou chamar um atendente." : "Temos turmas à noite, quer conhecer?",
        documentoId: null,
        acoes: [],
        confianca: humano ? 20 : 90,
        handoff: humano ? { motivo: "PEDIDO_HUMANO" } : null,
        fontes: [],
        humor: null,
      }),
      modelo: "simulado", provedor: "simulado", recusa: false, tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, latenciaMs: 0,
    };
  },
};
function provedorContador(base: ProvedorIA) {
  const c = { nome: base.nome, chamadas: 0, async gerar(p: PedidoIA) { c.chamadas++; return base.gerar(p); } };
  return c;
}
const provedorQueFalha = (codigo: string): ProvedorIA => ({ nome: "anthropic", async gerar() { throw new ErroProvedorIA(codigo); } });

async function cenario() {
  const cat = await seedCatalogoMinimo();
  const dono = await criarUsuario([], "Camila Souza");
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const op = await prisma.oportunidade.create({
    data: { nome: "Maria", paisId: cat.pais.id, telefoneE164: "+50688888888", vendedorDonoId: dono.id },
  });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: op.id, nomeExibicao: "Maria" } });
  const at = await prisma.$transaction((tx) =>
    garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }),
  );
  const conversaId = (await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } })).conversaId;
  const inbound = (corpo: string, criadoEm = new Date()) =>
    prisma.mensagemWhatsApp.create({
      data: { atendimentoId: at.id, conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo, driver: "MOTOR", status: "ENTREGUE", providerMessageId: `o-${++seq}`, criadoEm },
    });
  return { cat, dono, numero, op, contato, at, conversaId, inbound };
}

async function publicar(dono: string, estado: "SHADOW" | "ATIVA" | "DESLIGADA", editar: (c: ConfigAria) => void = () => undefined) {
  const config = configPadrao();
  editar(config);
  await prisma.versaoAgenteIA.create({ data: { numero: 1, status: "PUBLICADA", config, criadaPorId: dono, publicadaPorId: dono, publicadaEm: new Date() } });
  await prisma.agenteIA.upsert({ where: { id: "aria" }, create: { id: "aria", estado }, update: { estado } });
}

describe("processarTurnoAria", () => {
  let c: Awaited<ReturnType<typeof cenario>>;
  let inbound: { id: string };
  beforeEach(async () => {
    c = await cenario();
    inbound = await c.inbound("Quero saber das turmas de inglês");
  });
  const pronta = (estado: "SHADOW" | "ATIVA" | "DESLIGADA" = "ATIVA", editar?: (cfg: ConfigAria) => void) => publicar(c.dono.id, estado, editar);
  const matriz = (m: Matriz) => (cfg: ConfigAria) => { cfg.matriz = { ...cfg.matriz, ...m }; };

  it("lead_comercial_recebe_resposta", async () => {
    await pronta();
    const r = await processarTurnoAria(inbound.id, { provedor: provedorSimulado });
    expect(r).toMatchObject({ resultado: "RESPONDEU" });
    const t = await prisma.turnoAgenteIA.findFirstOrThrow();
    expect(t).toMatchObject({ resultado: "RESPONDEU", confianca: 90 });
    expect(t.chamadaId).not.toBeNull();
    expect(t.versaoId).not.toBeNull();
    expect(await prisma.intencaoMensagem.findFirstOrThrow()).toMatchObject({ origem: "IA", reativa: true, status: "PENDENTE" });
  });

  it("inbound_duplicado_gera_um_turno", async () => {
    await pronta();
    const contador = provedorContador(provedorSimulado);
    const [a, b] = await Promise.all([processarTurnoAria(inbound.id, { provedor: contador }), processarTurnoAria(inbound.id, { provedor: contador })]);
    expect([a, b].filter((r) => "duplicado" in r)).toHaveLength(1);
    expect(contador.chamadas).toBe(1);
    expect(await prisma.turnoAgenteIA.count()).toBe(1);
  });

  it("grupo_ignorado_sem_chamar_provedor", async () => {
    await pronta();
    const grupo = await prisma.grupoWhatsApp.create({ data: { numeroId: c.numero.id, grupoJid: "g1@g.us", nome: "Grupo" } });
    const conv = await prisma.conversaWhatsApp.create({ data: { numeroId: c.numero.id, grupoId: grupo.id } });
    const m = await prisma.mensagemWhatsApp.create({
      data: { conversaId: conv.id, numeroId: c.numero.id, direcao: "ENTRADA", corpo: "oi pessoal", driver: "MOTOR", status: "ENTREGUE", providerMessageId: "g-1" },
    });
    const contador = provedorContador(provedorSimulado);
    expect(await processarTurnoAria(m.id, { provedor: contador })).toMatchObject({ resultado: "IGNORADO:GRUPO" });
    expect(contador.chamadas).toBe(0);
    expect(await prisma.turnoAgenteIA.count()).toBe(0);
  });

  it("desligada_ignorada", async () => {
    await pronta("DESLIGADA");
    const contador = provedorContador(provedorSimulado);
    expect(await processarTurnoAria(inbound.id, { provedor: contador })).toMatchObject({ resultado: "IGNORADO:DESLIGADA" });
    expect(contador.chamadas).toBe(0);
    expect((await prisma.turnoAgenteIA.findFirstOrThrow()).resultado).toBe("IGNORADO:DESLIGADA");
  });

  it("pedido_humano_faz_handoff", async () => {
    await pronta();
    const h = await c.inbound("quero falar com um humano");
    expect(await processarTurnoAria(h.id, { provedor: provedorSimulado })).toMatchObject({ resultado: "HANDOFF" });
    expect(await prisma.acaoAgenteIA.findFirstOrThrow({ where: { acao: "HANDOFF" } })).toMatchObject({ status: "EXECUTADA" });
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.at.id } })).iaPausadaEm).not.toBeNull();
  });

  it("erro_do_provedor_faz_handoff_e_registra", async () => {
    await pronta();
    expect(await processarTurnoAria(inbound.id, { provedor: provedorQueFalha("429") })).toMatchObject({ resultado: "HANDOFF" });
    expect(await prisma.chamadaIA.findFirstOrThrow()).toMatchObject({ resultado: "ERRO:429" });
    expect(await prisma.acaoAgenteIA.findFirstOrThrow({ where: { acao: "HANDOFF" } })).toMatchObject({ payload: expect.objectContaining({ motivo: "ERRO_PROVEDOR" }) });
  });

  it("ativa_sem_chave_vira_handoff_erro_provedor_sem_resposta", async () => {
    await pronta("ATIVA");
    const chave = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(await processarTurnoAria(inbound.id)).toMatchObject({ resultado: "HANDOFF" });
    } finally {
      if (chave !== undefined) process.env.ANTHROPIC_API_KEY = chave;
    }
    expect(await prisma.chamadaIA.findFirstOrThrow()).toMatchObject({ resultado: "ERRO:SEM_CHAVE" });
    expect(await prisma.acaoAgenteIA.findFirstOrThrow({ where: { acao: "HANDOFF" } })).toMatchObject({ payload: expect.objectContaining({ motivo: "ERRO_PROVEDOR" }) });
    // A unica mensagem ao lead e o aviso de handoff; nenhuma resposta gerada pelo provedor simulado.
    const respostas = await prisma.acaoAgenteIA.findMany({ where: { acao: "RESPONDER" } });
    expect(respostas).toHaveLength(1);
    expect(JSON.stringify(respostas[0].payload)).toContain("Vou chamar uma pessoa da equipe");
  });

  it("shadow_nao_envia_nem_muda", async () => {
    await pronta("SHADOW");
    await processarTurnoAria(inbound.id, { provedor: provedorSimulado });
    expect(await prisma.intencaoMensagem.count({ where: { status: { not: "SIMULADA" } } })).toBe(0);
    expect(await prisma.acaoAgenteIA.count({ where: { status: { notIn: ["SIMULADA", "BLOQUEADA"] } } })).toBe(0);
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.at.id } })).iaPausadaEm).toBeNull();
  });

  it("responder_nao_faz_vira_handoff", async () => {
    await pronta("ATIVA", matriz({ NOVO: { RESPONDER: "NAO_FAZ" } }));
    expect(await processarTurnoAria(inbound.id, { provedor: provedorSimulado })).toMatchObject({ resultado: "HANDOFF" });
    expect(await prisma.acaoAgenteIA.findFirstOrThrow({ where: { acao: "HANDOFF" } })).toMatchObject({ payload: expect.objectContaining({ motivo: "SEM_PERMISSAO" }) });
  });

  it("orcamento_so_sugerir", async () => {
    await pronta();
    await prisma.configIA.upsert({ where: { id: "ia" }, create: { id: "ia", orcamentoMensalUsd: 1, acaoAoEstourar: "SO_SUGERIR" }, update: { orcamentoMensalUsd: 1, acaoAoEstourar: "SO_SUGERIR" } });
    await prisma.chamadaIA.create({
      data: { origem: "ATENDIMENTO", modelo: "claude-sonnet-5-5", provedor: "anthropic", tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, custoMicroUsd: 2_000_000, latenciaMs: 1, resultado: "OK" },
    });
    expect(await processarTurnoAria(inbound.id, { provedor: provedorSimulado })).toMatchObject({ resultado: "SUGERIU" });
    expect(await prisma.acaoAgenteIA.findFirstOrThrow({ where: { acao: "RESPONDER" } })).toMatchObject({ status: "SUGERIDA" });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("valor_nao_autorizado_vira_handoff", async () => {
    await pronta();
    const caro: ProvedorIA = {
      nome: "simulado",
      async gerar(p) {
        const r = await provedorSimulado.gerar(p);
        return { ...r, texto: JSON.stringify({ ...JSON.parse(r.texto), resposta: "A mensalidade custa R$ 123,00." }) };
      },
    };
    expect(await processarTurnoAria(inbound.id, { provedor: caro })).toMatchObject({ resultado: "HANDOFF" });
    expect(await prisma.acaoAgenteIA.findFirstOrThrow({ where: { acao: "HANDOFF" } })).toMatchObject({ payload: expect.objectContaining({ motivo: "VALOR_NAO_AUTORIZADO" }) });
  });

  it("pergunta_de_preco_sem_preco_vira_handoff", async () => {
    await pronta();
    await prisma.precoReferencia.updateMany({ data: { ativo: false } });
    const p = await c.inbound("quanto custa o curso?");
    expect(await processarTurnoAria(p.id, { provedor: provedorSimulado })).toMatchObject({ resultado: "HANDOFF" });
    expect(await prisma.acaoAgenteIA.findFirstOrThrow({ where: { acao: "HANDOFF" } })).toMatchObject({ payload: expect.objectContaining({ motivo: "SEM_PRECO" }) });
  });

  it("linha_com_dono_ignorada", async () => {
    await pronta();
    await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { donoId: c.dono.id } });
    expect(await processarTurnoAria(inbound.id, { provedor: provedorSimulado })).toMatchObject({ resultado: "IGNORADO:LINHA_COM_DONO" });
  });

  it("saida_invalida_vira_handoff", async () => {
    await pronta();
    const lixo: ProvedorIA = { nome: "simulado", async gerar() { return { texto: "{}", modelo: "simulado", provedor: "simulado", recusa: false, tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, latenciaMs: 0 }; } };
    expect(await processarTurnoAria(inbound.id, { provedor: lixo })).toMatchObject({ resultado: "HANDOFF" });
  });
});

describe("reprocessarTurnosPendentes", () => {
  it("processa_ancora_antiga_sem_turno_so_a_ultima", async () => {
    const c = await cenario();
    await publicar(c.dono.id, "ATIVA");
    const agora = new Date();
    const antiga = await c.inbound("primeira", new Date(agora.getTime() - 10 * 60_000));
    const ultima = await c.inbound("Quero saber das turmas", new Date(agora.getTime() - 5 * 60_000));
    const recente = await c.inbound("agora mesmo", new Date(agora.getTime() - 30_000));
    expect(await reprocessarTurnosPendentes(agora)).toBe(0);
    expect(await prisma.turnoAgenteIA.count()).toBe(0);
    await prisma.mensagemWhatsApp.delete({ where: { id: recente.id } });
    // Sem provedor injetado e sem chave, vale o provedor simulado do módulo.
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await reprocessarTurnosPendentes(agora)).toBe(1);
    expect((await prisma.turnoAgenteIA.findFirstOrThrow()).ancoraMensagemId).toBe(ultima.id);
    expect(antiga.id).not.toBe(ultima.id);
    expect(await reprocessarTurnosPendentes(agora)).toBe(0);
    vi.unstubAllEnvs();
  });

  it("desligada_nao_reprocessa", async () => {
    const c = await cenario();
    await c.inbound("oi", new Date(Date.now() - 5 * 60_000));
    expect(await reprocessarTurnosPendentes()).toBe(0);
    expect(await prisma.turnoAgenteIA.count()).toBe(0);
  });
});

describe("agendarTurnoAria", () => {
  it("nao_lanca_e_nao_cria_turno_com_aria_desligada", async () => {
    const c = await cenario();
    const m = await c.inbound("oi");
    expect(agendarTurnoAria(m.id)).toBeUndefined();
    await new Promise((r) => setTimeout(r, 200));
    expect(await prisma.turnoAgenteIA.count()).toBe(0);
  });
});
