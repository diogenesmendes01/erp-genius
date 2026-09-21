import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Papel } from "@prisma/client";

const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
vi.mock("./drivers/evolution", () => ({ driverEvolution: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const u = await sessao(); original.exigirPapel(u, ...papeis); return u;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { atendimentoVisivel, garantirAtendimento } from "./atendimentos";
import { destinatarioAtualDoAtendimento } from "./destinatario-atual";
import { carregarThread } from "./consultas";
import { enviarTextoInbox } from "./acoes";
import { abrirAtendimentoInstitucional, encerrarAtendimentoWhatsApp, listarTriagemWhatsApp } from "./operacoes-atendimento";
import { despacharFila } from "./despachante";
import { processarMensagemNormalizada } from "./inbound";

let ven: Awaited<ReturnType<typeof criarUsuario>>, fin: typeof ven, sec: typeof ven, adm: typeof ven, proFin: typeof ven;
let canal: Awaited<ReturnType<typeof seedCanal>>;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
type Atendimento = Awaited<ReturnType<typeof garantirAtendimento>>;
async function mensagemHistorica(a: Atendimento) {
  return prisma.mensagemWhatsApp.create({ data: { numeroId: canal.numero.id, conversaId: a.conversaId, atendimentoId: a.id, direcao: "ENTRADA", driver: "BAILEYS", corpo: "Histórico autorizado anterior à alteração", criadoEm: new Date(Date.now() - 60000) } });
}
async function intencao(a: Atendimento, contatoId: string, autorId: string, origem: "HUMANO" | "CRON" = "HUMANO") {
  return prisma.intencaoMensagem.create({ data: { numeroId: canal.numero.id, contatoId, atendimentoId: a.id, autorId, origem, corpoRenderizado: "Envio preparado antes da alteração" } });
}
async function comercial() {
  await prisma.numeroWhatsApp.update({ where: { id: canal.numero.id }, data: { finalidade: "VENDAS" } });
  const lead = await prisma.lead.create({ data: { nome: "Ana", telefoneE164: "+50688880001", vendedorDonoId: ven.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const atendimento = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: canal.numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id, responsavelId: ven.id }));
  return { lead, contato, atendimento };
}
async function financeiro(responsavel = false) {
  const cat = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna", paisId: cat.pais.id, telefoneE164: "+50688880002" } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC" } });
  const guardiao = responsavel ? await prisma.responsavel.create({ data: { nome: "Responsável original", telefoneE164: "+50688880003" } }) : null;
  const vinculo = guardiao ? await prisma.alunoResponsavel.create({ data: { alunoId: aluno.id, responsavelId: guardiao.id, papel: "FINANCEIRO" } }) : null;
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: guardiao?.telefoneE164 ?? aluno.telefoneE164!, alunoId: guardiao ? null : aluno.id, responsavelId: guardiao?.id } });
  const atendimento = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: canal.numero.id, contatoId: contato.id, finalidade: "FINANCEIRO", alunoId: aluno.id, matriculaId: matricula.id, responsavelId: fin.id }));
  return { aluno, matricula, guardiao, vinculo, contato, atendimento };
}
async function destinatarioAtual(id: string) {
  const a = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, include: { conversa: { include: { contato: true } } } });
  return destinatarioAtualDoAtendimento(a);
}

beforeEach(async () => {
  await truncarBanco();
  vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarMock.mockReset().mockImplementation(async () => ({ providerMessageId: `teste-${randomUUID()}` }));
  [ven, fin, sec, adm, proFin] = await Promise.all([
    criarUsuario([Papel.VENDEDOR]), criarUsuario([Papel.FINANCEIRO]), criarUsuario([Papel.SECRETARIA_ACADEMICA]), criarUsuario([Papel.ADMINISTRADOR]), criarUsuario([Papel.PROFESSOR, Papel.FINANCEIRO]),
  ]);
  canal = await seedCanal({ driver: "BAILEYS", estado: "ATIVA", janela: [0, 24] });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("destinatário atual para novos envios; histórico permanece autorizado", () => {
  it.each(["HUMANO", "CRON"] as const)("troca de telefone do lead revoga envio %s, preservando o histórico comercial", async (origem) => {
    const c = await comercial();
    const antiga = await mensagemHistorica(c.atendimento);
    const pendente = await intencao(c.atendimento, c.contato.id, ven.id, origem);
    expect(await atendimentoVisivel(ven, c.atendimento.id, true)).not.toBeNull();
    await prisma.lead.update({ where: { id: c.lead.id }, data: { telefoneE164: "+50688880999" } });
    expect(await destinatarioAtual(c.atendimento.id)).toBe(false);
    expect(await atendimentoVisivel(ven, c.atendimento.id, true)).toBeNull();
    expect((await carregarThread(ven, c.atendimento.id))?.mensagens.map((m) => m.id)).toEqual([antiga.id]);
    entrar(ven.id);
    expect((await enviarTextoInbox({ conversaId: c.atendimento.id, texto: "Não deve chegar ao número antigo" })).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(1);
    await despacharFila(); expect(enviarMock).not.toHaveBeenCalled();
    const depois = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: pendente.id } });
    expect(depois.status).toBe("CANCELADA");
    expect(depois.motivoFalha).toBe(origem === "HUMANO" ? "atendimento_sem_acesso" : "destinatario_alterado");
    expect(depois.autorId).toBe(ven.id); expect(depois.contatoId).toBe(c.contato.id);
  });

  it("troca do telefone do aluno bloqueia o contato antigo e abre novo atendimento no destinatário atual", async () => {
    const c = await financeiro();
    const antiga = await mensagemHistorica(c.atendimento);
    const pendente = await intencao(c.atendimento, c.contato.id, fin.id);
    expect(await destinatarioAtual(c.atendimento.id)).toBe(true);
    await prisma.aluno.update({ where: { id: c.aluno.id }, data: { telefoneE164: "+50688880777" } });
    expect(await destinatarioAtual(c.atendimento.id)).toBe(false);
    expect((await carregarThread(fin, c.atendimento.id))?.mensagens.map((m) => m.id)).toEqual([antiga.id]);
    entrar(fin.id);
    expect((await enviarTextoInbox({ conversaId: c.atendimento.id, texto: "Destino antigo bloqueado" })).ok).toBe(false);
    await despacharFila(); expect(enviarMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: pendente.id } })).status).toBe("CANCELADA");
    const novo = await abrirAtendimentoInstitucional({ numeroId: canal.numero.id, destinoChave: `FINANCEIRO:${c.matricula.id}` });
    expect(novo.ok, JSON.stringify(novo)).toBe(true);
    if (!novo.ok) return;
    expect(novo.dado!.id).not.toBe(c.atendimento.id);
    expect(await destinatarioAtual(novo.dado!.id)).toBe(true);
    expect((await enviarTextoInbox({ conversaId: novo.dado!.id, texto: "Mensagem para o destinatário atual" })).ok).toBe(true);
    expect(enviarMock).toHaveBeenCalledTimes(1);
    expect((await carregarThread(fin, c.atendimento.id))?.mensagens.map((m) => m.id)).toEqual([antiga.id]);
  });

  it("trocar o guardião revoga o contato antigo mesmo se o telefone do novo for igual", async () => {
    const c = await financeiro(true);
    const antiga = await mensagemHistorica(c.atendimento);
    const pendente = await intencao(c.atendimento, c.contato.id, fin.id);
    expect(await destinatarioAtual(c.atendimento.id)).toBe(true);
    const novo = await prisma.responsavel.create({ data: { nome: "Novo responsável", telefoneE164: c.guardiao!.telefoneE164 } });
    await prisma.alunoResponsavel.update({ where: { id: c.vinculo!.id }, data: { responsavelId: novo.id } });
    expect(await destinatarioAtual(c.atendimento.id)).toBe(false);
    entrar(fin.id);
    expect((await enviarTextoInbox({ conversaId: c.atendimento.id, texto: "Contato do guardião anterior" })).ok).toBe(false);
    await despacharFila(); expect(enviarMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: pendente.id } })).status).toBe("CANCELADA");
    expect((await carregarThread(fin, c.atendimento.id))?.mensagens.map((m) => m.id)).toEqual([antiga.id]);
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: c.contato.id } })).responsavelId).toBe(c.guardiao!.id);
  });

  it("cadastro de um guardião sem telefone não permite continuar enviando para o aluno", async () => {
    const c = await financeiro();
    expect(await destinatarioAtual(c.atendimento.id)).toBe(true);
    await prisma.alunoResponsavel.create({ data: { aluno: { connect: { id: c.aluno.id } }, papel: "FINANCEIRO", responsavel: { create: { nome: "Guardião sem telefone" } } } });
    expect(await destinatarioAtual(c.atendimento.id)).toBe(false);
    entrar(fin.id);
    const novo = await abrirAtendimentoInstitucional({ numeroId: canal.numero.id, destinoChave: `FINANCEIRO:${c.matricula.id}` });
    expect(novo.ok).toBe(false);
    if (!novo.ok) expect(novo.erro).toContain("destinatário válido");
    expect(enviarMock).not.toHaveBeenCalled();
  });
});

describe("encerramento respeita a finalidade e inbound retorna à triagem", () => {
  it("PRO+FIN consulta sua experimental, mas não usa Financeiro para encerrar assunto PEDAGOGICO", async () => {
    const lead = await prisma.lead.create({ data: { nome: "Experimental", telefoneE164: "+50688880666", professorExperimentalId: proFin.id, etapa: "EXPERIMENTAL_AGENDADA" } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
    const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: canal.numero.id, contatoId: contato.id, finalidade: "PEDAGOGICO", leadId: lead.id }));
    const pendente = await intencao(a, contato.id, proFin.id);
    expect(await atendimentoVisivel(proFin, a.id, true)).not.toBeNull();
    entrar(proFin.id);
    const negado = await encerrarAtendimentoWhatsApp(a.id);
    expect(negado.ok).toBe(false);
    if (!negado.ok) expect(negado.erro).toContain("finalidade");
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).encerradoEm).toBeNull();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: pendente.id } })).status).toBe("PENDENTE");
    expect(await eventosDo("AtendimentoWhatsApp", a.id)).toHaveLength(0);
    entrar(sec.id);
    expect((await encerrarAtendimentoWhatsApp(a.id)).ok).toBe(true);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: pendente.id } })).status).toBe("CANCELADA");
    expect((await eventosDo("AtendimentoWhatsApp", a.id))[0].autorId).toBe(sec.id);
  });

  it.each(["COMERCIAL", "FINANCEIRO"] as const)("inbound não reabre contexto %s encerrado e fica na triagem administrativa", async (finalidade) => {
    const c = finalidade === "COMERCIAL" ? await comercial() : await financeiro();
    const historica = await mensagemHistorica(c.atendimento);
    entrar(adm.id);
    expect((await encerrarAtendimentoWhatsApp(c.atendimento.id)).ok).toBe(true);
    const antes = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.atendimento.id } });
    expect(await processarMensagemNormalizada({ numeroProviderRef: canal.numero.providerRef, contatoWaId: c.contato.telefoneE164.replace(/\D/g, ""), providerMessageId: "inbound-apos-encerramento", corpo: "Uma nova solicitação após o encerramento", tipo: "TEXTO", driver: "BAILEYS", fromMe: false, quando: new Date() })).toBe("gravada");
    const inbound = await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "inbound-apos-encerramento" } });
    expect(inbound.atendimentoId).toBeNull();
    const depois = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.atendimento.id } });
    expect(depois.encerradoEm).toEqual(antes.encerradoEm); expect(depois.naoLidas).toBe(antes.naoLidas);
    expect(await prisma.atendimentoWhatsApp.count({ where: { conversaId: c.atendimento.conversaId } })).toBe(1);
    expect((await listarTriagemWhatsApp()).map((m) => m.id)).toContain(inbound.id);
    expect((await carregarThread(adm, c.atendimento.id))?.mensagens.map((m) => m.id)).toEqual([historica.id]);
    expect(enviarMock).not.toHaveBeenCalled();
  });
});
