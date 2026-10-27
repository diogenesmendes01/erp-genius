import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ reservas: vi.fn(), outras: vi.fn(), recorrencias: vi.fn() }));
vi.mock("@/server/matricula/reserva-particular-cron", () => ({ rodarVencimentoParticulares: m.reservas }));
vi.mock("@/server/agenda/inicio-turmas", () => ({ iniciarTurmasDaAgenda: m.outras }));
vi.mock("@/server/cobrancas/acesso-aulas", () => ({ rodarControleAcessoAulas: m.outras }));
vi.mock("@/server/whatsapp/cron", () => ({ rodarCronRegua: m.outras }));
vi.mock("@/server/financeiro/cron-financeiro", () => ({ rodarFechamentoComissoes: m.outras }));
vi.mock("@/server/matricula/cron-fechamento", () => ({ rodarFechamentosPendentes: m.outras }));
vi.mock("@/server/whatsapp/motor/drenar", () => ({ drenarEventosMotor: m.outras }));
vi.mock("@/server/crm/lembretes", () => ({ rodarLembretesTarefas: m.outras }));
vi.mock("@/server/whatsapp/alertas-sla", () => ({ rodarAlertasSla: m.outras }));
vi.mock("@/server/aria/turno/orquestrador", () => ({ reprocessarTurnosPendentes: m.outras }));
vi.mock("@/server/aria/expiracao", () => ({ expirarSugestoesAria: m.outras }));
vi.mock("@/server/whatsapp/despachante", () => ({ despacharFila: m.outras }));
vi.mock("@/server/whatsapp/linha-comercial", () => ({ adotarMensagensOrfasDaLinha: m.outras }));
vi.mock("@/server/contratos/vencimento-acesso", () => ({ rodarReconciliacaoAcessoVencimento: m.outras }));
vi.mock("@/server/crm/tarefa-recorrencia-materializacao", () => ({ rodarRecorrenciasTarefas: m.recorrencias }));
import { POST } from "./route";
beforeEach(() => { vi.resetAllMocks(); m.reservas.mockResolvedValue({ avaliadas: 0 }); m.outras.mockResolvedValue({}); m.recorrencias.mockResolvedValue({criadas:0}); });
afterEach(() => vi.unstubAllEnvs());
it("não executa rotinas sem configuração do segredo", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await POST(new Request("https://example.test/cron", { method: "POST" }))).status).toBe(503);
  expect(m.reservas).not.toHaveBeenCalled(); expect(m.outras).not.toHaveBeenCalled();
});
it("recusa segredo incorreto antes de qualquer processamento", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  expect((await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "incorreto" } }))).status).toBe(401);
  expect(m.reservas).not.toHaveBeenCalled(); expect(m.outras).not.toHaveBeenCalled();
});
it("chamada autenticada inclui a conferência de reservas", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  const resposta = await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "segredo-fixture" } }));
  expect(resposta.status).toBe(200);
  expect(await resposta.json()).toMatchObject({ reservasParticulares: { avaliadas: 0 } });
  expect(m.reservas).toHaveBeenCalledTimes(1);
});
it("chamada autenticada adota mensagens órfãs das linhas comerciais (SPEC-ERP-005 LC-15)", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  m.outras.mockResolvedValue({ conversas: 2, mensagens: 5 });
  const resposta = await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "segredo-fixture" } }));
  expect(await resposta.json()).toMatchObject({ linhaComercial: { conversas: 2, mensagens: 5 } });
});
it("tick só com etapas de base: sem comercial, copiloto e gestão (E1)", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  const corpo = await (await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "segredo-fixture" } }))).json();
  expect(Object.keys(corpo).sort()).toEqual(["acessoAulas", "acessoVencimentos", "alertasSla", "aria", "ariaExpiracao", "cobranca", "comissoes", "despacho", "eventosMotor", "fechamentosPendentes", "inicioTurmas", "lembretesTarefas", "linhaComercial", "recorrenciasTarefas", "reservasParticulares"]);
});
it("resposta inclui a chave lembretesTarefas (Fase 2)", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  m.outras.mockResolvedValue({ notificadas: 3 });
  const corpo = await (await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "segredo-fixture" } }))).json();
  expect(corpo.lembretesTarefas).toEqual({ notificadas: 3 });
});
it("etapa de base que falha fica isolada e as demais rodam (E1)", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  m.reservas.mockRejectedValue(new Error("boom"));
  const corpo = await (await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "segredo-fixture" } }))).json();
  expect(corpo.reservasParticulares).toEqual({ erro: "boom" });
  expect(corpo.despacho).toEqual({});
});
it("cron devolve eventosMotor no JSON", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  m.outras.mockResolvedValue({ processados: 3 });
  const corpo = await (await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "segredo-fixture" } }))).json();
  expect(corpo.eventosMotor).toEqual({ processados: 3 });
});
it("cron devolve ariaExpiracao e isola a falha da etapa", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  m.outras.mockResolvedValue({ expiradas: 2, handoffs: 1 });
  const corpo = await (await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "segredo-fixture" } }))).json();
  expect(corpo.ariaExpiracao).toEqual({ expiradas: 2, handoffs: 1 });
});
it("resposta inclui a chave alertasSla (alerta de prazo estourado no app)", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  m.outras.mockResolvedValue({ alertados: 1, notificacoes: 2 });
  const corpo = await (await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "segredo-fixture" } }))).json();
  expect(corpo.alertasSla).toEqual({ alertados: 1, notificacoes: 2 });
});

it("458 C1 falha de recorrência fica explícita e não impede lembretes",async()=>{
 vi.stubEnv("CRON_SECRET","segredo-fixture");const erro=new Error("recorrência indisponível");m.recorrencias.mockRejectedValueOnce(erro);
 const log=vi.spyOn(console,"error").mockImplementation(()=>{});
 try{const corpo=await(await POST(new Request("https://example.test/cron",{method:"POST",headers:{"x-cron-secret":"segredo-fixture"}}))).json();expect(m.recorrencias).toHaveBeenCalledOnce();expect(corpo.recorrenciasTarefas).toEqual({erro:erro.message});expect(corpo.lembretesTarefas).toEqual({});expect(log).toHaveBeenCalledWith("[cron recorrencias_tarefas] falhou:",erro);}finally{log.mockRestore();}
});