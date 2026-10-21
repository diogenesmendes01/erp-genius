import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (6º lote): pedido manual de restrição e de liberação de aulas recebe chave. Antes, se a solicitação era
// rejeitada entre a tentativa e o reenvio, o reenvio abria outra solicitação. A decisão já era idempotente por
// natureza (mesmo decisor, mesma decisão e mesmo motivo): fica a trava.

// Sessão: só `exigirSessao`/`exigirSessaoComPapel` são trocadas (mesmo motivo de
// empresas/empresa-idempotencia.int.test.ts: dois `import()` simultâneos do NextAuth mockado falham no vitest e o
// envio simultâneo é o que o teste mede); os papéis continuam lidos do banco.
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
import { bloquearAcesso, decidirSolicitacaoAcessoAulas, desbloquearAcesso } from "./acoes";

const como = (u: { id: string }) => { sessao.usuarioId = u.id; };
const contar = (tipo: string) => prisma.evento.count({ where: { tipo } });
const MOTIVO = "Motivo operacional da restrição";

async function cenario() {
  const cat = await seedCatalogoMinimo();
  const financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  const financeiro2 = await criarUsuario([Papel.FINANCEIRO], "Financeiro Dois");
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  const admin2 = await criarUsuario([Papel.ADMINISTRADOR], "Admin Dois");
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", sobrenome: "Silva", paisId: cat.pais.id } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, paisId: cat.pais.id, produtoId: cat.produto.id, moeda: "CRC", status: "ATIVA" } });
  return { financeiro, financeiro2, admin, admin2, matricula };
}

beforeEach(async () => { vi.clearAllMocks(); await truncarBanco(); });

describe("bloquearAcesso e desbloquearAcesso com chave (#166)", () => {
  it("a mesma chave, inclusive simultânea, registra uma solicitação", async () => {
    const c = await cenario();
    como(c.financeiro);
    const opcoes = { chaveIdempotencia: "chave-acesso-01" };
    const [r1, r2] = await Promise.all([bloquearAcesso(c.matricula.id, MOTIVO, opcoes), bloquearAcesso(c.matricula.id, MOTIVO, opcoes)]);
    expect(r1.ok && r2.ok, JSON.stringify([r1, r2])).toBe(true);
    expect(r2).toEqual(r1);
    expect(await prisma.solicitacaoAcessoAulas.count()).toBe(1);
    expect(await contar("RestricaoAulasSolicitada")).toBe(1);
  });

  it("o reenvio depois da rejeição devolve a mesma solicitação em vez de abrir outra", async () => {
    const c = await cenario();
    como(c.financeiro);
    const r1 = await bloquearAcesso(c.matricula.id, MOTIVO, { chaveIdempotencia: "chave-acesso-02" });
    if (!r1.ok) throw new Error(r1.erro);
    como(c.admin);
    expect((await decidirSolicitacaoAcessoAulas(r1.dado!.solicitacaoId, { aprovar: false, motivo: "Sem fundamento" })).ok).toBe(true);
    como(c.financeiro);
    expect(await bloquearAcesso(c.matricula.id, MOTIVO, { chaveIdempotencia: "chave-acesso-02" })).toEqual(r1);
    expect(await prisma.solicitacaoAcessoAulas.count()).toBe(1);
    // Chave nova é um novo pedido deliberado.
    const nova = await bloquearAcesso(c.matricula.id, MOTIVO, { chaveIdempotencia: "chave-acesso-03" });
    expect(nova.ok).toBe(true);
    expect(await prisma.solicitacaoAcessoAulas.count()).toBe(2);
  });

  it("o reenvio depois da aprovação devolve a solicitação aprovada em vez de recusar", async () => {
    const c = await cenario();
    como(c.financeiro);
    const r1 = await bloquearAcesso(c.matricula.id, MOTIVO, { chaveIdempotencia: "chave-acesso-04" });
    if (!r1.ok) throw new Error(r1.erro);
    como(c.admin);
    expect((await decidirSolicitacaoAcessoAulas(r1.dado!.solicitacaoId, { aprovar: true, motivo: "Fundamento conferido" })).ok).toBe(true);
    como(c.financeiro);
    expect(await bloquearAcesso(c.matricula.id, MOTIVO, { chaveIdempotencia: "chave-acesso-04" })).toEqual(r1);
    // Liberação com chave própria segue o mesmo contrato.
    const lib = { chaveIdempotencia: "chave-acesso-05" };
    const l1 = await desbloquearAcesso(c.matricula.id, "Regularização manual autorizada", lib);
    expect(l1.ok).toBe(true);
    expect(await desbloquearAcesso(c.matricula.id, "Regularização manual autorizada", lib)).toEqual(l1);
    expect(await contar("LiberacaoAulasSolicitada")).toBe(1);
  });

  it("recusa a mesma chave com outro motivo ou outro pedido, sem revelar nada; a chave de outro autor não serve", async () => {
    const c = await cenario();
    como(c.financeiro);
    expect((await bloquearAcesso(c.matricula.id, MOTIVO, { chaveIdempotencia: "chave-acesso-06" })).ok).toBe(true);
    const outroMotivo = await bloquearAcesso(c.matricula.id, "Outro motivo qualquer", { chaveIdempotencia: "chave-acesso-06" });
    const outroPedido = await desbloquearAcesso(c.matricula.id, MOTIVO, { chaveIdempotencia: "chave-acesso-06" });
    const outraMatricula = await bloquearAcesso("matricula-inexistente", MOTIVO, { chaveIdempotencia: "chave-acesso-06" });
    expect(outroMotivo.ok).toBe(false);
    expect(outroPedido).toEqual(outroMotivo);
    expect(outraMatricula).toEqual(outroMotivo);
    if (!outroMotivo.ok) expect(outroMotivo.erro).toMatch(/já foi usada/);
    como(c.financeiro2);
    expect(await bloquearAcesso(c.matricula.id, MOTIVO, { chaveIdempotencia: "chave-acesso-06" }))
      .toEqual({ ok: false, erro: "Esta matrícula já tem uma solicitação de acesso aguardando decisão." });
    expect(await prisma.solicitacaoAcessoAulas.count()).toBe(1);
  });

  it("sem chave, como antes", async () => {
    const c = await cenario();
    como(c.financeiro);
    const r1 = await bloquearAcesso(c.matricula.id, MOTIVO);
    expect(r1.ok).toBe(true);
    expect(await bloquearAcesso(c.matricula.id, MOTIVO)).toEqual(r1);
    expect(await contar("RestricaoAulasSolicitada")).toBe(1);
  });
});

describe("decidirSolicitacaoAcessoAulas por natureza (trava, #166)", () => {
  it("a mesma decisão do mesmo decisor devolve ok com um Evento; outro decisor é recusado", async () => {
    const c = await cenario();
    como(c.financeiro);
    const r1 = await bloquearAcesso(c.matricula.id, MOTIVO);
    if (!r1.ok) throw new Error(r1.erro);
    como(c.admin);
    const decisao = { aprovar: true, motivo: "Fundamento conferido" };
    expect((await decidirSolicitacaoAcessoAulas(r1.dado!.solicitacaoId, decisao)).ok).toBe(true);
    expect((await decidirSolicitacaoAcessoAulas(r1.dado!.solicitacaoId, decisao)).ok).toBe(true);
    expect(await contar("SolicitacaoAcessoAulasDecidida")).toBe(1);
    expect(await contar("AcessoBloqueado")).toBe(1);
    como(c.admin2);
    expect((await decidirSolicitacaoAcessoAulas(r1.dado!.solicitacaoId, decisao)).ok).toBe(false);
  });
});
