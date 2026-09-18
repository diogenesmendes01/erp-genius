import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, TipoAjuste, TipoCobranca, Vigencia } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Auth.js usa import dinâmico incompatível com concorrência neste runner Windows.
// Substituímos só a fronteira de autenticação: os papéis/estado continuam sendo
// relidos no PostgreSQL real, e as ações/locks/ledger permanecem sem mocks.
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
import { conferirPagamento, registrarPagamento, publicarPoliticaComissao, fecharMesComissoes } from "./acoes";
import { kpisFinanceiro } from "./consultas";
import { ajustarCobranca, decidirAprovacao } from "@/server/ajustes/acoes";
import { listarAprovacoesPendentes } from "@/server/ajustes/consultas";
import { criarMatricula, ativarMatricula, concluirMatricula } from "@/server/matricula/acoes";

let sec: Awaited<ReturnType<typeof criarUsuario>>, fin: typeof sec, ven: typeof sec, adm: typeof sec;
let cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let matriculaId: string, cobrancaId: string, alunoId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const pagamento = (chave: string, valor = 40) => ({ chaveIdempotencia: `pagamento-teste-${chave}`, valorRecebido: valor, comentario: "Recebimento e destinação conferidos no cenário", forma: "DINHEIRO" as const });
async function contratoAceito() {
  const documento = await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato aceito", url: "/api/files/contrato-financeiro.pdf" } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true, contratoDocumentoId: documento.id, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: sec.id } });
  return documento;
}

beforeEach(async () => {
  await truncarBanco();
  [sec, fin, ven, adm] = await Promise.all([
    criarUsuario([Papel.SECRETARIA_ACADEMICA]), criarUsuario([Papel.FINANCEIRO]), criarUsuario([Papel.VENDEDOR]), criarUsuario([Papel.ADMINISTRADOR]),
  ]);
  cat = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Teste", paisId: cat.pais.id } }); alunoId = aluno.id;
  const lead = await prisma.lead.create({ data: { nome: "Lead", vendedorDonoId: ven.id } });
  const m = await prisma.matricula.create({ data: {
    alunoId, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: "AGUARDANDO", mesesPlano: 2,
    referenciaCobertura: "MES_CIVIL",
    cobrancas: { create: [
      { tipo: "MATRICULA", valorOriginal: 100, valorNegociado: 100, moeda: "CRC", vencimento: new Date(), saldo: 100 },
      { tipo: "MENSALIDADE", coberturaInicio: new Date("2026-09-01"), coberturaFim: new Date("2026-09-30"), valorOriginal: 200, valorNegociado: 200, moeda: "CRC", vencimento: new Date(Date.now() + 86400000), saldo: 200 },
    ] },
  }, include: { cobrancas: true } });
  matriculaId = m.id; cobrancaId = m.cobrancas.find((c) => c.tipo === "MATRICULA")!.id;
});

describe("pagamento informado e ledger real", () => {
  it("SEC informa sem baixa/ativação; FIN diferente confirma exatamente uma vez", async () => {
    entrar(sec.id);
    expect((await registrarPagamento(cobrancaId, pagamento("informe"))).ok).toBe(true);
    const informe = await prisma.pagamentoInformado.findFirstOrThrow();
    expect(informe.status).toBe("A_CONFERIR");
    expect(await prisma.recebimento.count()).toBe(0);
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).valorRecebido).toBeNull();
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("AGUARDANDO");
    entrar(fin.id);
    const resultados = await Promise.all([
      conferirPagamento(informe.id, { versao: 1, confirmar: true }), conferirPagamento(informe.id, { versao: 1, confirmar: true }),
    ]);
    expect(resultados.every((r) => r.ok)).toBe(true);
    expect(await prisma.recebimento.count()).toBe(1);
    const cob = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
    expect(Number(cob.valorRecebido)).toBe(40); expect(Number(cob.saldo)).toBe(60);
  });
  it("acumular SEC+FIN não permite confirmar próprio informe nem contornar pela baixa direta", async () => {
    entrar(sec.id); await registrarPagamento(cobrancaId, pagamento("proprio"));
    await prisma.usuario.update({ where: { id: sec.id }, data: { papeis: [Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO] } });
    const informe = await prisma.pagamentoInformado.findFirstOrThrow();
    expect((await conferirPagamento(informe.id, { versao: 1, confirmar: true })).ok).toBe(false);
    expect((await registrarPagamento(cobrancaId, pagamento("bypass"))).ok).toBe(false);
    expect(await prisma.recebimento.count()).toBe(0);
  });
  it("rejeitar preserva evidência e não movimenta saldo", async () => {
    entrar(sec.id); await registrarPagamento(cobrancaId, pagamento("rejeitar"));
    const informe = await prisma.pagamentoInformado.findFirstOrThrow();
    entrar(fin.id);
    expect((await conferirPagamento(informe.id, { versao: 1, confirmar: false, motivo: "Valor não localizado" })).ok).toBe(true);
    expect((await prisma.pagamentoInformado.findUniqueOrThrow({ where: { id: informe.id } })).status).toBe("REJEITADO");
    expect(await prisma.recebimento.count()).toBe(0);
  });
  it("duas baixas parciais concorrentes acumulam, replay não duplica e KPI considera parciais", async () => {
    entrar(fin.id);
    const rs = await Promise.all([registrarPagamento(cobrancaId, pagamento("primeira", 30)), registrarPagamento(cobrancaId, pagamento("segunda", 40))]);
    expect(rs.every((r) => r.ok)).toBe(true);
    expect((await registrarPagamento(cobrancaId, pagamento("primeira", 30))).ok).toBe(true);
    expect((await registrarPagamento(cobrancaId, pagamento("primeira", 31))).ok).toBe(false);
    const cob = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
    expect(Number(cob.valorRecebido)).toBe(70); expect(Number(cob.saldo)).toBe(30); expect(await prisma.recebimento.count()).toBe(2);
    const kpis = await kpisFinanceiro();
    expect(kpis.recebidoMes).toEqual([{ moeda: "CRC", valor: 70 }]);
    expect(kpis.emAtraso).toEqual([{ moeda: "CRC", valor: 30 }]);
  });
});

describe("alçadas, aprovação vinculada e histórico", () => {
  const desconto = (valorPara: number) => ({ cobrancaId, valorPara, tipo: TipoAjuste.DESCONTO, vigencia: Vigencia.ESTA_COBRANCA, motivo: "Desconto negociado" });
  it("vendedor fora da carteira não altera cobrança", async () => {
    const outro = await criarUsuario([Papel.VENDEDOR]); entrar(outro.id);
    expect((await ajustarCobranca(desconto(95))).ok).toBe(false);
    expect(Number((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).valorNegociado)).toBe(100);
  });
  it("ajuste após parcial reconcilia saldo e verifica desconto acumulado", async () => {
    entrar(fin.id); await registrarPagamento(cobrancaId, pagamento("parcial"));
    await prisma.usuario.update({ where: { id: ven.id }, data: { limiteDescontoTaxaPct: 6, limiteDescontoMensalidadePct: 50 } });
    entrar(ven.id);
    expect((await ajustarCobranca(desconto(95))).ok).toBe(true);
    expect(Number((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).saldo)).toBe(55);
    const r = await ajustarCobranca(desconto(90));
    expect(r.ok && r.dado?.aprovacao).toBe(true);
    expect(Number((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).valorNegociado)).toBe(95);
  });
  it("admin solicitante não aprova próprio pedido; alteração invalida snapshot", async () => {
    entrar(adm.id); await ajustarCobranca(desconto(50));
    const ap = await prisma.aprovacao.findFirstOrThrow();
    expect((await decidirAprovacao(ap.id, { aprovar: true })).ok).toBe(false);
    entrar(fin.id); await registrarPagamento(cobrancaId, pagamento("mudou"));
    const direcao = await criarUsuario([Papel.ADMINISTRADOR]); entrar(direcao.id);
    expect((await decidirAprovacao(ap.id, { aprovar: true })).ok).toBe(false);
    expect((await prisma.aprovacao.findUniqueOrThrow({ where: { id: ap.id } })).status).toBe("PENDENTE");
  });
  it("fixa e paga conservam o valor quando a taxa muda", async () => {
    await prisma.comissao.createMany({ data: [
      { matriculaId, vendedorId: ven.id, tipo: "VALOR_FIXO", percentual: 0, valorFixo: 30, valor: 30, moeda: "CRC" },
      { matriculaId, vendedorId: ven.id, tipo: "PERCENTUAL", percentual: 10, valor: 10, moeda: "CRC", status: "PAGA", pagaEm: new Date() },
    ] });
    await prisma.usuario.update({ where: { id: ven.id }, data: { limiteDescontoTaxaPct: 50 } });
    entrar(ven.id); expect((await ajustarCobranca(desconto(50))).ok).toBe(true);
    expect((await prisma.comissao.findMany({ orderBy: { valor: "asc" } })).map((c) => Number(c.valor))).toEqual([10, 30]);
  });
  it("transferência retira a aprovação da equipe, inclusive quando GC acumula FIN", async () => {
    const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO]);
    const outroVendedor = await criarUsuario([Papel.VENDEDOR]);
    await prisma.usuario.update({ where: { id: gerente.id }, data: { limiteDescontoTaxaPct: 50 } });
    await prisma.usuario.update({ where: { id: ven.id }, data: { gerenteComercialId: gerente.id, limiteDescontoTaxaPct: 5 } });
    entrar(ven.id); expect((await ajustarCobranca(desconto(50))).ok).toBe(true);
    const pedido = await prisma.aprovacao.findFirstOrThrow();
    entrar(gerente.id); expect((await listarAprovacoesPendentes()).map((p) => p.id)).toContain(pedido.id);
    const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
    await prisma.lead.update({ where: { id: matricula.leadId! }, data: { vendedorDonoId: outroVendedor.id } });
    expect(await listarAprovacoesPendentes()).toEqual([]);
    expect((await decidirAprovacao(pedido.id, { aprovar: true })).ok).toBe(false);
    expect(Number((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).valorNegociado)).toBe(100);
  });
  it("fechamento concorrente com desconto conserva exatamente o valor registrado como pago", async () => {
    const comissao = await prisma.comissao.create({ data: { matriculaId, vendedorId: ven.id, tipo: "PERCENTUAL", percentual: 10, valor: 10, moeda: "CRC", status: "APROVADA" } });
    await prisma.usuario.update({ where: { id: adm.id }, data: { limiteDescontoTaxaPct: 50 } });
    entrar(adm.id);
    const resultados = await Promise.all([ajustarCobranca(desconto(50)), fecharMesComissoes()]);
    expect(resultados.every((r) => r.ok)).toBe(true);
    const paga = await prisma.comissao.findUniqueOrThrow({ where: { id: comissao.id } });
    const evento = await prisma.evento.findFirstOrThrow({ where: { tipo: "ComissaoPaga", agregadoId: comissao.id } });
    expect(paga.status).toBe("PAGA");
    expect([5, 10]).toContain(Number(paga.valor));
    expect((evento.payload as { valor: number }).valor).toBe(Number(paga.valor));
  });
});

function entradaMatricula() {
  return { alunoPrimeiroNome: "Nova", alunoSobrenome: "Aluna", alunoGenero: "NAO_INFORMADO" as const, alunoNascimento: "1990-05-10",
    alunoPaisId: cat.pais.id, alunoTipoDocumentoId: cat.pais.tiposDocumento[0].id, alunoDocumento: "1-2345-6789", alunoNacionalidade: "CR",
    alunoEmail: "nova@teste.cr", alunoTelefone: "88887777", alunoPaisResidencia: "CR", pagador: "ALUNO" as const,
    produtoId: cat.produto.id, taxaValor: 20000, mensalidadeValor: 85000, diaVencimento: 5, cobertura: { referencia: "MES_CIVIL" as const, inicio: "2026-06-01" }, primeiroVencimento: "2026-06-05", mesesPlano: 3 };
}

describe("matrícula e comissão configurável", () => {
  it("sem regra não usa percentual padrão do formulário", async () => {
    entrar(ven.id); const antes = await prisma.matricula.count();
    expect((await criarMatricula(entradaMatricula())).ok).toBe(false);
    expect(await prisma.matricula.count()).toBe(antes);
  });
  it("regra fixa é aplicada no servidor e nova versão preserva a comissão anterior", async () => {
    entrar(adm.id);
    expect((await publicarPoliticaComissao({ paisId: cat.pais.id, produtoId: cat.produto.id, tipo: "VALOR_FIXO", percentual: null, valorFixo: 321, moeda: "CRC", vigenteEm: new Date() })).ok).toBe(true);
    entrar(ven.id); const r = await criarMatricula(entradaMatricula()); expect(r.ok).toBe(true);
    const antiga = await prisma.comissao.findFirstOrThrow(); expect(Number(antiga.valor)).toBe(321); expect(antiga.tipo).toBe("VALOR_FIXO");
    entrar(adm.id);
    expect((await publicarPoliticaComissao({ paisId: cat.pais.id, produtoId: cat.produto.id, tipo: "PERCENTUAL", percentual: 10, valorFixo: null, moeda: "CRC", vigenteEm: new Date(Date.now() + 86400000) })).ok).toBe(true);
    const depois = await prisma.comissao.findUniqueOrThrow({ where: { id: antiga.id } });
    expect(depois.memoriaCalculo).toEqual(antiga.memoriaCalculo); expect(Number(depois.valor)).toBe(321);
  });
  it("limite separado na criação encaminha aprovação e mantém referência até decisão", async () => {
    await prisma.politicaComissao.create({ data: { paisId: cat.pais.id, produtoId: cat.produto.id, versao: 1, tipo: "PERCENTUAL", percentual: 10, moeda: "CRC", vigenteEm: new Date("2020-01-01"), criadaPorId: adm.id } });
    await prisma.usuario.update({ where: { id: ven.id }, data: { limiteDescontoTaxaPct: 5, limiteDescontoMensalidadePct: 50 } });
    entrar(ven.id); const r = await criarMatricula({ ...entradaMatricula(), taxaValor: 10000 });
    expect(r.ok && r.dado?.aguardaPreco).toBe(true);
    if (!r.ok) return;
    const taxa = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: r.dado!.id, tipo: TipoCobranca.MATRICULA } });
    expect(Number(taxa.valorNegociado)).toBe(20000);
    entrar(adm.id); const ap = await prisma.aprovacao.findFirstOrThrow();
    expect((await decidirAprovacao(ap.id, { aprovar: true })).ok).toBe(true);
    expect(Number((await prisma.cobranca.findUniqueOrThrow({ where: { id: taxa.id } })).valorNegociado)).toBe(10000);
  });
  it("país pausado não permite criar novo contrato", async () => {
    await prisma.pais.update({ where: { id: cat.pais.id }, data: { status: "PAUSADO" } }); entrar(adm.id);
    const r = await criarMatricula(entradaMatricula()); expect(r.ok).toBe(false); if (!r.ok) expect(r.erro).toMatch(/pausado/);
  });
  it("a conclusão exige contrato real e preserva primeira mensalidade já paga", async () => {
    const pagoEm = new Date("2026-08-15");
    entrar(fin.id);
    expect((await registrarPagamento(cobrancaId, { ...pagamento("taxa-previamente-paga", 100), dataPagamento: pagoEm })).ok).toBe(true);
    const mensalidade = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId, tipo: "MENSALIDADE" } });
    expect((await registrarPagamento(mensalidade.id, { ...pagamento("mensalidade-previamente-paga", 200), dataPagamento: pagoEm })).ok).toBe(true);
    entrar(sec.id);
    expect((await concluirMatricula(matriculaId)).ok).toBe(false);
    const contrato = await contratoAceito();
    const r = await concluirMatricula(matriculaId);
    expect(r.ok).toBe(true);
    const depois = await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidade.id } });
    expect(depois.status).toBe("PAGO"); expect(Number(depois.valorRecebido)).toBe(200); expect(depois.pagoEm).toEqual(pagoEm);
    expect(depois.vencimento).toEqual(mensalidade.vencimento);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).contratoDocumentoId).toBe(contrato.id);
    expect(await prisma.recebimento.count()).toBe(2);
  });
  it("informe a conferir não ativa; confirmação independente libera a conclusão", async () => {
    await contratoAceito(); entrar(sec.id);
    expect((await registrarPagamento(cobrancaId, pagamento("ativacao-informe", 100))).ok).toBe(true);
    const informe = await prisma.pagamentoInformado.findFirstOrThrow();
    expect(informe.suspenderLembretesAte).not.toBeNull();
    expect(informe.suspenderLembretesAte!.getTime() - informe.criadoEm.getTime()).toBe(48 * 3600_000);
    expect((await concluirMatricula(matriculaId)).ok).toBe(false);
    entrar(fin.id); expect((await conferirPagamento(informe.id, { versao: 1, confirmar: true })).ok).toBe(true);
    entrar(sec.id); expect((await concluirMatricula(matriculaId)).ok).toBe(true);
    expect(await prisma.recebimento.count()).toBe(1);
  });
  it("opção que exige primeira mensalidade bloqueia até sua confirmação", async () => {
    await contratoAceito();
    await prisma.configuracaoOperacional.create({ data: { id: "escola", exigirPrimeiraMensalidade: true } });
    entrar(fin.id); expect((await registrarPagamento(cobrancaId, pagamento("taxa-opcao", 100))).ok).toBe(true);
    expect((await concluirMatricula(matriculaId)).ok).toBe(false);
    const primeira = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId, tipo: "MENSALIDADE" } });
    expect((await registrarPagamento(primeira.id, pagamento("primeira-opcao", 200))).ok).toBe(true);
    expect((await concluirMatricula(matriculaId)).ok).toBe(true);
  });
  it("ativação com novo recebimento considera a taxa parcialmente confirmada", async () => {
    await contratoAceito(); entrar(fin.id);
    expect((await registrarPagamento(cobrancaId, pagamento("taxa-parcial", 40))).ok).toBe(true);
    expect((await ativarMatricula(matriculaId, { valorRecebido: 60, forma: "DINHEIRO", dataPagamento: new Date(), comentario: "Recebimento complementar destinado à taxa" })).ok).toBe(true);
    expect(Number((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).valorRecebido)).toBe(100);
    expect(await prisma.recebimento.count()).toBe(2);
  });
  it.each(["CANCELADA", "ENCERRADA"] as const)("estado %s não reativa nem altera recebimentos", async (status) => {
    await prisma.matricula.update({ where: { id: matriculaId }, data: { status } }); entrar(adm.id);
    expect((await ativarMatricula(matriculaId, { valorRecebido: 100, forma: "DINHEIRO", dataPagamento: new Date() })).ok).toBe(false);
    expect(await prisma.recebimento.count()).toBe(0);
  });
});
