import { beforeEach, describe, expect, it, vi } from "vitest";
import { EtapaLead, FormaPagamento, Papel, StatusMatricula, TipoCobranca } from "@prisma/client";

// #166 (6º lote): registrar o link de pagamento recebe chave. Antes, cada reenvio gravava outro
// LinkPagamentoEnviado e movia a âncora da régua "link sem pagamento" (linkEnviadoEm). Agora o reenvio da mesma
// tentativa devolve ok sem gravar nada, mesmo depois de a cobrança ser paga. Chave nova é um reenvio deliberado.

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
import { receberTx } from "@/server/financeiro/recebimentos";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarLinkPagamento } from "./acoes";

const TAXA = 20000;
let admin: Awaited<ReturnType<typeof criarUsuario>>;
let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outroVendedor: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outroVendedor = await criarUsuario([Papel.VENDEDOR], "Outro Vendedor");
});

const como = (u: { id: string }) => { sessao.usuarioId = u.id; };
const contar = (cobrancaId: string) => prisma.evento.count({ where: { tipo: "LinkPagamentoEnviado", agregadoId: cobrancaId } });
const ancora = async (id: string) => (await prisma.cobranca.findUniqueOrThrow({ where: { id } })).linkEnviadoEm?.getTime();

async function taxa() {
  const cat = await seedCatalogoMinimo();
  const lead = await prisma.oportunidade.create({ data: { nome: "Lead", vendedorDonoId: vendedor.id, etapa: EtapaLead.AGUARDANDO_MATRICULA } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Paula", paisId: cat.pais.id } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: StatusMatricula.AGUARDANDO, mesesPlano: 3, diaVencimento: 5 } });
  return prisma.cobranca.create({ data: { matriculaId: matricula.id, tipo: TipoCobranca.MATRICULA, moeda: "CRC", valorOriginal: TAXA, valorNegociado: TAXA, saldo: TAXA, vencimento: new Date("2027-01-05T12:00:00Z") } });
}

describe("registrarLinkPagamento com chave (#166)", () => {
  it("a mesma chave, inclusive simultânea, grava um Evento e não move a âncora", async () => {
    const t = await taxa();
    como(vendedor);
    const opcoes = { chaveIdempotencia: "chave-link-01" };
    const [r1, r2] = await Promise.all([registrarLinkPagamento(t.id, "https://pagar.exemplo/abc", opcoes), registrarLinkPagamento(t.id, "https://pagar.exemplo/abc", opcoes)]);
    expect(r1.ok && r2.ok, JSON.stringify([r1, r2])).toBe(true);
    const primeira = await ancora(t.id);
    expect((await registrarLinkPagamento(t.id, " https://pagar.exemplo/abc ", opcoes)).ok).toBe(true);
    expect(await ancora(t.id)).toBe(primeira);
    expect(await contar(t.id)).toBe(1);
  });

  it("o reenvio depois do pagamento devolve ok em vez de recusar", async () => {
    const t = await taxa();
    como(vendedor);
    const opcoes = { chaveIdempotencia: "chave-link-02" };
    expect((await registrarLinkPagamento(t.id, "https://pagar.exemplo/abc", opcoes)).ok).toBe(true);
    await prisma.$transaction((tx) => receberTx(tx, { cobrancaId: t.id, autorId: admin.id, chaveIdempotencia: `teste:${t.id}`, valorRecebido: TAXA, forma: FormaPagamento.PIX, dataPagamento: new Date(), evidencia: "Comprovante conferido no teste" }));
    expect((await registrarLinkPagamento(t.id, "https://pagar.exemplo/abc", opcoes)).ok).toBe(true);
    expect(await contar(t.id)).toBe(1);
    // Chave nova: a cobrança paga recusa, como antes.
    expect(await registrarLinkPagamento(t.id, "https://pagar.exemplo/abc", { chaveIdempotencia: "chave-link-03" }))
      .toEqual({ ok: false, erro: "Esta cobrança não está aberta para pagamento." });
  });

  it("recusa a mesma chave com outro link ou outra cobrança; a chave de outro autor não serve", async () => {
    const t = await taxa();
    como(vendedor);
    expect((await registrarLinkPagamento(t.id, "https://pagar.exemplo/abc", { chaveIdempotencia: "chave-link-04" })).ok).toBe(true);
    const outroLink = await registrarLinkPagamento(t.id, "https://pagar.exemplo/xyz", { chaveIdempotencia: "chave-link-04" });
    const outraCobranca = await registrarLinkPagamento("cobranca-inexistente", "https://pagar.exemplo/abc", { chaveIdempotencia: "chave-link-04" });
    expect(outroLink.ok).toBe(false);
    if (!outroLink.ok) expect(outroLink.erro).toMatch(/já foi usada/);
    expect(outraCobranca).toEqual(outroLink);
    como(outroVendedor);
    expect((await registrarLinkPagamento(t.id, "https://pagar.exemplo/abc", { chaveIdempotencia: "chave-link-04" })).ok).toBe(false);
    expect(await contar(t.id)).toBe(1);
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: t.id } })).linkPagamento).toBe("https://pagar.exemplo/abc");
  });

  it("sem chave, cada envio é um reenvio, como antes", async () => {
    const t = await taxa();
    como(vendedor);
    expect((await registrarLinkPagamento(t.id, "https://pagar.exemplo/abc")).ok).toBe(true);
    expect((await registrarLinkPagamento(t.id, "https://pagar.exemplo/abc")).ok).toBe(true);
    expect(await contar(t.id)).toBe(2);
  });
});
