import { beforeEach, describe, expect, it } from "vitest";
import { Papel, TipoCobranca, UnidadePermutaServico } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";

let matriculaId = "", mensalidadeId = "", taxaId = "";
let financeiroId = "", financeiroDoisId = "", pedagogoId = "", aprovadorId = "";
let sequencia = 0;
const chave = (prefixo: string) => `${prefixo}-${++sequencia}`;

async function criarAcordo() {
  return prisma.acordoPermutaServico.create({ data: {
    matriculaId, preparadorId: financeiroId,
    vigenciaInicio: new Date("2099-10-01"), vigenciaFim: new Date("2099-10-31"),
    moeda: "CRC", unidade: UnidadePermutaServico.HORA,
    quantidadePactuada: 10, valorPorUnidade: 10, valorTotalPactuado: 100,
    contrapartida: "Aulas de espanhol prestadas à equipe da escola.",
    formulaDescricao: "Quantidade comprovada multiplicada por dez CRC por hora.",
    chaveIdempotencia: chave("acordo"), entradaHash: chave("hash-acordo"),
  } });
}

async function confirmar(acordoId: string, dados: Partial<{ inicio: string; fim: string; quantidade: number }> = {}) {
  return prisma.confirmacaoServicoPermuta.create({ data: {
    acordoId, confirmadorId: pedagogoId,
    periodoInicio: new Date(dados.inicio ?? "2099-10-01"),
    periodoFim: new Date(dados.fim ?? "2099-10-03"), quantidadeComprovada: dados.quantidade ?? 5,
    referenciaServico: chave("servico"), evidencia: "Relatório pedagógico identifica o serviço realmente prestado.",
    chaveIdempotencia: chave("confirmacao"), entradaHash: chave("hash-confirmacao"),
  } });
}

async function propor(confirmacaoId: string, preparadorId = financeiroId) {
  const atual = await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidadeId } });
  return prisma.propostaCompensacaoPermuta.create({ data: {
    confirmacaoId, preparadorId, valor: 50, snapshot: { destinos: [{ cobrancaId: mensalidadeId, versao: atual.versao, saldo: atual.saldo?.toFixed(2), valor: "50.00" }] },
    chaveIdempotencia: chave("proposta"), entradaHash: chave("hash-proposta"),
  } });
}

beforeEach(async () => {
  await truncarBanco();
  sequencia = 0;
  const catalogo = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Paula", sobrenome: "Permuta", paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  matriculaId = matricula.id;
  mensalidadeId = (await prisma.cobranca.create({ data: { matriculaId, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: 100, valorNegociado: 100, saldo: 100, vencimento: new Date("2099-10-10") } })).id;
  taxaId = (await prisma.cobranca.create({ data: { matriculaId, tipo: TipoCobranca.MATRICULA, moeda: "CRC", valorOriginal: 100, valorNegociado: 100, saldo: 100, vencimento: new Date("2099-10-10") } })).id;
  financeiroId = (await criarUsuario([Papel.FINANCEIRO], "Financeiro proponente")).id;
  financeiroDoisId = (await criarUsuario([Papel.FINANCEIRO], "Segundo financeiro")).id;
  pedagogoId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Pedagógico confirmador")).id;
  aprovadorId = (await criarUsuario([Papel.FINANCEIRO], "Aprovador independente")).id;
  await prisma.usuario.update({ where: { id: aprovadorId }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
});

describe.sequential("P02/Q89/Q98 — guardas SQL da base de permuta", () => {
  it("aceita somente mensalidade elegível; taxa não entra no acordo", async () => {
    const acordo = await criarAcordo();
    await expect(prisma.acordoPermutaCobranca.create({ data: { acordoId: acordo.id, cobrancaId: taxaId, valorMaximo: 100 } })).rejects.toThrow();
    expect(await prisma.acordoPermutaCobranca.count()).toBe(0);
    await expect(prisma.acordoPermutaCobranca.create({ data: { acordoId: acordo.id, cobrancaId: mensalidadeId, valorMaximo: 100 } })).resolves.toMatchObject({ cobrancaId: mensalidadeId });
  });

  it("recusa decisão autoaprovada e aprovador financeiro inativo", async () => {
    const acordo = await criarAcordo();
    await prisma.acordoPermutaCobranca.create({ data: { acordoId: acordo.id, cobrancaId: mensalidadeId, valorMaximo: 100 } });
    const confirmacao = await confirmar(acordo.id);
    const proposta = await propor(confirmacao.id);
    await prisma.destinoPropostaCompensacaoPermuta.create({ data: { propostaId: proposta.id, cobrancaId: mensalidadeId, valor: 50 } });
    await expect(prisma.decisaoCompensacaoPermuta.create({ data: { propostaId: proposta.id, decisorId: financeiroId, aprovada: true, motivo: "Autoaprovação adversarial" } })).rejects.toThrow();
    await prisma.usuario.update({ where: { id: aprovadorId }, data: { ativo: false } });
    await expect(prisma.decisaoCompensacaoPermuta.create({ data: { propostaId: proposta.id, decisorId: aprovadorId, aprovada: true, motivo: "Aprovador revogado" } })).rejects.toThrow();
    expect(await prisma.decisaoCompensacaoPermuta.count()).toBe(0);
  });

  it("fecha destinos ao decidir e exige decisão independente", async () => {
    const acordo = await criarAcordo();
    await prisma.acordoPermutaCobranca.create({ data: { acordoId: acordo.id, cobrancaId: mensalidadeId, valorMaximo: 100 } });
    const confirmacao = await confirmar(acordo.id);
    const proposta = await propor(confirmacao.id);
    await prisma.destinoPropostaCompensacaoPermuta.create({ data: { propostaId: proposta.id, cobrancaId: mensalidadeId, valor: 50 } });
    await prisma.decisaoCompensacaoPermuta.create({ data: { propostaId: proposta.id, decisorId: aprovadorId, aprovada: true, motivo: "Conferência financeira independente" } });
    await expect(prisma.destinoPropostaCompensacaoPermuta.create({ data: { propostaId: proposta.id, cobrancaId: taxaId, valor: 1 } })).rejects.toThrow();
  });

  it("recusa períodos sobrepostos e quantidade cumulativa acima do acordo", async () => {
    const acordo = await criarAcordo();
    await confirmar(acordo.id, { inicio: "2099-10-01", fim: "2099-10-03", quantidade: 6 });
    await expect(confirmar(acordo.id, { inicio: "2099-10-03", fim: "2099-10-05", quantidade: 1 })).rejects.toThrow();
    await expect(confirmar(acordo.id, { inicio: "2099-10-05", fim: "2099-10-06", quantidade: 5 })).rejects.toThrow();
    expect(await prisma.confirmacaoServicoPermuta.count()).toBe(1);
  });

  it("serializa propostas concorrentes para a mesma confirmação", async () => {
    const acordo = await criarAcordo();
    const confirmacao = await confirmar(acordo.id);
    const resultados = await Promise.allSettled([propor(confirmacao.id, financeiroId), propor(confirmacao.id, financeiroDoisId)]);
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((resultado) => resultado.status === "rejected")).toHaveLength(1);
    expect(await prisma.propostaCompensacaoPermuta.count({ where: { confirmacaoId: confirmacao.id } })).toBe(1);
  });
});

it("banco rejeita aprovação de permuta após redução do saldo da mensalidade", async () => {
  const acordo = await criarAcordo();
  await prisma.acordoPermutaCobranca.create({ data: { acordoId: acordo.id, cobrancaId: mensalidadeId, valorMaximo: 100 } });
  const confirmacao = await confirmar(acordo.id);
  const proposta = await propor(confirmacao.id);
  await prisma.destinoPropostaCompensacaoPermuta.create({ data: { propostaId: proposta.id, cobrancaId: mensalidadeId, valor: 50 } });
  await prisma.cobranca.update({ where: { id: mensalidadeId }, data: { valorNegociado: 40, saldo: 40 } });
  await expect(prisma.decisaoCompensacaoPermuta.create({ data: { propostaId: proposta.id, decisorId: aprovadorId, aprovada: true, motivo: "Proposta com saldo antigo" } })).rejects.toThrow("Proposta obsoleta");
  expect(await prisma.decisaoCompensacaoPermuta.count()).toBe(0);
  await expect(prisma.decisaoCompensacaoPermuta.create({ data: { propostaId: proposta.id, decisorId: aprovadorId, aprovada: false, motivo: "Rejeitada para nova conferência" } })).resolves.toMatchObject({ aprovada: false });
});
