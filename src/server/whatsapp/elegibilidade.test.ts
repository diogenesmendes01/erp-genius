import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  lead: { findUnique: vi.fn() }, conversaWhatsApp: { findUnique: vi.fn() },
  mensagemWhatsApp: { count: vi.fn() }, evento: { count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { motivoCadenciaInvalida, podeReabrirIntencao } from "./elegibilidade";

const ancora = new Date("2026-09-07T13:00:00Z");
const futuro = new Date("2026-09-08T13:00:00Z");
const intencao = { leadId: "lead", numeroId: "canal", contatoId: "contato", ocorrenciaComercial: ancora.toISOString(), politicaComercial: { chave: "LEAD_NOVO_SEM_RESPOSTA" } };
beforeEach(() => {
  vi.resetAllMocks();
  db.lead.findUnique.mockResolvedValue({ id: "lead", etapa: "NOVO", dataExperimental: futuro });
  db.conversaWhatsApp.findUnique.mockResolvedValue({ id: "conversa", capturadaEm: ancora, contato: { leadId: "lead" } });
  db.mensagemWhatsApp.count.mockResolvedValue(0); db.evento.count.mockResolvedValue(0);
});

describe("validade do domínio no despacho (W01–W05)", () => {
  it("lead novo elegível passa; assumir o atendimento cancela a intenção já criada", async () => {
    expect(await motivoCadenciaInvalida(intencao, futuro)).toBeNull();
    db.lead.findUnique.mockResolvedValue({ id: "lead", etapa: "EM_ATENDIMENTO", dataExperimental: null });
    expect(await motivoCadenciaInvalida(intencao, futuro)).toBe("etapa_comercial_alterada");
  });
  it("fromMe e resposta humana entram na consulta de encerramento", async () => {
    db.mensagemWhatsApp.count.mockResolvedValue(1);
    expect(await motivoCadenciaInvalida(intencao, futuro)).toBe("atendimento_comercial_iniciado");
    expect(JSON.stringify(db.mensagemWhatsApp.count.mock.calls[0])).toContain('"origem":null');
  });
  it("experimental vencida, reagendada ou com pedido de reagendamento não recebe lembrete antigo", async () => {
    db.lead.findUnique.mockResolvedValue({ id: "lead", etapa: "EXPERIMENTAL_AGENDADA", dataExperimental: futuro });
    const i = { ...intencao, ocorrenciaComercial: futuro.toISOString(), politicaComercial: { chave: "PRE_EXPERIMENTAL" } };
    expect(await motivoCadenciaInvalida(i, ancora)).toBeNull();
    expect(await motivoCadenciaInvalida(i, futuro)).toBe("experimental_iniciada");
    db.evento.count.mockResolvedValue(1);
    expect(await motivoCadenciaInvalida(i, ancora)).toBe("reagendamento_solicitado");
    expect(await motivoCadenciaInvalida({ ...i, ocorrenciaComercial: ancora.toISOString() }, ancora)).toBe("ocorrencia_comercial_alterada");
  });
  it("lead e contato precisam continuar vinculados", async () => {
    db.conversaWhatsApp.findUnique.mockResolvedValue({ contato: { leadId: "outro" } });
    expect(await motivoCadenciaInvalida(intencao, futuro)).toBe("vinculo_comercial_alterado");
  });
  it.each(["envio_interrompido", "resultado_incerto", "timeout", "erro_inesperado"])("falha %s permanece em revisão; cron não repete", (motivo) => {
    expect(podeReabrirIntencao("FALHOU", motivo)).toBe(false);
  });
  it("adiamento preserva seu prazo; só simulação/cancelamento corrigível podem renascer", () => {
    expect(podeReabrirIntencao("ADIADA", "fora_da_janela")).toBe(false);
    expect(podeReabrirIntencao("DESPACHADA", null)).toBe(false);
    expect(podeReabrirIntencao("SIMULADA", "ambiente_sem_live")).toBe(true);
    expect(podeReabrirIntencao("CANCELADA", "opt_out")).toBe(true);
  });
});
