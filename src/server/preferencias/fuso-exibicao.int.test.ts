import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { consultarPreferenciaFusoEquipe, salvarPreferenciaFusoEquipe } from "./fuso-exibicao";

let usuarioId = "";

beforeEach(async () => {
  await truncarBanco();
  usuarioId = (await criarUsuario(["PROFESSOR"])).id;
  authMock.mockResolvedValue({ user: { id: usuarioId } });
});

it("persiste somente a preferência do usuário autenticado e preserva fallback nulo", async () => {
  const outro = await criarUsuario(["PROFESSOR"]);
  expect(await consultarPreferenciaFusoEquipe()).toMatchObject({ ok: true, dado: { fusoExibicao: null } });
  expect(await salvarPreferenciaFusoEquipe({ fusoExibicao: "America/Costa_Rica" })).toMatchObject({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  expect(await prisma.usuario.findUniqueOrThrow({ where: { id: outro.id } })).toMatchObject({ fusoExibicao: null });
  expect(await salvarPreferenciaFusoEquipe({ fusoExibicao: "" })).toMatchObject({ ok: true, dado: { fusoExibicao: null } });
});

it("recusa IANA inválido, usuário desativado e Factory no backstop SQL", async () => {
  expect(await salvarPreferenciaFusoEquipe({ fusoExibicao: "nao-e-iana" })).toMatchObject({ ok: false });
  await expect(prisma.usuario.update({ where: { id: usuarioId }, data: { fusoExibicao: "Factory" } })).rejects.toThrow("Fuso de exibição inválido");
  for (const fusoExibicao of ["UTC", "US/Eastern", "America/Costa_Rica"]) {
    await expect(prisma.usuario.update({ where: { id: usuarioId }, data: { fusoExibicao } })).resolves.toBeDefined();
  }
  await prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: false } });
  expect(await salvarPreferenciaFusoEquipe({ fusoExibicao: "UTC" })).toMatchObject({ ok: false });
});
