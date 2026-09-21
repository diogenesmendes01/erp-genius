import { FinalidadeTokenPortalAluno } from "@prisma/client";
import { beforeEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedCatalogoMinimo, truncarBanco } from "@/test/integracao";

let alunoId: string;
let contaId: string;

async function criarConviteConsumido(destinatario: string) {
  const token = await prisma.tokenPortalAluno.create({
    data: {
      contaId,
      finalidade: FinalidadeTokenPortalAluno.CONVITE,
      digest: `digest-${destinatario}-${Math.random()}`,
      destinatario,
      expiraEm: new Date("2099-01-01T00:00:00.000Z"),
    },
  });
  // Usa o mesmo relógio/precisão do criadoEm do banco, evitando que Date
  // truncado em milissegundos anteceda a criação por microssegundos.
  await prisma.$executeRaw`UPDATE "TokenPortalAluno"
    SET "consumidoEm" = CURRENT_TIMESTAMP AT TIME ZONE 'UTC' WHERE id = ${token.id}`;
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  alunoId = (await prisma.aluno.create({
    data: { primeiroNome: "Aluna", email: "original@example.test", paisId: catalogo.pais.id },
  })).id;
  contaId = (await prisma.contaPortalAluno.create({ data: { alunoId } })).id;
});

it("guarda SQL recusa ativação inicial por convite consumido para contato cadastral antigo", async () => {
  await criarConviteConsumido("original@example.test");
  await prisma.aluno.update({ where: { id: alunoId }, data: { email: "novo@example.test" } });

  await expect(prisma.contaPortalAluno.update({
    where: { id: contaId },
    data: { emailVerificado: "original@example.test", emailVerificadoEm: new Date() },
  })).rejects.toThrow("Convite não corresponde ao contato atual do aluno");
});

it("guarda SQL aceita o convite do contato atual, e edição cadastral posterior não transfere conta já estabelecida", async () => {
  await criarConviteConsumido("original@example.test");
  await expect(prisma.contaPortalAluno.update({
    where: { id: contaId },
    data: { emailVerificado: "original@example.test", emailVerificadoEm: new Date() },
  })).resolves.toMatchObject({ emailVerificado: "original@example.test" });

  await prisma.aluno.update({ where: { id: alunoId }, data: { email: "cadastro-alterado@example.test" } });
  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { id: contaId } });
  expect(conta.emailVerificado).toBe("original@example.test");
});
