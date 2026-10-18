import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// Falha simulada na atribuição (C7 da R2 do #233): erro de banco DENTRO da transação da triagem.
const falha = vi.hoisted(() => ({ atribuicao: false, abertura: false }));
// Falha simulada na abertura do atendimento do setor (C10 da revisão do #233): o erro tem de ir para o log.
vi.mock("@/server/whatsapp/atendimentos", async (orig) => {
  const real = await orig<typeof import("@/server/whatsapp/atendimentos")>();
  return {
    ...real,
    abrirAtendimentoDoSetor: async (...args: Parameters<typeof real.abrirAtendimentoDoSetor>) => {
      if (falha.abertura) await args[0].$executeRawUnsafe("SELECT 1/0");
      return real.abrirAtendimentoDoSetor(...args);
    },
  };
});
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
import { seedCobranca, criarNumeroSetor } from "@/test/integracao-whatsapp";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { provedorSimulado } from "./provedor";
import type { PedidoIA, ProvedorIA } from "./provedor";
import { configPadrao } from "./config-schema";
import { ancoraTriagem, classificarSetorPelaAria, fraseEncaminhamento } from "./triagem";

beforeEach(async () => { falha.atribuicao = false; falha.abertura = false; await truncarBanco(); });

let seq = 0;
const provedorComConfianca = (setor: string | null, confianca: number): ProvedorIA => ({
  nome: "simulado",
  // Parte da resposta do provedor simulado real: herda campos novos de RespostaIA (ex.: tokensEscritaCache).
  async gerar(p: PedidoIA) {
    return { ...(await provedorSimulado.gerar(p)), texto: JSON.stringify({ setor, confianca }) };
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
    data: { conversaId: conversa.id, numeroId: numero.id, direcao: "ENTRADA", driver: "MOTOR", corpo, status: "ENTREGUE", providerMessageId: `t-${++seq}` },
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
    const m = await prisma.mensagemWhatsApp.create({ data: { conversaId: conv.id, numeroId: c.numero.id, direcao: "ENTRADA", driver: "MOTOR", corpo: "boleto", providerMessageId: "t-x" } });
    expect(await classificarSetorPelaAria(m.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "SETOR_FORA_DO_NUMERO" });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("recusa_fica_na_triagem_humana", async () => {
    const recusa: ProvedorIA = { nome: "simulado", async gerar(p) { return { ...(await provedorSimulado.gerar(p)), texto: "", recusa: true }; } };
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

  it("aria_desligada_ou_numero_com_dono_nao_atua", async () => {
    await prisma.agenteIA.update({ where: { id: "aria" }, data: { estado: "DESLIGADA" } });
    expect(await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "DESLIGADA" });
  });

  it("grupo_nunca", async () => {
    const grupo = await prisma.grupoWhatsApp.create({ data: { numeroId: c.numero.id, grupoJid: "g1@g.us", nome: "Grupo" } });
    const conv = await prisma.conversaWhatsApp.create({ data: { numeroId: c.numero.id, grupoId: grupo.id } });
    const msgGrupo = await prisma.mensagemWhatsApp.create({ data: { conversaId: conv.id, numeroId: c.numero.id, direcao: "ENTRADA", driver: "MOTOR", corpo: "boleto", providerMessageId: "g-1" } });
    expect(await classificarSetorPelaAria(msgGrupo.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "DESLIGADA" });
  });

  describe("rodízio da 5F na abertura pela triagem", () => {
    let f1: { id: string }, f2: { id: string };
    beforeEach(async () => {
      f1 = await criarUsuario([Papel.FINANCEIRO], "F1");
      f2 = await criarUsuario([Papel.FINANCEIRO], "F2");
      await prisma.prazoRespostaSetor.upsert({
        where: { finalidade: "FINANCEIRO" },
        create: { finalidade: "FINANCEIRO", minutos: 60, regraDistribuicao: "RODIZIO", participantesIds: [f1.id, f2.id] },
        update: { regraDistribuicao: "RODIZIO", participantesIds: [f1.id, f2.id], ultimoAtribuidoId: null },
      });
    });

    it("atendimento_aberto_pela_triagem_recebe_responsavel_pelo_rodizio", async () => {
      const r = await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado });
      expect(r).toMatchObject({ setor: "FINANCEIRO" });
      const a = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: (r as { atendimentoId: string }).atendimentoId } });
      expect(a).toMatchObject({ responsavelId: f1.id, status: "EM_ATENDIMENTO" });
      expect((await ultimoEvento("AtendimentoAtribuido")).payload).toMatchObject({ atendimentoId: a.id, responsavelId: f1.id, motivo: "RODIZIO" });
      expect((await prisma.prazoRespostaSetor.findUniqueOrThrow({ where: { finalidade: "FINANCEIRO" } })).ultimoAtribuidoId).toBe(f1.id);
      expect((await ultimaIntencao()).corpoRenderizado).toBe(fraseEncaminhamento("FINANCEIRO", "Aria"));
    });

    it("falha_de_banco_na_atribuicao_nao_quebra_a_transacao_e_o_lead_fica_na_fila_do_setor", async () => {
      falha.atribuicao = true;
      const r = await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado });
      expect(r).toMatchObject({ setor: "FINANCEIRO" });
      const atendimentoId = (r as { atendimentoId: string }).atendimentoId;
      // Atendimento aberto e ligado à mensagem, sem responsável (fila do setor), com o encaminhamento ao lead.
      expect(await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atendimentoId } })).toMatchObject({ responsavelId: null, finalidade: "FINANCEIRO" });
      expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: msgBoleto.id } })).atendimentoId).toBe(atendimentoId);
      expect(await ultimaIntencao()).toMatchObject({ atendimentoId, origem: "IA", status: "PENDENTE" });
      expect(await prisma.evento.count({ where: { tipo: "AtendimentoAtribuido" } })).toBe(0);
      expect(await prisma.evento.count({ where: { tipo: "MensagemClassificada" } })).toBe(1);
    });
  });

  it("falha_na_abertura_do_setor_vai_para_o_log_sem_dados_pessoais_e_volta_a_triagem_humana", async () => {
    falha.abertura = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await classificarSetorPelaAria(msgBoleto.id, { provedor: provedorSimulado })).toEqual({ triagemHumana: "SETOR_FORA_DO_NUMERO" });
      expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: msgBoleto.id } })).atendimentoId).toBeNull();
      const chamada = log.mock.calls.find((a) => String(a[0]).includes("[aria]"));
      expect(chamada).toEqual([expect.stringContaining("abertura"), expect.objectContaining({ mensagemId: msgBoleto.id, setor: "FINANCEIRO" })]);
      const texto = JSON.stringify(chamada);
      expect(texto).not.toContain("boleto");
      expect(texto).not.toContain(c.contato.telefoneE164);
    } finally {
      log.mockRestore();
    }
  });

  describe("COMERCIAL: a Aria atende em vez de só encaminhar", () => {
    // Classifica como COMERCIAL e, no turno de atendimento, responde com confiança alta.
    const provedorComercial: ProvedorIA = {
      nome: "simulado",
      async gerar(p: PedidoIA) {
        const texto = p.tarefa === "classificacao"
          ? JSON.stringify({ setor: "COMERCIAL", confianca: 95 })
          : JSON.stringify({ resposta: "Temos turmas à noite, quer conhecer?", documentoId: null, acoes: [], confianca: 95, handoff: null, fontes: [], humor: null });
        return { ...(await provedorSimulado.gerar(p)), texto };
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
