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
  it("matriculadas sem comissão: gerente não vê a equipe de outro gerente, e matrícula cancelada ou encerrada não conta", async () => {
    const semComissao = async (dono: U, nome: string, status: "ATIVA" | "CANCELADA" | "ENCERRADA") => {
      const aluno = await prisma.aluno.create({ data: { primeiroNome: nome, paisId: cat.pais.id } });
      const lead = await prisma.oportunidade.create({ data: { nome, vendedorDonoId: dono.id, etapa: "MATRICULADO" } });
      await prisma.matricula.create({ data: { alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "BRL", status, mesesPlano: 2, referenciaCobertura: "MES_CIVIL" } });
      return lead.id;
    };
    const daEquipe = await semComissao(v2, "Da equipe", "ATIVA");
    const deOutraEquipe = await semComissao(v3, "De outra equipe", "ATIVA");
    await semComissao(v1, "Cancelada", "CANCELADA");
    await semComissao(v1, "Encerrada", "ENCERRADA");
    expect((await carregarPainelComissoes(sessaoDe(gerente), base)).matriculadasSemComissao).toEqual([{ oportunidadeId: daEquipe, nome: "Da equipe" }]);
    expect((await carregarPainelComissoes(sessaoDe(financeiro), base)).matriculadasSemComissao.map((o) => o.oportunidadeId).sort())
      .toEqual([daEquipe, deOutraEquipe].sort());
  });
  it("matriculadas sem comissão seguem o filtro de vendedor sem sair do escopo", async () => {
    const semComissao = async (dono: U, nome: string) => {
      const aluno = await prisma.aluno.create({ data: { primeiroNome: nome, paisId: cat.pais.id } });
      const lead = await prisma.oportunidade.create({ data: { nome, vendedorDonoId: dono.id, etapa: "MATRICULADO" } });
      await prisma.matricula.create({ data: { alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "BRL", status: "ATIVA", mesesPlano: 2, referenciaCobertura: "MES_CIVIL" } });
      return lead.id;
    };
    const deV1 = await semComissao(v1, "De V1");
    await semComissao(v2, "De V2");
    await semComissao(v3, "De V3");
    const lista = async (u: U, vendedorId: string) => (await carregarPainelComissoes(sessaoDe(u), { ...base, vendedorId })).matriculadasSemComissao;
    expect(await lista(financeiro, v1.id)).toEqual([{ oportunidadeId: deV1, nome: "De V1" }]);
    expect(await lista(gerente, v1.id)).toEqual([{ oportunidadeId: deV1, nome: "De V1" }]);
    // Gerente filtrando por vendedor de outra equipe: o escopo continua valendo (AND), nada aparece.
    expect(await lista(gerente, v3.id)).toEqual([]);
  });
});

// D11 (decisão do dono, 20/10/2026): previsão de pagamento = dia X do mês seguinte à competência, no fuso da escola,
// calculada na leitura com o X da ConfigFinanceiro (padrão 10). Paga e estornada ficam sem previsão.
describe("carregarPainelComissoes — previsão de pagamento (D11)", () => {
  const competenciaDe = (id: string, p: PainelComissoes) => p.linhas.find((l) => l.id === id);

  it("padrão: dia 10 do mês seguinte à competência; paga sem previsão", async () => {
    await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
    const p = await carregarPainelComissoes(sessaoDe(financeiro), base);
    expect(p.diaPrevisaoPagamento).toBe(10);
    const [ano, mes] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date()).split("-").map(Number);
    const seguinte = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
    const aprovadas = p.linhas.filter((l) => l.status === "APROVADA");
    expect(aprovadas.length).toBeGreaterThan(0);
    for (const l of aprovadas) expect(l.previsaoPagamento).toBe(`${seguinte}-10`);
    expect(p.linhas.find((l) => l.status === "PAGA")!.previsaoPagamento).toBeNull();
  });

  it("dezembro vira janeiro, no fuso da escola, com o dia configurado", async () => {
    await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
    await prisma.configFinanceiro.create({ data: { id: "financeiro", diaPrevisaoPagamentoComissao: 5 } });
    // 01/01/2027 às 02h30 UTC ainda é 31/12/2026 em São Paulo: competência dezembro, previsão 05/01/2027.
    const virada = await comissao(v1, { valor: 9, moeda: "BRL", status: "PENDENTE", aprovadaEm: new Date("2027-01-01T02:30:00Z") });
    const meio = await comissao(v1, { valor: 8, moeda: "BRL", status: "APROVADA", aprovadaEm: new Date("2026-12-15T15:00:00Z") });
    const estornada = await comissao(v1, { valor: 3, moeda: "BRL", status: "ESTORNADA", aprovadaEm: new Date("2026-12-15T15:00:00Z") });
    // "Este mês" do painel é dezembro de 2026: só o relógio (Date) é fixado, o resto segue real.
    vi.useFakeTimers({ now: new Date("2026-12-20T15:00:00Z"), toFake: ["Date"] });
    try {
      const p = await carregarPainelComissoes(sessaoDe(financeiro), base);
      expect(p.diaPrevisaoPagamento).toBe(5);
      expect(competenciaDe(virada.id, p)?.previsaoPagamento).toBe("2027-01-05");
      expect(competenciaDe(meio.id, p)?.previsaoPagamento).toBe("2027-01-05");
      expect(competenciaDe(estornada.id, p)?.previsaoPagamento).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("respeita o escopo: o vendedor só vê a previsão das próprias comissões", async () => {
    const p = await carregarPainelComissoes(sessaoDe(v1), base);
    expect(new Set(p.linhas.map((l) => l.vendedor))).toEqual(new Set(["V1"]));
    expect(p.linhas.every((l) => l.previsaoPagamento !== null)).toBe(true);
  });
});
