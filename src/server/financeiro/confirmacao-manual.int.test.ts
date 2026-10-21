import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { agoraAs, seedCobranca } from "@/test/integracao-whatsapp";
import { registrarCobrancaWhatsApp } from "./acoes";

beforeEach(async () => {
  await truncarBanco();
  authMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

it("não registra fato de cobrança para modelo ou passo forjados fora do contrato runtime", async () => {
  const financeiro = await criarUsuario([Papel.FINANCEIRO]);
  authMock.mockResolvedValue({ user: { id: financeiro.id } });
  const { cobranca } = await seedCobranca({ vencimento: agoraAs(12) });

  expect(await registrarCobrancaWhatsApp(cobranca.id, "forjado" as never, "D-7", 0)).toMatchObject({ ok: false });
  expect(await registrarCobrancaWhatsApp(cobranca.id, "amigavel", "D+99" as never, 0)).toMatchObject({ ok: false });
  expect(await prisma.evento.count({ where: { tipo: "CobrancaEnviadaWhatsApp", agregadoId: cobranca.id } })).toBe(0);

  expect(await registrarCobrancaWhatsApp(cobranca.id, "amigavel", "D-7", 0)).toMatchObject({ ok: true });
  expect(await prisma.evento.findFirstOrThrow({ where: { tipo: "CobrancaEnviadaWhatsApp", agregadoId: cobranca.id } })).toMatchObject({
    payload: { modelo: "amigavel", passo: "D-7", cicloRegua: 0, canal: "manual" },
  });
});

it("revalida o papel dentro da transação quando ele é revogado após o guard", async () => {
  const financeiro = await criarUsuario([Papel.FINANCEIRO]);
  authMock.mockResolvedValue({ user: { id: financeiro.id } });
  const { cobranca } = await seedCobranca({ vencimento: agoraAs(12) });
  const original = prisma.$transaction.bind(prisma) as unknown as (...args: unknown[]) => Promise<unknown>;
  vi.spyOn(prisma, "$transaction").mockImplementation((async (...args: unknown[]) => {
    await prisma.usuario.update({ where: { id: financeiro.id }, data: { papeis: [] } });
    return original(...args);
  }) as never);

  expect(await registrarCobrancaWhatsApp(cobranca.id, "amigavel", "D-7", 0)).toMatchObject({ ok: false });
  expect(await prisma.evento.count({ where: { tipo: "CobrancaEnviadaWhatsApp", agregadoId: cobranca.id } })).toBe(0);
});

it("recusa ciclo futuro sem gravar evento", async () => {
  const financeiro = await criarUsuario([Papel.FINANCEIRO]);
  authMock.mockResolvedValue({ user: { id: financeiro.id } });
  const { cobranca } = await seedCobranca({ vencimento: agoraAs(12) });

  expect(await registrarCobrancaWhatsApp(cobranca.id, "amigavel", "D-7", cobranca.cicloRegua + 1)).toMatchObject({ ok: false });
  expect(await prisma.evento.count({ where: { tipo: "CobrancaEnviadaWhatsApp", agregadoId: cobranca.id } })).toBe(0);
});
