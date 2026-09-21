import { Prisma } from "@prisma/client";

/** Projeção operacional interna. A autorização e o vínculo matrícula/proposta
 * devem ser conferidos pelo chamador antes de consultar este histórico. */
export async function carregarAndamentoSubstituicao(tx: Prisma.TransactionClient, proposta: { id: string; processoFonteId: string; aprovada: boolean | null; superada: boolean }, pagina = 1) {
  const intencao = await tx.intencaoCancelamentoAssinatura.findUnique({ where: { propostaId: proposta.id }, select: {
    id: true, criadaEm: true, executor: { select: { nome: true } },
    aplicacao: { select: { aplicadaEm: true, executor: { select: { nome: true } }, processoSubstituto: { select: { id: true, artefatoId: true, estado: true } } } },
  } });
  const fonte = await tx.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: proposta.processoFonteId }, select: { ambiente: true, conclusao: { select: { id: true } } } });
  const [antecessor] = await tx.$queryRaw<{ existe: boolean }[]>`SELECT fonte_assinada_substituicao_218(${proposta.processoFonteId}) AS existe`;
  const conflitoAssinatura = !!fonte.conclusao || antecessor.existe;
  const observacoes = intencao ? await tx.observacaoCancelamentoAssinatura.findMany({ where: { intencaoId: intencao.id },
    orderBy: [{ registradaEm: "desc" }, { id: "desc" }], skip: (pagina - 1) * 20, take: 21,
    select: { id: true, resultado: true, registradaEm: true } }) : [];
  const confirmado = intencao ? await tx.observacaoCancelamentoAssinatura.count({ where: { intencaoId: intencao.id, resultado: "CONFIRMADO" } }) > 0 : false;
  const processo = intencao?.aplicacao?.processoSubstituto;
  const etapa = conflitoAssinatura ? "CONFLITO_ASSINATURA" as const
    : processo ? processo.estado === "PREPARADO" ? "SUBSTITUTO_PREPARADO" as const
      : processo.estado === "ENVIANDO" ? "ENVIO_EM_ANDAMENTO" as const
      : processo.estado === "ENVIO_INCERTO" ? "ENVIO_A_CONCILIAR" as const
      : processo.estado === "ENVIADO" ? "SUBSTITUTO_ENVIADO" as const : "SUBSTITUTO_CANCELADO" as const
    : confirmado ? "CONFIRMADO_AGUARDANDO_APLICACAO" as const
    : intencao ? "CANCELAMENTO_A_CONCILIAR" as const
    : proposta.aprovada === false ? "PROPOSTA_REJEITADA" as const
    : proposta.superada ? "PROPOSTA_SUPERADA" as const
    : proposta.aprovada ? "CANCELAMENTO_NAO_INICIADO" as const : "AGUARDANDO_APROVACAO" as const;
  return { etapa, conflitoAssinatura, cancelamentoConfirmado: confirmado, ambiente: fonte.ambiente,
    intencao: intencao ? { criadaEm: intencao.criadaEm, executor: intencao.executor.nome } : null,
    aplicacao: intencao?.aplicacao ? { aplicadaEm: intencao.aplicacao.aplicadaEm, executor: intencao.aplicacao.executor.nome,
      artefatoSubstitutoId: intencao.aplicacao.processoSubstituto.artefatoId } : null,
    observacoes: observacoes.slice(0, 20), pagina, temProxima: observacoes.length > 20 };
}
