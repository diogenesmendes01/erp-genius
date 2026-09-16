import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararConvitePortalAluno } from "./identidade";
import { processarEnviosPortalAluno } from "./processar-envios";

const ambiente = {
  EMAIL_PORTAL_ENVIO_ENABLED: "true", RESEND_API_KEY: "chave-ficticia-worker",
  EMAIL_INSTITUCIONAL_REMETENTE: "portal@example.test", PORTAL_ALUNO_URL_PUBLICA: "https://escola.example.test",
};
let solicitacaoId: string;
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ id: "c4f884a4-96ce-4c22-bd42-806d93b1d1da" }), { status: 200 }));
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno worker", email: "worker@example.test", paisId: catalogo.pais.id } });
  await prisma.configuracaoOperacional.create({ data: {
    id: "escola", prazoSessaoPortalAlunoMinutos: 60, prazoConvitePortalAlunoMinutos: 120,
    prazoRecuperacaoPortalAlunoMinutos: 90, prazoValidacaoEmailPortalAlunoMinutos: 30,
  } });
  mocks.auth.mockResolvedValue({ user: { id: secretaria.id } });
  const preparado = await prepararConvitePortalAluno({ alunoId: aluno.id });
  if (!preparado.ok || !preparado.dado || !("solicitacaoEnvioId" in preparado.dado) || !preparado.dado.solicitacaoEnvioId) throw new Error("Convite de teste não preparado.");
  solicitacaoId = preparado.dado.solicitacaoEnvioId;
});
afterEach(() => vi.unstubAllGlobals());

it("dois workers concorrentes emitem uma única mensagem, token e recibo", async () => {
  const resultados = await Promise.all([
    processarEnviosPortalAluno({}, { ambiente }), processarEnviosPortalAluno({}, { ambiente }),
  ]);
  expect(resultados.reduce((soma, item) => soma + item.aceitosPeloProvedor, 0)).toBe(1);
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(await prisma.tokenPortalAluno.count()).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "SolicitacaoEnvioPortalAlunoAceitaPeloProvedor" } })).toBe(1);
  expect((await prisma.solicitacaoEnvioPortalAluno.findUniqueOrThrow({ where: { id: solicitacaoId } })).situacao).toBe("ENVIADO");
});

it("incerteza do transporte permanece fora de novas rodadas automáticas", async () => {
  mocks.fetch.mockRejectedValue(new Error("resposta perdida"));
  expect(await processarEnviosPortalAluno({}, { ambiente })).toMatchObject({ incertos: 1, aceitosPeloProvedor: 0 });
  expect(await processarEnviosPortalAluno({}, { ambiente })).toMatchObject({ processados: 0 });
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(await prisma.tokenPortalAluno.count()).toBe(1);
  expect((await prisma.solicitacaoEnvioPortalAluno.findUniqueOrThrow({ where: { id: solicitacaoId } })).situacao).toBe("INCERTO");
});

it("desligado preserva intenção preparada sem token nem transporte", async () => {
  expect(await processarEnviosPortalAluno({}, { ambiente: { ...ambiente, EMAIL_PORTAL_ENVIO_ENABLED: "false" } })).toMatchObject({ habilitado: false, processados: 0 });
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(await prisma.tokenPortalAluno.count()).toBe(0);
  expect((await prisma.solicitacaoEnvioPortalAluno.findUniqueOrThrow({ where: { id: solicitacaoId } })).situacao).toBe("PREPARADO");
});
