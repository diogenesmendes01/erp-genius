import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import { randomUUID } from "node:crypto";

const { authMock, cronMensagem, despacho } = vi.hoisted(() => ({ authMock: vi.fn(), cronMensagem: vi.fn(), despacho: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// O endpoint real executa o controle de acesso; os braços de mensagens ficam isolados.
vi.mock("@/server/whatsapp/cron", () => ({ rodarCronRegua: cronMensagem }));
vi.mock("@/server/whatsapp/cron-comercial", () => ({ rodarLeadNovoSemResposta: async () => ({}), rodarNoShow: async () => ({}), rodarPreExperimental: async () => ({}) }));
vi.mock("@/server/whatsapp/despachante", () => ({ despacharFila: despacho }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { bloquearAcesso, desbloquearAcesso, decidirSolicitacaoAcessoAulas } from "./acoes";
import { rodarControleAcessoAulas, reavaliarAcessoAutomaticoDaCobranca } from "./acesso-aulas";
import { carregarGestaoAcessoAulas } from "./acesso-aulas-consultas";
import { registrarPagamento } from "@/server/financeiro/acoes";
import { POST as cron } from "@/app/api/whatsapp/cron/route";

const DIA = 86_400_000;
const como = (usuario: { id: string; papeis: Papel[] }) => authMock.mockResolvedValue({ user: { id: usuario.id, papeis: usuario.papeis } });

async function cenario(dias = 29) {
  const cat = await seedCatalogoMinimo();
  const financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin aprovador");
  const acumulado = await criarUsuario([Papel.ADMINISTRADOR, Papel.FINANCEIRO], "Admin solicitante");
  const professor = await criarUsuario([Papel.PROFESSOR], "Professor");
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", sobrenome: "Silva", paisId: cat.pais.id } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, paisId: cat.pais.id, produtoId: cat.produto.id, moeda: "CRC", status: "ATIVA" } });
  const cobranca = await prisma.cobranca.create({ data: {
    matriculaId: matricula.id, tipo: "MENSALIDADE", status: "ATRASADO", moeda: "CRC",
    valorOriginal: 100, valorNegociado: 100, valorRecebido: 60, saldo: 40, vencimento: new Date(Date.now() - dias * DIA),
  } });
  return { financeiro, secretaria, admin, acumulado, professor, aluno, matricula, cobranca };
}

async function solicitar(c: Awaited<ReturnType<typeof cenario>>, bloquear = true) {
  const resultado = await (bloquear ? bloquearAcesso(c.matricula.id, "Motivo operacional da restrição") : desbloquearAcesso(c.matricula.id, "Regularização manual autorizada"));
  expect(resultado.ok).toBe(true);
  if (!resultado.ok || !resultado.dado) throw new Error("Solicitação não foi criada.");
  return resultado.dado.solicitacaoId;
}

beforeEach(async () => {
  vi.clearAllMocks();
  cronMensagem.mockResolvedValue({ executou: false, motivoParada: "politica_desligada" });
  despacho.mockResolvedValue({ despachadas: 0 });
  await truncarBanco();
});
afterEach(() => vi.unstubAllEnvs());

describe("restrição de aulas — automatismo D+30 e autorização manual", () => {
  it("distingue a pausa do contrato da restrição financeira e preserva o outro contrato", async () => {
    const c = await cenario(35);
    const outro = await prisma.matricula.create({ data: {
      alunoId: c.aluno.id, paisId: c.matricula.paisId, produtoId: c.matricula.produtoId,
      moeda: "CRC", status: "ATIVA",
    } });
    await rodarControleAcessoAulas();
    await prisma.matricula.update({ where: { id: c.matricula.id }, data: { status: "PAUSADA" } });
    await rodarControleAcessoAulas();
    como(c.secretaria);
    const resultado = await carregarGestaoAcessoAulas({ alunoId: c.aluno.id });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error("Consulta indisponível");
    expect(resultado.dado?.matriculas.find((m) => m.id === c.matricula.id)).toMatchObject({
      status: "PAUSADA", bloqueado: false, aulasRegularesPermitidas: false,
    });
    expect(resultado.dado?.matriculas.find((m) => m.id === outro.id)).toMatchObject({
      status: "ATIVA", bloqueado: false, aulasRegularesPermitidas: true,
    });
  });

  it("D+29 não bloqueia; D+30 com saldo parcial restringe uma única vez", async () => {
    const c = await cenario(29);
    const agora = new Date();
    expect((await rodarControleAcessoAulas(agora)).bloqueadas).toBe(0);
    const amanha = new Date(agora.getTime() + DIA);
    expect((await rodarControleAcessoAulas(amanha)).bloqueadas).toBe(1);
    expect((await rodarControleAcessoAulas(amanha)).bloqueadas).toBe(0);
    expect(await prisma.matricula.findUnique({ where: { id: c.matricula.id } })).toMatchObject({ acessoBloqueado: true, acessoBloqueioAutomatico: true, acessoBloqueioManual: false, status: "ATIVA" });
    const eventos = await eventosDo("Matricula", c.matricula.id);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ tipo: "AcessoBloqueado", autorId: null, payload: { origem: "AUTOMATICA", cobrancaIds: [c.cobranca.id] } });
  });

  it("informe a conferir pausa lembretes, mas não libera acesso nem impede D+30", async () => {
    const c = await cenario(35);
    const agora = new Date();
    const prazo = new Date(agora.getTime() + 48 * 3_600_000);
    await prisma.pagamentoInformado.create({ data: {
      chaveIdempotencia: randomUUID(), cobrancaId: c.cobranca.id, autorId: c.secretaria.id, valor: 40, moeda: "CRC",
      forma: "DINHEIRO", dataPagamento: agora, suspenderLembretesAte: prazo,
    } });
    await reavaliarAcessoAutomaticoDaCobranca(c.cobranca.id, agora);
    expect(await prisma.matricula.findUnique({ where: { id: c.matricula.id } })).toMatchObject({ acessoBloqueado: true, acessoBloqueioAutomatico: true });
    expect((await rodarControleAcessoAulas(new Date(prazo.getTime() - 1))).bloqueadas).toBe(0);
    expect((await rodarControleAcessoAulas(prazo)).bloqueadas).toBe(0);
    expect((await eventosDo("Matricula", c.matricula.id)).filter((e) => e.tipo === "AcessoBloqueado")).toHaveLength(1);
    expect(await prisma.cobranca.findUnique({ where: { id: c.cobranca.id } })).toMatchObject({ status: "ATRASADO" });
  });

  it("baixa financeira libera restrição automática ao quitar a dívida elegível", async () => {
    const c = await cenario(30);
    await rodarControleAcessoAulas();
    como(c.financeiro);
    expect((await registrarPagamento(c.cobranca.id, { chaveIdempotencia: randomUUID(), valorRecebido: 40, forma: "DINHEIRO" })).ok).toBe(true);
    expect(await prisma.matricula.findUnique({ where: { id: c.matricula.id } })).toMatchObject({ acessoBloqueado: false, acessoBloqueioAutomatico: false });
    expect((await eventosDo("Matricula", c.matricula.id)).filter((e) => e.tipo === "AcessoDesbloqueado")).toHaveLength(1);
  });

  it("quitação preserva restrição manual legada e não fabrica desbloqueio", async () => {
    const c = await cenario(35);
    await prisma.matricula.update({ where: { id: c.matricula.id }, data: { acessoBloqueado: true, acessoBloqueioManual: true, bloqueadoEm: new Date() } });
    await rodarControleAcessoAulas();
    como(c.financeiro);
    expect((await registrarPagamento(c.cobranca.id, { chaveIdempotencia: randomUUID(), valorRecebido: 40, forma: "DINHEIRO" })).ok).toBe(true);
    expect(await prisma.matricula.findUnique({ where: { id: c.matricula.id } })).toMatchObject({ acessoBloqueado: true, acessoBloqueioManual: true, acessoBloqueioAutomatico: false });
    expect((await eventosDo("Matricula", c.matricula.id)).some((e) => e.tipo === "AcessoDesbloqueado")).toBe(false);
  });

  it("Secretaria solicita com motivo; somente outra pessoa ADM decide; reenvio é idempotente", async () => {
    const c = await cenario();
    como(c.secretaria);
    expect((await bloquearAcesso(c.matricula.id)).ok).toBe(false);
    const pedido = await solicitar(c);
    expect(await solicitar(c)).toBe(pedido);
    expect(await prisma.matricula.findUnique({ where: { id: c.matricula.id } })).toMatchObject({ acessoBloqueado: false });
    expect((await decidirSolicitacaoAcessoAulas(pedido, { aprovar: true, motivo: "Pedido conferido" })).ok).toBe(false);
    como(c.admin);
    expect((await decidirSolicitacaoAcessoAulas(pedido, { aprovar: true, motivo: "Pedido conferido" })).ok).toBe(true);
    expect((await decidirSolicitacaoAcessoAulas(pedido, { aprovar: true, motivo: "Pedido conferido" })).ok).toBe(true);
    expect(await prisma.matricula.findUnique({ where: { id: c.matricula.id } })).toMatchObject({ acessoBloqueado: true, acessoBloqueioManual: true, acessoVersao: 1 });
    expect(await prisma.solicitacaoAcessoAulas.findUnique({ where: { id: pedido } })).toMatchObject({ status: "APROVADA", solicitanteId: c.secretaria.id, aprovadorId: c.admin.id, motivoDecisao: "Pedido conferido" });
    expect((await eventosDo("Matricula", c.matricula.id)).filter((e) => e.tipo === "AcessoBloqueado")).toHaveLength(1);
  });

  it("acúmulo de ADMIN+FIN não autoriza aprovar a própria solicitação", async () => {
    const c = await cenario();
    como(c.acumulado);
    const pedido = await solicitar(c);
    expect((await decidirSolicitacaoAcessoAulas(pedido, { aprovar: true, motivo: "Tenho ambos os papéis" })).ok).toBe(false);
    expect(await prisma.solicitacaoAcessoAulas.findUnique({ where: { id: pedido } })).toMatchObject({ status: "PENDENTE", aprovadorId: null });
    expect(await prisma.matricula.findUnique({ where: { id: c.matricula.id } })).toMatchObject({ acessoBloqueado: false });
  });

  it("rejeição conserva acesso e registra a decisão independente", async () => {
    const c = await cenario();
    como(c.financeiro);
    const pedido = await solicitar(c);
    como(c.admin);
    expect((await decidirSolicitacaoAcessoAulas(pedido, { aprovar: false, motivo: "Motivo não justifica restrição" })).ok).toBe(true);
    expect(await prisma.matricula.findUnique({ where: { id: c.matricula.id } })).toMatchObject({ acessoBloqueado: false, acessoVersao: 0 });
    expect(await prisma.solicitacaoAcessoAulas.findUnique({ where: { id: pedido } })).toMatchObject({ status: "REJEITADA", aprovadorId: c.admin.id });
  });

  it("liberação manual aprovada mantém restrição automática enquanto houver dívida D+30", async () => {
    const c = await cenario(35);
    await prisma.matricula.update({ where: { id: c.matricula.id }, data: { acessoBloqueado: true, acessoBloqueioManual: true, bloqueadoEm: new Date() } });
    como(c.financeiro);
    const pedido = await solicitar(c, false);
    como(c.admin);
    expect((await decidirSolicitacaoAcessoAulas(pedido, { aprovar: true, motivo: "Retirar apenas restrição manual" })).ok).toBe(true);
    expect(await prisma.matricula.findUnique({ where: { id: c.matricula.id } })).toMatchObject({ acessoBloqueado: true, acessoBloqueioManual: false, acessoBloqueioAutomatico: true });
  });

  it("revogar ADM após login bloqueia decisão e professor não consulta o painel financeiro", async () => {
    const c = await cenario();
    como(c.financeiro);
    const pedido = await solicitar(c);
    como(c.admin);
    await prisma.usuario.update({ where: { id: c.admin.id }, data: { papeis: [Papel.GERENTE_COMERCIAL] } });
    expect((await decidirSolicitacaoAcessoAulas(pedido, { aprovar: true, motivo: "Cookie antigo de administrador" })).ok).toBe(false);
    como(c.professor);
    expect((await carregarGestaoAcessoAulas({ matriculaId: c.matricula.id })).ok).toBe(false);
    como(c.secretaria);
    expect((await carregarGestaoAcessoAulas()).ok).toBe(false);
    expect((await carregarGestaoAcessoAulas({ alunoId: c.aluno.id })).ok).toBe(true);
  });

  it("aprovação com versão manual alterada é negada e pode ser rejeitada para liberar nova solicitação", async () => {
    const c = await cenario();
    como(c.financeiro);
    const pedido = await solicitar(c);
    await prisma.matricula.update({ where: { id: c.matricula.id }, data: { acessoVersao: { increment: 1 } } });
    como(c.admin);
    expect((await decidirSolicitacaoAcessoAulas(pedido, { aprovar: true, motivo: "Pedido antigo" })).ok).toBe(false);
    expect((await decidirSolicitacaoAcessoAulas(pedido, { aprovar: false, motivo: "Solicitação precisa de atualização" })).ok).toBe(true);
    como(c.financeiro);
    expect(await solicitar(c)).not.toBe(pedido);
  });

  it("cron autenticado aplica D+30 com política WhatsApp desligada, sem despachar mensagens reais", async () => {
    const c = await cenario(35);
    vi.stubEnv("CRON_SECRET", "segredo-apenas-do-teste");
    expect((await cron(new Request("http://localhost/api/whatsapp/cron", { method: "POST" }))).status).toBe(401);
    const resposta = await cron(new Request("http://localhost/api/whatsapp/cron", { method: "POST", headers: { "x-cron-secret": "segredo-apenas-do-teste" } }));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ acessoAulas: { bloqueadas: 1 }, cobranca: { executou: false, motivoParada: "politica_desligada" } });
    expect(await prisma.matricula.findUnique({ where: { id: c.matricula.id } })).toMatchObject({ acessoBloqueado: true });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
  });
});
