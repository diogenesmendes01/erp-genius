import { Prisma } from "@prisma/client";
import { afterAll, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { depoisDoCursorEmSql } from "./consulta-sql";
import { codificarCursor, decodificarCursor } from "./cursor";

const linhas = [
  { id: "a-before", em: "2026-10-01T10:00:00.000Z" },
  { id: "m-a", em: "2026-10-01T12:00:00.000Z" },
  { id: "m-m", em: "2026-10-01T12:00:00.000Z" },
  { id: "m-z", em: "2026-10-01T12:00:00.000Z" },
  { id: "z-after", em: "2026-10-01T14:00:00.000Z" },
  { id: "a-null", em: null },
  { id: "n-null", em: null },
];
const instantes = [
  "2026-10-01T12:00:00.000Z",
  "2026-10-01T09:00:00.000-03:00",
  "2026-10-01T17:30:00.000+05:30",
  "2026-10-01T15:00:00.000Z",
  "2026-10-01T09:00:00.000Z",
  null,
  "0",
];
const casos = ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]
  .flatMap(zona => instantes.map(em => ({ zona, em })));

afterAll(async () => { await prisma.$disconnect(); });

it.each(casos)("cursor $em preserva o instante e os empates em $zona", async ({ zona, em }) => {
  const cursor = decodificarCursor(codificarCursor({ em, id: "m-m" }));
  expect(cursor).not.toBeNull();
  const esperado = linhas.filter(linha => em === null
    ? linha.em === null && linha.id < "m-m"
    : linha.em === null || Date.parse(linha.em) < Date.parse(em)
      || (Date.parse(linha.em) === Date.parse(em) && linha.id < "m-m"))
    .map(linha => linha.id).sort();
  const obtido = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$queryRaw`SELECT set_config('TimeZone', ${zona}, true)`;
    return tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT a.id FROM (VALUES ${Prisma.join(linhas.map(linha =>
        Prisma.sql`(${linha.id}::text, ${linha.em}::timestamp(3))`))})
      AS a(id, "ultimaMensagemEm") WHERE ${depoisDoCursorEmSql(cursor!)} ORDER BY a.id`);
  });
  expect(obtido.map(linha => linha.id).sort()).toEqual(esperado);
});
