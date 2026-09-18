"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { executarAcao, ErroPermissao, exigirSessaoComPapel } from "@/server/_shared";
import { carregarFontesReconferenciaDeltaTx } from "./desistencia-reconferencia-delta-fontes";

const entrada = z.object({ matriculaId: z.string().trim().min(1).max(100) }).strict();
type ItemMemoria = { cobrancaId: string; moeda: string; ajusteDevido: string; ajusteSaldo: string; creditoDelta: string; reducaoCredito: string };
type CreditoExterno = { id: string; moeda: string; saldoDisponivel: string };

function memoriaPublica(memoria: unknown) {
  const dados = memoria && typeof memoria === "object" ? memoria as Record<string, unknown> : {};
  const itens = Array.isArray(dados.itens) ? dados.itens.filter((item): item is ItemMemoria =>
    !!item && typeof item === "object" && ["cobrancaId", "moeda", "ajusteDevido", "ajusteSaldo", "creditoDelta", "reducaoCredito"]
      .every(campo => typeof (item as Record<string, unknown>)[campo] === "string"),
  ) : [];
  const creditosExternos = Array.isArray(dados.creditosExternos) ? dados.creditosExternos.filter((credito): credito is CreditoExterno =>
    !!credito && typeof credito === "object" && ["id", "moeda", "saldoDisponivel"]
      .every(campo => typeof (credito as Record<string, unknown>)[campo] === "string"),
  ) : [];
  return {
    tipo: typeof dados.tipo === "string" ? dados.tipo : "PENDENCIA",
    pendencia: typeof dados.pendencia === "string" ? dados.pendencia : null,
    itens,
    creditosExternos,
  };
}

function orientacaoPendencia(pendencia: string | null) {
  const texto = pendencia?.toLocaleLowerCase("pt-BR") ?? "";
  if (texto.includes("informe")) return "Conclua a conferência do informe de pagamento no fluxo financeiro. Esta tela não transforma informe em caixa.";
  if (texto.includes("permuta")) return "A permuta exige destinação negociada e aprovada no fluxo próprio. Esta reconferência não escolhe nem cria destino.";
  if (texto.includes("redução de crédito")) return "A redução de crédito exige ajuste financeiro auditável antes de uma nova reconferência; não há crédito automático neste fluxo.";
  return "Regularize a pendência financeira indicada antes de preparar nova reconferência.";
}

/** Consulta financeira da cadeia delta; não expõe fotografia nem chaves. */
export async function consultarReconferenciaDeltaDesistencia(input: z.input<typeof entrada>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const { matriculaId } = entrada.parse(input);
    return prisma.$transaction(async tx => {
      await bloquearMatriculas(tx, [matriculaId]);
      const usuario = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { ativo: true, papeis: true, permissoes: true } });
      if (!usuario?.ativo || (!usuario.papeis.includes(Papel.FINANCEIRO) && !usuario.papeis.includes(Papel.ADMINISTRADOR))) throw new ErroPermissao();
      const efetivacao = await tx.efetivacaoPedidoDesistenciaPreparacao.findUnique({ where: { matriculaId }, select: { id: true } });
      if (efetivacao) return { podePreparar: false, aplicacoesBase: [], impedimento: "A desistência já foi efetivada." };
      const bases = await tx.aplicacaoAcertoDesistenciaContratual.findMany({
        where: { decisao: { proposta: { pedido: { matriculaId } } } }, orderBy: { criadaEm: "desc" }, take: 20,
        select: { id: true, criadaEm: true, memoria: true, reconferenciasDelta: { orderBy: [{ versao: "desc" }, { criadaEm: "desc" }], take: 20,
          select: { id: true, versao: true, estado: true, fotografiaHash: true, aplicacaoDeltaAnteriorId: true, preparadorId: true, criadaEm: true, preparador: { select: { nome: true } }, memoriaDelta: true,
            decisaoFinanceira: { select: { id: true, aprovada: true, motivo: true, decisorId: true, decisor: { select: { nome: true } } } },
            decisaoAdministrativa: { select: { id: true, aprovada: true, motivo: true, decisorId: true, decisor: { select: { nome: true } } } },
            aplicacao: { select: { id: true, criadaEm: true } },
          },
        } },
      });
      if (!bases.length) return { podePreparar: false, aplicacoesBase: [], impedimento: "Aplique primeiro a memória contratual Q165." };
      const podeAprovarFinanceiro = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos");
      return {
        podePreparar: true, impedimento: null,
        aplicacoesBase: await Promise.all(bases.map(async base => {
          const propostaVigente = base.reconferenciasDelta[0] ?? null;
          const [fontesAtuais, ultimaAplicacao] = await Promise.all([
            carregarFontesReconferenciaDeltaTx(tx, matriculaId, base.memoria),
            tx.aplicacaoReconferenciaDeltaDesistencia.findFirst({ where: { aplicacaoBaseId: base.id }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], select: { id: true } }),
          ]);
          const fontesMudaram = !!propostaVigente && (
            hashSubstituicao(fontesAtuais.fotografia) !== propostaVigente.fotografiaHash
            || (ultimaAplicacao?.id ?? null) !== propostaVigente.aplicacaoDeltaAnteriorId
          );
          const rejeitada = propostaVigente?.decisaoFinanceira?.aprovada === false || propostaVigente?.decisaoAdministrativa?.aprovada === false;
          const podePreparar = !propostaVigente || rejeitada || fontesMudaram;
          const preparoBloqueadoPor = !podePreparar && propostaVigente
            ? propostaVigente.estado === "PENDENCIA_FINANCEIRA"
              ? orientacaoPendencia(memoriaPublica(propostaVigente.memoriaDelta).pendencia)
              : "Há uma reconferência vigente aguardando decisão ou aplicação. Não prepare outra versão para a mesma fotografia."
            : null;
          return { id: base.id, criadaEmISO: base.criadaEm.toISOString(), podePreparar, preparoBloqueadoPor, propostas: base.reconferenciasDelta.map(proposta => {
          const memoria = memoriaPublica(proposta.memoriaDelta);
          const decisaoFinanceira = proposta.decisaoFinanceira, decisaoAdministrativa = proposta.decisaoAdministrativa;
          const vigente = proposta.id === propostaVigente?.id && !fontesMudaram;
          return { id: proposta.id, versao: proposta.versao, estado: proposta.estado, fotografiaHash: proposta.fotografiaHash, criadaEmISO: proposta.criadaEm.toISOString(), preparadorNome: proposta.preparador.nome,
            tipo: memoria.tipo, pendencia: memoria.pendencia, itens: memoria.itens, creditosExternos: memoria.creditosExternos,
            podeDecidirFinanceiro: vigente && !decisaoFinanceira && podeAprovarFinanceiro && proposta.preparadorId !== sessao.id && proposta.estado === "PENDENTE",
            podeDecidirAdministrativo: vigente && !decisaoAdministrativa && usuario.papeis.includes(Papel.ADMINISTRADOR) && proposta.preparadorId !== sessao.id && proposta.estado === "PENDENTE",
            podeAplicar: vigente && podeAprovarFinanceiro && !!decisaoFinanceira?.aprovada && !!decisaoAdministrativa?.aprovada && !proposta.aplicacao && decisaoFinanceira.decisorId === sessao.id && proposta.estado === "PENDENTE",
            decisaoFinanceira: decisaoFinanceira && { id: decisaoFinanceira.id, aprovada: decisaoFinanceira.aprovada, motivo: decisaoFinanceira.motivo, decisorNome: decisaoFinanceira.decisor.nome },
            decisaoAdministrativa: decisaoAdministrativa && { id: decisaoAdministrativa.id, aprovada: decisaoAdministrativa.aprovada, motivo: decisaoAdministrativa.motivo, decisorNome: decisaoAdministrativa.decisor.nome },
            aplicacao: proposta.aplicacao && { id: proposta.aplicacao.id, criadaEmISO: proposta.aplicacao.criadaEm.toISOString() },
          };
        }) };
        })),
      };
    });
  });
}
