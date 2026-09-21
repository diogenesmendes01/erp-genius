import { receberTx } from "@/server/financeiro/recebimentos";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
vi.mock("./drivers/evolution", () => ({ driverEvolution: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { carregarThread, listarConversas, buscarPessoasVinculo } from "./consultas";
import { despacharFila } from "./despachante";
import { enfileirarIntencaoCobranca, enfileirarIntencaoComercial } from "./fila";
import { referenciaDestinoCobranca, snapshotCobranca } from "./elegibilidade";
import { enviarTextoInbox, vincularContatoWhatsApp } from "./acoes";
import { abrirAtendimentoInstitucional, classificarMensagemWhatsApp, listarOpcoesAtendimento } from "./operacoes-atendimento";
import { rodarLeadNovoSemResposta, rodarPreExperimental } from "./cron-comercial";
import { capturarRespostaExperimental } from "@/server/comercial/captura";

beforeEach(async () => {
  await truncarBanco(); vi.stubEnv("WHATSAPP_LIVE", "1"); authMock.mockReset();
  enviarMock.mockReset().mockResolvedValue({ providerMessageId: "teste-sem-rede" });
});
afterEach(() => vi.unstubAllEnvs());
const sessao = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });

async function comercial() {
  const vendedor = await criarUsuario([Papel.VENDEDOR]);
  const outro = await criarUsuario([Papel.VENDEDOR]);
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999999999", rotulo: "Institucional", driver: "BAILEYS", finalidade: "VENDAS", donoId: outro.id } });
  const lead = await prisma.lead.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: vendedor.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
  return { vendedor, outro, numero, lead, contato, a };
}

async function filaComercial(chave = "LEAD_NOVO_SEM_RESPOSTA") {
  const c = await comercial();
  const ancora = new Date(Date.now() - 3600_000);
  const aula = new Date(Date.now() + 3600_000);
  const ocorrencia = chave === "PRE_EXPERIMENTAL" ? aula : ancora;
  const passo = chave === "PRE_EXPERIMENTAL" ? "-2h" : "+30min";
  await prisma.conversaWhatsApp.update({ where: { id: c.a.conversaId }, data: { capturadaEm: ancora, ultimoInboundEm: ancora } });
  if (chave === "PRE_EXPERIMENTAL") await prisma.lead.update({ where: { id: c.lead.id }, data: { etapa: "EXPERIMENTAL_AGENDADA", dataExperimental: aula } });
  const politica = await prisma.politicaComercial.create({ data: { chave, nome: chave, estado: "ATIVA", janelaInicio: 0, janelaFim: 24,
    diasSemana: [0, 1, 2, 3, 4, 5, 6], numeroRemetenteId: c.numero.id, degraus: { create: { passo, offsetMinutos: chave === "PRE_EXPERIMENTAL" ? -120 : 30, rotulo: "teste" } } } });
  const dados = { numeroId: c.numero.id, contatoId: c.contato.id, leadId: c.lead.id, politicaComercialId: politica.id,
    ocorrenciaComercial: ocorrencia.toISOString(), passoComercial: passo, corpoRenderizado: "Mensagem autorizada", variaveis: [], templateId: null,
    validaAte: new Date(ocorrencia.getTime() + 7 * 24 * 3600_000) };
  await prisma.$transaction((tx) => enfileirarIntencaoComercial(tx, dados));
  const i = await prisma.intencaoMensagem.findFirstOrThrow();
  return { ...c, ancora, aula, dados, i };
}

describe("D02: atendimento comercial segue carteira/equipe/cobertura atual", () => {
  it("dono do número não herda o lead; transferência revoga anterior e mensagem humana pendente", async () => {
    const c = await comercial();
    expect((await listarConversas(sessao(c.vendedor))).map((a) => a.id)).toContain(c.a.id);
    expect(await carregarThread(sessao(c.outro), c.a.id)).toBeNull();
    await prisma.intencaoMensagem.create({ data: { numeroId: c.numero.id, contatoId: c.contato.id, atendimentoId: c.a.id, origem: "HUMANO", autorId: c.vendedor.id, corpoRenderizado: "Antes da transferência" } });
    await prisma.lead.update({ where: { id: c.lead.id }, data: { vendedorDonoId: c.outro.id } });
    expect(await carregarThread(sessao(c.vendedor), c.a.id)).toBeNull();
    expect(await carregarThread(sessao(c.outro), c.a.id)).not.toBeNull();
    await despacharFila();
    expect(enviarMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).toBe("atendimento_sem_acesso");
  });
  it("cobertura vence sem compartilhar registros fora da carteira", async () => {
    const c = await comercial();
    const cobertura = await prisma.coberturaCarteira.create({ data: { titularId: c.vendedor.id, substitutoId: c.outro.id, concedenteId: c.vendedor.id,
      inicio: new Date(Date.now() - 1000), fim: new Date(Date.now() + 60000), motivo: "Cobertura teste" } });
    expect(await carregarThread(sessao(c.outro), c.a.id)).not.toBeNull();
    await prisma.coberturaCarteira.update({ where: { id: cobertura.id }, data: { fim: new Date(Date.now() - 1) } });
    expect(await carregarThread(sessao(c.outro), c.a.id)).toBeNull();
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
    const { numero } = await seedCanal({ driver: "BAILEYS", estado: "ATIVA" });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: aluno.telefoneE164!, alunoId: aluno.id, nomeExibicao: aluno.telefoneE164 } });
    const pedagogico = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "PEDAGOGICO", alunoId: aluno.id, turmaId: t.id, matriculaId: matricula.id }));
    const financeiro = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "FINANCEIRO", alunoId: aluno.id, matriculaId: matricula.id }));
    return { pro, outro, t, aluno, matricula, numero, contato, pedagogico, financeiro };
  }
  it("PRO+FIN recebe só mensagens pedagógicas nesse assunto; telefone não aparece no payload", async () => {
    const c = await turma();
    await prisma.mensagemWhatsApp.createMany({ data: [
      { numeroId: c.numero.id, conversaId: c.pedagogico.conversaId, atendimentoId: c.pedagogico.id, direcao: "ENTRADA", driver: "BAILEYS", corpo: "Tarefa de hoje" },
      { numeroId: c.numero.id, conversaId: c.pedagogico.conversaId, atendimentoId: c.financeiro.id, direcao: "ENTRADA", driver: "BAILEYS", corpo: "Dívida de 900" },
      { numeroId: c.numero.id, conversaId: c.pedagogico.conversaId, direcao: "ENTRADA", driver: "BAILEYS", corpo: "Legado financeiro" },
    ] });
    const thread = await carregarThread(sessao(c.pro), c.pedagogico.id);
    expect(thread?.mensagens.map((m) => m.corpo)).toEqual(["Tarefa de hoje"]);
    expect(thread?.cobrancaAtiva).toBeNull();
    expect(JSON.stringify(thread)).not.toContain(c.aluno.telefoneE164);
    expect(JSON.stringify(thread)).not.toContain(c.aluno.email);
    await prisma.turma.update({ where: { id: c.t.id }, data: { professorId: c.outro.id } });
    expect(await carregarThread(sessao(c.pro), c.pedagogico.id)).toBeNull();
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
    const m = await prisma.mensagemWhatsApp.create({ data: { numeroId: c.numero.id, conversaId: c.pedagogico.conversaId, direcao: "ENTRADA", driver: "BAILEYS", corpo: "Revisar tarefa" } });
    authMock.mockResolvedValue({ user: { id: c.pro.id } });
    expect((await classificarMensagemWhatsApp({ mensagemId: m.id, atendimentoId: c.pedagogico.id, motivo: "Conteúdo revisado como pedagógico" })).ok).toBe(false);
    const adm = await criarUsuario([Papel.ADMINISTRADOR]); authMock.mockResolvedValue({ user: { id: adm.id } });
    expect((await classificarMensagemWhatsApp({ mensagemId: m.id, atendimentoId: c.pedagogico.id, motivo: "Conteúdo revisado como pedagógico" })).ok).toBe(true);
    expect((await carregarThread(sessao(c.pro), c.pedagogico.id))?.mensagens.map((m) => m.corpo)).toEqual(["Revisar tarefa"]);
  });
});

describe("W01–W07: intenção velha nunca chama o driver", () => {
  it("W01: mudança de etapa cancela uma intenção adiada", async () => {
    const c = await filaComercial();
    await prisma.intencaoMensagem.update({ where: { id: c.i.id }, data: { status: "ADIADA", despacharAposEm: new Date(0) } });
    await prisma.lead.update({ where: { id: c.lead.id }, data: { etapa: "EM_ATENDIMENTO" } });
    await despacharFila(); expect(enviarMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.i.id } })).motivoFalha).toBe("etapa_comercial_alterada");
  });
  it("W02: aula vencida cancela o lembrete mesmo que já esteja na fila", async () => {
    const c = await filaComercial("PRE_EXPERIMENTAL");
    await despacharFila(new Date(c.aula.getTime() + 1)); expect(enviarMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.i.id } })).motivoFalha).toBe("experimental_iniciada");
  });
  it("W03: saída fromMe encerra o cron e o despacho pendente", async () => {
    const c = await filaComercial();
    await prisma.mensagemWhatsApp.create({ data: { numeroId: c.numero.id, conversaId: c.a.conversaId, direcao: "SAIDA", origem: null, driver: "BAILEYS", corpo: "Resposta pelo celular" } });
    expect((await rodarLeadNovoSemResposta()).enfileiradas).toBe(0);
    await despacharFila(); expect(enviarMock).not.toHaveBeenCalled();
  });
  it("W04: REAGENDAR cancela e não renasce para a agenda anterior", async () => {
    const c = await filaComercial("PRE_EXPERIMENTAL");
    await prisma.evento.create({ data: { tipo: "ReguaComercialEnviada", agregadoTipo: "Lead", agregadoId: c.lead.id,
      payload: { chave: "PRE_EXPERIMENTAL", ocorrencia: c.aula.toISOString(), passo: "-24h" } } });
    await prisma.$transaction((tx) => capturarRespostaExperimental(tx, { leadId: c.lead.id, corpo: "REAGENDAR", quando: new Date() }));
    expect((await rodarPreExperimental()).enfileiradas).toBe(0);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.i.id } })).status).toBe("CANCELADA");
    await despacharFila(); expect(enviarMock).not.toHaveBeenCalled();
  });
  it("W05: claim interrompido fica FALHOU e enfileirador não reabre", async () => {
    const c = await filaComercial();
    await prisma.intencaoMensagem.update({ where: { id: c.i.id }, data: { status: "ENVIANDO", despacharAposEm: new Date(0) } });
    await despacharFila();
    expect(await prisma.$transaction((tx) => enfileirarIntencaoComercial(tx, c.dados))).toBe("ja_existente");
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.i.id } })).status).toBe("FALHOU");
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
