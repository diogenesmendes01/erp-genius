import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModoDegrau } from "@prisma/client";
import type { ReguaCalculada } from "@/server/cobrancas/consultas";
import type { PassoRegua } from "@/server/cobrancas/regua";

// Alcance da régua (docs/42 L2517; fatia B, issue #169): a regra de quem recebe é a do cron — decidirEnvioCron —,
// e contarAlcanceRegua conta com ela, só lendo. Prisma, o cérebro da régua e o destino financeiro são mocks: o
// teste fixa a REGRA (degrau devido → bloqueio nunca automático → só AUTOMATICO → precisa de destino) e a contagem.

const m = vi.hoisted(() => ({ findMany: vi.fn(), regua: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { cobranca: { findMany: m.findMany } } }));
vi.mock("@/server/cobrancas/consultas", () => ({ montarReguaPorCobranca: m.regua }));
vi.mock("./identidade", () => ({
  INCLUDE_DESTINO: { matricula: { include: { marcador: true } } },
  resolverDestinoCobranca: (c: { destinoTeste?: { telefoneE164: string } | null }) => c.destinoTeste ?? null,
}));

import { contarAlcanceRegua, decidirEnvioCron } from "./alcance-regua";
import type { CobrancaComDestino } from "./identidade";

const VENCIMENTO = new Date("2026-10-01T12:00:00.000Z");
const AGORA = new Date("2026-10-13T12:00:00.000Z");
const destino = (telefoneE164: string) => ({ telefoneE164, nome: "Pagador", responsavelId: null, contatoAlunoId: null, alunoId: "a", matriculaId: "m", fuso: "UTC", origem: "LEGADO", tipoPagador: null, referenciaFonte: "x" });
const cobranca = (id: string, destinoTeste: ReturnType<typeof destino> | null) =>
  ({ id, vencimento: VENCIMENTO, cicloRegua: 1, matricula: { acessoBloqueado: false }, destinoTeste }) as unknown as CobrancaComDestino;
const calc = (passo: PassoRegua | null, over: Partial<ReguaCalculada> = {}): ReguaCalculada => ({
  conferenciaAte: null, estado: passo ? "acao_devida" : "futuro", passo, tipoAcao: passo ? "cobrar" : null, template: "vencida", rotuloAcao: null,
  atrasadaNaAcao: false, diasAtraso: 12, prioridade: 1, promessaAte: null, precisaBloqueio: false, tentativas: 0, ultimaCobrancaEm: null, passosFeitos: [], ...over,
} as ReguaCalculada);
const modos = new Map<PassoRegua, ModoDegrau>([["D-3", "AUTOMATICO"], ["D+3", "AUTOMATICO"], ["D+7", "LOTE"], ["D0", "MANUAL"], ["D+15", "MANUAL"]]);
const degraus = [{ passo: "D+3" as PassoRegua, offsetDias: 3, tipo: "cobrar" as const, template: "vencida" as const, rotulo: "Cobrança" }];

describe("decidirEnvioCron — a regra do cron", () => {
  it("sem degrau devido (ou sem cálculo), nada a fazer", () => {
    expect(decidirEnvioCron(cobranca("c", destino("+1")), undefined, modos)).toEqual({ tipo: "sem_acao" });
    expect(decidirEnvioCron(cobranca("c", destino("+1")), calc(null), modos)).toEqual({ tipo: "sem_acao" });
    expect(decidirEnvioCron(cobranca("c", destino("+1")), calc("D+3", { estado: "promessa" }), modos)).toEqual({ tipo: "sem_acao" });
  });

  it("bloqueio nunca é automático, mesmo se o modo disser AUTOMATICO (lei)", () => {
    const tudoAutomatico = new Map<PassoRegua, ModoDegrau>([["D+15", "AUTOMATICO"]]);
    expect(decidirEnvioCron(cobranca("c", destino("+1")), calc("D+15", { tipoAcao: "bloquear" }), tudoAutomatico)).toEqual({ tipo: "nao_automatico", passo: "D+15", modo: null });
  });

  it("modo manual, lote ou ausente não é automático (e o modo volta para quem conta o lote)", () => {
    expect(decidirEnvioCron(cobranca("c", destino("+1")), calc("D0"), modos)).toEqual({ tipo: "nao_automatico", passo: "D0", modo: "MANUAL" });
    expect(decidirEnvioCron(cobranca("c", destino("+1")), calc("D+7"), modos)).toEqual({ tipo: "nao_automatico", passo: "D+7", modo: "LOTE" });
    expect(decidirEnvioCron(cobranca("c", destino("+1")), calc("D-7"), modos)).toEqual({ tipo: "nao_automatico", passo: "D-7", modo: null });
  });

  it("automático sem destino financeiro não nasce (S2); com destino, enfileira para ele", () => {
    expect(decidirEnvioCron(cobranca("c", null), calc("D+3"), modos)).toEqual({ tipo: "sem_destino", passo: "D+3" });
    expect(decidirEnvioCron(cobranca("c", destino("+50688887777")), calc("D+3"), modos)).toEqual({ tipo: "enfileirar", passo: "D+3", destino: destino("+50688887777") });
  });
});

describe("contarAlcanceRegua — a consulta de alcance (só leitura)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const lista = [
      cobranca("auto-ana-1", destino("+5511900000001")),
      cobranca("auto-ana-2", destino("+5511900000001")), // mesma pessoa, outra cobrança
      cobranca("auto-bia", destino("+5511900000002")),
      cobranca("auto-sem-destino", null),
      cobranca("lote-com-destino", destino("+5511900000003")),
      cobranca("lote-sem-destino", null),
      cobranca("manual", destino("+5511900000004")),
      cobranca("bloqueio", destino("+5511900000005")),
      cobranca("em-dia", destino("+5511900000006")),
    ];
    m.findMany.mockResolvedValue(lista);
    m.regua.mockResolvedValue(new Map<string, ReguaCalculada>([
      ["auto-ana-1", calc("D+3")], ["auto-ana-2", calc("D-3", { tipoAcao: "lembrar" })], ["auto-bia", calc("D+3")], ["auto-sem-destino", calc("D+3")],
      ["lote-com-destino", calc("D+7")], ["lote-sem-destino", calc("D+7")], ["manual", calc("D0")],
      ["bloqueio", calc("D+15", { tipoAcao: "bloquear" })], ["em-dia", calc(null)],
    ]));
  });

  it("conta pessoas distintas, cobranças automáticas, as sem destino e as de lote com destino", async () => {
    expect(await contarAlcanceRegua({ degraus, modoPorPasso: modos }, AGORA)).toEqual({ pessoas: 2, cobrancas: 3, semDestino: 1, emLote: 1 });
  });

  it("lê só as cobranças abertas, com o destino, e calcula a régua com os degraus dados e o instante dado", async () => {
    await contarAlcanceRegua({ degraus, modoPorPasso: modos }, AGORA);
    expect(m.findMany).toHaveBeenCalledTimes(1);
    expect(m.findMany).toHaveBeenCalledWith({ where: { status: { in: ["PENDENTE", "ATRASADO"] } }, include: { matricula: { include: { marcador: true } } } });
    expect(m.regua).toHaveBeenCalledTimes(1);
    const [entrada, instante, degrausUsados] = m.regua.mock.calls[0];
    expect(entrada).toHaveLength(9);
    expect(entrada[0]).toEqual({ id: "auto-ana-1", vencimento: VENCIMENTO, cicloRegua: 1, acessoBloqueado: false });
    expect(instante).toBe(AGORA);
    expect(degrausUsados).toBe(degraus);
  });

  it("com os mesmos dados, outra política muda a contagem (é a política do formulário que vale)", async () => {
    const tudoManual = new Map<PassoRegua, ModoDegrau>([["D-3", "MANUAL"], ["D+3", "MANUAL"], ["D+7", "MANUAL"]]);
    expect(await contarAlcanceRegua({ degraus, modoPorPasso: tudoManual }, AGORA)).toEqual({ pessoas: 0, cobrancas: 0, semDestino: 0, emLote: 0 });
  });

  it("fila vazia: ninguém recebe", async () => {
    m.findMany.mockResolvedValue([]);
    m.regua.mockResolvedValue(new Map());
    expect(await contarAlcanceRegua({ degraus, modoPorPasso: modos }, AGORA)).toEqual({ pessoas: 0, cobrancas: 0, semDestino: 0, emLote: 0 });
  });
});
