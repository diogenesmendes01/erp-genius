import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModoDegrau } from "@prisma/client";
import type { PassoRegua } from "@/server/cobrancas/regua";

// O cron da régua decide quem recebe com decidirEnvioCron (alcance-regua.ts, fatia B da #169) — a mesma regra
// que conta o alcance na ativação. Aqui a regra é REAL e todo o resto é mock (Prisma, política, carga das
// cobranças, contato, fila, despachante, render): o teste fixa que o cron só enfileira o degrau AUTOMATICO com
// destino, conta os não automáticos (manual, lote, bloqueio) e os sem destino, e não enfileira nada fora do
// driver oficial. Complementa o cron.int.test.ts (banco), que não roda no CI (issue #162).

const m = vi.hoisted(() => ({
  ErroCobrancaAlterada: class extends Error {},
  politica: vi.fn(), numero: vi.fn(), templates: vi.fn(), carregar: vi.fn(), enfileirar: vi.fn(), despachar: vi.fn(), contato: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    numeroWhatsApp: { findUnique: m.numero },
    templateWhatsApp: { findMany: m.templates },
    $transaction: (fn: (tx: unknown) => unknown) => fn({}),
  },
}));
vi.mock("@/server/cobrancas/politica", () => ({ carregarPoliticaRegua: m.politica }));
vi.mock("./alcance-regua", async (original) => ({ ...(await original<typeof import("./alcance-regua")>()), carregarCobrancasDaRegua: m.carregar }));
vi.mock("./identidade", () => ({
  INCLUDE_DESTINO: {},
  resolverDestinoCobranca: (c: { destinoTeste?: unknown }) => c.destinoTeste ?? null,
  garantirContato: m.contato,
}));
vi.mock("./fila", () => ({ enfileirarIntencaoCobranca: m.enfileirar, ErroCobrancaAlterada: m.ErroCobrancaAlterada }));
vi.mock("./despachante", () => ({ despacharFila: m.despachar }));
vi.mock("./elegibilidade", () => ({ referenciaDestinoCobranca: () => "ref" }));
vi.mock("./render", () => ({ renderizarTemplate: () => ({ corpo: "texto", variaveis: {} }), TEXTOS_FABRICA: { vencida: "fábrica", dados: "fábrica" } }));

import { rodarCronRegua } from "./cron";

const AGORA = new Date("2026-10-13T12:00:00.000Z");
const destino = (telefoneE164: string) => ({ telefoneE164, nome: "Pagador", responsavelId: null, contatoAlunoId: null });
const cobranca = (id: string, comDestino = true) => ({
  id, vencimento: new Date("2026-10-01T12:00:00.000Z"), versao: 1, cicloRegua: 1, saldo: 100, valorNegociado: 100, moeda: "BRL",
  matricula: { acessoBloqueado: false, aluno: { pais: { idioma: "pt" } } },
  destinoTeste: comDestino ? destino(`+5511900000${id}`) : null,
});
const devido = (passo: PassoRegua, tipoAcao = "cobrar") => ({ estado: "acao_devida", passo, tipoAcao, template: "vencida" });
const modos = new Map<PassoRegua, ModoDegrau>([["D+3", "AUTOMATICO"], ["D+7", "LOTE"], ["D0", "MANUAL"], ["D+15", "AUTOMATICO"]]);

beforeEach(() => {
  vi.clearAllMocks();
  m.politica.mockResolvedValue({ id: "pol", estado: "ATIVA", killSwitch: false, numeroRemetenteId: "num", degraus: [], modoPorPasso: modos, templateIdPorPasso: new Map() });
  m.numero.mockResolvedValue({ id: "num", ativo: true, driver: "META_CLOUD" });
  m.templates.mockResolvedValue([]);
  m.contato.mockResolvedValue({ id: "contato" });
  m.enfileirar.mockResolvedValue("criada");
  m.despachar.mockResolvedValue(null);
  m.carregar.mockResolvedValue({
    cobrancas: [cobranca("c-auto"), cobranca("c-lote"), cobranca("c-manual"), cobranca("c-bloqueio"), cobranca("c-sem-destino", false), cobranca("c-em-dia")],
    regua: new Map<string, unknown>([
      ["c-auto", devido("D+3")], ["c-lote", devido("D+7")], ["c-manual", devido("D0")], ["c-bloqueio", devido("D+15", "bloquear")],
      ["c-sem-destino", devido("D+3")], ["c-em-dia", { estado: "futuro", passo: null, tipoAcao: null, template: null }],
    ]),
  });
});

describe("rodarCronRegua — quem recebe é decidirEnvioCron", () => {
  it("só o degrau AUTOMATICO com destino vira intenção; manual, lote e bloqueio (mesmo marcado automático) não; sem destino não nasce", async () => {
    const r = await rodarCronRegua(AGORA);
    expect(m.enfileirar).toHaveBeenCalledTimes(1);
    expect(m.enfileirar.mock.calls[0][1]).toMatchObject({ cobrancaId: "c-auto", passo: "D+3", origem: "CRON", numeroId: "num", politicaId: "pol" });
    expect(r).toMatchObject({ executou: true, cobrancasAvaliadas: 6, acoesDevidas: 5, degrausNaoAutomaticos: 3, semDestino: 1, enfileiradas: 1 });
    expect(m.carregar).toHaveBeenCalledWith(AGORA, []);
  });

  it("em BAILEYS legado, o cron não carrega cobranças nem enfileira (trava_driver_oficial)", async () => {
    m.numero.mockResolvedValue({ id: "num", ativo: true, driver: "BAILEYS" });
    const r = await rodarCronRegua(AGORA);
    expect(r).toMatchObject({ executou: false, motivoParada: "trava_driver_oficial" });
    expect(m.carregar).not.toHaveBeenCalled();
    expect(m.enfileirar).not.toHaveBeenCalled();
  });

  it("número MOTOR enfileira normalmente (S1 revogada, D36)", async () => {
    m.numero.mockResolvedValue({ id: "num", ativo: true, driver: "MOTOR" });
    const r = await rodarCronRegua(AGORA);
    expect(r.motivoParada).not.toBe("trava_driver_oficial");
    expect(r.enfileiradas).toBe(1);
  });

  it("política desligada não gera nem intenção", async () => {
    m.politica.mockResolvedValue({ id: "pol", estado: "DESLIGADA", killSwitch: false, numeroRemetenteId: "num", degraus: [], modoPorPasso: modos, templateIdPorPasso: new Map() });
    expect(await rodarCronRegua(AGORA)).toMatchObject({ executou: false, motivoParada: "politica_desligada" });
    expect(m.enfileirar).not.toHaveBeenCalled();
  });
});
