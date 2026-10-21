import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarEvidenciaEnvioIncerto } from "./conciliacao-envio";
import { despacharAcessoPortalResend } from "./envio-resend";
import { prepararConvitePortalAluno } from "./identidade";

const ambiente = {
  EMAIL_PORTAL_ENVIO_ENABLED: "true", RESEND_API_KEY: "chave-resend-de-teste",
  EMAIL_INSTITUCIONAL_REMETENTE: "portal@example.test", PORTAL_ALUNO_URL_PUBLICA: "https://escola.example.test",
};
let secretariaId: string;
let administradorId: string;
let alunoId: string;

async function prepararIncerto() {
  mocks.auth.mockResolvedValue({ user: { id: secretariaId } });
  const preparado = await prepararConvitePortalAluno({ alunoId });
  if (!preparado.ok || !preparado.dado?.solicitacaoEnvioId) throw new Error(JSON.stringify(preparado));
  await despacharAcessoPortalResend(preparado.dado.solicitacaoEnvioId, { ambiente, fetch: vi.fn().mockRejectedValue(new Error("timeout")) });
  const evidencia = await registrarEvidenciaEnvioIncerto({ solicitacaoId: preparado.dado.solicitacaoEnvioId, evidencia: "Provedor não confirmou o resultado e a equipe conferiu o painel." });
  if (!evidencia.ok || !evidencia.dado) throw new Error(JSON.stringify(evidencia));
  return { solicitacaoId: preparado.dado.solicitacaoEnvioId, ...evidencia.dado };
}

beforeEach(async () => {
  mocks.auth.mockReset();
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  administradorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluna adversarial", email: "adversarial@example.test", paisId: catalogo.pais.id } })).id;
  await prisma.configuracaoOperacional.create({ data: { id: "escola", prazoSessaoPortalAlunoMinutos: 60, prazoConvitePortalAlunoMinutos: 120, prazoRecuperacaoPortalAlunoMinutos: 90, prazoValidacaoEmailPortalAlunoMinutos: 30 } });
});

it("SQL recusa decisor sem Administração e autoaprovação da evidência", async () => {
  const evidencia = await prepararIncerto();
  const professorId = (await criarUsuario(["PROFESSOR"])).id;
  for (const decisorId of [secretariaId, professorId]) {
    await expect(prisma.$executeRaw(Prisma.sql`
      INSERT INTO "DecisaoReemissaoEnvioPortalAluno" (id, "conciliacaoId", "decisorId", aprovada, motivo, "estadoHash")
      VALUES (${randomUUID()}, ${evidencia.conciliacaoId}, ${decisorId}, false, 'Tentativa direta sem alçada independente.', ${evidencia.estadoHash})
    `)).rejects.toThrow(/P0001/);
  }
});

it("SQL não vincula nova intenção divergente nem mantém token anterior utilizável", async () => {
  const evidencia = await prepararIncerto();
  const decisaoId = randomUUID();
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DecisaoReemissaoEnvioPortalAluno" (id, "conciliacaoId", "decisorId", aprovada, motivo, "estadoHash")
    VALUES (${decisaoId}, ${evidencia.conciliacaoId}, ${administradorId}, true, 'Autorização independente para testar a guarda SQL.', ${evidencia.estadoHash})
  `);
  const envioDivergenteId = randomUUID();
  const conta = await prisma.contaPortalAluno.findUniqueOrThrow({ where: { alunoId } });
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "SolicitacaoEnvioPortalAluno" (id, "contaId", finalidade, destinatario, situacao, chave)
    VALUES (${envioDivergenteId}, ${conta.id}, 'CONVITE', 'outro-contato@example.test', 'PREPARADO', ${`adversarial:${envioDivergenteId}`})
  `);
  await expect(prisma.$executeRaw(Prisma.sql`
    UPDATE "DecisaoReemissaoEnvioPortalAluno" SET "solicitacaoReemitidaId" = ${envioDivergenteId} WHERE id = ${decisaoId}
  `)).rejects.toThrow(/P0001/);
});
