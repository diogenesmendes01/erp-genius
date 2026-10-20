import { DriverWhatsApp } from "@prisma/client";
import { receberTx } from "@/server/financeiro/recebimentos";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./drivers/motor", () => ({ driverMotor: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { buscarPessoasVinculo } from "./consultas";
import { obterItemListaInbox } from "@/server/inbox/consultas-pagina";
import { carregarPainel } from "@/server/inbox/paineis";
import { listaDoInbox, mensagensDoInbox } from "@/test/inbox-consultas";
import { despacharFila } from "./despachante";
import { enfileirarIntencaoCobranca } from "./fila";
import { referenciaDestinoCobranca, snapshotCobranca } from "./elegibilidade";
import { enviarTextoInbox, vincularContatoWhatsApp } from "./acoes";
import { abrirAtendimentoInstitucional, classificarMensagemWhatsApp, listarOpcoesAtendimento } from "./operacoes-atendimento";

beforeEach(async () => {
  await truncarBanco(); vi.stubEnv("WHATSAPP_LIVE", "1"); authMock.mockReset();
  enviarMock.mockReset().mockResolvedValue({ providerMessageId: "teste-sem-rede" });
});
afterEach(() => vi.unstubAllEnvs());
const sessao = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });

async function comercial() {
  const vendedor = await criarUsuario([Papel.VENDEDOR]);
  const outro = await criarUsuario([Papel.VENDEDOR]);
  // Linha SEM dono: aqui o acesso vem só da carteira. Dono da linha vê a conversa (SPEC-ERP-005
  // LC-D01) — coberto em linha-comercial.int.test.ts.
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999999999", rotulo: "Institucional", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", donoId: null } });
  const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: vendedor.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
  return { vendedor, outro, numero, lead, contato, a };
}

describe("D02: atendimento comercial segue carteira/equipe/cobertura atual", () => {
  it("participante da conversa fora da carteira abre a thread; o painel do lead não traz copiloto (E1)", async () => {
    const c = await comercial();
    await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: c.a.id, usuarioId: c.outro.id, concedenteId: c.vendedor.id, inicio: new Date(Date.now() - 1000), fim: new Date(Date.now() + 60000), motivo: "Apoio restrito à conversa" } });
    authMock.mockResolvedValue({ user: { id: c.outro.id } });
    const restrita = await carregarPainel(sessao(c.outro), c.a.id);
    expect(restrita?.acoes?.leadId).toBe(c.lead.id);
    expect(restrita).toMatchObject({ oportunidade: { id: c.lead.id } });
    expect(JSON.stringify(restrita)).not.toContain("copilotoAtivo");
    expect(JSON.stringify(restrita)).not.toContain("sugestoesIA");
  });
  it("transferência da carteira revoga o anterior e a mensagem humana pendente", async () => {
    const c = await comercial();
    expect((await listaDoInbox(sessao(c.vendedor))).map((a) => a.id)).toContain(c.a.id);
    expect(await obterItemListaInbox(sessao(c.outro), c.a.id)).toBeNull();
    await prisma.intencaoMensagem.create({ data: { numeroId: c.numero.id, contatoId: c.contato.id, atendimentoId: c.a.id, origem: "HUMANO", autorId: c.vendedor.id, corpoRenderizado: "Antes da transferência" } });
    await prisma.oportunidade.update({ where: { id: c.lead.id }, data: { vendedorDonoId: c.outro.id } });
    expect(await obterItemListaInbox(sessao(c.vendedor), c.a.id)).toBeNull();
    expect(await obterItemListaInbox(sessao(c.outro), c.a.id)).not.toBeNull();
    await despacharFila();
    expect(enviarMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).toBe("atendimento_sem_acesso");
  });
  it("cobertura vence sem compartilhar registros fora da carteira", async () => {
    const c = await comercial();
    const cobertura = await prisma.coberturaCarteira.create({ data: { titularId: c.vendedor.id, substitutoId: c.outro.id, concedenteId: c.vendedor.id,
      inicio: new Date(Date.now() - 1000), fim: new Date(Date.now() + 60000), motivo: "Cobertura teste" } });
    expect(await obterItemListaInbox(sessao(c.outro), c.a.id)).not.toBeNull();
    await prisma.coberturaCarteira.update({ where: { id: cobertura.id }, data: { fim: new Date(Date.now() - 1) } });
    expect(await obterItemListaInbox(sessao(c.outro), c.a.id)).toBeNull();
  });
  it("A06: busca e vinculação comercial não abrem cadastro de alunos nem outra carteira", async () => {
    const c = await comercial();
    const pais = await prisma.pais.create({ data: { nome: "País", codigoISO: "CR", ddi: "+506", moedaLocal: "CRC" } });
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Segredo", paisId: pais.id } });
    expect(await buscarPessoasVinculo(sessao(c.vendedor), "Segredo", c.a.id)).toEqual({ alunos: [], responsaveis: [], leads: [] });
    authMock.mockResolvedValue({ user: { id: c.vendedor.id } });
    expect((await vincularContatoWhatsApp({ contatoId: c.contato.id, atendimentoId: c.a.id, alvo: { tipo: "aluno", id: aluno.id } })).ok).toBe(false);
  });
});

describe("D04: finalidade pedagógica e contexto legado", () => {
  async function turma() {
    const catalogo = await seedCatalogoMinimo();
    const pro = await criarUsuario([Papel.PROFESSOR, Papel.FINANCEIRO]);
    const outro = await criarUsuario([Papel.PROFESSOR]);
    const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
    const t = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: catalogo.modalidade.id, professorId: pro.id } });
    await prisma.vinculoDocente.create({ data: { turmaId: t.id, professorId: pro.id, inicio: new Date(Date.now() - 1000) } });
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna", paisId: catalogo.pais.id, telefoneE164: "+50680001111", whatsapp: true, email: "privado@example.test" } });
    const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC" } });
    await prisma.alocacaoTurma.create({ data: { turmaId: t.id, alunoId: aluno.id, matriculaId: matricula.id } });
    const { numero } = await seedCanal({ estado: "ATIVA" });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: aluno.telefoneE164!, alunoId: aluno.id, nomeExibicao: aluno.telefoneE164 } });
    const pedagogico = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "PEDAGOGICO", alunoId: aluno.id, turmaId: t.id, matriculaId: matricula.id }));
    const financeiro = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "FINANCEIRO", alunoId: aluno.id, matriculaId: matricula.id }));
    return { pro, outro, t, aluno, matricula, numero, contato, pedagogico, financeiro };
  }
  it("PRO+FIN recebe só mensagens pedagógicas nesse assunto; telefone não aparece no payload", async () => {
    const c = await turma();
    await prisma.mensagemWhatsApp.createMany({ data: [
      { numeroId: c.numero.id, conversaId: c.pedagogico.conversaId, atendimentoId: c.pedagogico.id, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "Tarefa de hoje" },
      { numeroId: c.numero.id, conversaId: c.pedagogico.conversaId, atendimentoId: c.financeiro.id, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "Dívida de 900" },
      { numeroId: c.numero.id, conversaId: c.pedagogico.conversaId, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "Legado financeiro" },
    ] });
    const mensagens = await mensagensDoInbox(sessao(c.pro), c.pedagogico.id);
    expect(mensagens?.map((m) => m.corpo)).toEqual(["Tarefa de hoje"]);
    const painel = await carregarPainel(sessao(c.pro), c.pedagogico.id);
    expect(painel?.acoes).toMatchObject({ cobranca: null });
    const payload = JSON.stringify([await obterItemListaInbox(sessao(c.pro), c.pedagogico.id), mensagens, painel]);
    expect(payload).not.toContain(c.aluno.telefoneE164);
    expect(payload).not.toContain(c.aluno.email);
    await prisma.turma.update({ where: { id: c.t.id }, data: { professorId: c.outro.id } });
    expect(await obterItemListaInbox(sessao(c.pro), c.pedagogico.id)).toBeNull();
  });
  it("abertura e envio institucionais funcionam; chave de turma alheia é negada", async () => {
    const c = await turma();
    authMock.mockResolvedValue({ user: { id: c.outro.id } });
    expect((await abrirAtendimentoInstitucional({ numeroId: c.numero.id, destinoChave: `PEDAGOGICO:${c.aluno.id}:${c.t.id}` })).ok).toBe(false);
    expect((await listarOpcoesAtendimento()).destinos).toHaveLength(0);
    authMock.mockResolvedValue({ user: { id: c.pro.id } });
    const aberta = await abrirAtendimentoInstitucional({ numeroId: c.numero.id, destinoChave: `PEDAGOGICO:${c.aluno.id}:${c.t.id}:${c.matricula.id}:ALUNO` });
    expect(aberta.ok).toBe(true);
    const r = await enviarTextoInbox({ conversaId: c.pedagogico.id, texto: "A tarefa está no material institucional." });
    expect(r.ok && r.dado?.status).toBe("DESPACHADA");
    expect(enviarMock).toHaveBeenCalledOnce();
  });
  it("mensagem legada só entra no contexto por classificação administrativa auditada", async () => {
    const c = await turma();
    const m = await prisma.mensagemWhatsApp.create({ data: { numeroId: c.numero.id, conversaId: c.pedagogico.conversaId, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "Revisar tarefa" } });
    authMock.mockResolvedValue({ user: { id: c.pro.id } });
    expect((await classificarMensagemWhatsApp({ mensagemId: m.id, atendimentoId: c.pedagogico.id, motivo: "Conteúdo revisado como pedagógico" })).ok).toBe(false);
    const adm = await criarUsuario([Papel.ADMINISTRADOR]); authMock.mockResolvedValue({ user: { id: adm.id } });
    expect((await classificarMensagemWhatsApp({ mensagemId: m.id, atendimentoId: c.pedagogico.id, motivo: "Conteúdo revisado como pedagógico" })).ok).toBe(true);
    expect((await mensagensDoInbox(sessao(c.pro), c.pedagogico.id))?.map((m) => m.corpo)).toEqual(["Revisar tarefa"]);
  });
});

describe("W01–W07: intenção velha nunca chama o driver", () => {
  // W01–W04 eram da cadência comercial do CRM antigo (removida); o cancelamento das que sobraram na fila
  // está em despachante-teto.int.test.ts.
  it("W05: claim interrompido fica FALHOU e não é reenviado", async () => {
    const c = await comercial();
    const i = await prisma.intencaoMensagem.create({ data: { numeroId: c.numero.id, contatoId: c.contato.id, atendimentoId: c.a.id,
      origem: "HUMANO", autorId: c.vendedor.id, corpoRenderizado: "Texto", status: "ENVIANDO", despacharAposEm: new Date(0) } });
    await despacharFila();
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).toMatchObject({ status: "FALHOU", motivoFalha: "envio_interrompido" });
    await despacharFila();
    expect(enviarMock).not.toHaveBeenCalled();
  });
  it.each(["total", "parcial"])("W06: pagamento %s impede texto com saldo antigo", async (tipo) => {
    const fin = await criarUsuario([Papel.FINANCEIRO]);
    const { numero, politica, templates } = await seedCanal({ estado: "ATIVA" });
    const { aluno, cobranca } = await seedCobranca({ vencimento: new Date() });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: aluno.telefoneE164!, alunoId: aluno.id } });
    const snapshot = await snapshotCobranca(cobranca.id); if (!snapshot?.destino) throw new Error("Destino ausente na fixture.");
    await prisma.$transaction((tx) => enfileirarIntencaoCobranca(tx, { numeroId: numero.id, contatoId: contato.id,
      cobrancaId: cobranca.id, passo: "D-7", origem: "LOTE", autorId: fin.id, politicaId: politica.id, templateId: templates.get("amigavel")!,
      referenciaCalendario: { versao: cobranca.versao, vencimento: cobranca.vencimento.toISOString(), cicloRegua: cobranca.cicloRegua },
      referenciaDestino: referenciaDestinoCobranca(snapshot.destino),
      corpoRenderizado: "Saldo antigo", variaveis: [] }));
    await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: fin.id, valorRecebido: tipo === "total" ? 85000 : 5000, forma: "DINHEIRO", dataPagamento: new Date(), comentario: "Pagamento registrado após preparação da mensagem", chaveIdempotencia: `pagamento-whatsapp-${tipo}` }));
    await despacharFila(); expect(enviarMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).status).toBe("CANCELADA");
  });
  it("W07 e AC06: número inativo ou autor revogado bloqueiam envio humano", async () => {
    const c = await comercial();
    const i = await prisma.intencaoMensagem.create({ data: { numeroId: c.numero.id, contatoId: c.contato.id, atendimentoId: c.a.id,
      origem: "HUMANO", autorId: c.vendedor.id, corpoRenderizado: "Texto" } });
    await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { ativo: false } });
    await despacharFila(); expect(enviarMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).motivoFalha).toBe("numero_remetente_inativo");
    await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { ativo: true } });
    await prisma.intencaoMensagem.update({ where: { id: i.id }, data: { status: "PENDENTE" } });
    await prisma.usuario.update({ where: { id: c.vendedor.id }, data: { ativo: false } });
    await despacharFila(); expect(enviarMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).motivoFalha).toBe("autor_sem_acesso");
  });
});
