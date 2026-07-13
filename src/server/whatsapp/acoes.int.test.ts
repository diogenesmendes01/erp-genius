import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { agoraAs, diasDepois, seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { montarReguaPorCobranca } from "@/server/cobrancas/consultas";
import { carregarPoliticaRegua } from "@/server/cobrancas/politica";
import { enfileirarCobrancaWhatsApp, aprovarLoteCobranca } from "./acoes";

// Integração E2 (doc 30): braço humano/lote via fila + regra S6 no replay da régua.

let financeiro: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  financeiro = await criarUsuario([Papel.FINANCEIRO]);
  authMock.mockResolvedValue({ user: { id: financeiro.id } });
});

describe("enfileirarCobrancaWhatsApp (origem HUMANO)", () => {
  it("enfileira o degrau devido e despacha — sem WHATSAPP_LIVE vira SIMULADA", async () => {
    const agora = agoraAs(10);
    await seedCanal({ estado: "ATIVA" });
    const { cobranca } = await seedCobranca({ vencimento: diasDepois(agora, 7) });

    const r = await enfileirarCobrancaWhatsApp(cobranca.id);
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    const dado = r.ok ? r.dado! : null;
    expect(dado?.passo).toBe("D-7");
    expect(dado?.status).toBe("SIMULADA"); // ambiente sem WHATSAPP_LIVE=1 nunca envia

    // Simulada NÃO cumpre o degrau (evento só no despacho real).
    expect(await eventosDo("Cobranca", cobranca.id)).toHaveLength(0);
    const intencao = await prisma.intencaoMensagem.findFirst();
    expect(intencao?.origem).toBe("HUMANO");
    expect(intencao?.autorId).toBe(financeiro.id);
  });

  it("sem destino → erro claro e nada enfileirado", async () => {
    const agora = agoraAs(10);
    await seedCanal();
    const { cobranca } = await seedCobranca({ vencimento: diasDepois(agora, 7), telefoneAluno: null });

    const r = await enfileirarCobrancaWhatsApp(cobranca.id);
    expect(r.ok).toBe(false);
    expect((r as { erro?: string }).erro).toContain("Sem destino");
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("sem papel de cobrança (Vendedor) → negado", async () => {
    const vendedor = await criarUsuario([Papel.VENDEDOR]);
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    const agora = agoraAs(10);
    await seedCanal();
    const { cobranca } = await seedCobranca({ vencimento: diasDepois(agora, 7) });

    const r = await enfileirarCobrancaWhatsApp(cobranca.id);
    expect(r.ok).toBe(false);
  });
});

describe("aprovarLoteCobranca (origem LOTE)", () => {
  it("itens válidos entram; inválidos voltam com motivo, sem derrubar o lote", async () => {
    const agora = agoraAs(10);
    await seedCanal({ estado: "ATIVA" });
    const a = await seedCobranca({ vencimento: diasDepois(agora, 7) });
    const b = await seedCobranca(
      { vencimento: diasDepois(agora, 7), telefoneAluno: null },
      { pais: a.pais, produto: { id: (await prisma.produto.findFirstOrThrow()).id } },
    );

    const r = await aprovarLoteCobranca({ cobrancaIds: [a.cobranca.id, b.cobranca.id] });
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    const dado = r.ok ? r.dado! : null;
    expect(dado?.enfileiradas).toBe(1);
    expect(dado?.puladas).toHaveLength(1);
    expect(dado?.puladas[0].cobrancaId).toBe(b.cobranca.id);
    expect(dado?.puladas[0].motivo).toContain("Sem destino");
    expect(dado?.simuladas).toBe(1); // ambiente sem live

    const intencao = await prisma.intencaoMensagem.findFirst();
    expect(intencao?.origem).toBe("LOTE");
  });
});

describe("regra S6 — vencimento renegociado reseta os passos no replay", () => {
  it("passos anteriores à renegociação são ignorados; a régua recomeça da data nova", async () => {
    const agora = agoraAs(10);
    await seedCanal();
    const { cobranca } = await seedCobranca({ vencimento: diasDepois(agora, 7) });

    // Histórico: D-7 cumprido na data ANTIGA; depois renegociou o vencimento.
    const ontem = new Date(agora.getTime() - 24 * 3600_000);
    await prisma.evento.create({
      data: {
        tipo: "CobrancaEnviadaWhatsApp",
        agregadoTipo: "Cobranca",
        agregadoId: cobranca.id,
        payload: { modelo: "amigavel", passo: "D-7", canal: "manual" },
        versao: 2,
        criadoEm: ontem,
      },
    });
    await prisma.evento.create({
      data: {
        tipo: "CobrancaRenegociada",
        agregadoTipo: "Cobranca",
        agregadoId: cobranca.id,
        payload: { de: 85000, para: 85000, novoVencimento: diasDepois(agora, 7).toISOString() },
        criadoEm: new Date(ontem.getTime() + 3600_000),
      },
    });

    const politica = await carregarPoliticaRegua();
    const regua = await montarReguaPorCobranca(
      [{ id: cobranca.id, vencimento: cobranca.vencimento, acessoBloqueado: false }],
      agora,
      politica.degraus,
    );
    const calc = regua.get(cobranca.id)!;
    expect(calc.estado).toBe("acao_devida");
    expect(calc.passo).toBe("D-7"); // voltou a dever o D-7 da NOVA data
    expect(calc.passosFeitos).toHaveLength(0);
  });

  it("sem renegociação, o passo antigo continua valendo (contra-prova)", async () => {
    const agora = agoraAs(10);
    await seedCanal();
    const { cobranca } = await seedCobranca({ vencimento: diasDepois(agora, 7) });
    await prisma.evento.create({
      data: {
        tipo: "CobrancaEnviadaWhatsApp",
        agregadoTipo: "Cobranca",
        agregadoId: cobranca.id,
        payload: { modelo: "amigavel", passo: "D-7", canal: "manual" },
        versao: 2,
      },
    });

    const politica = await carregarPoliticaRegua();
    const regua = await montarReguaPorCobranca(
      [{ id: cobranca.id, vencimento: cobranca.vencimento, acessoBloqueado: false }],
      agora,
      politica.degraus,
    );
    expect(regua.get(cobranca.id)!.estado).toBe("futuro");
  });
});
