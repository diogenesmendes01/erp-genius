import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { pausarAriaNoAtendimento } from "../pausa";
import { montarContextoTurno } from "./contexto";
import { executarResposta } from "./executor";

beforeEach(truncarBanco);

let seq = 0;
async function cenario() {
  const cat = await seedCatalogoMinimo();
  const dono = await criarUsuario([]);
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const op = await prisma.oportunidade.create({
    data: { nome: "Maria", paisId: cat.pais.id, telefoneE164: "+50688888888", vendedorDonoId: dono.id },
  });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: op.id } });
  const at = await prisma.$transaction((tx) =>
    garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }),
  );
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } });
  const ancora = await prisma.mensagemWhatsApp.create({
    data: {
      atendimentoId: at.id, conversaId: conv.conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo: "oi",
      driver: "MOTOR", status: "ENTREGUE", providerMessageId: `ex-${++seq}`,
    },
  });
  const turno = await prisma.turnoAgenteIA.create({
    data: { ancoraMensagemId: ancora.id, atendimentoId: at.id, tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO" },
  });
  const fonte = async (enviavel: boolean) => {
    const dir = await criarUsuario([]);
    const up = await prisma.registroUpload.create({
      data: { url: `/api/files/doc-${++seq}.pdf`, nome: "tabela.pdf", mime: "application/pdf", tamanho: 10, autorId: dir.id },
    });
    return prisma.fonteConhecimento.create({
      data: { tipo: "ARQUIVO", nome: "Tabela", registroUploadId: up.id, status: "PRONTA", hashConteudo: `h${seq}`, enviavelAoLead: enviavel, criadoPorId: dir.id },
    });
  };
  return { at, turno, fonte, primeira: true };
}

describe("executor: resposta e documento", () => {
  let c: Awaited<ReturnType<typeof cenario>>;
  beforeEach(async () => {
    c = await cenario();
  });

  async function executar(o: { texto: string; destino: "EXECUTAR" | "SUGERIR"; simulado?: boolean; documentoId?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const ctx = await montarContextoTurno(c.at.id, tx);
      return executarResposta(tx, {
        turnoId: c.turno.id, ctx, texto: o.texto, documentoId: o.documentoId ?? null, destino: o.destino,
        simulado: o.simulado ?? false, confianca: 90, fontes: [], nomeAria: "Aria",
      });
    });
  }
  const ultimaIntencao = () => prisma.intencaoMensagem.findFirstOrThrow({ orderBy: { criadaEm: "desc" } });
  const contarIntencoes = () => prisma.intencaoMensagem.count();

  it("primeira_resposta_comeca_com_apresentacao", async () => {
    await executar({ texto: "Temos turmas à noite.", destino: "EXECUTAR" });
    expect((await ultimaIntencao()).corpoRenderizado).toBe("Oi! Eu sou a Aria, assistente virtual da escola. Temos turmas à noite.");
  });

  it("intencao_reativa_origem_ia_com_acao", async () => {
    const r = await executar({ texto: "ok", destino: "EXECUTAR" });
    expect(await ultimaIntencao()).toMatchObject({ origem: "IA", reativa: true, status: "PENDENTE", acaoAgenteIAId: (r as any).acao.id });
    expect((r as any).acao).toMatchObject({ acao: "RESPONDER", status: "EXECUTADA", reversivel: false, motivoIrreversivel: "Mensagem enviada não pode ser desfeita" });
    expect((r as any).acao.intencaoId).toBe((await ultimaIntencao()).id);
  });

  it("so_texto_ou_documento", async () => {
    await executar({ texto: "ok", destino: "EXECUTAR" });
    expect(["TEXTO", "DOCUMENTO"]).toContain((await ultimaIntencao()).tipo);
  });

  it("shadow_grava_simulada", async () => {
    await executar({ texto: "ok", destino: "EXECUTAR", simulado: true });
    expect(await ultimaIntencao()).toMatchObject({ status: "SIMULADA" });
  });

  it("sugerir_nao_cria_intencao", async () => {
    const r = await executar({ texto: "ok", destino: "SUGERIR" });
    expect(await contarIntencoes()).toBe(0);
    expect((r as any).acao.status).toBe("SUGERIDA");
  });

  it("valor_inventado_bloqueia", async () => {
    expect(await executar({ texto: "Faço por R$ 10", destino: "EXECUTAR" })).toEqual({ bloqueada: "VALOR_NAO_AUTORIZADO" });
    expect(await contarIntencoes()).toBe(0);
  });

  it("valor_da_tabela_passa", async () => {
    const r = await executar({ texto: "A matrícula é ₡20.000 e posso dar 10% em até 10x", destino: "EXECUTAR" });
    expect(r).toHaveProperty("acao");
  });

  it("valor_de_resposta_rapida_liberada_passa_e_de_nao_liberada_bloqueia", async () => {
    const rr = (atalho: string, corpo: string, ariaPodeUsar: boolean, setor: "COMERCIAL" | "FINANCEIRO" | null = null) =>
      prisma.templateWhatsApp.create({ data: { nome: `rr:${atalho}`, atalho, titulo: atalho, corpo, tipo: "RESPOSTA_RAPIDA", ariaPodeUsar, setor } });
    await rr("/material", "O material didático custa ₡15.000 em até 12x.", true, "COMERCIAL");
    await rr("/taxa", "A taxa de prova é ₡7.500.", false);
    await rr("/boleto", "A segunda via custa ₡2.000.", true, "FINANCEIRO");
    expect(await executar({ texto: "O material é ₡15.000 e dá para pagar em 12x.", destino: "EXECUTAR" })).toHaveProperty("acao");
    expect(await executar({ texto: "A taxa de prova é ₡7.500.", destino: "EXECUTAR" })).toEqual({ bloqueada: "VALOR_NAO_AUTORIZADO" });
    // Liberada, mas de outro setor: não entra no contexto, então o valor dela não está autorizado.
    expect(await executar({ texto: "A segunda via custa ₡2.000.", destino: "EXECUTAR" })).toEqual({ bloqueada: "VALOR_NAO_AUTORIZADO" });
  });

  it("nao_envia_se_humano_respondeu_durante_o_turno", async () => {
    await prisma.$transaction((tx) => pausarAriaNoAtendimento(tx, c.at.id, "CELULAR", null));
    expect(await executar({ texto: "ok", destino: "EXECUTAR" })).toEqual({ bloqueada: "PAUSADA_DURANTE_TURNO" });
    expect(await contarIntencoes()).toBe(0);
  });

  it("documento_so_se_enviavel", async () => {
    const naoEnviavel = await c.fonte(false);
    const enviavel = await c.fonte(true);
    expect(await executar({ texto: "Segue", documentoId: naoEnviavel.id, destino: "EXECUTAR" })).toEqual({ bloqueada: "DOCUMENTO_NAO_ENVIAVEL" });
    expect(await executar({ texto: "Segue", documentoId: "inexistente", destino: "EXECUTAR" })).toEqual({ bloqueada: "DOCUMENTO_NAO_ENVIAVEL" });
    const r = await executar({ texto: "Segue", documentoId: enviavel.id, destino: "EXECUTAR" });
    expect(await ultimaIntencao()).toMatchObject({ tipo: "DOCUMENTO", midiaPath: expect.stringContaining("/api/files/") });
    expect((r as any).acao.acao).toBe("ENVIAR_DOCUMENTO");
  });
});
