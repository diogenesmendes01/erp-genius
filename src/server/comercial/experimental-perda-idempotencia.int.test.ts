import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166, 5º lote: ações do funil e da Home do professor, idempotentes por natureza.
// - Check-in da experimental (compareceu ou faltou): o mesmo check-in, já registrado por quem repete, devolve ok sem
//   outro Evento. Antes o reenvio dava erro, e o clique duplo gravava dois Eventos.
// - Marcar como perdida: a mesma perda, do mesmo autor e com o mesmo motivo, devolve ok sem outro `LeadPerdido`.
//   Antes, cada reenvio gravava um.
// - Abrir turma: a solicitação ganha chave; o reenvio da mesma tentativa não grava outro `AberturaTurmaSolicitada`.

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
import { checkinExperimental, marcarPerdido } from "./acoes";
import { solicitarAberturaTurma } from "@/server/turmas/acoes";

let professorId: string, outroProfessorId: string, vendedorId: string, outroVendedorId: string, leadId: string;
let cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
const eventos = (tipo: string) => prisma.evento.count({ where: { tipo } });

beforeEach(async () => {
  await truncarBanco();
  cat = await seedCatalogoMinimo();
  professorId = (await criarUsuario([Papel.PROFESSOR], "Professora")).id;
  outroProfessorId = (await criarUsuario([Papel.PROFESSOR], "Outro professor")).id;
  vendedorId = (await criarUsuario([Papel.VENDEDOR], "Vendedora")).id;
  outroVendedorId = (await criarUsuario([Papel.VENDEDOR], "Outro vendedor")).id;
  leadId = (await prisma.oportunidade.create({ data: { nome: "Interessada", vendedorDonoId: vendedorId, etapa: "EXPERIMENTAL_AGENDADA", professorExperimentalId: professorId } })).id;
});

describe("check-in da experimental repetido (#166)", () => {
  it("o mesmo check-in, inclusive simultâneo, devolve ok com um Evento", async () => {
    sessao.usuarioId = professorId;
    const [a, b] = await Promise.all([checkinExperimental(leadId, true), checkinExperimental(leadId, true)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await checkinExperimental(leadId, true)).ok).toBe(true);
    expect(await eventos("ExperimentalRealizada")).toBe(1);
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: leadId } })).etapa).toBe("EXPERIMENTAL_REALIZADA");
  });

  it("falta repetida devolve ok; o check-in oposto continua recusado", async () => {
    sessao.usuarioId = professorId;
    expect((await checkinExperimental(leadId, false)).ok).toBe(true);
    expect((await checkinExperimental(leadId, false)).ok).toBe(true);
    expect(await eventos("NoShow")).toBe(1);
    const oposto = await checkinExperimental(leadId, true);
    expect(oposto).toEqual({ ok: false, erro: "Não há experimental agendada para check-in neste lead." });
    expect(await eventos("ExperimentalRealizada")).toBe(0);
  });

  it("outro professor não recebe ok nem descobre o estado do lead", async () => {
    sessao.usuarioId = professorId;
    await checkinExperimental(leadId, true);
    sessao.usuarioId = outroProfessorId;
    expect(await checkinExperimental(leadId, true)).toEqual({ ok: false, erro: "Esta experimental não está atribuída a você." });
    expect(await eventos("ExperimentalRealizada")).toBe(1);
  });
});

describe("marcar oportunidade como perdida repetido (#166)", () => {
  it("a mesma perda, inclusive simultânea, grava um LeadPerdido", async () => {
    sessao.usuarioId = vendedorId;
    const perda = { motivoPerda: "OUTRO" as const, observacao: "Mudou de cidade" };
    const [a, b] = await Promise.all([marcarPerdido(leadId, perda), marcarPerdido(leadId, perda)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await marcarPerdido(leadId, perda)).ok).toBe(true);
    expect(await eventos("LeadPerdido")).toBe(1);
  });

  it("outro motivo segue como antes: atualiza e grava", async () => {
    sessao.usuarioId = vendedorId;
    await marcarPerdido(leadId, { motivoPerda: "NAO_RESPONDEU" });
    expect((await marcarPerdido(leadId, { motivoPerda: "OUTRO", observacao: "Fechou com concorrente" })).ok).toBe(true);
    expect(await eventos("LeadPerdido")).toBe(2);
    expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: leadId } })).motivoPerda).toBe("OUTRO");
  });
});

describe("solicitar abertura de turma com chave (#166)", () => {
  it("o reenvio da mesma tentativa, inclusive simultâneo, grava uma solicitação", async () => {
    sessao.usuarioId = vendedorId;
    const entrada = { produtoId: cat.produto.id, chaveIdempotencia: "chave-abertura-01" };
    const [a, b] = await Promise.all([solicitarAberturaTurma(entrada), solicitarAberturaTurma(entrada)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await solicitarAberturaTurma(entrada)).ok).toBe(true);
    expect(await eventos("AberturaTurmaSolicitada")).toBe(1);
  });

  it("chave nova é nova solicitação; sem chave, o comportamento de antes; a chave é do autor", async () => {
    sessao.usuarioId = vendedorId;
    await solicitarAberturaTurma({ produtoId: cat.produto.id, chaveIdempotencia: "chave-abertura-02" });
    await solicitarAberturaTurma({ produtoId: cat.produto.id, chaveIdempotencia: "chave-abertura-03" });
    await solicitarAberturaTurma({ produtoId: cat.produto.id });
    sessao.usuarioId = outroVendedorId;
    await solicitarAberturaTurma({ produtoId: cat.produto.id, chaveIdempotencia: "chave-abertura-02" });
    expect(await eventos("AberturaTurmaSolicitada")).toBe(4);
  });

  it("recusa a mesma chave com outra entrada, sem gravar", async () => {
    sessao.usuarioId = vendedorId;
    await solicitarAberturaTurma({ produtoId: cat.produto.id, chaveIdempotencia: "chave-abertura-04" });
    const outra = await solicitarAberturaTurma({ produtoId: cat.produto.id, observacao: "Turma no período da noite", chaveIdempotencia: "chave-abertura-04" });
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/tentativa já foi usada/);
    expect(await eventos("AberturaTurmaSolicitada")).toBe(1);
  });
});
