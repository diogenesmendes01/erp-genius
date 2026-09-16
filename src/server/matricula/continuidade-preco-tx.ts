import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { resolverMensalVigenteTx } from "@/server/contratos/aditivo-mensal-vigente";
import { exigirContratoAceito } from "./ativacao";
import { selecionarCondicaoContinuidadeVigente } from "./continuidade-condicao-vigente";
import { exigirPrecoPreparacaoAutorizado } from "./preco-autorizado";

const EntradaResolverPrecoSchema = z
  .object({
    matriculaId: z.string().min(1),
    inicioCobertura: z.date(),
    fimCobertura: z.date(),
  })
  .strict();

const ReferenciasPreparacaoSchema = z.object({
  alcada: z.object({
    componentes: z.array(
      z.object({
        tipo: z.string(),
        referencia: z.string().nullable(),
        proposto: z.string(),
      }),
    ),
  }),
  precos: z.array(
    z.object({
      tipoCobranca: z.string(),
      moeda: z.string(),
      valor: z.string(),
    }),
  ),
});

function dataCivil(data: Date): string {
  if (
    !Number.isFinite(data.getTime()) ||
    data.getUTCHours() !== 0 ||
    data.getUTCMinutes() !== 0 ||
    data.getUTCSeconds() !== 0 ||
    data.getUTCMilliseconds() !== 0
  ) {
    throw new ErroRegra("A cobertura da continuidade deve usar datas civis UTC.");
  }
  return data.toISOString().slice(0, 10);
}

function valorCanonico(valor: string, descricao: string): string {
  try {
    z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/).parse(valor);
    return new Prisma.Decimal(valor).toString();
  } catch {
    throw new ErroRegra(`${descricao} da preparação não é um decimal conferível.`);
  }
}

/**
 * Lê o preço mensal histórico, sem emitir cobrança. O chamador fornece a nova
 * cobertura e este loader aplica somente versões formalizadas de aditivo.
 */
export async function resolverPrecoContinuidadeMensalTx(
  tx: Prisma.TransactionClient,
  input: z.input<typeof EntradaResolverPrecoSchema>,
) {
  const dados = EntradaResolverPrecoSchema.parse(input);
  const inicioCivil = dataCivil(dados.inicioCobertura);
  dataCivil(dados.fimCobertura);
  if (dados.fimCobertura < dados.inicioCobertura) {
    throw new ErroRegra("Cobertura da continuidade inválida.");
  }

  const matricula = await tx.matricula.findUnique({
    where: { id: dados.matriculaId },
    select: {
      id: true,
      leadId: true,
      moeda: true,
      contratoOk: true,
      contratoDocumentoId: true,
      confirmacaoContratoEm: true,
      confirmacaoContratoPorId: true,
    },
  });
  if (!matricula) {
    throw new ErroRegra("Matrícula não encontrada.");
  }

  // O gate usa a memória imutável da preparação e sua decisão, não uma tabela
  // atual de referências comerciais.
  await exigirPrecoPreparacaoAutorizado(tx, matricula.id);
  const documentoId = await exigirContratoAceito(tx, matricula);

  const preparacao = await tx.preparacaoComercialMatricula.findUnique({
    where: { matriculaId: matricula.id },
    select: {
      id: true,
      regime: true,
      moeda: true,
      valorServicoProposto: true,
      referencias: true,
    },
  });
  if (!preparacao) {
    throw new ErroRegra(
      "A matrícula legada não possui fonte estruturada de preço mensal. Faça conferência específica.",
    );
  }
  if (preparacao.regime !== "MENSALIDADE" || preparacao.moeda !== matricula.moeda) {
    throw new ErroRegra("A fonte de preparação não corresponde a uma contratação mensal desta matrícula.");
  }

  const componentes = ReferenciasPreparacaoSchema.safeParse(preparacao.referencias);
  const mensalidades = componentes.success
    ? componentes.data.alcada.componentes.filter((componente) => componente.tipo === "MENSALIDADE")
    : [];
  if (mensalidades.length !== 1) {
    throw new ErroRegra("A preparação não possui uma referência mensal histórica conferível.");
  }

  const componente = mensalidades[0];
  const referenciasMensais = componentes.success
    ? componentes.data.precos.filter(
        (preco) => preco.tipoCobranca === "MENSALIDADE" && preco.moeda === matricula.moeda,
      )
    : [];
  if (referenciasMensais.length !== 1) {
    throw new ErroRegra("A preparação não possui uma referência mensal histórica conferível.");
  }
  const valorOriginalReferencia = valorCanonico(referenciasMensais[0].valor, "A referência mensal");
  const valorAlcada = valorCanonico(
    componente.referencia ?? componente.proposto,
    "A referência mensal da alçada",
  );
  if (valorAlcada !== valorOriginalReferencia) {
    throw new ErroRegra("A referência mensal diverge da análise de alçada preservada.");
  }
  const valorNegociadoPreparacao = valorCanonico(
    preparacao.valorServicoProposto.toString(),
    "O preço mensal proposto",
  );
  if (valorCanonico(componente.proposto, "O componente mensal proposto") !== valorNegociadoPreparacao) {
    throw new ErroRegra("O componente mensal diverge do preço preservado na preparação.");
  }

  const condicoesAprovadas = await tx.condicoesContinuidadeMensalMatricula.findMany({
    where: { matriculaId: matricula.id, status: "APROVADA" },
    select: {
      id: true,
      versao: true,
      documentoId: true,
      regras: true,
    },
  });
  const vigente = selecionarCondicaoContinuidadeVigente(condicoesAprovadas, inicioCivil);
  if (
    vigente.condicoes.documentoId !== documentoId ||
    vigente.regras.continuidadeContratada.evidenciaId !== documentoId ||
    vigente.regras.moeda !== matricula.moeda
  ) {
    throw new ErroRegra("A condição mensal aprovada não corresponde ao contrato confirmado.");
  }

  // A condição é transcrição do preço autorizado em sua própria vigência. Ela
  // não congela o valor para períodos posteriores, que podem ter aditivo válido.
  const inicioRegra = new Date(`${vigente.regras.vigenteDesde}T00:00:00.000Z`);
  const precoNaVigenciaDaRegra = await resolverMensalVigenteTx(tx, {
    matriculaId: matricula.id,
    inicioCobertura: inicioRegra,
    fimCobertura: inicioRegra,
    valorOriginal: valorOriginalReferencia,
    valorNegociadoOriginal: valorNegociadoPreparacao,
    moedaOriginal: matricula.moeda,
  });
  if (
    valorCanonico(vigente.regras.valorOriginal, "O valor original da condição") !==
      valorCanonico(precoNaVigenciaDaRegra.valorOriginal, "A referência autorizada") ||
    valorCanonico(vigente.regras.valorNegociado, "O valor negociado da condição") !==
      valorCanonico(precoNaVigenciaDaRegra.valorNegociado, "O preço autorizado")
  ) {
    throw new ErroRegra("A condição mensal não reproduz o preço autorizado na data de vigência.");
  }

  const preco = await resolverMensalVigenteTx(tx, {
    matriculaId: matricula.id,
    inicioCobertura: dados.inicioCobertura,
    fimCobertura: dados.fimCobertura,
    valorOriginal: valorOriginalReferencia,
    valorNegociadoOriginal: valorNegociadoPreparacao,
    moedaOriginal: matricula.moeda,
  });

  return {
    preco,
    referencia: {
      condicoesId: vigente.condicoes.id,
      versaoCondicoes: vigente.condicoes.versao,
      documentoId,
      preparacaoId: preparacao.id,
      valorOriginalReferencia,
      valorNegociadoPreparacao,
    },
  };
}
