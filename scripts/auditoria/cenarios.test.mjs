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
// Fase 4E: o único driver é o motor próprio (Meta Cloud e Evolution saíram do código).
vi.mock("@/server/whatsapp/drivers/motor", () => ({
  driverMotor: { enviarTexto: sendMock, enviarTemplate: sendMock, enviarMidia: sendMock, enviarConteudo: sendMock },
}));
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo } from "@/test/integracao";
import { exigirSessao } from "@/server/_shared/sessao";
import { criarMatricula, ativarMatricula } from "@/server/matricula/acoes";
import { ajustarCobranca, decidirAprovacao } from "@/server/ajustes/acoes";
import { registrarPagamento } from "@/server/financeiro/acoes";
import { kpisFinanceiro } from "@/server/financeiro/consultas";
import { listarAlunos } from "@/server/alunos/consultas";
import { pausarAluno, reativarAluno, encerrarAluno, trocarTurma } from "@/server/alunos/acoes";
import { solicitarRetomada, decidirRetomada } from "@/server/retomada/acoes";
import { criarLead } from "@/server/comercial/acoes";
import { obterLead, listarLeads } from "@/server/comercial/consultas";
import { buscarVinculosInbox } from "@/server/whatsapp/acoes";
import { editarPais } from "@/server/paises/acoes";
import { despacharFila } from "@/server/whatsapp/despachante";
import { capturarRespostaExperimental } from "@/server/comercial/captura";

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
  const lead = await prisma.oportunidade.create({ data: { nome: "Lead auditoria", vendedorDonoId: vendedor.id } });
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
  // Escopo docente atual (escopoTurmasDocente): além de Turma.professorId, exige VinculoDocente vigente.
  await prisma.vinculoDocente.create({ data: { turmaId: t.id, professorId: professor.id, inicio: new Date(Date.now() - 60000) } });
  if (alunoId) await prisma.alocacaoTurma.create({ data: { alunoId, turmaId: t.id } });
  return t;
}
// Contrato atual: ativação com valor > 0 exige evidência da destinação (comentario >= 5 caracteres).
const ativacao = (valorRecebido) => ({
  valorRecebido, forma: "DINHEIRO", dataPagamento: new Date().toISOString(), comentario: "Recebido em caixa (auditoria)",
});
// Contrato atual de registrarPagamento: chave de idempotência (>= 16) e evidência da destinação (>= 5).
const pagamento = (valorRecebido) => ({
  valorRecebido, forma: "DINHEIRO", chaveIdempotencia: "auditoria-" + crypto.randomUUID(), comentario: "Recebido em caixa (auditoria)",
});
// Pré-condições de ativação (regras atuais): contrato vigente aceito e confirmado pela secretaria
// (exigirContratoAceito) e cobertura da primeira mensalidade conferida (expandirCoberturaMensal).
// Montadas direto no banco, como em matricula/comissao-aprovada-em.int.test.ts: estes cenários
// auditam o dinheiro, não o fluxo de aceite.
async function contratoConfirmado(matricula) {
  const primeira = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: matricula.id, tipo: "MENSALIDADE" } });
  const v = primeira.vencimento;
  await prisma.cobranca.update({ where: { id: primeira.id }, data: {
    coberturaInicio: new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), 1)),
    coberturaFim: new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth() + 1, 0)),
  } });
  await prisma.matricula.update({ where: { id: matricula.id }, data: { referenciaCobertura: "MES_CIVIL" } });
  const sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria auditoria");
  const doc = await prisma.documento.create({ data: { matriculaId: matricula.id, categoria: "CONTRATO", nome: "Contrato aceito", url: "/api/files/contrato-auditoria.pdf" } });
  await prisma.matricula.update({ where: { id: matricula.id }, data: {
    contratoOk: true, contratoDocumentoId: doc.id, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: sec.id,
  } });
}
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
    // A busca deixou de responder erro: fora do escopo devolve listas vazias (fail-closed por resultado).
    // O critério auditado continua o mesmo: o professor não obtém cadastro de alunos pela inbox.
    const { aluno, matricula } = await contrato();
    const numero = await prisma.numeroWhatsApp.create({ data: {
      telefoneE164: "+50677775555", rotulo: "Secretaria auditoria", driver: "MOTOR", finalidade: "COBRANCA",
      providerRef: "audit-secretaria", sessao: "CONECTADO",
    } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: aluno.telefoneE164, alunoId: aluno.id } });
    const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
    const atendimento = await prisma.atendimentoWhatsApp.create({ data: {
      conversaId: conversa.id, contextoChave: "auditoria-a06", finalidade: "SECRETARIA", alunoId: aluno.id, matriculaId: matricula.id,
    } });
    const vazado = (r) => r.ok && r.dado.alunos.length + r.dado.responsaveis.length + r.dado.leads.length > 0;
    // Contraprova: quem tem o papel de atendimento encontra o aluno pela mesma busca.
    expect(vazado(await buscarVinculosInbox("Auditoria", atendimento.id))).toBe(true);
    logar(professor);
    expect(vazado(await buscarVinculosInbox("Auditoria", atendimento.id))).toBe(false);
    expect(vazado(await buscarVinculosInbox("Auditoria"))).toBe(false);
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
    sucesso(await registrarPagamento(mensalidade.id, pagamento(40)));
    // Alçada atual: ajuste pedido pela administração exige aprovação de OUTRA pessoa da direção.
    expect(sucesso(await ajustarCobranca(ajuste(mensalidade.id, 80)))).toEqual({ aprovacao: true });
    const pedido = await prisma.aprovacao.findFirstOrThrow({ where: { alvoId: mensalidade.id, status: "PENDENTE" } });
    logar(await criarUsuario([Papel.ADMINISTRADOR], "Segunda direcao auditoria"));
    sucesso(await decidirAprovacao(pedido.id, { aprovar: true, motivo: "Aprovado na auditoria" }));
    const c = await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidade.id } });
    expect({ negociado: Number(c.valorNegociado), recebido: Number(c.valorRecebido), saldo: Number(c.saldo) })
      .toEqual({ negociado: 80, recebido: 40, saldo: 40 });
  });
  it("F02 indicadores contam recebimento parcial e saldo real", async () => {
    const { taxa, mensalidade } = await contrato();
    await prisma.cobranca.update({ where: { id: taxa.id }, data: { status: "CANCELADA" } });
    sucesso(await registrarPagamento(mensalidade.id, pagamento(40)));
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
      registrarPagamento(mensalidade.id, pagamento(40)),
      registrarPagamento(mensalidade.id, pagamento(30)),
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
    sucesso(await registrarPagamento(mensalidade.id, pagamento(100)));
    await contratoConfirmado(matricula);
    sucesso(await ativarMatricula(matricula.id, ativacao(100)));
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidade.id } })).status).toBe("PAGO");
  });
  it("F06 ativacao considera taxa parcialmente paga anteriormente", async () => {
    const { matricula, taxa } = await contrato();
    sucesso(await registrarPagamento(taxa.id, pagamento(40)));
    await contratoConfirmado(matricula);
    sucesso(await ativarMatricula(matricula.id, ativacao(60)));
  });
  it("F07 pagamento nao declara contrato assinado sem evidencia", async () => {
    const { matricula } = await contrato();
    // Regra nova (exigirContratoAceito): o recebimento não ativa nem declara contrato; a ativação é
    // recusada até a secretaria confirmar um contrato vigente.
    expect((await ativarMatricula(matricula.id, ativacao(100))).ok).toBe(false);
    const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matricula.id } });
    expect({ status: m.status, contratoOk: m.contratoOk, confirmadoPor: m.confirmacaoContratoPorId })
      .toEqual({ status: "AGUARDANDO", contratoOk: false, confirmadoPor: null });
  });
  it("F08 aluno reativado recupera cobrancas futuras", async () => {
    const { aluno, matricula } = await contrato();
    await prisma.matricula.update({ where: { id: matricula.id }, data: { status: "ATIVA" } });
    sucesso(await pausarAluno(aluno.id, { motivo: "Viagem" }));
    // Regra nova: a retomada direta foi desativada; exige proposta e aprovação por outra pessoa (FIN/ADM).
    expect((await reativarAluno(aluno.id)).ok).toBe(false);
    const { propostaId } = sucesso(await solicitarRetomada(aluno.id, { opcao: "MANTER_VENCIMENTOS", motivo: "Voltou da viagem" }));
    expect((await decidirRetomada(propostaId, { aprovar: true, motivo: "Aprovo a retomada" })).ok).toBe(false); // mesma pessoa
    logar(await criarUsuario([Papel.FINANCEIRO], "Financeiro auditoria"));
    sucesso(await decidirRetomada(propostaId, { aprovar: true, motivo: "Aprovo a retomada" }));
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
    const tipoOriginal = aluno.tipoDocumentoId;
    const pais = { nome: "Costa Rica editada", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506", fuso: "America/Costa_Rica", idioma: "es" };
    // Regra nova: tipos são editados por id; omitir um tipo usado por alunos é recusado (não recriado).
    expect((await editarPais(cat.pais.id, { ...pais, tiposDocumento: [{ nome: "Cedula", validador: "cedula_cr" }] })).ok).toBe(false);
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: aluno.id } })).tipoDocumentoId).toBe(tipoOriginal);
    sucesso(await editarPais(cat.pais.id, { ...pais, tiposDocumento: [{ id: tipoOriginal, nome: "Cedula", validador: "cedula_cr" }] }));
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: aluno.id } })).tipoDocumentoId).toBe(tipoOriginal);
    expect((await prisma.tipoDocumento.findUniqueOrThrow({ where: { id: tipoOriginal } })).nome).toBe("Cedula");
  });
  it("F12 pais pausado nao aceita nova matricula", async () => {
    await prisma.pais.update({ where: { id: cat.pais.id }, data: { status: "PAUSADO" } });
    expect((await criarMatricula(dadosMatricula())).ok).toBe(false);
  });
});

// Chaves da régua comercial do CRM antigo (removida): as intenções que sobraram na fila são canceladas no despacho.
const CHAVE_LEAD_NOVO = "LEAD_NOVO_SEM_RESPOSTA";
const CHAVE_PRE_EXPERIMENTAL = "PRE_EXPERIMENTAL";
async function canalComercial(chave = CHAVE_LEAD_NOVO, etapa = "NOVO", ancora = new Date(Date.now() - 45 * 60000)) {
  const numero = await prisma.numeroWhatsApp.create({ data: {
    telefoneE164: "+50677776666", rotulo: "Auditoria", driver: "MOTOR", finalidade: "VENDAS",
    donoId: vendedor.id, providerRef: "audit-instance", sessao: "CONECTADO",
  } });
  const lead = await prisma.oportunidade.create({ data: {
    nome: "Lead auditoria", etapa, vendedorDonoId: vendedor.id, paisId: cat.pais.id,
    dataExperimental: chave === CHAVE_PRE_EXPERIMENTAL ? ancora : null,
  } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777", leadId: lead.id } });
  const conversa = await prisma.conversaWhatsApp.create({ data: {
    numeroId: numero.id, contatoId: contato.id, capturadaEm: chave === CHAVE_LEAD_NOVO ? ancora : maisDias(-3),
  } });
  return { numero, chave, lead, contato, conversa, ancora };
}
async function intencao(c, extra = {}) {
  return prisma.intencaoMensagem.create({ data: {
    numeroId: c.numero.id, contatoId: c.contato.id,
    leadId: c.lead.id, passoComercial: c.chave === CHAVE_PRE_EXPERIMENTAL ? "-2h" : "+30min",
    ocorrenciaComercial: c.ancora.toISOString(), origem: "CRON", corpoRenderizado: "Mensagem antiga",
    status: "ADIADA", despacharAposEm: new Date(Date.now() - 60000), ...extra,
  } });
}

describe("WhatsApp com drivers falsos e banco real", () => {
  it("W01 item adiado nao sai depois de avancar o lead", async () => {
    const c = await canalComercial(); const i = await intencao(c);
    await prisma.oportunidade.update({ where: { id: c.lead.id }, data: { etapa: "EM_ATENDIMENTO" } });
    await despacharFila();
    expect({ envios: sendMock.mock.calls.length, status: (await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).status })
      .toEqual({ envios: 0, status: "CANCELADA" });
  });
  it("W02 lembrete adiado nao sai apos comecar a experimental", async () => {
    const c = await canalComercial(CHAVE_PRE_EXPERIMENTAL, "EXPERIMENTAL_AGENDADA", new Date(Date.now() - 60000));
    await intencao(c); await despacharFila();
    expect(sendMock).not.toHaveBeenCalled();
  });
  // W03 (lead novo interrompido pela saída do celular) saiu com o cron comercial na E1 (53c69b4b):
  // não há mais enfileiramento automático de lead novo para auditar.
  it("W04 pedido de reagendamento impede novos lembretes", async () => {
    const c = await canalComercial(CHAVE_PRE_EXPERIMENTAL, "EXPERIMENTAL_AGENDADA", new Date(Date.now() + 60000 * 60));
    await prisma.evento.create({ data: {
      tipo: "ReguaComercialEnviada", agregadoTipo: "Lead", agregadoId: c.lead.id,
      payload: { chave: CHAVE_PRE_EXPERIMENTAL, passo: "-24h", ocorrencia: c.ancora.toISOString() },
    } });
    await prisma.$transaction(tx => capturarRespostaExperimental(tx, { leadId: c.lead.id, corpo: "REAGENDAR", quando: new Date() }));
    // Sem o cron comercial (E1), o critério auditável é o registro do pedido de reagendamento.
    expect(await prisma.evento.count({ where: { tipo: "ExperimentalReagendamentoSolicitado" } })).toBe(1);
  });
  it("W05 falha de envio incerto nao eh reaberta automaticamente", async () => {
    const c = await canalComercial();
    const i = await intencao(c, { status: "ENVIANDO", despacharAposEm: new Date(Date.now() - 60000) });
    await despacharFila();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).motivoFalha).toBe("envio_interrompido");
    await despacharFila(); // novo despacho não reabre a falha incerta
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
    sucesso(await registrarPagamento(f.mensalidade.id, pagamento(100)));
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
