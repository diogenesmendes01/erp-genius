import { afterAll, expect, it } from "vitest";
import { prisma } from "./prisma";
import { confirmarTransacao } from "./transacao-confirmada";

afterAll(() => prisma.$disconnect());

it("rejeita erro de trigger deferred antes de devolver o resultado da operação", async () => {
  await expect(prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('CREATE TEMP TABLE teste_confirmacao (id integer PRIMARY KEY) ON COMMIT DROP');
    await tx.$executeRawUnsafe("CREATE OR REPLACE FUNCTION pg_temp.rejeitar_confirmacao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'restricao de teste rejeitada'; END $$");
    await tx.$executeRawUnsafe('CREATE CONSTRAINT TRIGGER rejeitar_confirmacao AFTER INSERT ON teste_confirmacao DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pg_temp.rejeitar_confirmacao()');
    await tx.$executeRawUnsafe('INSERT INTO teste_confirmacao VALUES (1)');
    return { aplicada: true };
  })).rejects.toThrow("restricao de teste rejeitada");
});

it("preserva a ordem e quantidade dos resultados de transações em lote", async () => {
  const resultado = await prisma.$transaction([
    prisma.$queryRaw`SELECT 1::integer AS valor`,
    prisma.$queryRaw`SELECT 2::integer AS valor`,
  ]);
  expect(resultado).toEqual([[{ valor: 1 }], [{ valor: 2 }]]);
});

it("permite completar os vínculos deferred antes da conferência e preserva o retorno", async () => {
  const resultado = await prisma.$transaction(confirmarTransacao(async (tx) => {
    await tx.$executeRawUnsafe('CREATE TEMP TABLE teste_vinculo_confirmacao (id integer PRIMARY KEY, pai integer, FOREIGN KEY (pai) REFERENCES teste_vinculo_confirmacao(id) DEFERRABLE INITIALLY DEFERRED) ON COMMIT DROP');
    await tx.$executeRawUnsafe('INSERT INTO teste_vinculo_confirmacao VALUES (1, 2)');
    await tx.$executeRawUnsafe('INSERT INTO teste_vinculo_confirmacao VALUES (2, NULL)');
    return { aplicada: true, id: 1 };
  }));
  expect(resultado).toEqual({ aplicada: true, id: 1 });
});
