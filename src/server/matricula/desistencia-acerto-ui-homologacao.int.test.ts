import { expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import { Papel } from "@prisma/client";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";

const arquivo = "node_modules/.implementation/q165-ui-homologacao-fixture.json";
const senha = "Homologacao-Q165-Local";

/** Executado só sob demanda antes da homologação visual. A fonte de assinatura
 * é simulada pelo helper; nenhum fornecedor ou mensagem externa é acionado. */
it.runIf(process.env.HOMOLOGACAO_UI_Q165 === "true")("prepara fixture local para a homologação operacional Q165", async () => {
  await truncarBanco();
  const base = await prepararFixtureSubstituicaoContratual(authMock, {
    camposFinanceiros: true,
    semSubstituicao: true,
    ambiente: "SANDBOX",
  });
  const [preparador, aprovador, semAlcada] = await Promise.all([
    criarUsuario([Papel.FINANCEIRO], "Financeiro preparador UI Q165"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro aprovador UI Q165"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro sem alçada UI Q165"),
  ]);
  await prisma.usuario.update({ where: { id: aprovador.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });

  const usuarios = [
    [base.secretariaId, "secretaria-ui248@genius.test"],
    [base.adminId, "admin-ui248@genius.test"],
    [preparador.id, "financeiro-preparador-ui248@genius.test"],
    [aprovador.id, "financeiro-aprovador-ui248@genius.test"],
    [semAlcada.id, "financeiro-sem-alcada-ui248@genius.test"],
  ] as const;
  const senhaHash = await bcrypt.hash(senha, 10);
  for (const [id, email] of usuarios) await prisma.usuario.update({ where: { id }, data: { email, senhaHash, ativo: true } });

  const fixture = {
    matriculaId: base.matriculaId,
    rotas: { secretaria: "/secretaria", pedido: `/matriculas/${base.matriculaId}/desistencia`, financeiro: `/matriculas/${base.matriculaId}/desistencia/financeiro` },
    senha,
    usuarios: Object.fromEntries(usuarios.map(([, email]) => [email.split("@")[0].replace("-ui248", ""), email])),
  };
  await fs.mkdir("node_modules/.implementation", { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(fixture, null, 2) + "\n");
  expect(await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: base.processoId } })).toMatchObject({ estado: "ENVIADO", referenciaExterna: "q116-fonte-simulada" });
  console.log(JSON.stringify({ fixture: arquivo, ...fixture }));
});