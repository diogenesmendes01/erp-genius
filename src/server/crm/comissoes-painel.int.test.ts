import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo } from "@/test/integracao";
import { carregarPainelComissoes, type PainelComissoes } from "./comissoes-painel";

const sessaoDe = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });
const base = { periodo: "mes" as const, pagina: 1 };
const nomes = (p: PainelComissoes) => [...new Set(p.porVendedor.map((v) => v.nome))];

type U = Awaited<ReturnType<typeof criarUsuario>>;
let gerente: U;
let v1: U;
let v2: U;
let v3: U;
let financeiro: U;
let aprovadaMesPassado: string;
let semAprovadaMesPassado: string;
let cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let seq = 0;

async function comissao(vendedor: U, extra: { valor: number; moeda: string; status: "PENDENTE" | "APROVADA" | "PAGA" | "ESTORNADA"; aprovadaEm?: Date | null; criadoEm?: Date; politicaId?: string }) {
  seq += 1;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: `Aluno${seq}`, paisId: cat.pais.id } });
  const lead = await prisma.oportunidade.create({ data: { nome: `Opp${seq}`, vendedorDonoId: vendedor.id, etapa: "MATRICULADO" } });
  const m = await prisma.matricula.create({ data: { alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: extra.moeda, status: "ATIVA", mesesPlano: 2, referenciaCobertura: "MES_CIVIL" } });
  return prisma.comissao.create({ data: {
    matriculaId: m.id, vendedorId: vendedor.id, tipo: "PERCENTUAL", percentual: 10, valor: extra.valor, moeda: extra.moeda, status: extra.status,
    aprovadaEm: extra.aprovadaEm === undefined ? new Date() : extra.aprovadaEm, ...(extra.criadoEm ? { criadoEm: extra.criadoEm } : {}), politicaId: extra.politicaId,
  } });
}

beforeEach(async () => {
  await truncarBanco();
  seq = 0;
  cat = await seedCatalogoMinimo();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const outro = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outro gerente");
  v1 = await criarUsuario([Papel.VENDEDOR], "V1");
  v2 = await criarUsuario([Papel.VENDEDOR], "V2");
  v3 = await criarUsuario([Papel.VENDEDOR], "V3");
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  await prisma.usuario.updateMany({ where: { id: { in: [v1.id, v2.id] } }, data: { gerenteComercialId: gerente.id } });
  await prisma.usuario.update({ where: { id: v3.id }, data: { gerenteComercialId: outro.id } });
  const politica = await prisma.politicaComissao.create({ data: {
    paisId: cat.pais.id, produtoId: cat.produto.id, versao: 1, tipo: "PERCENTUAL", percentual: 10, moeda: "BRL", vigenteEm: new Date("2026-01-01"), criadaPorId: financeiro.id,
  } });
  await comissao(v1, { valor: 25, moeda: "BRL", status: "APROVADA", politicaId: politica.id });
  await comissao(v2, { valor: 1600, moeda: "CRC", status: "PAGA" });
  await comissao(v3, { valor: 15, moeda: "BRL", status: "APROVADA" });
  const agora = new Date();
  const mesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 15, 12);
  aprovadaMesPassado = (await comissao(v1, { valor: 5, moeda: "BRL", status: "APROVADA", aprovadaEm: mesPassado })).id;
  semAprovadaMesPassado = (await comissao(v2, { valor: 7, moeda: "BRL", status: "PENDENTE", aprovadaEm: null, criadoEm: mesPassado })).id;
});

describe("carregarPainelComissoes", () => {
  it("vendedor vê só as próprias; gerente a equipe; financeiro tudo", async () => {
    expect(nomes(await carregarPainelComissoes(sessaoDe(v1), base))).toEqual(["V1"]);
    expect(nomes(await carregarPainelComissoes(sessaoDe(gerente), base)).sort()).toEqual(["V1", "V2"]);
    expect(nomes(await carregarPainelComissoes(sessaoDe(financeiro), base)).sort()).toEqual(["V1", "V2", "V3"]);
  });
  it("totais nunca somam moedas diferentes e incluem PAGA", async () => {
    expect((await carregarPainelComissoes(sessaoDe(financeiro), base)).totais).toEqual([
      { moeda: "BRL", status: "APROVADA", valor: "40.00" }, { moeda: "CRC", status: "PAGA", valor: "1600.00" }]);
  });
  it("competência usa aprovadaEm e cai em criadoEm", async () => {
    const p = await carregarPainelComissoes(sessaoDe(financeiro), { periodo: "mes_anterior", pagina: 1 });
    expect(p.linhas.map((l) => l.id).sort()).toEqual([aprovadaMesPassado, semAprovadaMesPassado].sort());
    expect(p.linhas.find((l) => l.id === aprovadaMesPassado)).toMatchObject({ valor: "5.00", moeda: "BRL", status: "APROVADA", vendedor: "V1" });
  });
  it("filtra por vendedor e agrupa por política e por mês", async () => {
    const p = await carregarPainelComissoes(sessaoDe(financeiro), { ...base, vendedorId: v1.id });
    expect(p.porVendedor).toEqual([{ vendedorId: v1.id, nome: "V1", moeda: "BRL", valor: "25.00", quantidade: 1 }]);
    expect(p.porPolitica).toEqual([expect.objectContaining({ moeda: "BRL", valor: "25.00", rotulo: expect.stringContaining("v1 · 10% da taxa") })]);
    expect(p.evolucao).toHaveLength(1);
  });
  it("matriculadas sem comissão só para quem vê a equipe", async () => {
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Sem", paisId: cat.pais.id } });
    const lead = await prisma.oportunidade.create({ data: { nome: "Sem comissão", vendedorDonoId: v1.id, etapa: "MATRICULADO" } });
    await prisma.matricula.create({ data: { alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: "ATIVA", mesesPlano: 2, referenciaCobertura: "MES_CIVIL" } });
    expect((await carregarPainelComissoes(sessaoDe(v1), base)).matriculadasSemComissao).toEqual([]);
    expect((await carregarPainelComissoes(sessaoDe(gerente), base)).matriculadasSemComissao).toEqual([{ oportunidadeId: lead.id, nome: "Sem comissão" }]);
  });
});
