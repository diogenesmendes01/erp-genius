import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { carregarThread, contarNaoLidas, listarConversas, listarConversasInbox, listarLinhasDoUsuario } from "./consultas";
import { processarMensagemNormalizada } from "./inbound";
import { criarLeadDaConversa, enviarTextoInbox, salvarNumeroWhatsApp, vincularContatoWhatsApp } from "./acoes";
import { abrirAtendimentoInstitucional, listarOpcoesAtendimento, listarTriagemWhatsApp } from "./operacoes-atendimento";
import { atendimentoVisivel, garantirAtendimento } from "./atendimentos";
import { adotarMensagensOrfasDaLinha, CHAVE_LINHA } from "./linha-comercial";
import { importarHistoricoLinha, type MensagemHistorica } from "./historico";

// SPEC-ERP-005 — linha comercial do WhatsApp (critérios LC-01…LC-15). Número de VENDAS é o espelho
// do WhatsApp do vendedor: toda conversa aparece para o dono, com ou sem lead; o canal institucional
// não muda. Sem WHATSAPP_LIVE: envios viram SIMULADA (nenhuma mensagem real sai).

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
let vendedorA: Usuario, vendedorB: Usuario, gerenteA: Usuario, gerenteB: Usuario, financeiro: Usuario, admin: Usuario;

const sessao = (u: Usuario) => ({ id: u.id, nome: u.nome, papeis: u.papeis });
const entrar = (u: Usuario) => authMock.mockResolvedValue({ user: { id: u.id } });

beforeEach(async () => {
  await truncarBanco();
  authMock.mockReset();
  gerenteA = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente A");
  gerenteB = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente B");
  vendedorA = await criarUsuario([Papel.VENDEDOR], "Vendedor A");
  vendedorB = await criarUsuario([Papel.VENDEDOR], "Vendedor B");
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  await prisma.usuario.update({ where: { id: vendedorA.id }, data: { gerenteComercialId: gerenteA.id } });
  await prisma.usuario.update({ where: { id: vendedorB.id }, data: { gerenteComercialId: gerenteB.id } });
});

async function linhaDe(dono: Usuario | null, over: { ativo?: boolean } = {}) {
  return prisma.numeroWhatsApp.create({ data: {
    telefoneE164: "+5511988880000", rotulo: "Vendas — A", driver: "BAILEYS", finalidade: "VENDAS",
    providerRef: "linha-a", donoId: dono?.id ?? null, ativo: over.ativo ?? true,
  } });
}

async function numeroCobranca() {
  return prisma.numeroWhatsApp.create({ data: {
    telefoneE164: "+5511977770000", rotulo: "Cobrança", driver: "BAILEYS", finalidade: "COBRANCA", providerRef: "cobranca-1",
  } });
}

let seq = 0;
async function mensagem(providerRef: string, over: Partial<Parameters<typeof processarMensagemNormalizada>[0]> = {}) {
  seq += 1;
  return processarMensagemNormalizada({
    numeroProviderRef: providerRef, contatoWaId: "50670001111", nomeExibicao: "Desconhecido",
    providerMessageId: `LC-${seq}-${Date.now()}`, corpo: `mensagem ${seq}`, tipo: "TEXTO", driver: "BAILEYS",
    fromMe: false, quando: new Date(), ...over,
  });
}

async function ligarAutoLead(saudacao: "DESLIGADA" | "SHADOW" | "ATIVA" = "DESLIGADA") {
  await prisma.configComercial.upsert({
    where: { id: "comercial" },
    create: { id: "comercial", autoLeadAtivo: true, saudacaoEstado: saudacao },
    update: { autoLeadAtivo: true, saudacaoEstado: saudacao },
  });
}

describe("LC-01/LC-02: contato desconhecido aparece na inbox do dono da linha", () => {
  it("LC-01: auto-lead desligado → conversa sem lead, com 'Criar lead', fora da triagem", async () => {
    await linhaDe(vendedorA);
    expect(await mensagem("linha-a")).toBe("gravada");

    const lista = await listarConversas(sessao(vendedorA));
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ linhaComercial: true, vinculo: null, naoLidas: 1 });
    const thread = await carregarThread(sessao(vendedorA), lista[0].id);
    expect(thread).toMatchObject({ linhaComercial: true, podeCriarLead: true, lead: null, podeEnviar: true });

    const atendimento = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: lista[0].id } });
    expect(atendimento).toMatchObject({ finalidade: "COMERCIAL", contextoChave: CHAVE_LINHA, leadId: null, responsavelId: vendedorA.id });
    expect(await prisma.lead.count()).toBe(0);
    entrar(admin);
    expect(await listarTriagemWhatsApp()).toHaveLength(0);
  });

  it("LC-02: auto-lead ligado → lead do dono da linha gravado no MESMO atendimento", async () => {
    await linhaDe(vendedorA);
    await ligarAutoLead();
    await mensagem("linha-a");
    await mensagem("linha-a");

    const lead = await prisma.lead.findFirstOrThrow();
    expect(lead.vendedorDonoId).toBe(vendedorA.id);
    const atendimentos = await prisma.atendimentoWhatsApp.findMany();
    expect(atendimentos).toHaveLength(1);
    expect(atendimentos[0].leadId).toBe(lead.id);
    expect(await prisma.mensagemWhatsApp.count({ where: { atendimentoId: atendimentos[0].id } })).toBe(2);
    const thread = await carregarThread(sessao(vendedorA), atendimentos[0].id);
    expect(thread?.lead?.id).toBe(lead.id);
    expect(thread?.podeCriarLead).toBe(false);
  });
});

describe("LC-03/LC-04/LC-13: quem vê a linha", () => {
  it("LC-03: vendedor de outra equipe não alcança a conversa por nenhum caminho", async () => {
    await linhaDe(vendedorA);
    await mensagem("linha-a");
    const [a] = await listarConversas(sessao(vendedorA));

    expect(await listarConversas(sessao(vendedorB))).toHaveLength(0);
    expect(await carregarThread(sessao(vendedorB), a.id)).toBeNull();
    expect(await atendimentoVisivel(sessao(vendedorB), a.id)).toBeNull();
    expect(await contarNaoLidas(sessao(vendedorB))).toBe(0);
    expect((await listarConversasInbox(sessao(vendedorB), { busca: "Desconhecido" })).itens).toHaveLength(0);
    entrar(vendedorB);
    expect((await enviarTextoInbox({ conversaId: a.id, texto: "intrusão" })).ok).toBe(false);
    expect((await criarLeadDaConversa(a.id)).ok).toBe(false);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("LC-04: gerente da equipe do dono vê; gerente de outra equipe não", async () => {
    await linhaDe(vendedorA);
    await mensagem("linha-a");
    expect(await listarConversas(sessao(gerenteA))).toHaveLength(1);
    expect(await listarConversas(sessao(gerenteB))).toHaveLength(0);
    expect(await contarNaoLidas(sessao(gerenteA))).toBe(1);
  });

  it("LC-13: financeiro e secretaria não veem linha comercial; admin vê", async () => {
    await linhaDe(vendedorA);
    await mensagem("linha-a");
    const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA]);
    expect(await listarConversas(sessao(financeiro))).toHaveLength(0);
    expect(await listarConversas(sessao(secretaria))).toHaveLength(0);
    expect(await listarConversas(sessao(admin))).toHaveLength(1);
  });

  it("LC-D02: cobertura de carteira não dá a linha do titular; o substituto vê só os leads cobertos", async () => {
    await linhaDe(vendedorA);
    await mensagem("linha-a"); // conversa sem lead
    const lead = await prisma.lead.create({ data: { nome: "Lead coberto", telefoneE164: "+50670009999", vendedorDonoId: vendedorA.id } });
    await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
    await mensagem("linha-a", { contatoWaId: "50670009999", nomeExibicao: "Lead coberto" });
    await prisma.coberturaCarteira.create({ data: { titularId: vendedorA.id, substitutoId: vendedorB.id, concedenteId: gerenteA.id,
      inicio: new Date(Date.now() - 1000), fim: new Date(Date.now() + 60_000), motivo: "Férias do titular" } });

    const doSubstituto = await listarConversas(sessao(vendedorB));
    expect(doSubstituto.map((c) => c.contatoNome)).toEqual(["Lead coberto"]);
  });

  it("LC-L05: linha desativada corta o acesso do dono no próximo pedido", async () => {
    const linha = await linhaDe(vendedorA);
    await mensagem("linha-a");
    expect(await listarConversas(sessao(vendedorA))).toHaveLength(1);
    await prisma.numeroWhatsApp.update({ where: { id: linha.id }, data: { ativo: false } });
    expect(await listarConversas(sessao(vendedorA))).toHaveLength(0);
  });

  it("filtro 'Linha comercial' × 'Institucional' só restringe o escopo", async () => {
    await linhaDe(vendedorA);
    await mensagem("linha-a");
    expect((await listarConversasInbox(sessao(admin), { canal: "linha" })).itens).toHaveLength(1);
    expect((await listarConversasInbox(sessao(admin), { canal: "institucional" })).itens).toHaveLength(0);
    expect((await listarConversasInbox(sessao(vendedorB), { canal: "linha" })).itens).toHaveLength(0);
  });
});

describe("LC-05/LC-06: histórico único da conversa", () => {
  it("LC-05: resposta pelo celular (fromMe) entra como SAIDA no mesmo atendimento", async () => {
    await linhaDe(vendedorA);
    const t0 = Date.now();
    await mensagem("linha-a", { quando: new Date(t0 - 60_000) });
    await mensagem("linha-a", { fromMe: true, corpo: "respondi pelo celular", quando: new Date(t0) });
    const atendimentos = await prisma.atendimentoWhatsApp.findMany();
    expect(atendimentos).toHaveLength(1);
    const thread = await carregarThread(sessao(vendedorA), atendimentos[0].id);
    expect(thread?.mensagens.map((m) => m.direcao)).toEqual(["ENTRADA", "SAIDA"]);
    expect(atendimentos[0].naoLidas).toBe(1); // a saída não conta como não lida
  });

  it("LC-06: 'Criar lead' grava o lead no mesmo atendimento, com autoria; segundo clique é recusado", async () => {
    await linhaDe(vendedorA);
    await mensagem("linha-a");
    await mensagem("linha-a");
    const [conversa] = await listarConversas(sessao(vendedorA));

    entrar(vendedorA);
    const r = await criarLeadDaConversa(conversa.id);
    expect(r.ok, r.ok ? "" : r.erro).toBe(true);
    expect(r.ok && r.dado?.criado).toBe(true);

    const lead = await prisma.lead.findFirstOrThrow();
    expect(lead).toMatchObject({ vendedorDonoId: vendedorA.id, telefoneE164: "+50670001111", nome: "Desconhecido" });
    const atendimentos = await prisma.atendimentoWhatsApp.findMany();
    expect(atendimentos).toHaveLength(1);
    expect(atendimentos[0].leadId).toBe(lead.id);
    expect(await prisma.mensagemWhatsApp.count({ where: { atendimentoId: atendimentos[0].id } })).toBe(2);
    const criado = (await eventosDo("Lead", lead.id)).find((e) => e.tipo === "LeadCriado");
    expect(criado?.autorId).toBe(vendedorA.id);
    expect(criado?.payload).toMatchObject({ origem: "whatsapp_linha" });

    expect((await criarLeadDaConversa(conversa.id)).ok).toBe(false);
    expect(await prisma.lead.count()).toBe(1);
  });

  it("vincular um lead da carteira também não abre outro atendimento", async () => {
    await linhaDe(vendedorA);
    await mensagem("linha-a");
    const lead = await prisma.lead.create({ data: { nome: "Lead já cadastrado", telefoneE164: "+50670001111", vendedorDonoId: vendedorA.id } });
    const [conversa] = await listarConversas(sessao(vendedorA));
    entrar(vendedorA);
    const r = await vincularContatoWhatsApp({ contatoId: conversa.contatoId, atendimentoId: conversa.id, alvo: { tipo: "lead", id: lead.id } });
    expect(r.ok, r.ok ? "" : r.erro).toBe(true);
    const atendimentos = await prisma.atendimentoWhatsApp.findMany();
    expect(atendimentos).toHaveLength(1);
    expect(atendimentos[0].leadId).toBe(lead.id);
  });

  it("'Criar lead' com telefone que já é lead vincula o existente em vez de duplicar", async () => {
    await linhaDe(vendedorA);
    await mensagem("linha-a");
    const existente = await prisma.lead.create({ data: { nome: "Antigo", telefoneE164: "+50670001111", vendedorDonoId: vendedorA.id } });
    const [conversa] = await listarConversas(sessao(vendedorA));
    entrar(vendedorA);
    const r = await criarLeadDaConversa(conversa.id);
    expect(r.ok && r.dado).toEqual({ leadId: existente.id, criado: false });
    expect(await prisma.lead.count()).toBe(1);
  });
});

describe("LC-07/LC-08: ver a conversa não abre outros dados", () => {
  it("LC-07: contato que é aluno — mensagens visíveis na linha, sem aluno/matrícula/cobrança; 'Criar lead' recusa", async () => {
    const cat = await seedCatalogoMinimo();
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna", sobrenome: "Matriculada", paisId: cat.pais.id, telefoneE164: "+50670001111" } });
    await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC" } });
    await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50670001111", alunoId: aluno.id } });
    await linhaDe(vendedorA);
    await mensagem("linha-a");

    const [conversa] = await listarConversas(sessao(vendedorA));
    const atendimento = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: conversa.id } });
    expect(atendimento).toMatchObject({ finalidade: "COMERCIAL", alunoId: null, matriculaId: null });
    const thread = await carregarThread(sessao(vendedorA), conversa.id);
    expect(thread?.mensagens).toHaveLength(1);
    expect(thread).toMatchObject({ matricula: null, cobrancaAtiva: null, contato: { alunoId: null, alunoNome: null } });
    entrar(vendedorA);
    const r = await criarLeadDaConversa(conversa.id);
    expect(r.ok).toBe(false);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("LC-08: lead da carteira de outro vendedor — dono da linha vê a conversa, não o painel do lead", async () => {
    const vendedorC = await criarUsuario([Papel.VENDEDOR], "Vendedor C");
    const lead = await prisma.lead.create({ data: { nome: "Lead do C", telefoneE164: "+50670001111", vendedorDonoId: vendedorC.id } });
    await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
    await linhaDe(vendedorA);
    await mensagem("linha-a");

    const [conversa] = await listarConversas(sessao(vendedorA));
    const doDono = await carregarThread(sessao(vendedorA), conversa.id);
    expect(doDono?.mensagens).toHaveLength(1);
    expect(doDono?.lead).toBeNull();
    expect(doDono?.contato.leadId).toBeNull();
    expect(doDono?.podeCriarLead).toBe(false); // a conversa já tem lead (de outra carteira)

    // O titular da carteira continua com o painel completo (regra anterior preservada).
    const doTitular = await carregarThread(sessao(vendedorC), conversa.id);
    expect(doTitular?.lead?.id).toBe(lead.id);
  });
});

describe("LC-09: troca de dono — o histórico segue a linha", () => {
  it("novo dono vê as conversas anteriores; o antigo perde o acesso", async () => {
    const linha = await linhaDe(vendedorA);
    await mensagem("linha-a");
    const vendedorD = await criarUsuario([Papel.VENDEDOR], "Vendedor D");
    entrar(admin);
    const r = await salvarNumeroWhatsApp({ id: linha.id, telefoneE164: linha.telefoneE164, rotulo: linha.rotulo, driver: "BAILEYS",
      finalidade: "VENDAS", providerRef: linha.providerRef ?? "", donoId: vendedorD.id, ativo: true });
    expect(r.ok, r.ok ? "" : r.erro).toBe(true);
    expect(await listarConversas(sessao(vendedorD))).toHaveLength(1);
    expect(await listarConversas(sessao(vendedorA))).toHaveLength(0);
    expect((await eventosDo("NumeroWhatsApp", linha.id)).map((e) => e.tipo)).toContain("NumeroWhatsAppAlterado");
  });
});

describe("LC-10/LC-11: histórico do aparelho", () => {
  const agora = new Date("2026-09-26T15:00:00.000Z");
  const dias = (n: number) => new Date(agora.getTime() - n * 86_400_000);
  const historicas = (): MensagemHistorica[] => [
    { contatoWaId: "50670001111", nomeExibicao: "Cliente antigo", providerMessageId: "H-90", corpo: "há 90 dias", tipo: "TEXTO", fromMe: false, quando: dias(90) },
    { contatoWaId: "50670001111", nomeExibicao: "Cliente antigo", providerMessageId: "H-10", corpo: "sim", tipo: "TEXTO", fromMe: false, quando: dias(10) },
    { contatoWaId: "50670001111", providerMessageId: "H-9", corpo: "resposta minha", tipo: "TEXTO", fromMe: true, quando: dias(9) },
    { contatoWaId: "50670002222", nomeExibicao: "Outra pessoa", providerMessageId: "H-2", corpo: "sair", tipo: "TEXTO", fromMe: false, quando: dias(2) },
  ];

  it("LC-10: grava só os últimos 30 dias, na linha, sem lead/saudação/opt-out/não lidas", async () => {
    await linhaDe(vendedorA);
    await ligarAutoLead("ATIVA");
    const r = await importarHistoricoLinha({ numeroProviderRef: "linha-a" }, historicas(), agora);
    expect(r).toMatchObject({ gravadas: 3, motivo: null });

    expect(await prisma.mensagemWhatsApp.count()).toBe(3);
    expect(await prisma.mensagemWhatsApp.count({ where: { providerMessageId: "H-90" } })).toBe(0);
    expect(await prisma.lead.count()).toBe(0);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.contatoWhatsApp.count({ where: { optOutEm: { not: null } } })).toBe(0);
    const lista = await listarConversas(sessao(vendedorA));
    expect(lista).toHaveLength(2);
    expect(lista.every((c) => c.naoLidas === 0)).toBe(true);
    expect(await prisma.mensagemWhatsApp.count({ where: { atendimentoId: null } })).toBe(0);
    // Recência vem da mensagem mais nova do histórico.
    expect(lista[0].ultimaMensagemEm).toBe(dias(2).toISOString());
  });

  it("LC-11: reenvio do mesmo histórico não duplica", async () => {
    await linhaDe(vendedorA);
    await importarHistoricoLinha({ numeroProviderRef: "linha-a" }, historicas(), agora);
    const again = await importarHistoricoLinha({ numeroProviderRef: "linha-a" }, historicas(), agora);
    expect(again.gravadas).toBe(0);
    expect(await prisma.mensagemWhatsApp.count()).toBe(3);
    expect(await prisma.atendimentoWhatsApp.count()).toBe(2);
  });

  it("canal institucional não importa histórico", async () => {
    await numeroCobranca();
    const r = await importarHistoricoLinha({ numeroProviderRef: "cobranca-1" }, historicas(), agora);
    expect(r).toMatchObject({ gravadas: 0, motivo: "nao_e_linha_comercial" });
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
  });

  it("histórico não recua a recência de uma conversa viva mais nova", async () => {
    await linhaDe(vendedorA);
    await mensagem("linha-a", { quando: agora });
    await importarHistoricoLinha({ numeroProviderRef: "linha-a" }, historicas(), agora);
    const [primeira] = await listarConversas(sessao(vendedorA));
    expect(primeira.ultimaMensagemEm).toBe(agora.toISOString());
  });
});

describe("LC-12: canal institucional inalterado", () => {
  it("contato sem vínculo no número de COBRANCA continua na triagem administrativa", async () => {
    await numeroCobranca();
    await mensagem("cobranca-1");
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    expect(m.atendimentoId).toBeNull();
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
    entrar(admin);
    expect((await listarTriagemWhatsApp()).map((t) => t.id)).toEqual([m.id]);
  });

  it("conversa da linha com assunto institucional aberto segue o roteamento institucional", async () => {
    const linha = await linhaDe(vendedorA);
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50670001111" } });
    await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: linha.id, contatoId: contato.id, finalidade: "SECRETARIA" }));
    await mensagem("linha-a");
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    // SECRETARIA sem aluno não tem destinatário atual → triagem, como antes da SPEC-ERP-005.
    expect(m.atendimentoId).toBeNull();
    expect(await prisma.atendimentoWhatsApp.count({ where: { finalidade: "COMERCIAL" } })).toBe(0);
  });
});

describe("LC-15: mensagens da linha paradas na triagem", () => {
  it("backfill leva as órfãs ao atendimento da linha como não lidas; é idempotente", async () => {
    const linha = await linhaDe(vendedorA);
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50670001111", nomeExibicao: "Legado" } });
    const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: linha.id, contatoId: contato.id } });
    const antiga = new Date("2026-09-20T10:00:00.000Z");
    await prisma.mensagemWhatsApp.createMany({ data: [
      { conversaId: conversa.id, numeroId: linha.id, direcao: "ENTRADA", driver: "BAILEYS", corpo: "oi", providerMessageId: "O-1", criadoEm: antiga },
      { conversaId: conversa.id, numeroId: linha.id, direcao: "SAIDA", driver: "BAILEYS", corpo: "olá", providerMessageId: "O-2", criadoEm: new Date(antiga.getTime() + 60_000) },
    ] });
    expect(await listarConversas(sessao(vendedorA))).toHaveLength(0);

    expect(await adotarMensagensOrfasDaLinha()).toEqual({ conversas: 1, mensagens: 2 });
    const [item] = await listarConversas(sessao(vendedorA));
    expect(item).toMatchObject({ naoLidas: 1, ultimaMensagemEm: new Date(antiga.getTime() + 60_000).toISOString() });
    entrar(admin);
    expect(await listarTriagemWhatsApp()).toHaveLength(0);

    expect(await adotarMensagensOrfasDaLinha()).toEqual({ conversas: 0, mensagens: 0 });
    expect((await listarConversas(sessao(vendedorA)))[0].naoLidas).toBe(1);
  });

  it("salvar a linha já adota as conversas dela", async () => {
    const linha = await linhaDe(null);
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50670001111" } });
    const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: linha.id, contatoId: contato.id } });
    await prisma.mensagemWhatsApp.create({ data: { conversaId: conversa.id, numeroId: linha.id, direcao: "ENTRADA", driver: "BAILEYS", corpo: "sem dono", providerMessageId: "O-3" } });
    entrar(admin);
    const r = await salvarNumeroWhatsApp({ id: linha.id, telefoneE164: linha.telefoneE164, rotulo: linha.rotulo, driver: "BAILEYS",
      finalidade: "VENDAS", providerRef: linha.providerRef ?? "", donoId: vendedorA.id, ativo: true });
    expect(r.ok, r.ok ? "" : r.erro).toBe(true);
    expect(await listarConversas(sessao(vendedorA))).toHaveLength(1);
  });
});

describe("abrir atendimento comercial e estado da linha (§5.5)", () => {
  it("comercial só sai pelas linhas acessíveis; o atendimento aberto é o da linha", async () => {
    const linha = await linhaDe(vendedorA);
    const cobranca = await numeroCobranca();
    const lead = await prisma.lead.create({ data: { nome: "Lead A", telefoneE164: "+50670001111", vendedorDonoId: vendedorA.id } });
    await mensagem("linha-a");
    entrar(vendedorA);
    const opcoes = await listarOpcoesAtendimento();
    expect(opcoes.numeros.find((n) => n.id === linha.id)?.comercial).toBe(true);
    expect(opcoes.numeros.find((n) => n.id === cobranca.id)?.comercial).toBe(false);

    const chave = `COMERCIAL:${lead.id}`;
    expect((await abrirAtendimentoInstitucional({ numeroId: cobranca.id, destinoChave: chave })).ok).toBe(false);
    const aberto = await abrirAtendimentoInstitucional({ numeroId: linha.id, destinoChave: chave });
    expect(aberto.ok, aberto.ok ? "" : aberto.erro).toBe(true);
    const atendimentos = await prisma.atendimentoWhatsApp.findMany();
    expect(atendimentos).toHaveLength(1);
    expect(aberto.ok && aberto.dado?.id).toBe(atendimentos[0].id);
    expect(atendimentos[0].leadId).toBe(lead.id);
  });

  it("vendedor de outra linha não abre atendimento comercial na linha alheia", async () => {
    const linha = await linhaDe(vendedorA);
    const lead = await prisma.lead.create({ data: { nome: "Lead B", telefoneE164: "+50670003333", vendedorDonoId: vendedorB.id } });
    entrar(vendedorB);
    expect((await listarOpcoesAtendimento()).numeros.find((n) => n.id === linha.id)?.comercial).toBe(false);
    expect((await abrirAtendimentoInstitucional({ numeroId: linha.id, destinoChave: `COMERCIAL:${lead.id}` })).ok).toBe(false);
  });

  it("dono vê o estado das próprias linhas; outros não", async () => {
    await linhaDe(vendedorA);
    expect(await listarLinhasDoUsuario(sessao(vendedorA))).toEqual([expect.objectContaining({ rotulo: "Vendas — A", sessao: "DESCONECTADO", driver: "BAILEYS" })]);
    expect(await listarLinhasDoUsuario(sessao(vendedorB))).toEqual([]);
    expect(await listarLinhasDoUsuario(sessao(financeiro))).toEqual([]);
  });
});
