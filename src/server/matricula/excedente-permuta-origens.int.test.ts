import { beforeEach, expect, it, vi } from "vitest";
import { Papel, TipoCobranca, TipoDestinacaoRecebimento, UnidadePermutaServico } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { receberComDestinacoesTx } from "@/server/financeiro/recebimentos";
import { proporUtilizacaoCredito } from "@/server/financeiro/uso-credito-proposta";
import { decidirUtilizacaoCredito } from "@/server/financeiro/uso-credito-decisao";
import { prepararAcordoPermuta, confirmarServicoPermuta, proporCompensacaoPermuta, decidirCompensacaoPermuta } from "@/server/financeiro/permuta-servico";
import { registrarPagamento } from "@/server/financeiro/acoes";
import { carregarOrigensExcedentePermutaTx } from "./excedente-permuta-origens-tx";

let financeiroId = "", aprovadorId = "", pedagogicoId = "", secretariaId = "", matriculaId = "", cobrancaId = "";
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

beforeEach(async () => {
  await truncarBanco();
  financeiroId = (await criarUsuario([Papel.FINANCEIRO], "Financeiro origens Q167")).id;
  aprovadorId = (await criarUsuario([Papel.FINANCEIRO], "Aprovador origens Q167")).id;
  pedagogicoId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Pedagógico origens Q167")).id;
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria origens Q167")).id;
  await prisma.usuario.update({ where: { id: aprovadorId }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  const catalogo = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Origens", sobrenome: "Q167", paisId: catalogo.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  cobrancaId = (await prisma.cobranca.create({ data: { matriculaId, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: 100, valorNegociado: 100, saldo: 100, vencimento: new Date("2099-10-01T00:00:00Z") } })).id;
});

it("mantém a leitura pendente enquanto informe e proposta de crédito não viraram origem final", async () => {
  await prisma.$transaction((tx) => receberComDestinacoesTx(tx, {
    titularMatriculaId: matriculaId, chaveIdempotencia: "q167-credito-pendente-origem", autorId: financeiroId, valorRecebido: 20, forma: "DINHEIRO", moeda: "CRC", dataPagamento: new Date("2099-09-01T12:00:00Z"),
    destinos: [{ tipo: TipoDestinacaoRecebimento.CREDITO_SEM_DESTINO, valor: 20, evidencia: "Crédito materializado antes da proposta ainda pendente.", chaveIdempotencia: "q167-credito-pendente-destino" }],
  }));
  const credito = await prisma.creditoMatricula.findFirstOrThrow({ where: { origemDestinacaoRecebimentoId: { not: null } } });
  entrar(financeiroId);
  const uso = await proporUtilizacaoCredito({ creditoId: credito.id, cobrancaId, valor: "20.00", concordancia: "Titular concordou com uso que aguarda aprovação financeira.", motivo: "Proposta ainda não decidida para testar a origem provisória.", chaveIdempotencia: "q167-uso-pendente" });
  if (!uso.ok || !uso.dado) throw new Error(JSON.stringify(uso));
  entrar(secretariaId);
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "q167-informe-pendente", valorRecebido: 10, forma: "DINHEIRO", dataPagamento: new Date("2099-09-02T12:00:00Z"), comentario: "Comprovante enviado pela Secretaria para conferência." })).toMatchObject({ ok: true, dado: { informado: true } });

  const resultado = await prisma.$transaction((tx) => carregarOrigensExcedentePermutaTx(tx, { matriculaId, cobrancaId }));
  const informe = await prisma.pagamentoInformado.findFirstOrThrow({ where: { cobrancaId, status: "A_CONFERIR" } });
  expect(resultado).toMatchObject({ status: "PENDENTE_ORIGEM_NAO_FINAL", origens: [],
    fotografia: { informesAConferir: [{ id: informe.id, versao: informe.versao, valor: "10.00", moeda: "CRC" }], propostasUsoCreditoAguardarDecisao: [{ id: uso.dado.id, creditoId: credito.id, versao: expect.any(Number), valor: "20.00" }] },
    pendencias: [{ codigo: "INFORME_PAGAMENTO_A_CONFERIR", ids: [informe.id] }, { codigo: "PROPOSTA_USO_CREDITO_A_DECIDIR", ids: [uso.dado.id] }],
  });
  expect(await prisma.decisaoUsoCredito.count()).toBe(0);
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).valorLiquidadoCredito.toFixed(2)).toBe("0.00");
});

it("carrega caixa, crédito e permuta pelas cadeias reais sem inferir obrigação proposta", async () => {
  const caixa = await prisma.$transaction((tx) => receberComDestinacoesTx(tx, {
    titularMatriculaId: matriculaId, chaveIdempotencia: "q167-caixa-para-cobranca", autorId: financeiroId, valorRecebido: 20, forma: "DINHEIRO", moeda: "CRC", dataPagamento: new Date("2099-09-01T12:00:00Z"),
    destinos: [{ tipo: TipoDestinacaoRecebimento.COBRANCA, cobrancaId, valor: 20, evidencia: "Caixa identificado para a mensalidade Q167.", chaveIdempotencia: "q167-caixa-destino" }],
  }));
  await prisma.$transaction((tx) => receberComDestinacoesTx(tx, {
    titularMatriculaId: matriculaId, chaveIdempotencia: "q167-caixa-gera-credito", autorId: financeiroId, valorRecebido: 30, forma: "DINHEIRO", moeda: "CRC", dataPagamento: new Date("2099-09-02T12:00:00Z"),
    destinos: [{ tipo: TipoDestinacaoRecebimento.CREDITO_SEM_DESTINO, valor: 30, evidencia: "Antecipação materializada como crédito antes da utilização.", chaveIdempotencia: "q167-credito-destino" }],
  }));
  const credito = await prisma.creditoMatricula.findFirstOrThrow({ where: { origemDestinacaoRecebimentoId: { not: null } } });
  entrar(financeiroId);
  const uso = await proporUtilizacaoCredito({ creditoId: credito.id, cobrancaId, valor: "30.00", concordancia: "Titular concordou com o uso do crédito identificado.", motivo: "Aplicar crédito já materializado à mensalidade.", chaveIdempotencia: "q167-uso-credito" });
  if (!uso.ok || !uso.dado) throw new Error(JSON.stringify(uso));
  entrar(aprovadorId);
  expect(await decidirUtilizacaoCredito({ propostaId: uso.dado.id, aprovar: true, motivo: "Crédito e cobrança conferidos por aprovador independente." })).toMatchObject({ ok: true });

  entrar(financeiroId);
  const acordo = await prepararAcordoPermuta({ matriculaId, vigenciaInicio: "2099-10-01", vigenciaFim: "2099-10-31", moeda: "CRC", unidade: UnidadePermutaServico.HORA, quantidadePactuada: "1.00", valorPorUnidade: "50.00", contrapartida: "Serviço pedagógico efetivamente prestado à escola.", formulaDescricao: "Uma hora comprovada a cinquenta CRC.", cobrancas: [{ cobrancaId, valorMaximo: "50.00" }], chaveIdempotencia: "q167-acordo-permuta" });
  if (!acordo.ok || !acordo.dado) throw new Error(JSON.stringify(acordo));
  entrar(pedagogicoId);
  const confirmacao = await confirmarServicoPermuta({ acordoId: acordo.dado.id, periodoInicio: "2099-10-01", periodoFim: "2099-10-01", quantidadeComprovada: "1.00", referenciaServico: "Q167-SERVICO-1", evidencia: "Diário pedagógico confirma a hora prestada à escola.", chaveIdempotencia: "q167-confirmacao-permuta" });
  if (!confirmacao.ok || !confirmacao.dado) throw new Error(JSON.stringify(confirmacao));
  entrar(financeiroId);
  const proposta = await proporCompensacaoPermuta({ confirmacaoId: confirmacao.dado.id, destinos: [{ cobrancaId, valor: "50.00" }], chaveIdempotencia: "q167-proposta-permuta" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(aprovadorId);
  expect(await decidirCompensacaoPermuta({ propostaId: proposta.dado.id, aprovar: true, motivo: "Acordo, confirmação, proposta e destino conferidos." })).toMatchObject({ ok: true });

  const resultado = await prisma.$transaction((tx) => carregarOrigensExcedentePermutaTx(tx, { matriculaId, cobrancaId }));
  const cobranca = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  expect(resultado).toMatchObject({ status: "PRONTA", fotografia: { cobrancaId, versaoCobranca: cobranca.versao, obrigacaoAtual: "100.00", recebido: "20.00", creditoLiquidado: "30.00", permutaCompensada: "50.00", saldo: "0.00" } });
  expect(resultado).not.toHaveProperty("valorDevido");
  expect(resultado.origens.map((origem) => ({ id: origem.id, tipo: origem.tipo, versao: origem.versaoCobranca }))).toEqual([
    { id: (await prisma.destinacaoRecebimento.findFirstOrThrow({ where: { recebimentoId: caixa.id, cobrancaId } })).id, tipo: "CAIXA", versao: cobranca.versao },
    { id: uso.dado.id, tipo: "CREDITO", versao: cobranca.versao },
    { id: (await prisma.aplicacaoCompensacaoPermuta.findFirstOrThrow({ where: { cobrancaId } })).id, tipo: "PERMUTA", versao: cobranca.versao },
  ]);
  expect(resultado.fotografia.cadeias).toEqual(expect.arrayContaining([
    expect.objectContaining({ tipo: "CAIXA", recebimentoId: caixa.id }),
    expect.objectContaining({ tipo: "CREDITO", creditoId: credito.id, propostaId: uso.dado.id }),
    expect.objectContaining({ tipo: "PERMUTA", acordoId: acordo.dado.id, confirmacaoId: confirmacao.dado.id, propostaId: proposta.dado.id }),
  ]));
});
