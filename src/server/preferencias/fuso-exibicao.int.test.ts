import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { consultarPreferenciaFusoEquipe, salvarPreferenciaFusoEquipe } from "./fuso-exibicao";
import { APELIDOS_FUSO_LEGADOS, LINKS_FUSO_BACKWARD_ICU } from "@/server/operacao/fuso";

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

it("grava apelido legado com o nome canônico IANA (decisão do dono, 17/10/2026)", async () => {
  expect(await salvarPreferenciaFusoEquipe({ fusoExibicao: "US/Eastern" })).toMatchObject({ ok: true, dado: { fusoExibicao: "America/New_York" } });
  expect(await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } })).toMatchObject({ fusoExibicao: "America/New_York" });
  // A linha continua editável pelo trigger de fuso depois de gravada.
  await expect(prisma.usuario.update({ where: { id: usuarioId }, data: { nome: "Professor com fuso" } })).resolves.toBeDefined();
});

// Revisão R1 do #210 (C1): links do `backward` que o CampoFuso sugeria (Intl.supportedValuesOf) viram o
// nome canônico, e todo destino do mapa existe em pg_timezone_names com ou sem tzdata-legacy.
it("grava links do backward listados pelo ICU com o nome canônico aceito pelo banco", async () => {
  for (const [link, canonico] of Object.entries(LINKS_FUSO_BACKWARD_ICU)) {
    expect(await salvarPreferenciaFusoEquipe({ fusoExibicao: link }), link).toMatchObject({ ok: true, dado: { fusoExibicao: canonico } });
    expect(await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } })).toMatchObject({ fusoExibicao: canonico });
  }
  const destinos = [...new Set(Object.values(APELIDOS_FUSO_LEGADOS))];
  const conhecidos = await prisma.$queryRaw<{ name: string }[]>`SELECT name FROM pg_timezone_names WHERE name = ANY(${destinos})`;
  expect(conhecidos.map((l) => l.name).sort()).toEqual([...destinos].sort());
});

it("recusa IANA inválido, usuário desativado e Factory no backstop SQL", async () => {
  expect(await salvarPreferenciaFusoEquipe({ fusoExibicao: "nao-e-iana" })).toMatchObject({ ok: false });
  await expect(prisma.usuario.update({ where: { id: usuarioId }, data: { fusoExibicao: "Factory" } })).rejects.toThrow("Fuso de exibição inválido");
  for (const fusoExibicao of ["UTC", "America/New_York", "America/Costa_Rica"]) {
    await expect(prisma.usuario.update({ where: { id: usuarioId }, data: { fusoExibicao } })).resolves.toBeDefined();
  }
  await prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: false } });
  expect(await salvarPreferenciaFusoEquipe({ fusoExibicao: "UTC" })).toMatchObject({ ok: false });
});
