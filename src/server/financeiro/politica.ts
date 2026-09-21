import { Prisma, TipoCobranca } from "@prisma/client";
import { ErroRegra, type UsuarioSessao } from "@/server/_shared";
import { acimaDaAlcada, calcularPoliticaComissao } from "./regras";

export async function limitesAtuais(tx: Prisma.TransactionClient, autor: UsuarioSessao) {
  const usuario = await tx.usuario.findUnique({ where: { id: autor.id }, select: {
    ativo: true, limiteDescontoTaxaPct: true, limiteDescontoMensalidadePct: true, alcadaAlteradaEm: true,
  } });
  if (!usuario?.ativo) throw new ErroRegra("Usuário inativo.");
  return usuario;
}

export function exigeAprovacaoComponente(limites: { limiteDescontoTaxaPct: Prisma.Decimal | null; limiteDescontoMensalidadePct: Prisma.Decimal | null }, tipo: TipoCobranca, referencia: Prisma.Decimal.Value, valor: Prisma.Decimal.Value) {
  const limite = tipo === TipoCobranca.MATRICULA ? limites.limiteDescontoTaxaPct : tipo === TipoCobranca.MENSALIDADE ? limites.limiteDescontoMensalidadePct : null;
  return acimaDaAlcada(referencia, valor, limite);
}

export async function resolverComissao(tx: Prisma.TransactionClient, params: { paisId: string; produtoId: string; taxa: number; moeda: string; agora?: Date }) {
  const agora = params.agora ?? new Date();
  const regras = await tx.politicaComissao.findMany({ where: {
    paisId: params.paisId, produtoId: params.produtoId, vigenteEm: { lte: agora },
    OR: [{ encerraEm: null }, { encerraEm: { gt: agora } }],
  } });
  if (regras.length !== 1) throw new ErroRegra(regras.length ? "Há políticas de comissão sobrepostas para esta oferta." : "Configure a política de comissão desta oferta antes de matricular.");
  const regra = regras[0];
  const valor = calcularPoliticaComissao(regra, params.taxa, params.moeda);
  return { regra, valor, memoria: {
    politicaId: regra.id, versao: regra.versao, tipo: regra.tipo, base: regra.base,
    valorBase: params.taxa, percentual: regra.percentual?.toNumber() ?? null,
    valorFixo: regra.valorFixo?.toNumber() ?? null, moeda: params.moeda, valor: valor.toNumber(),
    calculadaEm: agora.toISOString(),
  } };
}
