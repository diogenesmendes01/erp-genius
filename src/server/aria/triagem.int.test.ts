import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedCobranca, criarNumeroSetor } from "@/test/integracao-whatsapp";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { ErroProvedorIA, provedorSimulado } from "./provedor";
import type { PedidoIA, ProvedorIA } from "./provedor";
import { configPadrao } from "./config-schema";
import { ancoraTriagem, classificarSetorPelaAria, FRASE_ENCAMINHAMENTO, fraseEncaminhamento } from "./triagem";

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
    expect(await prisma.turnoAgenteIA.findFirstOrThrow()).toMatchObject({ tipo: "TRIAGEM", ancoraMensagemId: ancoraTriagem(msgBoleto.id) });
    expect(await prisma.acaoAgenteIA.findFirstOrThrow()).toMatchObject({ acao: "CLASSIFICAR_SETOR", status: "EXECUTADA", reversivel: false });
    expect(await prisma.chamadaIA.findFirstOrThrow()).toMatchObject({ origem: "TRIAGEM" });
  });

  it("nao_responde_conteudo_so_encaminha", async () => {
    await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado });
    const i = await ultimaIntencao();
    expect(FRASE_ENCAMINHAMENTO.FINANCEIRO).toBe("Obrigada! Vou encaminhar sua mensagem para o Financeiro.");
    expect(fraseEncaminhamento("FINANCEIRO", "Aria", false)).toBe(FRASE_ENCAMINHAMENTO.FINANCEIRO);
    expect(i.corpoRenderizado).toBe(fraseEncaminhamento("FINANCEIRO", "Aria"));
    // Primeira fala da Aria no atendimento: começa pela apresentação obrigatória.
    expect(i.corpoRenderizado).toBe("Oi! Eu sou a Aria, assistente virtual da escola. Obrigada! Vou encaminhar sua mensagem para o Financeiro.");
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
    const turno = await prisma.turnoAgenteIA.findUniqueOrThrow({ where: { ancoraMensagemId: ancoraTriagem(msgBoleto.id) } });
    expect(turno).toMatchObject({ tipo: "TRIAGEM", atendimentoId: null, resultado: "SIMULOU" });
    expect(await prisma.acaoAgenteIA.findFirstOrThrow({ where: { turnoId: turno.id } })).toMatchObject({
      acao: "CLASSIFICAR_SETOR", status: "SIMULADA", modoConfigurado: "SHADOW", atendimentoId: null,
      intencaoId: null, payload: { mensagemId: msgBoleto.id, finalidade: "FINANCEIRO" },
    });
    // Repetir a triagem da mesma mensagem não duplica a simulação.
    await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado });
    expect(await prisma.acaoAgenteIA.count({ where: { status: "SIMULADA" } })).toBe(1);
  });

  it("desligada_por_padrao", async () => {
    await prisma.configIA.update({ where: { id: "ia" }, data: { triagemAtiva: false } });
    expect(await classificarSetorPelaAria(msgBoleto.id)).toEqual({ triagemHumana: "DESLIGADA" });
  });

  describe("quando a Aria não atua (nada muda, nenhuma chamada ao modelo)", () => {
    const naoChamado = () => {
      const gerar = vi.fn();
      return { prov: { nome: "simulado", gerar } as unknown as ProvedorIA, gerar };
    };
    async function esperaSemEfeito(id: string, esperado: unknown = { triagemHumana: "DESLIGADA" }) {
      const { prov, gerar } = naoChamado();
      expect(await classificarSetorPelaAria(id, { provedor: prov })).toEqual(esperado);
      expect(gerar).not.toHaveBeenCalled();
      expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id } })).atendimentoId).toBeNull();
      expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
      expect(await prisma.intencaoMensagem.count()).toBe(0);
      expect(await prisma.turnoAgenteIA.count()).toBe(0);
    }

    it("aria_desligada", async () => {
      await prisma.agenteIA.update({ where: { id: "aria" }, data: { estado: "DESLIGADA" } });
      await esperaSemEfeito(msgBoleto.id);
    });

    it("aria_pausada", async () => {
      await prisma.agenteIA.update({ where: { id: "aria" }, data: { pausadoEm: new Date(), motivoPausa: "teste" } });
      await esperaSemEfeito(msgBoleto.id);
    });

    it("numero_com_dono_nao_atua", async () => {
      const dono = await criarUsuario([], "Vendedor");
      const numero = await criarNumeroSetor({ telefoneE164: "+5511900000666", setores: ["COMERCIAL", "FINANCEIRO"], donoId: dono.id });
      const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: c.contato.id } });
      const m = await prisma.mensagemWhatsApp.create({
        data: { conversaId: conversa.id, numeroId: numero.id, direcao: "ENTRADA", driver: "META_CLOUD", corpo: "boleto", providerMessageId: "dono-1" },
      });
      await esperaSemEfeito(m.id);
    });

    it("contato_em_opt_out", async () => {
      await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { optOutEm: new Date() } });
      await esperaSemEfeito(msgBoleto.id);
    });

    it("numero_com_menos_de_dois_setores", async () => {
      const numero = await criarNumeroSetor({ telefoneE164: "+5511900000777", setores: ["FINANCEIRO"] });
      const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: c.contato.id } });
      const m = await prisma.mensagemWhatsApp.create({
        data: { conversaId: conversa.id, numeroId: numero.id, direcao: "ENTRADA", driver: "META_CLOUD", corpo: "boleto", providerMessageId: "um-setor" },
      });
      await esperaSemEfeito(m.id);
    });

    it("orcamento_estourado", async () => {
      await prisma.configIA.update({ where: { id: "ia" }, data: { orcamentoMensalUsd: 0 } });
      await esperaSemEfeito(msgBoleto.id);
    });
  });

  describe("falhas do modelo: a mensagem fica na triagem humana", () => {
    const semEfeito = async (id: string) => {
      expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id } })).atendimentoId).toBeNull();
      expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
      expect(await prisma.intencaoMensagem.count()).toBe(0);
    };

    it("erro_do_provedor_registra_a_chamada_com_erro", async () => {
      const quebrado: ProvedorIA = { nome: "simulado", async gerar() { throw new ErroProvedorIA("TIMEOUT"); } };
      expect(await classificarSetorPelaAria(msgBoleto.id, { provedor: quebrado })).toEqual({ triagemHumana: "CONFIANCA" });
      expect(await prisma.chamadaIA.findFirstOrThrow()).toMatchObject({ origem: "TRIAGEM", resultado: "ERRO:TIMEOUT" });
      await semEfeito(msgBoleto.id);
    });

    it("saida_invalida_do_modelo", async () => {
      const lixo: ProvedorIA = { nome: "simulado", async gerar() {
        return { texto: "não é json", modelo: "simulado", provedor: "simulado", recusa: false, tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, latenciaMs: 0 };
      } };
      expect(await classificarSetorPelaAria(msgBoleto.id, { provedor: lixo })).toEqual({ triagemHumana: "CONFIANCA" });
      await semEfeito(msgBoleto.id);
      expect(await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorComConfianca("INEXISTENTE", 99) })).toEqual({ triagemHumana: "CONFIANCA" });
      await semEfeito(msgBoleto.id);
    });

    describe("ATIVA sem chave de API", () => {
      afterEach(() => vi.unstubAllEnvs());
      it("nao_cai_no_simulado", async () => {
        vi.stubEnv("ANTHROPIC_API_KEY", "");
        expect(await classificarSetorPelaAria(msgBoleto.id)).toEqual({ triagemHumana: "CONFIANCA" });
        expect(await prisma.chamadaIA.count()).toBe(0);
        await semEfeito(msgBoleto.id);
      });
    });
  });

  it("corrida_com_atendimento_ja_atribuido_nao_reclassifica", async () => {
    // Enquanto o modelo responde, um humano tria a mensagem para outro atendimento.
    let humano = "";
    const comCorrida: ProvedorIA = {
      nome: "simulado",
      async gerar(p: PedidoIA) {
        const at = await prisma.atendimentoWhatsApp.create({ data: { conversaId: c.conversa.id, contextoChave: "humano", finalidade: "SECRETARIA" } });
        humano = at.id;
        await prisma.mensagemWhatsApp.update({ where: { id: msgBoleto.id }, data: { atendimentoId: at.id } });
        return provedorSimulado.gerar(p);
      },
    };
    expect(await classificarSetorPelaAria(msgBoleto.id, { provedor: comCorrida })).toEqual({ triagemHumana: "DESLIGADA" });
    expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: msgBoleto.id } })).atendimentoId).toBe(humano);
    expect(await prisma.atendimentoWhatsApp.count()).toBe(1);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.acaoAgenteIA.count()).toBe(0);
  });

  it("grupo_nunca", async () => {
    const grupo = await prisma.grupoWhatsApp.create({ data: { numeroId: c.numero.id, grupoJid: "g1@g.us", nome: "Grupo" } });
    const conv = await prisma.conversaWhatsApp.create({ data: { numeroId: c.numero.id, grupoId: grupo.id } });
    const msgGrupo = await prisma.mensagemWhatsApp.create({ data: { conversaId: conv.id, numeroId: c.numero.id, direcao: "ENTRADA", driver: "META_CLOUD", corpo: "boleto", providerMessageId: "g-1" } });
    expect(await classificarSetorPelaAria(msgGrupo.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "DESLIGADA" });
  });

  describe("COMERCIAL: a Aria atende em vez de só encaminhar", () => {
    // Classifica como COMERCIAL e, no turno de atendimento, responde com confiança alta.
    const provedorComercial: ProvedorIA = {
      nome: "simulado",
      async gerar(p: PedidoIA) {
        const texto = p.tarefa === "classificacao"
          ? JSON.stringify({ setor: "COMERCIAL", confianca: 95 })
          : JSON.stringify({ resposta: "Temos turmas à noite, quer conhecer?", documentoId: null, acoes: [], confianca: 95, handoff: null, fontes: [], humor: null });
        return { texto, modelo: "simulado", provedor: "simulado", recusa: false, tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, latenciaMs: 0 };
      },
    };

    it("sem_frase_fixa_e_turno_de_atendimento_responde_com_apresentacao", async () => {
      const autor = await criarUsuario([], "Admin");
      const config = { ...configPadrao(), nome: "Lia" };
      await prisma.versaoAgenteIA.create({ data: { numero: 1, status: "PUBLICADA", config, criadaPorId: autor.id, publicadaPorId: autor.id, publicadaEm: new Date() } });
      const m = await c.msg("Quero conhecer os cursos de inglês");
      const r = await classificarSetorPelaAria(m.id, { provedor: provedorComercial });
      expect(r).toMatchObject({ setor: "COMERCIAL" });
      const atendimentoId = (r as { atendimentoId: string }).atendimentoId;

      const turnos = await prisma.turnoAgenteIA.findMany({ orderBy: { criadoEm: "asc" } });
      expect(turnos.map((t) => [t.tipo, t.ancoraMensagemId])).toEqual([["TRIAGEM", ancoraTriagem(m.id)], ["ATENDIMENTO", m.id]]);
      expect(turnos[1]).toMatchObject({ atendimentoId, resultado: "RESPONDEU" });

      // Uma única fala ao lead: a resposta da Aria, começando pela apresentação; nenhuma frase de encaminhamento.
      const intencoes = await prisma.intencaoMensagem.findMany();
      expect(intencoes).toHaveLength(1);
      expect(intencoes[0]).toMatchObject({ origem: "IA", reativa: true, status: "PENDENTE", atendimentoId });
      expect(intencoes[0].corpoRenderizado).toBe("Oi! Eu sou a Lia, assistente virtual da escola. Temos turmas à noite, quer conhecer?");
      expect(await prisma.acaoAgenteIA.findFirstOrThrow({ where: { acao: "CLASSIFICAR_SETOR" } })).toMatchObject({ status: "EXECUTADA", intencaoId: null });
      expect((await ultimoEvento("MensagemClassificada")).payload).toMatchObject({ finalidade: "COMERCIAL", intencaoId: null });
    });
  });
});
