import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

export type OrigemLiquidacaoAcerto = {
  id: string;
  tipo: "CAIXA" | "CREDITO" | "PERMUTA";
  cobrancaId: string;
  versaoCobranca: number;
  moeda: string;
  valor: Prisma.Decimal.Value;
};

export type DistribuicaoExcedenteAcerto = {
  origemId: string;
  valor: Prisma.Decimal.Value;
};

export type EntradaExcedentePermuta = {
  cobrancaId: string;
  versaoCobranca: number;
  moeda: string;
  valorDevido: Prisma.Decimal.Value;
  origens: OrigemLiquidacaoAcerto[];
  distribuicao?: DistribuicaoExcedenteAcerto[];
};

const zero = 0n;

function centavos(valor: Prisma.Decimal.Value, campo: string) {
  const decimal = new Prisma.Decimal(valor);
  if (!decimal.isFinite() || decimal.isNegative()) throw new ErroRegra(`${campo} deve ser um valor não negativo.`);
  const emCentavos = decimal.mul(100);
  if (!emCentavos.isInteger()) throw new ErroRegra(`${campo} deve ter no máximo duas casas decimais.`);
  return BigInt(emCentavos.toFixed(0));
}

const exibir = (valor: bigint) => new Prisma.Decimal(valor.toString()).div(100).toFixed(2);

/**
 * Q167: separa a aritmética da escolha de destino. Nenhum excedente é
 * convertido em crédito, devolução ou nova compensação neste cálculo.
 */
export function calcularExcedentePermuta(entrada: EntradaExcedentePermuta) {
  if (!entrada.cobrancaId) throw new ErroRegra("Informe a cobrança do acerto.");
  if (!Number.isInteger(entrada.versaoCobranca) || entrada.versaoCobranca < 0) throw new ErroRegra("Versão da cobrança inválida.");
  if (!/^[A-Z]{3}$/.test(entrada.moeda)) throw new ErroRegra("Moeda inválida.");
  const devido = centavos(entrada.valorDevido, "Valor devido");
  const ids = new Set<string>();
  const origens = entrada.origens.map((origem) => {
    if (!origem.id || ids.has(origem.id)) throw new ErroRegra("Origem de liquidação duplicada.");
    ids.add(origem.id);
    if (!(["CAIXA", "CREDITO", "PERMUTA"] as const).includes(origem.tipo)) throw new ErroRegra("Tipo da origem de liquidação inválido.");
    if (origem.cobrancaId !== entrada.cobrancaId || origem.moeda !== entrada.moeda) throw new ErroRegra("Origem de liquidação pertence a outra cobrança ou moeda.");
    if (origem.versaoCobranca !== entrada.versaoCobranca) throw new ErroRegra("Origem de liquidação diverge da versão atual da cobrança.");
    return { ...origem, centavos: centavos(origem.valor, `Valor da origem ${origem.id}`) };
  });
  const liquidado = origens.reduce((total, origem) => total + origem.centavos, zero);
  const reducao = liquidado > devido ? liquidado - devido : zero;
  const permuta = origens.filter((origem) => origem.tipo === "PERMUTA");
  const totalPermuta = permuta.reduce((total, origem) => total + origem.centavos, zero);
  const naoServico = origens.filter((origem) => origem.tipo !== "PERMUTA").reduce((total, origem) => total + origem.centavos, zero);
  const minimoPermuta = reducao > naoServico ? reducao - naoServico : zero;
  const maximoPermuta = reducao < totalPermuta ? reducao : totalPermuta;
  const base = {
    cobrancaId: entrada.cobrancaId,
    versaoCobranca: entrada.versaoCobranca,
    moeda: entrada.moeda,
    valorDevido: exibir(devido),
    totalLiquidado: exibir(liquidado),
    reducaoNecessaria: exibir(reducao),
    totalPermuta: exibir(totalPermuta),
  };

  if (entrada.distribuicao) {
    const distribuicoes = new Set<string>();
    const porOrigem = entrada.distribuicao.map((item) => {
      if (!item.origemId || distribuicoes.has(item.origemId)) throw new ErroRegra("Distribuição repete a mesma origem.");
      distribuicoes.add(item.origemId);
      const origem = origens.find((candidata) => candidata.id === item.origemId);
      if (!origem) throw new ErroRegra("Distribuição aponta para origem inexistente.");
      const valor = centavos(item.valor, `Distribuição da origem ${item.origemId}`);
      if (valor > origem.centavos) throw new ErroRegra("Distribuição excede o valor preservado na origem.");
      return { origem, centavos: valor };
    });
    const totalDistribuido = porOrigem.reduce((total, item) => total + item.centavos, zero);
    if (totalDistribuido !== reducao) throw new ErroRegra("Distribuição deve totalizar exatamente a redução da obrigação.");
    const excedentesServico = porOrigem.filter((item) => item.origem.tipo === "PERMUTA" && item.centavos > zero).map((item) => ({
      aplicacaoPermutaId: item.origem.id,
      valor: exibir(item.centavos),
      cobrancaId: item.origem.cobrancaId,
      versaoCobranca: item.origem.versaoCobranca,
      moeda: item.origem.moeda,
    }));
    return {
      ...base,
      status: excedentesServico.length ? "DISTRIBUICAO_EXPLICITA" as const : "SEM_EXCEDENTE_SERVICO" as const,
      excedenteServico: exibir(excedentesServico.reduce((total, item) => total + centavos(item.valor, "Excedente de serviço"), zero)),
      excedentesServico,
      distribuicao: porOrigem.map((item) => ({ origemId: item.origem.id, tipo: item.origem.tipo, valor: exibir(item.centavos) })),
    };
  }

  if (reducao === zero || totalPermuta === zero) return { ...base, status: "SEM_EXCEDENTE_SERVICO" as const, excedenteServico: "0.00", excedentesServico: [] };
  const fonteDeterminada = permuta.filter((origem) => origem.centavos > zero);
  if (minimoPermuta !== maximoPermuta || fonteDeterminada.length !== 1) {
    return { ...base, status: "DISTRIBUICAO_MISTA_PENDENTE" as const, excedenteServicoMinimo: exibir(minimoPermuta), excedenteServicoMaximo: exibir(maximoPermuta), excedentesServico: [], pendencia: "A redução mistura fontes de liquidação; distribua explicitamente o excedente por origem antes da decisão." };
  }
  const origem = fonteDeterminada[0];
  return {
    ...base,
    status: "EXCEDENTE_SERVICO_DETERMINADO" as const,
    excedenteServico: exibir(minimoPermuta),
    excedentesServico: [{ aplicacaoPermutaId: origem.id, valor: exibir(minimoPermuta), cobrancaId: origem.cobrancaId, versaoCobranca: origem.versaoCobranca, moeda: origem.moeda }],
  };
}
