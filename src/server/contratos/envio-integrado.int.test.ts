import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const autenticacao = await authMock();
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: autenticacao.user.id } });
    if (!usuario.ativo) throw new atual.ErroAutenticacao();
    return usuario;
  };
  return { ...atual, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); atual.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";
import { conciliarEnvioAssinatura, consultarIntegracaoAssinatura, enviarContratoParaAssinatura } from "./envio";
import { provedorAssinaturaAtivo } from "./provedor-assinatura-ativo";

let base: Awaited<ReturnType<typeof prepararFixtureSubstituicaoContratual>>;
const driverAnterior = process.env.ASSINATURA_DRIVER;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const alvo = () => ({ matriculaId: base.matriculaId, artefatoId: base.artefatoFonteId, conferenciaId: base.conferenciaFonteId });

beforeEach(async () => {
  await truncarBanco();
  base = await prepararFixtureSubstituicaoContratual(authMock, { semEnvio: true });
  entrar(base.secretariaId);
});
afterEach(() => { if (driverAnterior === undefined) delete process.env.ASSINATURA_DRIVER; else process.env.ASSINATURA_DRIVER = driverAnterior; });

it("sem driver o envio integrado não existe; driver desconhecido falha alto sem gravar nada", async () => {
  delete process.env.ASSINATURA_DRIVER;
  expect(await consultarIntegracaoAssinatura()).toEqual({ ok: true, dado: null });
  expect(await enviarContratoParaAssinatura(alvo())).toMatchObject({ ok: false, erro: expect.stringContaining("não está configurada") });
  process.env.ASSINATURA_DRIVER = "zapsign";
  expect(await consultarIntegracaoAssinatura()).toMatchObject({ ok: false, erro: expect.stringContaining("Q155") });
  expect(await enviarContratoParaAssinatura(alvo())).toMatchObject({ ok: false, erro: expect.stringContaining("Q155") });
  expect(await prisma.processoAssinaturaContratual.count()).toBe(0);
  expect(await prisma.envelopeAssinaturaSimulado.count()).toBe(0);
});

it("driver simulado envia uma única vez como SIMULADO/SANDBOX, com Evento e idempotência pela chave", async () => {
  process.env.ASSINATURA_DRIVER = "simulado";
  expect(await consultarIntegracaoAssinatura()).toEqual({ ok: true, dado: { fornecedor: "SIMULADO", ambiente: "SANDBOX", simulado: true } });
  const vendedor = await criarUsuario([Papel.VENDEDOR]);
  entrar(vendedor.id);
  expect(await enviarContratoParaAssinatura({ ...alvo(), chaveIdempotencia: "envio-contrato-1" })).toMatchObject({ ok: false });
  entrar(base.secretariaId);

  const enviado = await enviarContratoParaAssinatura({ ...alvo(), chaveIdempotencia: "envio-contrato-1" });
  expect(enviado).toMatchObject({ ok: true, dado: { tentativa: 1, estado: "ENVIADO", repetido: false } });
  const processo = await prisma.processoAssinaturaContratual.findFirstOrThrow({ where: { matriculaId: base.matriculaId } });
  expect(processo).toMatchObject({ fornecedor: "SIMULADO", ambiente: "SANDBOX", estado: "ENVIADO", tentativaAtual: 1, preparadorId: base.secretariaId });
  expect(processo.referenciaExterna).toMatch(/^sim_[a-f0-9]{24}$/);
  const envelope = await prisma.envelopeAssinaturaSimulado.findUniqueOrThrow({ where: { referenciaExterna: processo.referenciaExterna! } });
  const artefato = await prisma.artefatoContratual.findUniqueOrThrow({ where: { id: base.artefatoFonteId } });
  expect(envelope).toMatchObject({ pdfHash: artefato.pdfHash, situacao: "EM_ASSINATURA" });
  expect(envelope.signatarios).toEqual([expect.objectContaining({ papel: "ALUNO", etapa: 1, email: "aluno@example.test" })]);

  // Mesma chave: devolve o resultado sem nova tentativa nem nova chamada; chave nova não repete o envio.
  expect(await enviarContratoParaAssinatura({ ...alvo(), chaveIdempotencia: "envio-contrato-1" })).toMatchObject({ ok: true, dado: { processoId: processo.id, tentativa: 1, estado: "ENVIADO", repetido: true } });
  expect(await enviarContratoParaAssinatura({ ...alvo(), chaveIdempotencia: "envio-contrato-2" })).toMatchObject({ ok: false, erro: expect.stringContaining("Não repetir") });
  expect(await enviarContratoParaAssinatura({ ...alvo(), conferenciaId: "outra", chaveIdempotencia: "envio-contrato-1" })).toMatchObject({ ok: false, erro: expect.stringContaining("outros dados") });
  expect(await prisma.tentativaEnvioAssinatura.count()).toBe(1);
  expect(await prisma.envelopeAssinaturaSimulado.count()).toBe(1);
  expect(await conciliarEnvioAssinatura({ matriculaId: base.matriculaId, processoId: processo.id })).toMatchObject({ ok: false, erro: expect.stringContaining("não possui envio pendente") });

  const eventos = await prisma.evento.findMany({ where: { tipo: { in: ["ProcessoAssinaturaPreparado", "TentativaAssinaturaIniciada", "EnvelopeSimuladoCriado", "ResultadoEnvioAssinaturaRegistrado"] } }, orderBy: { criadoEm: "asc" } });
  expect(eventos.map(e => e.tipo)).toEqual(["ProcessoAssinaturaPreparado", "TentativaAssinaturaIniciada", "EnvelopeSimuladoCriado", "ResultadoEnvioAssinaturaRegistrado"]);
  expect(eventos[1]).toMatchObject({ autorId: base.secretariaId, payload: expect.objectContaining({ chaveIdempotencia: "envio-contrato-1" }) });

  // O banco recusa SIMULADO fora de SANDBOX e referência que não seja do simulado, mesmo sem os triggers.
  const semTriggers = (sql: string) => prisma.$transaction(async tx => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await tx.$executeRawUnsafe(sql, processo.id); });
  await expect(semTriggers(`UPDATE "ProcessoAssinaturaContratual" SET ambiente = 'PRODUCAO' WHERE id = $1`)).rejects.toThrow(/simulado_sandbox_check/);
  await expect(semTriggers(`UPDATE "ProcessoAssinaturaContratual" SET "referenciaExterna" = 'externo-real' WHERE id = $1`)).rejects.toThrow(/referencia_simulada_check/);
});

it("resposta perdida vira ENVIO_INCERTO; só a conciliação pela chave da tentativa resolve, e dúvida mantém incerto", async () => {
  process.env.ASSINATURA_DRIVER = "simulado";
  const simulado = provedorAssinaturaAtivo()!;
  const criar = simulado.criarEnvelope.bind(simulado), consultar = simulado.consultarPorChave.bind(simulado);
  simulado.criarEnvelope = async (envelope) => { await criar(envelope); throw new Error("timeout"); };
  try {
    expect(await enviarContratoParaAssinatura(alvo())).toMatchObject({ ok: true, dado: { estado: "ENVIO_INCERTO" } });
  } finally { simulado.criarEnvelope = criar; }
  const processo = await prisma.processoAssinaturaContratual.findFirstOrThrow({ where: { matriculaId: base.matriculaId } });
  expect(processo).toMatchObject({ estado: "ENVIO_INCERTO", referenciaExterna: null });
  expect(await enviarContratoParaAssinatura(alvo())).toMatchObject({ ok: false });

  simulado.consultarPorChave = async () => { throw new Error("rede"); };
  try {
    expect(await conciliarEnvioAssinatura({ matriculaId: base.matriculaId, processoId: processo.id })).toMatchObject({ ok: true, dado: { estado: "ENVIO_INCERTO" } });
  } finally { simulado.consultarPorChave = consultar; }
  // R1 C2: envelope cancelado ou recusado no serviço não confirma o envio; o processo segue incerto.
  for (const situacao of ["CANCELADO", "RECUSADO"] as const) {
    simulado.consultarPorChave = async (chave) => { const r = await consultar(chave); return r.resultado === "ENCONTRADO" ? { ...r, situacao } : r; };
    try {
      expect(await conciliarEnvioAssinatura({ matriculaId: base.matriculaId, processoId: processo.id })).toMatchObject({ ok: true, dado: { estado: "ENVIO_INCERTO" } });
    } finally { simulado.consultarPorChave = consultar; }
  }
  expect(await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: processo.id } })).toMatchObject({ estado: "ENVIO_INCERTO", referenciaExterna: null });
  expect(await conciliarEnvioAssinatura({ matriculaId: "outra", processoId: processo.id })).toMatchObject({ ok: false });
  expect(await conciliarEnvioAssinatura({ matriculaId: base.matriculaId, processoId: processo.id, chaveIdempotencia: "conciliacao-contrato-1" })).toMatchObject({ ok: true, dado: { estado: "ENVIADO", repetido: false } });
  expect(await conciliarEnvioAssinatura({ matriculaId: base.matriculaId, processoId: processo.id, chaveIdempotencia: "conciliacao-contrato-1" })).toMatchObject({ ok: true, dado: { estado: "ENVIADO", repetido: true } });
  const final = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: processo.id }, include: { tentativas: { include: { observacoes: { orderBy: [{ registradaEm: "asc" }, { id: "asc" }] } } } } });
  expect(final.estado).toBe("ENVIADO");
  expect(final.tentativas).toHaveLength(1);
  expect(final.tentativas[0].observacoes.map(o => o.resultado)).toEqual(["INCERTO", "INCERTO", "INCERTO", "INCERTO", "REGISTRADO"]);
  expect(await prisma.envelopeAssinaturaSimulado.count()).toBe(1);
  const conciliacao = await prisma.evento.findFirstOrThrow({ where: { tipo: "ResultadoEnvioAssinaturaRegistrado", autorId: base.secretariaId, payload: { path: ["chaveIdempotencia"], equals: "conciliacao-contrato-1" } } });
  expect(conciliacao.payload).toMatchObject({ estado: "ENVIADO", resultado: "REGISTRADO" });
});
