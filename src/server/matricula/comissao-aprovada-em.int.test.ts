import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const autenticacao = await authMock();
    const usuario = await prisma.usuario.findUnique({ where: { id: autenticacao.user.id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new atual.ErroAutenticacao();
    return usuario;
  };
  return { ...atual, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); atual.exigirPapel(usuario, ...papeis); return usuario;
  } };
});
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { ativarMatricula } from "./acoes";

// A ativação pela preparação (ativarPreparacaoTx) é exercida, com a mesma asserção de aprovadaEm,
// em reserva-vaga.int.test.ts (montar a preparação completa aqui duplicaria centenas de linhas).
describe("aprovadaEm da comissão (K15)", () => {
  beforeEach(async () => { await truncarBanco(); });

  it("ativação legada grava aprovadaEm e só toca comissão PENDENTE", async () => {
    const [fin, ven, sec] = await Promise.all([criarUsuario([Papel.FINANCEIRO]), criarUsuario([Papel.VENDEDOR]), criarUsuario([Papel.SECRETARIA_ACADEMICA])]);
    const cat = await seedCatalogoMinimo();
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Teste", paisId: cat.pais.id } });
    const lead = await prisma.oportunidade.create({ data: { nome: "Lead", vendedorDonoId: ven.id } });
    const m = await prisma.matricula.create({ data: {
      alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: "AGUARDANDO", mesesPlano: 2,
      referenciaCobertura: "MES_CIVIL",
      cobrancas: { create: [
        { tipo: "MATRICULA", valorOriginal: 100, valorNegociado: 100, moeda: "CRC", vencimento: new Date(), saldo: 100 },
        { tipo: "MENSALIDADE", coberturaInicio: new Date("2026-09-01"), coberturaFim: new Date("2026-09-30"), valorOriginal: 200, valorNegociado: 200, moeda: "CRC", vencimento: new Date(Date.now() + 86400000), saldo: 200 },
      ] },
    } });
    const documento = await prisma.documento.create({ data: { matriculaId: m.id, categoria: "CONTRATO", nome: "Contrato aceito", url: "/api/files/contrato.pdf" } });
    await prisma.matricula.update({ where: { id: m.id }, data: { contratoOk: true, contratoDocumentoId: documento.id, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: sec.id } });
    await prisma.comissao.create({ data: { matriculaId: m.id, vendedorId: ven.id, tipo: "PERCENTUAL", percentual: 10, valor: 10, moeda: "CRC", status: "PENDENTE" } });
    authMock.mockResolvedValue({ user: { id: fin.id } });
    const antes = Date.now();
    const r = await ativarMatricula(m.id, { valorRecebido: 100, forma: "DINHEIRO", dataPagamento: new Date(), comentario: "Recebimento destinado à taxa" });
    expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
    const cs = await prisma.comissao.findMany({ where: { matriculaId: m.id } });
    expect(cs).toHaveLength(1);
    expect(cs.every((c) => c.status === "APROVADA" && c.aprovadaEm instanceof Date)).toBe(true);
    expect(cs[0].aprovadaEm!.getTime()).toBeGreaterThanOrEqual(antes - 1000);
  });
});
