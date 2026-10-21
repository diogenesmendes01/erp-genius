import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { diaUtilAs } from "@/test/janela-envio";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { notasDoAtendimento } from "@/server/whatsapp/acoes-conversa";
import { montarContextoTurno } from "./turno/contexto";
import { executarAcaoCrm, executarResposta } from "./turno/executor";
import type { AcaoProposta } from "./turno/tipos";
import { aprovarAcaoAria, desfazerAcaoAria, rejeitarAcaoAria } from "./historico";

type U = Awaited<ReturnType<typeof criarUsuario>>;
const logado = (u: U) => authMock.mockResolvedValue({ user: { id: u.id } });

let seq = 0;
async function cenario() {
  const cat = await seedCatalogoMinimo();
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const gerenteOutra = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outra equipe");
  const dono = await criarUsuario([Papel.VENDEDOR]);
  await prisma.usuario.update({ where: { id: dono.id }, data: { gerenteComercialId: gerente.id } });
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const pessoa = await prisma.pessoa.create({ data: { nome: "Maria" } });
  const op = await prisma.oportunidade.create({
    data: { nome: "Maria", paisId: cat.pais.id, telefoneE164: "+50688888888", vendedorDonoId: dono.id, pessoaId: pessoa.id },
  });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: op.id } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }));
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } });
  const ancora = await prisma.mensagemWhatsApp.create({
    data: { atendimentoId: at.id, conversaId: conv.conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo: "oi", driver: "MOTOR", status: "ENTREGUE", providerMessageId: `hist-${++seq}` },
  });
  const turno = await prisma.turnoAgenteIA.create({ data: { ancoraMensagemId: ancora.id, atendimentoId: at.id, tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO" } });
  const tag = await prisma.tag.create({ data: { nome: "Interessado", cor: "INFO" } });
  const campo = await prisma.campoPersonalizado.create({ data: { nome: "objetivo", tipo: "TEXTO", alvo: "PESSOA" } });
  return { op, at, turno, tag, campo, pessoa, gerente, gerenteOutra, dono };
}

describe("histórico da Aria: aprovar, rejeitar, desfazer", () => {
  let c: Awaited<ReturnType<typeof cenario>>;
  beforeEach(async () => {
    await truncarBanco();
    authMock.mockReset();
    c = await cenario();
    logado(c.gerente);
  });

  const exec = (proposta: AcaoProposta, destino: "EXECUTAR" | "SUGERIR" = "EXECUTAR") =>
    prisma.$transaction(async (tx) => {
      const ctx = await montarContextoTurno(c.at.id, tx);
      return executarAcaoCrm(tx, { turnoId: c.turno.id, ctx, proposta, destino, modo: destino === "EXECUTAR" ? "EXECUTA" : "SUGERE", simulado: false, confianca: 90 });
    });
  const acao = (a: { id: string }) => prisma.acaoAgenteIA.findUniqueOrThrow({ where: { id: a.id } });
  const tags = () => prisma.pessoaTag.findMany({ where: { pessoaId: c.pessoa.id } });
  const valorCampo = async () => (await prisma.valorCampoPersonalizado.findFirst({ where: { campoId: c.campo.id, pessoaId: c.pessoa.id } }))?.valor ?? null;
  const amanha = () => new Date(Date.now() + 86_400_000).toISOString();
  const util = () => diaUtilAs(10).toISOString(); // D12: dentro da janela de envio
  const sugTag = () => exec({ acao: "TAG", tagId: c.tag.id, justificativa: "x" }, "SUGERIR");

  it("aprovar_aplica_e_marca_quem", async () => {
    const s = await sugTag();
    expect((await aprovarAcaoAria(s.id)).ok).toBe(true);
    expect(await acao(s)).toMatchObject({ status: "APROVADA", decididaPorId: c.gerente.id, eventoId: expect.any(String) });
    expect(await tags()).toHaveLength(1);
    expect(await prisma.evento.findFirstOrThrow({ where: { tipo: "AcaoAriaAprovada", agregadoTipo: "AcaoAgenteIA", agregadoId: s.id } })).toMatchObject({ autorId: c.gerente.id });
  });

  it("aprovar_duas_vezes_falha", async () => {
    const s = await sugTag();
    await aprovarAcaoAria(s.id);
    expect(await aprovarAcaoAria(s.id)).toEqual({ ok: false, erro: "Esta sugestão já foi decidida." });
  });

  it("gerente_so_na_propria_equipe", async () => {
    const s = await sugTag();
    logado(c.gerenteOutra);
    expect((await aprovarAcaoAria(s.id)).ok).toBe(false);
    expect((await rejeitarAcaoAria(s.id)).ok).toBe(false);
    expect((await acao(s)).status).toBe("SUGERIDA");
    expect(await tags()).toHaveLength(0);
  });

  it("sem_capacidade_nao_decide", async () => {
    const s = await sugTag();
    logado(c.dono);
    expect((await aprovarAcaoAria(s.id)).ok).toBe(false);
  });

  it("aprovar_expirada_falha", async () => {
    const s = await sugTag();
    await prisma.acaoAgenteIA.update({ where: { id: s.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    expect(await aprovarAcaoAria(s.id)).toEqual({ ok: false, erro: "Esta sugestão expirou." });
  });

  it("aprovar_revalida_estado_e_nao_aplica_parcial", async () => {
    const s = await exec({ acao: "MOVER_ETAPA", para: "EM_ATENDIMENTO", justificativa: "x" }, "SUGERIR");
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { etapa: "PERDIDO" } });
    expect((await aprovarAcaoAria(s.id)).ok).toBe(false);
    expect((await acao(s)).status).toBe("SUGERIDA");
  });

  it("rejeitar_marca_motivo_e_nao_aplica", async () => {
    const s = await sugTag();
    expect((await rejeitarAcaoAria(s.id, "  Não é o momento  ")).ok).toBe(true);
    expect(await acao(s)).toMatchObject({ status: "REJEITADA", decididaPorId: c.gerente.id, payload: { motivoRejeicao: "Não é o momento" } });
    expect(await tags()).toHaveLength(0);
    expect(await prisma.evento.count({ where: { tipo: "AcaoAriaRejeitada" } })).toBe(1);
    expect(await rejeitarAcaoAria(s.id)).toEqual({ ok: false, erro: "Esta sugestão já foi decidida." });
  });

  it("aprovar_resposta_sugerida_cria_intencao_ia", async () => {
    const r = await prisma.$transaction(async (tx) => {
      const ctx = await montarContextoTurno(c.at.id, tx);
      return executarResposta(tx, { turnoId: c.turno.id, ctx, texto: "Podemos conversar.", documentoId: null, destino: "SUGERIR", simulado: false, confianca: 70, fontes: [], nomeAria: "Aria" });
    });
    if (!("acao" in r)) throw new Error("bloqueada");
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect((await aprovarAcaoAria(r.acao.id)).ok).toBe(true);
    const m = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(m).toMatchObject({ origem: "IA", reativa: true, status: "PENDENTE", acaoAgenteIAId: r.acao.id, atendimentoId: c.at.id });
    expect(m.corpoRenderizado).toContain("Podemos conversar.");
    expect(await acao(r.acao)).toMatchObject({ status: "APROVADA", intencaoId: m.id });
  });

  it("aprovar_resposta_com_aria_pausada_falha", async () => {
    const r = await prisma.$transaction(async (tx) => {
      const ctx = await montarContextoTurno(c.at.id, tx);
      return executarResposta(tx, { turnoId: c.turno.id, ctx, texto: "Olá", documentoId: null, destino: "SUGERIR", simulado: false, confianca: 70, fontes: [], nomeAria: "Aria" });
    });
    if (!("acao" in r)) throw new Error("bloqueada");
    await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { iaPausadaEm: new Date(), iaPausaMotivo: "HUMANO_RESPONDEU" } });
    expect((await aprovarAcaoAria(r.acao.id)).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("aprovar_agendamento_com_aria_pausada_falha", async () => {
    const s = await exec({ acao: "AGENDAR_MENSAGEM", texto: "Lembrete da aula", enviarEmISO: util(), justificativa: "x" }, "SUGERIR");
    expect(s.status).toBe("SUGERIDA");
    await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { iaPausadaEm: new Date(), iaPausaMotivo: "HUMANO_RESPONDEU" } });
    expect(await aprovarAcaoAria(s.id)).toEqual({ ok: false, erro: "A Aria está pausada neste atendimento: uma pessoa já assumiu a conversa." });
    expect((await acao(s)).status).toBe("SUGERIDA");
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("aprovar_agendamento_depois_de_mudanca_de_preco_falha", async () => {
    const s = await exec({ acao: "AGENDAR_MENSAGEM", texto: "A mensalidade é ₡85.000.", enviarEmISO: util(), justificativa: "x" }, "SUGERIR");
    expect(s.status).toBe("SUGERIDA");
    await prisma.precoReferencia.updateMany({ where: { tipoCobranca: "MENSALIDADE" }, data: { valor: 90000 } });
    expect(await aprovarAcaoAria(s.id)).toEqual({ ok: false, erro: "O texto cita um valor que não está mais autorizado." });
    expect((await acao(s)).status).toBe("SUGERIDA");
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("aprovar_agendamento_valido_cria_intencao_ia_agendada", async () => {
    const s = await exec({ acao: "AGENDAR_MENSAGEM", texto: "A mensalidade é ₡85.000.", enviarEmISO: util(), justificativa: "x" }, "SUGERIR");
    expect((await aprovarAcaoAria(s.id)).ok).toBe(true);
    expect(await prisma.intencaoMensagem.findFirstOrThrow()).toMatchObject({ origem: "IA", acaoAgenteIAId: s.id, agendadaPara: expect.any(Date) });
  });

  it("desfazer_tag_remove_e_grava_eventos", async () => {
    const e = await exec({ acao: "TAG", tagId: c.tag.id, justificativa: "x" });
    expect((await desfazerAcaoAria(e.id)).ok).toBe(true);
    expect(await tags()).toHaveLength(0);
    expect(await acao(e)).toMatchObject({ status: "DESFEITA", desfeitaPorId: c.gerente.id });
    expect(await prisma.evento.count({ where: { tipo: "TagRemovida", autorId: c.gerente.id } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "AcaoAriaDesfeita", agregadoId: e.id } })).toBe(1);
    expect(await desfazerAcaoAria(e.id)).toEqual({ ok: false, erro: "Esta ação já foi desfeita." });
  });

  it("desfazer_restaura_antes", async () => {
    const e = await exec({ acao: "ATUALIZAR_CAMPO", campo: "objetivo", valor: "viagem", justificativa: "x" });
    expect(await valorCampo()).toBe("viagem");
    expect((await desfazerAcaoAria(e.id)).ok).toBe(true);
    expect(await valorCampo()).toBeNull();
    expect(await acao(e)).toMatchObject({ status: "DESFEITA" });
  });

  it("desfazer_irreversivel_falha", async () => {
    const r = await prisma.$transaction(async (tx) => {
      const ctx = await montarContextoTurno(c.at.id, tx);
      return executarResposta(tx, { turnoId: c.turno.id, ctx, texto: "Olá", documentoId: null, destino: "EXECUTAR", simulado: false, confianca: 95, fontes: [], nomeAria: "Aria" });
    });
    if (!("acao" in r)) throw new Error("bloqueada");
    expect(await desfazerAcaoAria(r.acao.id)).toEqual({ ok: false, erro: "Mensagem enviada não pode ser desfeita" });
  });

  it("desfazer_nao_sobrescreve_mudanca_humana", async () => {
    const e = await exec({ acao: "ATUALIZAR_CAMPO", campo: "objetivo", valor: "viagem", justificativa: "x" });
    // pessoa muda o campo depois da Aria (valor e Evento sem ator ARIA)
    await prisma.valorCampoPersonalizado.updateMany({ where: { campoId: c.campo.id, pessoaId: c.pessoa.id }, data: { valor: "trabalho" } });
    await prisma.evento.create({ data: { tipo: "CampoPersonalizadoAlterado", agregadoTipo: "Pessoa", agregadoId: c.pessoa.id, autorId: c.dono.id, payload: { campoId: c.campo.id, nome: "objetivo", de: "viagem", para: "trabalho" } } });
    expect(await desfazerAcaoAria(e.id)).toEqual({ ok: false, erro: "O campo foi alterado por uma pessoa depois da Aria. Nada foi desfeito." });
    expect(await valorCampo()).toBe("trabalho");
    expect((await acao(e)).status).toBe("EXECUTADA");
  });

  it("desfazer_campo_com_evento_humano_e_mesmo_valor_tambem_falha", async () => {
    const e = await exec({ acao: "ATUALIZAR_CAMPO", campo: "objetivo", valor: "viagem", justificativa: "x" });
    await prisma.evento.create({ data: { tipo: "CampoPersonalizadoAlterado", agregadoTipo: "Pessoa", agregadoId: c.pessoa.id, autorId: c.dono.id, payload: { campoId: c.campo.id, nome: "objetivo", de: "viagem", para: "viagem" } } });
    expect((await desfazerAcaoAria(e.id)).ok).toBe(false);
  });

  it("desfazer_mensagem_agendada_pendente_cancela", async () => {
    const e = await exec({ acao: "AGENDAR_MENSAGEM", texto: "Lembrete", enviarEmISO: util(), justificativa: "x" });
    expect((await desfazerAcaoAria(e.id)).ok).toBe(true);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: e.intencaoId! } })).status).toBe("CANCELADA");
  });

  it("desfazer_mensagem_agendada_ja_despachada_falha", async () => {
    const e = await exec({ acao: "AGENDAR_MENSAGEM", texto: "Lembrete", enviarEmISO: util(), justificativa: "x" });
    await prisma.intencaoMensagem.update({ where: { id: e.intencaoId! }, data: { status: "DESPACHADA" } });
    expect((await desfazerAcaoAria(e.id)).ok).toBe(false);
    expect((await acao(e)).status).toBe("EXECUTADA");
  });

  it("desfazer_etapa_volta_e_revalida_transicao", async () => {
    const e = await exec({ acao: "MOVER_ETAPA", para: "EM_ATENDIMENTO", justificativa: "x" });
    expect((await desfazerAcaoAria(e.id)).ok).toBe(true);
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: c.op.id } })).etapa).toBe("NOVO");

    const f = await exec({ acao: "MOVER_ETAPA", para: "EM_ATENDIMENTO", justificativa: "x" });
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { etapa: "PERDIDO" } });
    expect((await desfazerAcaoAria(f.id)).ok).toBe(false);
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: c.op.id } })).etapa).toBe("PERDIDO");
  });

  it("desfazer_marcar_perdido_restaura_etapa_e_motivo", async () => {
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { etapa: "QUALIFICADO" } });
    const e = await exec({ acao: "MARCAR_PERDIDO", motivo: "PRECO", justificativa: "x" });
    expect((await desfazerAcaoAria(e.id)).ok).toBe(true);
    expect(await prisma.oportunidade.findUniqueOrThrow({ where: { id: c.op.id } })).toMatchObject({ etapa: "QUALIFICADO", motivoPerda: null });
  });

  it("desfazer_tarefa_cancela_e_recusa_se_ja_concluida", async () => {
    const e = await exec({ acao: "CRIAR_TAREFA", titulo: "Ligar", venceEmISO: amanha(), justificativa: "x" });
    expect((await desfazerAcaoAria(e.id)).ok).toBe(true);
    const t = await prisma.tarefa.findFirstOrThrow({ where: { titulo: "Ligar" } });
    expect(t).toMatchObject({ status: "CANCELADA", canceladaEm: expect.any(Date) });

    const g = await exec({ acao: "CRIAR_TAREFA", titulo: "Outra", venceEmISO: amanha(), justificativa: "x" });
    await prisma.tarefa.updateMany({ where: { titulo: "Outra" }, data: { status: "CONCLUIDA" } });
    expect((await desfazerAcaoAria(g.id)).ok).toBe(false);
  });

  it("desfazer_nota_arquiva_e_some_da_lista", async () => {
    const e = await exec({ acao: "NOTA_INTERNA", texto: "Prefere noite", justificativa: "x" });
    logado(c.gerente);
    expect((await notasDoAtendimento(c.at.id)).map((n) => n.nota)).toEqual(["Prefere noite"]);
    expect((await desfazerAcaoAria(e.id)).ok).toBe(true);
    expect(await notasDoAtendimento(c.at.id)).toEqual([]);
    expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "NotaInternaArquivada" } })).toBe(1);
  });
});
