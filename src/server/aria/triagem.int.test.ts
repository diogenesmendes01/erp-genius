import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedCobranca, criarNumeroSetor } from "@/test/integracao-whatsapp";
import { truncarBanco } from "@/test/integracao";
import { provedorSimulado } from "./provedor";
import type { PedidoIA, ProvedorIA } from "./provedor";
import { classificarSetorPelaAria, FRASE_ENCAMINHAMENTO } from "./triagem";

beforeEach(truncarBanco);

let seq = 0;
const provedorComConfianca = (setor: string | null, confianca: number): ProvedorIA => ({
  nome: "simulado",
  async gerar(_p: PedidoIA) {
    return { texto: JSON.stringify({ setor, confianca }), modelo: "simulado", provedor: "simulado", recusa: false,
      tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, latenciaMs: 0 };
  },
});

async function ligar(estado: "SHADOW" | "ATIVA" = "ATIVA", triagemAtiva = true) {
  await prisma.agenteIA.upsert({ where: { id: "aria" }, create: { id: "aria", estado }, update: { estado } });
  await prisma.configIA.upsert({ where: { id: "ia" }, create: { id: "ia", triagemAtiva }, update: { triagemAtiva } });
}

async function cenario() {
  const { aluno } = await seedCobranca({ vencimento: new Date() });
  const numero = await criarNumeroSetor({ telefoneE164: "+5511900000555", setores: ["COMERCIAL", "FINANCEIRO", "SECRETARIA"] });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777", alunoId: aluno.id } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  const msg = (corpo: string) => prisma.mensagemWhatsApp.create({
    data: { conversaId: conversa.id, numeroId: numero.id, direcao: "ENTRADA", driver: "META_CLOUD", corpo, status: "ENTREGUE", providerMessageId: `t-${++seq}` },
  });
  return { numero, contato, conversa, msg };
}

const ultimoEvento = (tipo: string) => prisma.evento.findFirstOrThrow({ where: { tipo }, orderBy: { criadoEm: "desc" } });
const ultimaIntencao = () => prisma.intencaoMensagem.findFirstOrThrow({ orderBy: { criadaEm: "desc" } });

describe("classificarSetorPelaAria", () => {
  let c: Awaited<ReturnType<typeof cenario>>;
  let msgBoleto: { id: string };
  beforeEach(async () => {
    await ligar();
    c = await cenario();
    msgBoleto = await c.msg("Preciso da segunda via do boleto");
  });

  it("confianca_alta_abre_atendimento_no_setor", async () => {
    const r = await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado });
    expect(r).toMatchObject({ setor: "FINANCEIRO" });
    expect((await ultimoEvento("MensagemClassificada")).payload).toMatchObject({ ator: "ARIA", finalidade: "FINANCEIRO" });
    const m = await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: msgBoleto.id } });
    expect(m.atendimentoId).toBe((r as { atendimentoId: string }).atendimentoId);
    expect(await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: m.atendimentoId! } })).toMatchObject({ finalidade: "FINANCEIRO", naoLidas: 1 });
    expect(await prisma.turnoAgenteIA.findFirstOrThrow()).toMatchObject({ tipo: "TRIAGEM", ancoraMensagemId: msgBoleto.id });
    expect(await prisma.acaoAgenteIA.findFirstOrThrow()).toMatchObject({ acao: "CLASSIFICAR_SETOR", status: "EXECUTADA", reversivel: false });
    expect(await prisma.chamadaIA.findFirstOrThrow()).toMatchObject({ origem: "TRIAGEM" });
  });

  it("nao_responde_conteudo_so_encaminha", async () => {
    await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado });
    const i = await ultimaIntencao();
    expect(i.corpoRenderizado).toBe(FRASE_ENCAMINHAMENTO.FINANCEIRO);
    expect(i).toMatchObject({ origem: "IA", reativa: true, status: "PENDENTE" });
  });

  it("segunda_chamada_nao_duplica", async () => {
    await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado });
    expect(await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "DESLIGADA" });
    expect(await prisma.intencaoMensagem.count()).toBe(1);
  });

  it("confianca_baixa_fica_na_triagem_humana", async () => {
    const m = await c.msg("Oi, tudo bem?");
    expect(await classificarSetorPelaAria(m.id, { provedor: provedorComConfianca("COMERCIAL", 79) })).toEqual({ triagemHumana: "CONFIANCA" });
    expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: m.id } })).atendimentoId).toBeNull();
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("no_limiar_classifica", async () => {
    const m = await c.msg("Quero saber de cursos");
    expect(await classificarSetorPelaAria(m.id, { provedor: provedorComConfianca("COMERCIAL", 80) })).toMatchObject({ setor: "COMERCIAL" });
  });

  it("setor_que_o_numero_nao_atende", async () => {
    const msgProfessor = await c.msg("Quero falar com o professor da turma");
    expect(await classificarSetorPelaAria(msgProfessor.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "SETOR_FORA_DO_NUMERO" });
  });

  it("regra_de_contexto_da_fase_3_aluno_sem_matricula_unica", async () => {
    await prisma.matricula.deleteMany({ where: { alunoId: c.contato.alunoId! } }).catch(() => undefined);
    const outro = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880000" } });
    const conv = await prisma.conversaWhatsApp.create({ data: { numeroId: c.numero.id, contatoId: outro.id } });
    const m = await prisma.mensagemWhatsApp.create({ data: { conversaId: conv.id, numeroId: c.numero.id, direcao: "ENTRADA", driver: "META_CLOUD", corpo: "boleto", providerMessageId: "t-x" } });
    expect(await classificarSetorPelaAria(m.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "SETOR_FORA_DO_NUMERO" });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("recusa_fica_na_triagem_humana", async () => {
    const recusa: ProvedorIA = { nome: "simulado", async gerar() { return { texto: "", modelo: "simulado", provedor: "simulado", recusa: true, tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, latenciaMs: 0 }; } };
    expect(await classificarSetorPelaAria(msgBoleto.id, { provedor: recusa })).toEqual({ triagemHumana: "RECUSA" });
  });

  it("shadow_so_registra_sem_mudar_o_crm", async () => {
    await ligar("SHADOW");
    expect(await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "DESLIGADA" });
    expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: msgBoleto.id } })).atendimentoId).toBeNull();
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: "AriaTriagemSimulada" } })).toBe(1);
  });

  it("desligada_por_padrao", async () => {
    await prisma.configIA.update({ where: { id: "ia" }, data: { triagemAtiva: false } });
    expect(await classificarSetorPelaAria(msgBoleto.id)).toEqual({ triagemHumana: "DESLIGADA" });
  });

  it("aria_desligada_ou_numero_com_dono_nao_atua", async () => {
    await prisma.agenteIA.update({ where: { id: "aria" }, data: { estado: "DESLIGADA" } });
    expect(await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "DESLIGADA" });
  });

  it("grupo_nunca", async () => {
    const grupo = await prisma.grupoWhatsApp.create({ data: { numeroId: c.numero.id, grupoJid: "g1@g.us", nome: "Grupo" } });
    const conv = await prisma.conversaWhatsApp.create({ data: { numeroId: c.numero.id, grupoId: grupo.id } });
    const msgGrupo = await prisma.mensagemWhatsApp.create({ data: { conversaId: conv.id, numeroId: c.numero.id, direcao: "ENTRADA", driver: "META_CLOUD", corpo: "boleto", providerMessageId: "g-1" } });
    expect(await classificarSetorPelaAria(msgGrupo.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "DESLIGADA" });
  });
});
