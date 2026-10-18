import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock, provedorMock } = vi.hoisted(() => ({ authMock: vi.fn(), provedorMock: { gerar: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./provedor", async (orig) => ({
  ...(await orig<typeof import("./provedor")>()),
  escolherProvedor: () => ({ nome: "simulado", gerar: provedorMock.gerar }),
}));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { configPadrao } from "./config-schema";
import { publicarRascunho, rascunhoAtual, salvarRascunho } from "./versoes";
import { testarAria } from "./playground";

type U = Awaited<ReturnType<typeof criarUsuario>>;
const logado = (u: U) => authMock.mockResolvedValue({ user: { id: u.id } });
let admin: U, vendedor: U;
let cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

const saida = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ resposta: "Oi", documentoId: null, acoes: [], confianca: 90, handoff: null, fontes: [], humor: null, ...extra });
const resposta = (texto: string, extra: Record<string, unknown> = {}) => ({
  texto, modelo: "simulado", provedor: "simulado", recusa: false, tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, latenciaMs: 1, ...extra,
});

const p = { mensagens: [{ papel: "usuario" as const, texto: "Quanto custa?" }], etapa: "NOVO" as const, usarRascunho: false };

async function rodar(i: Parameters<typeof testarAria>[0]) {
  const r = await testarAria(i);
  if (!r.ok) throw new Error(r.erro);
  return r.dado!;
}
async function contarTudo() {
  return Promise.all([
    prisma.acaoAgenteIA.count(), prisma.turnoAgenteIA.count(), prisma.intencaoMensagem.count(),
    prisma.evento.count(), prisma.mensagemWhatsApp.count(),
  ]);
}
async function rascunhoComNome(nome: string) {
  const base = (await prisma.versaoAgenteIA.findFirst({ where: { status: "PUBLICADA" } }))?.id ?? null;
  expect((await salvarRascunho({ config: { ...configPadrao(), nome }, baseVersaoId: base, rascunho: await rascunhoAtual() })).ok).toBe(true);
}

beforeEach(async () => {
  await truncarBanco();
  authMock.mockReset();
  provedorMock.gerar.mockReset();
  // O provedor de mentira cumprimenta com o nome que está no sistema (prova qual config foi usada).
  provedorMock.gerar.mockImplementation(async (ped: { sistema: string }) => {
    const nome = /Você é ([^,]+),/.exec(ped.sistema)?.[1] ?? "?";
    return resposta(saida({ resposta: `Oi! Eu sou a ${nome}, assistente virtual da escola.` }));
  });
  cat = await seedCatalogoMinimo();
  admin = await criarUsuario([Papel.ADMINISTRADOR]);
  vendedor = await criarUsuario([Papel.VENDEDOR]);
  logado(admin);
});

describe("playground da Aria", () => {
  it("nao_grava_nada_alem_da_chamada", async () => {
    const antes = await contarTudo();
    expect((await testarAria(p)).ok).toBe(true);
    expect(await contarTudo()).toEqual(antes);
    expect(await prisma.chamadaIA.count({ where: { origem: "PLAYGROUND" } })).toBe(1);
  });

  it("usa_rascunho_quando_pedido", async () => {
    await rascunhoComNome("Lia");
    expect((await rodar({ ...p, usarRascunho: true })).resposta).toContain("Eu sou a Lia");
    // Sem pedir o rascunho, vale a publicada (aqui, o padrão).
    expect((await rodar(p)).resposta).toContain(`Eu sou a ${configPadrao().nome}`);
  });

  it("usa_a_publicada_quando_nao_pedem_rascunho", async () => {
    await rascunhoComNome("Lia");
    expect((await publicarRascunho({ rascunho: await rascunhoAtual() })).ok).toBe(true);
    await rascunhoComNome("Bia");
    expect((await rodar(p)).resposta).toContain("Eu sou a Lia");
    expect((await rodar({ ...p, usarRascunho: true })).resposta).toContain("Eu sou a Bia");
  });

  it("mostra_destino_das_acoes", async () => {
    provedorMock.gerar.mockResolvedValue(resposta(saida({ acoes: [{ acao: "TAG", tagId: "t1", justificativa: "pediu preço" }] })));
    expect((await rodar(p)).acoes[0]).toEqual({ acao: "TAG", destino: "Executaria" });
    provedorMock.gerar.mockResolvedValue(resposta(saida({ confianca: 60, acoes: [{ acao: "TAG", tagId: "t1", justificativa: "x" }] })));
    expect((await rodar(p)).acoes[0]).toEqual({ acao: "TAG", destino: "Pediria aprovação" });
    provedorMock.gerar.mockResolvedValue(resposta(saida({ acoes: [{ acao: "MOVER_ETAPA", para: "PERDIDO", justificativa: "x" }] })));
    expect((await rodar({ ...p, etapa: "PROPOSTA" })).acoes[0].destino).toBe("Sem permissão");
  });

  it("devolve_handoff_confianca_e_fontes", async () => {
    provedorMock.gerar.mockResolvedValue(resposta(saida({ confianca: 30 })));
    const r = (await rodar(p));
    expect(r).toMatchObject({ confianca: 30, handoff: "CONFIANCA", bloqueio: null });
    provedorMock.gerar.mockResolvedValue(resposta(saida({ fontes: [{ tipo: "FAQ", id: "f1" }] })));
    expect((await rodar(p)).fontes).toEqual([{ tipo: "FAQ", id: "f1" }]);
  });

  it("usa_precos_do_pais_e_bloqueia_valor_nao_autorizado", async () => {
    provedorMock.gerar.mockResolvedValue(resposta(saida({ resposta: "A mensalidade é R$ 777 por mês." })));
    const r = await rodar({ ...p, paisId: cat.pais.id });
    expect(r.bloqueio).toContain("777");
    // Mesmo comportamento do turno real: não sai como fala da Aria e transfere para humano.
    expect(r).toMatchObject({ resposta: null, handoff: "VALOR_NAO_AUTORIZADO" });
    const sistema = provedorMock.gerar.mock.calls[0][0].sistema as string;
    expect(sistema).toContain("Português · Regular");
  });

  it("falha_do_provedor_vira_handoff_e_registra_erro", async () => {
    provedorMock.gerar.mockRejectedValue(new Error("boom"));
    const r = (await rodar(p));
    expect(r).toMatchObject({ resposta: null, handoff: "ERRO_PROVEDOR" });
    expect(await prisma.chamadaIA.count({ where: { origem: "PLAYGROUND", resultado: { startsWith: "ERRO" } } })).toBe(1);
  });

  it("falha_ao_registrar_sucesso_nao_vira_erro_sem_custo", async () => {
    provedorMock.gerar.mockResolvedValue(resposta(saida(), { tokensEntrada: 1000, tokensSaida: 500 }));
    const espiao = vi.spyOn(prisma.chamadaIA, "create").mockRejectedValueOnce(new Error("insert falhou"));
    try {
      expect((await testarAria(p)).ok).toBe(false);
      // Só a tentativa do sucesso: nenhum registro de "erro" sem tokens foi gravado no lugar.
      expect(espiao).toHaveBeenCalledTimes(1);
      expect(espiao.mock.calls[0][0]).toMatchObject({ data: { resultado: "OK", tokensEntrada: 1000 } });
      expect(await prisma.chamadaIA.count({ where: { resultado: { startsWith: "ERRO" } } })).toBe(0);
    } finally {
      espiao.mockRestore();
    }
  });

  it("orcamento_estourado_recusa_sem_chamar", async () => {
    await prisma.configIA.upsert({ where: { id: "ia" }, create: { id: "ia", orcamentoMensalUsd: 1 }, update: { orcamentoMensalUsd: 1 } });
    await prisma.chamadaIA.create({
      data: { origem: "ATENDIMENTO", modelo: "m", provedor: "simulado", tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, custoMicroUsd: 2_000_000, latenciaMs: 1, resultado: "OK" },
    });
    expect(await testarAria(p)).toEqual({ ok: false, erro: "Orçamento do mês atingido" });
    expect(provedorMock.gerar).not.toHaveBeenCalled();
  });

  it("entrada_invalida", async () => {
    expect((await testarAria({ ...p, mensagens: [] })).ok).toBe(false);
    expect((await testarAria({ ...p, mensagens: [{ papel: "assistente", texto: "oi" }] })).ok).toBe(false);
  });

  it("vendedor_sem_acesso", async () => {
    logado(vendedor);
    expect((await testarAria(p)).ok).toBe(false);
    expect(provedorMock.gerar).not.toHaveBeenCalled();
  });
});
