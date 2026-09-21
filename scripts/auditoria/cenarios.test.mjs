// Auditoria de regras: os testes exprimem o comportamento esperado e podem FALHAR.
// Banco exclusivo de teste. Auth/cache e drivers externos sao mocks; Prisma e regras sao reais.
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock, sendMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  sendMock: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/whatsapp/drivers/meta-cloud", () => ({
  driverMetaCloud: { enviarTexto: sendMock, enviarTemplate: sendMock, enviarMidia: sendMock },
}));
vi.mock("@/server/whatsapp/drivers/evolution", () => ({
  driverEvolution: { enviarTexto: sendMock, enviarTemplate: sendMock, enviarMidia: sendMock },
}));
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo } from "@/test/integracao";
import { exigirSessao } from "@/server/_shared/sessao";
import { criarMatricula, ativarMatricula } from "@/server/matricula/acoes";
import { ajustarCobranca } from "@/server/ajustes/acoes";
import { registrarPagamento } from "@/server/financeiro/acoes";
import { kpisFinanceiro } from "@/server/financeiro/consultas";
import { listarAlunos } from "@/server/alunos/consultas";
import { pausarAluno, reativarAluno, encerrarAluno, trocarTurma } from "@/server/alunos/acoes";
import { criarLead } from "@/server/comercial/acoes";
import { obterLead, listarLeads } from "@/server/comercial/consultas";
import { buscarVinculosInbox } from "@/server/whatsapp/acoes";
import { editarPais } from "@/server/paises/acoes";
import { rodarLeadNovoSemResposta, rodarPreExperimental } from "@/server/whatsapp/cron-comercial";
import { despacharFila } from "@/server/whatsapp/despachante";
import { capturarRespostaExperimental } from "@/server/comercial/captura";
import { CADENCIAS_COMERCIAIS, CHAVE_LEAD_NOVO, CHAVE_PRE_EXPERIMENTAL } from "@/server/comercial/regua-fabrica";

let cat, admin, vendedor, outro, professor;
const logar = (u) => authMock.mockResolvedValue({ user: { id: u.id } });
function sucesso(r) {
  expect(r.ok, r.ok ? "" : r.erro).toBe(true);
  return r.dado;
}
const maisDias = (dias) => new Date(Date.now() + dias * 86400000);

beforeEach(async () => {
  await truncarBanco();
  cat = await seedCatalogoMinimo();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin auditoria");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor auditoria");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro vendedor");
  professor = await criarUsuario([Papel.PROFESSOR], "Professor auditoria");
  sendMock.mockReset().mockImplementation(async () => ({ providerMessageId: "audit-" + crypto.randomUUID() }));
  vi.stubEnv("WHATSAPP_LIVE", "1"); // drivers inteiramente mockados; nenhum envio real
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Rede externa bloqueada na auditoria"); }));
  logar(admin);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function dadosMatricula(extra = {}) {
  return {
    alunoPrimeiroNome: "Aluno", alunoSobrenome: "Auditoria",
    alunoGenero: "NAO_INFORMADO", alunoNascimento: "1990-05-10",
    alunoPaisId: cat.pais.id, alunoTipoDocumentoId: cat.pais.tiposDocumento[0].id,
    alunoDocumento: "123456789", alunoNacionalidade: "CR", alunoEmail: "audit@example.test",
    alunoTelefone: "88887777", alunoWhatsapp: true, alunoAceitaComunicacoes: true,
    alunoPaisResidencia: "CR", pagador: "ALUNO", produtoId: cat.produto.id,
    taxaValor: 20000, mensalidadeValor: 85000, comissaoPct: 10,
    diaVencimento: 5, mesesPlano: 3, ...extra,
  };
}
async function contrato(extra = {}) {
  const aluno = await prisma.aluno.create({ data: {
    primeiroNome: "Aluno Auditoria", paisId: cat.pais.id, tipoDocumentoId: cat.pais.tiposDocumento[0].id,
    nascimento: new Date("1990-01-01"), telefoneE164: "+50688887777", ...extra,
  } });
  const lead = await prisma.lead.create({ data: { nome: "Lead auditoria", vendedorDonoId: vendedor.id } });
  const matricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id, leadId: lead.id, paisId: cat.pais.id, produtoId: cat.produto.id,
    moeda: "CRC", status: "AGUARDANDO", mesesPlano: 3,
    cobrancas: { create: [
      { tipo: "MATRICULA", valorOriginal: 100, valorNegociado: 100, moeda: "CRC", vencimento: new Date() },
      { tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100, moeda: "CRC", vencimento: maisDias(35) },
    ] },
    comissoes: { create: { vendedorId: vendedor.id, percentual: 10, valor: 10, moeda: "CRC" } },
  }, include: { cobrancas: true } });
  return { aluno, lead, matricula,
    taxa: matricula.cobrancas.find(c => c.tipo === "MATRICULA"),
    mensalidade: matricula.cobrancas.find(c => c.tipo === "MENSALIDADE") };
}
async function turma(alunoId) {
  const nivel = await prisma.nivel.create({ data: { codigo: "A1", ordem: 1, idiomaId: cat.idioma.id } });
  const t = await prisma.turma.create({ data: {
    modalidadeId: cat.modalidade.id, nivelId: nivel.id, professorId: professor.id, capacidade: 20,
    status: "ABERTA", dataInicio: maisDias(1), dataFim: maisDias(90),
  } });
  if (alunoId) await prisma.alocacaoTurma.create({ data: { alunoId, turmaId: t.id } });
  return t;
}
const ativacao = (valorRecebido) => ({ valorRecebido, forma: "DINHEIRO", dataPagamento: new Date().toISOString() });
const ajuste = (cobrancaId, valorPara) => ({
  cobrancaId, valorPara, tipo: "DESCONTO", vigencia: "ESTA_COBRANCA", motivo: "Cenario de auditoria",
});

describe("Controles existentes - contraprovas", () => {
  it("C01 vendedor nao le ficha de lead de terceiro", async () => {
    const { lead } = await contrato();
    expect(await obterLead(lead.id, outro)).toBeNull();
  });
  it("C02 papel revogado bloqueia criacao de lead", async () => {
    await prisma.usuario.update({ where: { id: vendedor.id }, data: { papeis: [Papel.PROFESSOR] } });
    logar(vendedor);
    expect((await criarLead({ nome: "Nao criar" })).ok).toBe(false);
  });
  it("C03 professor nao lista alunos de turma alheia", async () => {
    const { aluno } = await contrato();
    const t = await turma(aluno.id);
    await prisma.turma.update({ where: { id: t.id }, data: { professorId: admin.id } });
    expect(await listarAlunos(professor)).toHaveLength(0);
  });
  it("C04 matricula sem preco e sem justificativa eh bloqueada", async () => {
    await prisma.precoReferencia.updateMany({ data: { ativo: false } });
    expect((await criarMatricula(dadosMatricula())).ok).toBe(false);
  });
});

describe("Acesso e alçadas", () => {
  it("A01 professor nao recebe resumo financeiro na lista", async () => {
    const { aluno } = await contrato(); await turma(aluno.id);
    const lista = await listarAlunos(professor);
    expect(lista).toHaveLength(1);
    expect(lista[0].financeiro).toBeNull();
  });
  it("A02 vendedor nao ajusta cobranca de terceiro", async () => {
    const { mensalidade } = await contrato();
    await prisma.usuario.update({ where: { id: outro.id }, data: { limiteDescontoPct: 20 } });
    logar(outro);
    const r = await ajustarCobranca(ajuste(mensalidade.id, 90));
    expect({ autorizado: r.ok, valor: Number((await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidade.id } })).valorNegociado) })
      .toEqual({ autorizado: false, valor: 100 });
  });
  it("A03 vendedor com limite 5% nao cria matricula com desconto de 99%", async () => {
    await prisma.usuario.update({ where: { id: vendedor.id }, data: { limiteDescontoPct: 5 } });
    logar(vendedor);
    const r = await criarMatricula(dadosMatricula({ taxaValor: 200, mensalidadeValor: 850 }));
    const aprovacoes = await prisma.aprovacao.count();
    expect({ autorizadaSemAprovacao: r.ok && aprovacoes === 0 }).toEqual({ autorizadaSemAprovacao: false });
  });
  it("A04 vendedor nao define livremente comissao de 100%", async () => {
    logar(vendedor);
    const r = await criarMatricula(dadosMatricula({ comissaoPct: 100 }));
    const c = await prisma.comissao.findFirst();
    expect({ aceitouComissaoLivre: r.ok && Number(c?.percentual) === 100 }).toEqual({ aceitouComissaoLivre: false });
  });
  it("A05 revogacao do papel comercial bloqueia leitura mesmo mantendo dono", async () => {
    const { lead } = await contrato();
    await prisma.usuario.update({ where: { id: vendedor.id }, data: { papeis: [Papel.PROFESSOR] } });
    logar(vendedor);
    const fresca = await exigirSessao();
    expect(await obterLead(lead.id, fresca)).toBeNull();
  });
  it("A06 busca da inbox bloqueia professor sem papel de atendimento", async () => {
    await contrato(); logar(professor);
    const r = await buscarVinculosInbox("Auditoria");
    expect(r.ok).toBe(false);
  });
  it("A07 filtro opcional nao substitui escopo obrigatorio do vendedor", async () => {
    const { lead } = await contrato();
    const lista = await listarLeads(outro, { vendedorId: vendedor.id });
    expect(lista.map(l => l.id)).not.toContain(lead.id);
  });
});

describe("Dinheiro e ciclo de matricula", () => {
  it("F01 desconto depois de baixa parcial recalcula saldo", async () => {
    const { mensalidade } = await contrato();
    sucesso(await registrarPagamento(mensalidade.id, { valorRecebido: 40, forma: "DINHEIRO" }));
    sucesso(await ajustarCobranca(ajuste(mensalidade.id, 80)));
    const c = await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidade.id } });
    expect({ negociado: Number(c.valorNegociado), recebido: Number(c.valorRecebido), saldo: Number(c.saldo) })
      .toEqual({ negociado: 80, recebido: 40, saldo: 40 });
  });
  it("F02 indicadores contam recebimento parcial e saldo real", async () => {
    const { taxa, mensalidade } = await contrato();
    await prisma.cobranca.update({ where: { id: taxa.id }, data: { status: "CANCELADA" } });
    sucesso(await registrarPagamento(mensalidade.id, { valorRecebido: 40, forma: "DINHEIRO" }));
    const k = await kpisFinanceiro();
    expect({ recebido: k.recebidoMes, receber: k.aReceber }).toEqual({
      recebido: [{ moeda: "CRC", valor: 40 }], receber: [{ moeda: "CRC", valor: 60 }],
    });
  });
  // Inconclusivo: imports dinamicos concorrentes escapam do mock de Auth.js neste runner
  // (ERR_MODULE_NOT_FOUND next/server). Nao contabilizar como defeito reproduzido.
  it.skip("F03 duas baixas concorrentes nao perdem valor", async () => {
    const { mensalidade } = await contrato();
    await exigirSessao(); // resolve imports dinamicos antes das chamadas concorrentes no Vitest
    // Chamadas reais concorrentes, sem interceptar delegates do Prisma.
    // A reproducao depende da intercalacao do banco; um passe nao prova ausencia da corrida.
    const resultados = await Promise.all([
      registrarPagamento(mensalidade.id, { valorRecebido: 40, forma: "DINHEIRO" }),
      registrarPagamento(mensalidade.id, { valorRecebido: 30, forma: "DINHEIRO" }),
    ]);
    resultados.forEach(sucesso);
    const c = await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidade.id } });
    expect(Number(c.valorRecebido)).toBe(70);
  });
  it("F04 matricula CANCELADA nao volta a ATIVA pelo recebimento", async () => {
    const { matricula } = await contrato();
    await prisma.matricula.update({ where: { id: matricula.id }, data: { status: "CANCELADA" } });
    expect((await ativarMatricula(matricula.id, ativacao(100))).ok).toBe(false);
  });
  it("F05 ativacao preserva primeira mensalidade ja paga", async () => {
    const { matricula, mensalidade } = await contrato();
    sucesso(await registrarPagamento(mensalidade.id, { valorRecebido: 100, forma: "DINHEIRO" }));
    sucesso(await ativarMatricula(matricula.id, ativacao(100)));
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidade.id } })).status).toBe("PAGO");
  });
  it("F06 ativacao considera taxa parcialmente paga anteriormente", async () => {
    const { matricula, taxa } = await contrato();
    sucesso(await registrarPagamento(taxa.id, { valorRecebido: 40, forma: "DINHEIRO" }));
    expect((await ativarMatricula(matricula.id, ativacao(60))).ok).toBe(true);
  });
  it("F07 pagamento nao declara contrato assinado sem evidencia", async () => {
    const { matricula } = await contrato();
    sucesso(await ativarMatricula(matricula.id, ativacao(100)));
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matricula.id } })).contratoOk).toBe(false);
  });
  it("F08 aluno reativado recupera cobrancas futuras", async () => {
    const { aluno, matricula } = await contrato();
    await prisma.matricula.update({ where: { id: matricula.id }, data: { status: "ATIVA" } });
    sucesso(await pausarAluno(aluno.id, { motivo: "Viagem" }));
    sucesso(await reativarAluno(aluno.id));
    const futuras = await prisma.cobranca.count({ where: {
      matriculaId: matricula.id, tipo: "MENSALIDADE", status: "PENDENTE", vencimento: { gt: new Date() },
    } });
    expect(futuras).toBeGreaterThan(0);
  });
  it("F09 aluno encerrado libera alocacao ativa e vaga", async () => {
    const { aluno } = await contrato(); await turma(aluno.id);
    sucesso(await encerrarAluno(aluno.id, { motivo: "Desistiu" }));
    expect(await prisma.alocacaoTurma.count({ where: { alunoId: aluno.id, ativa: true } })).toBe(0);
  });
  it("F10 mudanca de nivel pela secretaria exige decisao pedagogica", async () => {
    const { aluno } = await contrato(); await turma(aluno.id);
    const b2 = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "B2", ordem: 5 } });
    const destino = await prisma.turma.create({ data: { nivelId: b2.id, modalidadeId: cat.modalidade.id, capacidade: 20 } });
    const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA]); logar(secretaria);
    expect((await trocarTurma(aluno.id, { turmaDestinoId: destino.id })).ok).toBe(false);
  });
  it("F11 editar pais preserva tipo de documento dos alunos existentes", async () => {
    const { aluno } = await contrato();
    sucesso(await editarPais(cat.pais.id, {
      nome: "Costa Rica editada", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506",
      fuso: "America/Costa_Rica", idioma: "es", tiposDocumento: [{ nome: "Cedula", validador: "cedula_cr" }],
    }));
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: aluno.id } })).tipoDocumentoId).not.toBeNull();
  });
  it("F12 pais pausado nao aceita nova matricula", async () => {
    await prisma.pais.update({ where: { id: cat.pais.id }, data: { status: "PAUSADO" } });
    expect((await criarMatricula(dadosMatricula())).ok).toBe(false);
  });
});

async function canalComercial(chave = CHAVE_LEAD_NOVO, etapa = "NOVO", ancora = new Date(Date.now() - 45 * 60000)) {
  const numero = await prisma.numeroWhatsApp.create({ data: {
    telefoneE164: "+50677776666", rotulo: "Auditoria", driver: "BAILEYS", finalidade: "VENDAS",
    donoId: vendedor.id, providerRef: "audit-instance", sessao: "CONECTADO",
  } });
  const cadencia = CADENCIAS_COMERCIAIS.find(c => c.chave === chave);
  const politica = await prisma.politicaComercial.create({ data: {
    chave, nome: cadencia.nome, estado: "ATIVA", janelaInicio: 0, janelaFim: 24,
    diasSemana: [0,1,2,3,4,5,6], tetoPorContatoDia: 10, numeroRemetenteId: numero.id,
    degraus: { create: cadencia.degraus.map(d => ({
      passo: d.passo, offsetMinutos: d.offsetMinutos, rotulo: d.rotulo, ativo: true,
    })) },
  } });
  const lead = await prisma.lead.create({ data: {
    nome: "Lead auditoria", etapa, vendedorDonoId: vendedor.id, paisId: cat.pais.id,
    dataExperimental: chave === CHAVE_PRE_EXPERIMENTAL ? ancora : null,
  } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777", leadId: lead.id } });
  const conversa = await prisma.conversaWhatsApp.create({ data: {
    numeroId: numero.id, contatoId: contato.id, capturadaEm: chave === CHAVE_LEAD_NOVO ? ancora : maisDias(-3),
  } });
  return { numero, politica, lead, contato, conversa, ancora };
}
async function intencao(c, extra = {}) {
  return prisma.intencaoMensagem.create({ data: {
    numeroId: c.numero.id, contatoId: c.contato.id, politicaComercialId: c.politica.id,
    leadId: c.lead.id, passoComercial: c.politica.chave === CHAVE_PRE_EXPERIMENTAL ? "-2h" : "+30min",
    ocorrenciaComercial: c.ancora.toISOString(), origem: "CRON", corpoRenderizado: "Mensagem antiga",
    status: "ADIADA", despacharAposEm: new Date(Date.now() - 60000), ...extra,
  } });
}

describe("WhatsApp com drivers falsos e banco real", () => {
  it("W01 item adiado nao sai depois de avancar o lead", async () => {
    const c = await canalComercial(); const i = await intencao(c);
    await prisma.lead.update({ where: { id: c.lead.id }, data: { etapa: "EM_ATENDIMENTO" } });
    await despacharFila();
    expect({ envios: sendMock.mock.calls.length, status: (await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).status })
      .toEqual({ envios: 0, status: "CANCELADA" });
  });
  it("W02 lembrete adiado nao sai apos comecar a experimental", async () => {
    const c = await canalComercial(CHAVE_PRE_EXPERIMENTAL, "EXPERIMENTAL_AGENDADA", new Date(Date.now() - 60000));
    await intencao(c); await despacharFila();
    expect(sendMock).not.toHaveBeenCalled();
  });
  it("W03 saida humana pelo celular interrompe lead novo", async () => {
    const c = await canalComercial();
    await prisma.mensagemWhatsApp.create({ data: {
      conversaId: c.conversa.id, numeroId: c.numero.id, direcao: "SAIDA", origem: null,
      corpo: "Eu sou o vendedor, vou te atender", driver: "BAILEYS",
    } });
    const r = await rodarLeadNovoSemResposta();
    expect(r.enfileiradas).toBe(0);
  });
  it("W04 pedido de reagendamento impede novos lembretes", async () => {
    const c = await canalComercial(CHAVE_PRE_EXPERIMENTAL, "EXPERIMENTAL_AGENDADA", new Date(Date.now() + 60000 * 60));
    await prisma.evento.create({ data: {
      tipo: "ReguaComercialEnviada", agregadoTipo: "Lead", agregadoId: c.lead.id,
      payload: { chave: CHAVE_PRE_EXPERIMENTAL, passo: "-24h", ocorrencia: c.ancora.toISOString() },
    } });
    await prisma.$transaction(tx => capturarRespostaExperimental(tx, { leadId: c.lead.id, corpo: "REAGENDAR", quando: new Date() }));
    expect(await prisma.evento.count({ where: { tipo: "ExperimentalReagendamentoSolicitado" } })).toBe(1);
    expect((await rodarPreExperimental()).enfileiradas).toBe(0);
  });
  it("W05 falha de envio incerto nao eh reaberta automaticamente", async () => {
    const c = await canalComercial();
    const i = await intencao(c, { status: "ENVIANDO", despacharAposEm: new Date(Date.now() - 60000) });
    await despacharFila();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).motivoFalha).toBe("envio_interrompido");
    await rodarLeadNovoSemResposta();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("FALHOU");
  });
  it("W06 cobranca paga depois do enqueue nao eh enviada", async () => {
    const f = await contrato(); const c = await canalComercial();
    const politica = await prisma.politicaRegua.create({ data: {
      nome: "Cobranca auditoria", estado: "ATIVA", janelaInicio: 0, janelaFim: 24, diasSemana: [0,1,2,3,4,5,6],
      numeroRemetenteId: c.numero.id,
    } });
    await prisma.intencaoMensagem.create({ data: {
      numeroId: c.numero.id, contatoId: c.contato.id, origem: "LOTE", politicaId: politica.id,
      cobrancaId: f.mensalidade.id, passo: "D0", corpoRenderizado: "Pague 100",
    } });
    sucesso(await registrarPagamento(f.mensalidade.id, { valorRecebido: 100, forma: "DINHEIRO" }));
    await despacharFila();
    expect(sendMock).not.toHaveBeenCalled();
  });
  it("W07 numero inativo nao despacha itens antigos", async () => {
    const c = await canalComercial(); await intencao(c);
    await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { ativo: false } });
    await despacharFila();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
