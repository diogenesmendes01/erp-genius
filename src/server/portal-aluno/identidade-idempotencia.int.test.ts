import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Papel } from "@prisma/client";

// #166 (4º lote): ações do portal do aluno na ficha da equipe são idempotentes por natureza. Nenhum reenvio grava
// Evento de novo nem prepara outro e-mail:
// - convite ainda não despachado: reaproveita o envio e não grava outro ConvitePortalAlunoPreparado;
// - pendência de e-mail: registrada uma vez enquanto nada muda;
// - troca de e-mail pendente idêntica, do mesmo autor: devolvida (antes caía no índice de troca pendente única);
// - a mesma decisão, do mesmo decisor e com o mesmo motivo: devolvida.

// Sessão: só `exigirSessao`/`exigirSessaoComPapel` são trocadas (mesmo motivo de
// comercial/criar-lead-idempotencia.int.test.ts); os papéis continuam lidos do banco.
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  const exigirSessao = async () => {
    const u = await o.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  };
  return { ...o, exigirSessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const u = await exigirSessao(); o.exigirPapel(u, ...papeis); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import {
  consumirTokenPortalAluno, decidirTrocaEmailPortalAluno, despacharSolicitacaoPortalAlunoInterna, prepararConvitePortalAluno, prepararTrocaEmailPortalAluno,
} from "./identidade";
import { processarEnviosPortalAluno } from "./processar-envios";

let secretariaId: string, adminId: string, alunoId: string, semEmailId: string;

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria")).id;
  adminId = (await criarUsuario([Papel.ADMINISTRADOR], "Adm")).id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluna portal", email: "aluna.portal@example.com", paisId: catalogo.pais.id } })).id;
  semEmailId = (await prisma.aluno.create({ data: { primeiroNome: "Sem e-mail", paisId: catalogo.pais.id } })).id;
  await prisma.configuracaoOperacional.create({ data: {
    id: "escola", prazoSessaoPortalAlunoMinutos: 60, prazoConvitePortalAlunoMinutos: 120,
    prazoRecuperacaoPortalAlunoMinutos: 90, prazoValidacaoEmailPortalAlunoMinutos: 30,
  } });
  sessao.usuarioId = secretariaId;
});

async function despachar(id: string) {
  let token = "";
  await despacharSolicitacaoPortalAlunoInterna(id, async (mensagem) => { token = mensagem.token; });
  if (!token) throw new Error("O despachante interno não forneceu token.");
  return token;
}

const eventos = (tipo: string) => prisma.evento.count({ where: { tipo, agregadoTipo: "Aluno" } });

describe("convite do portal repetido (#166)", () => {
  it("o reenvio, inclusive simultâneo, reaproveita o envio e grava um Evento", async () => {
    const [a, b] = await Promise.all([prepararConvitePortalAluno({ alunoId }), prepararConvitePortalAluno({ alunoId })]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    expect(await prepararConvitePortalAluno({ alunoId })).toEqual(a);
    expect(await prisma.solicitacaoEnvioPortalAluno.count()).toBe(1);
    expect(await eventos("ConvitePortalAlunoPreparado")).toBe(1);
  });

  it("a pendência de e-mail é registrada uma vez", async () => {
    const a = await prepararConvitePortalAluno({ alunoId: semEmailId });
    expect(a.ok && a.dado?.situacao).toBe("PENDENTE_EMAIL");
    expect(await prepararConvitePortalAluno({ alunoId: semEmailId })).toEqual(a);
    expect(await eventos("PendenciaAcessoPortalAlunoEmailAusente")).toBe(1);
  });
});

// B1 da R1 do #274: sem chave, o servidor só reconhecia o reenvio do convite enquanto o envio estava PREPARADO.
// Se o cron despachasse no intervalo, o reenvio preparava outro convite, e o despacho seguinte revogava o link do
// primeiro. Com a chave da tentativa (marca no `ConvitePortalAlunoPreparado`), o reenvio devolve o convite
// original mesmo já despachado; a reemissão deliberada usa chave nova.
describe("convite do portal com chave, depois do despacho pelo cron (B1 da R1 do #274)", () => {
  const ambiente = {
    EMAIL_PORTAL_ENVIO_ENABLED: "true", RESEND_API_KEY: "chave-ficticia-idem",
    EMAIL_INSTITUCIONAL_REMETENTE: "portal@example.test", PORTAL_ALUNO_URL_PUBLICA: "https://escola.example.test",
  };
  const fetch = vi.fn();
  beforeEach(() => {
    fetch.mockReset();
    fetch.mockImplementation(async () => new Response(JSON.stringify({ id: randomUUID() }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
  });
  afterEach(() => vi.unstubAllGlobals());
  const tokenDoEmail = (n: number) => {
    const token = /#token=([^\n]+)/.exec(JSON.parse(fetch.mock.calls[n]![1].body).text)?.[1];
    if (!token) throw new Error("O e-mail de teste não trouxe o token.");
    return token;
  };

  it("o reenvio com a mesma chave devolve o convite original: um envio, um Evento, um e-mail e o link vale", async () => {
    const entrada = { alunoId, chaveIdempotencia: "chave-convite-01" };
    const a = await prepararConvitePortalAluno(entrada);
    expect(a.ok, a.ok ? undefined : a.erro).toBe(true);
    expect(await processarEnviosPortalAluno({}, { ambiente })).toMatchObject({ aceitosPeloProvedor: 1 });
    const b = await prepararConvitePortalAluno(entrada);
    expect(b.ok && b.dado && "solicitacaoEnvioId" in b.dado && b.dado.solicitacaoEnvioId).toBe(a.ok && a.dado && "solicitacaoEnvioId" in a.dado && a.dado.solicitacaoEnvioId);
    expect(await processarEnviosPortalAluno({}, { ambiente })).toMatchObject({ processados: 0 });
    expect(await prisma.solicitacaoEnvioPortalAluno.count()).toBe(1);
    expect(await eventos("ConvitePortalAlunoPreparado")).toBe(1);
    expect(fetch).toHaveBeenCalledOnce();
    expect(await consumirTokenPortalAluno({ token: tokenDoEmail(0), senha: "Senha inicial segura 2026" })).toMatchObject({ tipo: "SESSAO" });
  });

  it("devolve o convite original mesmo depois da ativação da conta", async () => {
    const entrada = { alunoId, chaveIdempotencia: "chave-convite-02" };
    const a = await prepararConvitePortalAluno(entrada);
    await processarEnviosPortalAluno({}, { ambiente });
    await consumirTokenPortalAluno({ token: tokenDoEmail(0), senha: "Senha inicial segura 2026" });
    const b = await prepararConvitePortalAluno(entrada);
    expect(b.ok, b.ok ? undefined : b.erro).toBe(true);
    expect(b.ok && b.dado && "solicitacaoEnvioId" in b.dado && b.dado.solicitacaoEnvioId).toBe(a.ok && a.dado && "solicitacaoEnvioId" in a.dado && a.dado.solicitacaoEnvioId);
  });

  it("o reenvio de uma tentativa que reaproveitou o envio preparado também é reconhecido depois do despacho", async () => {
    const semChave = await prepararConvitePortalAluno({ alunoId });
    const entrada = { alunoId, chaveIdempotencia: "chave-convite-03" };
    const a = await prepararConvitePortalAluno(entrada);
    expect(a).toEqual(semChave);
    await processarEnviosPortalAluno({}, { ambiente });
    expect((await prepararConvitePortalAluno(entrada)).ok).toBe(true);
    expect(await prisma.solicitacaoEnvioPortalAluno.count()).toBe(1);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("chave nova é reemissão deliberada: novo convite, e o link anterior deixa de valer", async () => {
    await prepararConvitePortalAluno({ alunoId, chaveIdempotencia: "chave-convite-04" });
    await processarEnviosPortalAluno({}, { ambiente });
    const nova = await prepararConvitePortalAluno({ alunoId, chaveIdempotencia: "chave-convite-05" });
    expect(nova.ok, nova.ok ? undefined : nova.erro).toBe(true);
    await processarEnviosPortalAluno({}, { ambiente });
    expect(await prisma.solicitacaoEnvioPortalAluno.count()).toBe(2);
    expect(await eventos("ConvitePortalAlunoPreparado")).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    await expect(consumirTokenPortalAluno({ token: tokenDoEmail(0), senha: "Senha inicial segura 2026" })).rejects.toThrow(/não está disponível/);
    expect(await consumirTokenPortalAluno({ token: tokenDoEmail(1), senha: "Senha inicial segura 2026" })).toMatchObject({ tipo: "SESSAO" });
  });

  it("recusa a mesma chave para outro aluno, sem preparar nada", async () => {
    await prepararConvitePortalAluno({ alunoId, chaveIdempotencia: "chave-convite-06" });
    const outro = await prepararConvitePortalAluno({ alunoId: semEmailId, chaveIdempotencia: "chave-convite-06" });
    expect(outro.ok).toBe(false);
    if (!outro.ok) expect(outro.erro).toMatch(/tentativa já foi usada/);
    expect(await eventos("PendenciaAcessoPortalAlunoEmailAusente")).toBe(0);
  });
});

describe("troca de e-mail repetida (#166)", () => {
  const troca = { novoEmail: "novo.portal@example.com", motivo: "Aluna perdeu o endereço verificado", evidencia: "Identidade e vínculo conferidos presencialmente" };

  async function contaAtiva() {
    const convite = await prepararConvitePortalAluno({ alunoId });
    if (!convite.ok || !convite.dado || !("solicitacaoEnvioId" in convite.dado)) throw new Error(JSON.stringify(convite));
    const ativada = await consumirTokenPortalAluno({ token: await despachar(String(convite.dado.solicitacaoEnvioId)), senha: "Senha inicial segura 2026" });
    if (ativada.tipo !== "SESSAO") throw new Error("Convite não criou sessão.");
  }

  it("preparar: a mesma troca devolve a solicitação já preparada, com um envio e um Evento", async () => {
    await contaAtiva();
    const a = await prepararTrocaEmailPortalAluno({ alunoId, ...troca });
    expect(a.ok, a.ok ? undefined : a.erro).toBe(true);
    expect(await prepararTrocaEmailPortalAluno({ alunoId, ...troca })).toEqual(a);
    expect(await prisma.solicitacaoTrocaEmailPortalAluno.count()).toBe(1);
    expect(await prisma.solicitacaoEnvioPortalAluno.count({ where: { finalidade: "VALIDAR_TROCA_EMAIL" } })).toBe(1);
    expect(await eventos("TrocaEmailPortalAlunoPreparada")).toBe(1);
    const outra = await prepararTrocaEmailPortalAluno({ alunoId, ...troca, motivo: "Outro motivo informado agora" });
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/troca de e-mail pendente/);
  });

  it("decidir: a mesma rejeição devolve a decisão já tomada; outra decisão continua recusada", async () => {
    await contaAtiva();
    const preparada = await prepararTrocaEmailPortalAluno({ alunoId, ...troca });
    if (!preparada.ok || !preparada.dado) throw new Error(JSON.stringify(preparada));
    expect(await consumirTokenPortalAluno({ token: await despachar(String(preparada.dado.solicitacaoEnvioId)) })).toEqual({ tipo: "EMAIL_VALIDADO" });
    sessao.usuarioId = adminId;
    const decisao = { solicitacaoId: preparada.dado.solicitacaoId, aprovar: false, motivo: "Evidência insuficiente para a troca" };
    const a = await decidirTrocaEmailPortalAluno(decisao);
    expect(a.ok, a.ok ? undefined : a.erro).toBe(true);
    expect(await decidirTrocaEmailPortalAluno(decisao)).toEqual(a);
    expect(await prisma.decisaoTrocaEmailPortalAluno.count()).toBe(1);
    expect((await decidirTrocaEmailPortalAluno({ ...decisao, aprovar: true })).ok).toBe(false);
  });

  it("decidir: a mesma aprovação devolve a decisão e o envio já preparados, sem aplicar de novo", async () => {
    await contaAtiva();
    const preparada = await prepararTrocaEmailPortalAluno({ alunoId, ...troca });
    if (!preparada.ok || !preparada.dado) throw new Error(JSON.stringify(preparada));
    await consumirTokenPortalAluno({ token: await despachar(String(preparada.dado.solicitacaoEnvioId)) });
    sessao.usuarioId = adminId;
    const decisao = { solicitacaoId: preparada.dado.solicitacaoId, aprovar: true, motivo: "Identidade e endereço conferidos por outra pessoa" };
    const a = await decidirTrocaEmailPortalAluno(decisao);
    expect(a.ok, a.ok ? undefined : a.erro).toBe(true);
    const envios = await prisma.solicitacaoEnvioPortalAluno.count({ where: { finalidade: "RECUPERACAO" } });
    expect(await decidirTrocaEmailPortalAluno(decisao)).toEqual(a);
    expect(await prisma.solicitacaoEnvioPortalAluno.count({ where: { finalidade: "RECUPERACAO" } })).toBe(envios);
    expect(await eventos("TrocaEmailPortalAlunoAplicada")).toBe(1);
  });

  it("decidir: a aprovação repetida devolve o próprio envio mesmo depois de outra troca aplicada (N2 da R1 do #274)", async () => {
    await contaAtiva();
    const preparada = await prepararTrocaEmailPortalAluno({ alunoId, ...troca });
    if (!preparada.ok || !preparada.dado) throw new Error(JSON.stringify(preparada));
    await consumirTokenPortalAluno({ token: await despachar(String(preparada.dado.solicitacaoEnvioId)) });
    sessao.usuarioId = adminId;
    const decisao = { solicitacaoId: preparada.dado.solicitacaoId, aprovar: true, motivo: "Identidade e endereço conferidos por outra pessoa" };
    const a = await decidirTrocaEmailPortalAluno(decisao);
    if (!a.ok || !a.dado?.aprovada) throw new Error(JSON.stringify(a));
    // Uma segunda troca é aplicada depois: o `TrocaEmailPortalAlunoAplicada` mais recente passa a ser o dela.
    sessao.usuarioId = secretariaId;
    const segunda = await prepararTrocaEmailPortalAluno({ alunoId, ...troca, novoEmail: "terceiro.portal@example.com" });
    if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
    await consumirTokenPortalAluno({ token: await despachar(String(segunda.dado.solicitacaoEnvioId)) });
    sessao.usuarioId = adminId;
    const b = await decidirTrocaEmailPortalAluno({ ...decisao, solicitacaoId: segunda.dado.solicitacaoId });
    expect(b.ok, b.ok ? undefined : b.erro).toBe(true);
    expect(await decidirTrocaEmailPortalAluno(decisao)).toEqual(a);
    expect(a.dado.solicitacaoEnvioId).toEqual(expect.any(String));
  });
});
