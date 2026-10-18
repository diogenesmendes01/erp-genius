import { beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { montarContextoTurno } from "./contexto";
import { aplicarAcao, executarAcaoCrm } from "./executor";
import type { AcaoProposta } from "./tipos";

beforeEach(truncarBanco);

let seq = 0;
async function cenario(opts: { semPessoa?: boolean; semDono?: boolean } = {}) {
  const cat = await seedCatalogoMinimo();
  const dono = await criarUsuario([Papel.VENDEDOR]);
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const pessoa = opts.semPessoa ? null : await prisma.pessoa.create({ data: { nome: "Maria" } });
  const op = await prisma.oportunidade.create({
    data: { nome: "Maria", paisId: cat.pais.id, telefoneE164: "+50688888888", vendedorDonoId: opts.semDono ? null : dono.id, pessoaId: pessoa?.id ?? null },
  });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: op.id } });
  const at = await prisma.$transaction((tx) =>
    garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }),
  );
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } });
  const ancora = await prisma.mensagemWhatsApp.create({
    data: {
      atendimentoId: at.id, conversaId: conv.conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo: "oi",
      driver: "MOTOR", status: "ENTREGUE", providerMessageId: `crm-${++seq}`,
    },
  });
  const turno = await prisma.turnoAgenteIA.create({
    data: { ancoraMensagemId: ancora.id, atendimentoId: at.id, tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO" },
  });
  const tag = await prisma.tag.create({ data: { nome: "Interessado", cor: "INFO" } });
  return { op, at, turno, tag, dono, pessoa };
}

describe("executor: ações no CRM", () => {
  let c: Awaited<ReturnType<typeof cenario>>;
  beforeEach(async () => {
    c = await cenario();
  });

  async function exec(
    proposta: AcaoProposta,
    destino: "EXECUTAR" | "SUGERIR" | "NEGAR" = "EXECUTAR",
    o: { simulado?: boolean } = {},
  ) {
    return prisma.$transaction(async (tx) => {
      const ctx = await montarContextoTurno(c.at.id, tx);
      return executarAcaoCrm(tx, {
        turnoId: c.turno.id, ctx, proposta, destino, modo: destino === "EXECUTAR" ? "EXECUTA" : destino === "SUGERIR" ? "SUGERE" : "NAO_FAZ",
        simulado: o.simulado ?? false, confianca: 90,
      });
    });
  }
  const etapa = async () => (await prisma.oportunidade.findUniqueOrThrow({ where: { id: c.op.id } })).etapa;
  const ultimoEvento = (tipo: string) => prisma.evento.findFirstOrThrow({ where: { tipo }, orderBy: { criadoEm: "desc" } });
  const tagsDe = () => prisma.pessoaTag.findMany({ where: { pessoaId: c.pessoa!.id } });
  const amanha = () => new Date(Date.now() + 86_400_000).toISOString();

  it("mover_etapa_grava_evento_da_aria", async () => {
    const a = await exec({ acao: "MOVER_ETAPA", para: "EM_ATENDIMENTO", justificativa: "respondeu" });
    expect(a.status).toBe("EXECUTADA");
    expect(await etapa()).toBe("EM_ATENDIMENTO");
    expect((await ultimoEvento("EtapaAlterada")).payload).toMatchObject({ ator: "ARIA", acaoAgenteIAId: a.id, de: "NOVO", para: "EM_ATENDIMENTO" });
    expect((await ultimoEvento("EtapaAlterada")).autorId).toBeNull();
    expect(a).toMatchObject({ reversivel: true, eventoId: (await ultimoEvento("EtapaAlterada")).id });
  });

  it("transicao_proibida_bloqueada", async () => {
    const a = await exec({ acao: "MOVER_ETAPA", para: "MATRICULADO", justificativa: "x" });
    expect(a.status).toBe("BLOQUEADA");
    expect(await etapa()).toBe("NOVO");
  });

  it("marcar_perdido_grava_motivo_e_evento", async () => {
    const a = await exec({ acao: "MARCAR_PERDIDO", motivo: "PRECO", justificativa: "x" });
    expect(a.status).toBe("EXECUTADA");
    expect(await prisma.oportunidade.findUniqueOrThrow({ where: { id: c.op.id } })).toMatchObject({ etapa: "PERDIDO", motivoPerda: "PRECO" });
    expect((await ultimoEvento("LeadPerdido")).payload).toMatchObject({ ator: "ARIA", acaoAgenteIAId: a.id, motivoPerda: "PRECO" });
    expect((await exec({ acao: "MARCAR_PERDIDO", motivo: "TEMPO", justificativa: "x" })).status).toBe("BLOQUEADA");
  });

  it("tag_grava_pessoa_tag_e_sem_pessoa_bloqueia", async () => {
    const a = await exec({ acao: "TAG", tagId: c.tag.id, justificativa: "x" });
    expect(a.status).toBe("EXECUTADA");
    expect(await tagsDe()).toHaveLength(1);
    expect((await ultimoEvento("TagAtribuida")).payload).toMatchObject({ ator: "ARIA", acaoAgenteIAId: a.id });
    expect((await exec({ acao: "TAG", tagId: c.tag.id, justificativa: "x" })).status).toBe("BLOQUEADA");
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { pessoaId: null } });
    const b = await exec({ acao: "TAG", tagId: c.tag.id, justificativa: "x" });
    expect(b.status).toBe("BLOQUEADA");
  });

  it("tarefa_com_origem_aria", async () => {
    await exec({ acao: "CRIAR_TAREFA", titulo: "Ligar", venceEmISO: amanha(), justificativa: "x" });
    expect(await prisma.tarefa.findFirstOrThrow({ orderBy: { criadoEm: "desc" } })).toMatchObject({
      origem: "IA", responsavelId: c.op.vendedorDonoId, leadId: c.op.id, titulo: "Ligar", criadorId: null,
    });
  });

  it("nota_interna_vira_evento_sem_mensagem", async () => {
    const a = await exec({ acao: "NOTA_INTERNA", texto: "Prefere noite", justificativa: "x" });
    expect(a.status).toBe("EXECUTADA");
    expect(await ultimoEvento("NotaInterna")).toMatchObject({ agregadoTipo: "AtendimentoWhatsApp", agregadoId: c.at.id, autorId: null, payload: { nota: "Prefere noite", ator: "ARIA" } });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("agendar_mensagem_cria_intencao_ia_agendada", async () => {
    const quando = amanha();
    const a = await exec({ acao: "AGENDAR_MENSAGEM", texto: "Lembrete da aula", enviarEmISO: quando, justificativa: "x" });
    expect(a.status).toBe("EXECUTADA");
    const m = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(m).toMatchObject({ origem: "IA", atendimentoId: c.at.id, corpoRenderizado: "Lembrete da aula", acaoAgenteIAId: a.id, status: "PENDENTE" });
    expect(m.agendadaPara?.toISOString()).toBe(quando);
    expect(a.intencaoId).toBe(m.id);
    const passado = await exec({ acao: "AGENDAR_MENSAGEM", texto: "x", enviarEmISO: new Date(Date.now() - 1000).toISOString(), justificativa: "x" });
    expect(passado.status).toBe("BLOQUEADA");
    const valor = await exec({ acao: "AGENDAR_MENSAGEM", texto: "Faço por R$ 10", enviarEmISO: quando, justificativa: "x" });
    expect(valor.status).toBe("BLOQUEADA");
  });

  it("negar_nao_muda_nada", async () => {
    const a = await exec({ acao: "TAG", tagId: c.tag.id, justificativa: "x" }, "NEGAR");
    expect(a.status).toBe("BLOQUEADA");
    expect(await tagsDe()).toEqual([]);
  });

  it("sugerir_guarda_payload_e_expira", async () => {
    const a = await exec({ acao: "TAG", tagId: c.tag.id, justificativa: "x" }, "SUGERIR");
    expect(a).toMatchObject({ status: "SUGERIDA", expiraEm: expect.any(Date), payload: { tagId: c.tag.id } });
    const min = (a.expiraEm!.getTime() - Date.now()) / 60_000;
    expect(min).toBeGreaterThan(59);
    expect(min).toBeLessThanOrEqual(60);
    expect(await tagsDe()).toEqual([]);
    expect(await prisma.evento.count({ where: { tipo: "TagAtribuida" } })).toBe(0);
  });

  it("sugerida_aplicada_depois_por_aplicarAcao", async () => {
    const a = await exec({ acao: "MOVER_ETAPA", para: "EM_ATENDIMENTO", justificativa: "x" }, "SUGERIR");
    const r = await prisma.$transaction((tx) => aplicarAcao(tx, a));
    expect(await etapa()).toBe("EM_ATENDIMENTO");
    expect(r.eventoId).toBe((await ultimoEvento("EtapaAlterada")).id);
    expect((await prisma.acaoAgenteIA.findUniqueOrThrow({ where: { id: a.id } })).eventoId).toBe(r.eventoId);
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { etapa: "QUALIFICADO" } });
    const b = await exec({ acao: "MOVER_ETAPA", para: "EXPERIMENTAL_AGENDADA", justificativa: "x" }, "SUGERIR");
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { etapa: "EM_ATENDIMENTO" } });
    await expect(prisma.$transaction((tx) => aplicarAcao(tx, b))).rejects.toThrow();
  });

  it("shadow_nao_muda", async () => {
    const a = await exec({ acao: "TAG", tagId: c.tag.id, justificativa: "x" }, "EXECUTAR", { simulado: true });
    expect(a.status).toBe("SIMULADA");
    expect(await tagsDe()).toEqual([]);
    expect(await prisma.evento.count({ where: { tipo: "TagAtribuida" } })).toBe(0);
  });

  it("desconto_entre_limites_cria_aprovacao", async () => {
    const a = await exec({ acao: "CONDICAO_COMERCIAL", tipoCobranca: "MENSALIDADE", descontoPct: 15, parcelas: 1, justificativa: "x" });
    expect(a).toMatchObject({ status: "EXECUTADA", aprovacaoId: expect.any(String), reversivel: false });
    expect(await prisma.aprovacao.findUniqueOrThrow({ where: { id: a.aprovacaoId! } })).toMatchObject({ tipo: "DESCONTO", status: "PENDENTE" });
  });

  it("desconto_dentro_do_limite_nao_cria_aprovacao_e_acima_bloqueia", async () => {
    const ok = await exec({ acao: "CONDICAO_COMERCIAL", tipoCobranca: "MATRICULA", descontoPct: 10, parcelas: 1, justificativa: "x" });
    expect(ok).toMatchObject({ status: "EXECUTADA", aprovacaoId: null, reversivel: false });
    const fora = await exec({ acao: "CONDICAO_COMERCIAL", tipoCobranca: "MATRICULA", descontoPct: 25, parcelas: 1, justificativa: "x" });
    expect(fora).toMatchObject({ status: "BLOQUEADA", payload: { motivoBloqueio: "FORA_POLITICA", motivoHandoff: "FORA_POLITICA" } });
    expect(await prisma.aprovacao.count()).toBe(0);
  });

  it("payload_guarda_antes_para_desfazer", async () => {
    await prisma.campoPersonalizado.create({ data: { nome: "objetivo", tipo: "TEXTO", alvo: "PESSOA" } });
    const a = await exec({ acao: "ATUALIZAR_CAMPO", campo: "objetivo", valor: "viagem", justificativa: "x" });
    expect(a.status).toBe("EXECUTADA");
    expect(a.payload).toMatchObject({ de: null, para: "viagem", campo: "objetivo" });
    const v = await prisma.valorCampoPersonalizado.findFirstOrThrow({ where: { pessoaId: c.pessoa!.id } });
    expect(v.valor).toBe("viagem");
    const b = await exec({ acao: "ATUALIZAR_CAMPO", campo: "objetivo", valor: "trabalho", justificativa: "x" });
    expect(b.payload).toMatchObject({ de: "viagem", para: "trabalho" });
  });

  it("campo_arquivado_ou_inexistente_bloqueia", async () => {
    await prisma.campoPersonalizado.create({ data: { nome: "antigo", tipo: "TEXTO", alvo: "PESSOA", arquivadoEm: new Date() } });
    expect((await exec({ acao: "ATUALIZAR_CAMPO", campo: "antigo", valor: "x", justificativa: "x" })).status).toBe("BLOQUEADA");
    expect((await exec({ acao: "ATUALIZAR_CAMPO", campo: "naoexiste", valor: "x", justificativa: "x" })).status).toBe("BLOQUEADA");
  });

  it("reversibilidade_fixa", async () => {
    const t = await exec({ acao: "CRIAR_TAREFA", titulo: "Ligar", venceEmISO: amanha(), justificativa: "x" });
    const n = await exec({ acao: "NOTA_INTERNA", texto: "n", justificativa: "x" });
    const m = await exec({ acao: "AGENDAR_MENSAGEM", texto: "oi", enviarEmISO: amanha(), justificativa: "x" });
    expect([t.reversivel, n.reversivel, m.reversivel]).toEqual([true, true, true]);
  });
});
