"use server";

import { carregarAplicacoesCamposTx } from "./aditivo-aplicacao-campos-tx";
import { projetarAplicacoesPorCampo } from "./aditivo-aplicacao-campos";
import { consultarAlvoPrimeiraMensalidadeTx } from "./aditivo-primeira-mensalidade";
import { CAMPOS_ADIANTAMENTO, consultarAlvoAdiantamentoTx } from "./aditivo-adiantamento";
import { consultarAlvoMoedaTx } from "./aditivo-moeda";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { hashSubstituicao } from "./substituicao-estado";
import { PrepararAditivoContratualSchema } from "./aditivo-schema";
import { planejarEfeitosAditivo } from "./aditivo-efeitos";

const id = z.string().trim().min(1).max(100);
const Alvo = z.object({ matriculaId: id, propostaId: id }).strict();

/** Revisão de valores preservados; não constitui autorização ou aplicação. */
export async function consultarEfeitosAditivo(input: z.input<typeof Alvo>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = Alvo.parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      const p = await tx.propostaAditivoContratual.findFirst({
        where: { id: d.propostaId, matriculaId: d.matriculaId },
        select: { snapshot: true, entradaHash: true, vigenciaInicio: true },
      });
      if (!p) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      if (hashSubstituicao(p.snapshot) !== p.entradaHash) throw new ErroRegra("A proposta preservada exige conferência de integridade.");
      const entrada = z.object({ entrada: PrepararAditivoContratualSchema }).parse(p.snapshot).entrada;
      if (entrada.matriculaId !== d.matriculaId) throw new ErroRegra("A proposta não corresponde à matrícula.");
      const alteracaoVencimento = entrada.alteracoes.find(a => a.origem === "PRIMEIRA_MENSALIDADE_VENCIMENTO");
      const primeiraMensalidade = alteracaoVencimento?.valorEstruturado
        ? await consultarAlvoPrimeiraMensalidadeTx(tx, d.matriculaId, alteracaoVencimento.valorEstruturado) : null;
      const aplicacaoVencimento = primeiraMensalidade ? await tx.aplicacaoVencimentoAditivo.findFirst({
        where: { decisao: { proposta: { matriculaId: d.matriculaId, propostaAditivoId: d.propostaId } } },
        orderBy: [{ aplicadaEm: "desc" }, { id: "desc" }],
        select: { id: true, aplicadaEm: true, vencimentoNovo: true },
      }) : null;
      const versaoFormalizada = await tx.versaoCondicoesAditivo.findUnique({ where: { propostaId: d.propostaId }, select: { id: true, versao: true, condicoes: true, vigenciaInicio: true } });
      // Q172: o alvo só existe depois de formalizadas as condições; antes disso a tela orienta pelo texto padrão.
      const alteraAdiantamento = entrada.alteracoes.some(a => (CAMPOS_ADIANTAMENTO as readonly string[]).includes(a.origem));
      const alvoAdiantamento = alteraAdiantamento && versaoFormalizada ? await consultarAlvoAdiantamentoTx(tx, d.matriculaId, versaoFormalizada.condicoes) : null;
      const aplicacaoAdiantamento = alteraAdiantamento ? await tx.aplicacaoAdiantamentoAditivo.findFirst({
        where: { decisao: { proposta: { matriculaId: d.matriculaId, propostaAditivoId: d.propostaId } } }, orderBy: [{ aplicadaEm: "desc" }, { id: "desc" }], select: { id: true, aplicadaEm: true },
      }) : null;
      // Q173: a troca de moeda tem acerto próprio no Financeiro, com a lista do que ainda impede a matrícula de estar "limpa".
      const alteraMoeda = entrada.alteracoes.some(a => a.origem === "MOEDA");
      const aplicacaoMoeda = alteraMoeda ? await tx.aplicacaoMoedaAditivo.findFirst({ where: { decisao: { proposta: { matriculaId: d.matriculaId, propostaAditivoId: d.propostaId } } }, select: { id: true, aplicadaEm: true } }) : null;
      const alvoMoeda = alteraMoeda && versaoFormalizada && !aplicacaoMoeda ? await consultarAlvoMoedaTx(tx, d.matriculaId, versaoFormalizada) : null;
      const provas = versaoFormalizada ? projetarAplicacoesPorCampo((await carregarAplicacoesCamposTx(tx, d.matriculaId)).filter(v => v.versao <= versaoFormalizada.versao)) : {};
      const aplicacoesCampos = entrada.alteracoes.map(a => ({ campo: a.origem, aplicada: !!provas[a.origem]?.aplicacaoId }));
      // Acertos de taxa comprovam somente as cobranças selecionadas; não liberam
      // a condição contratual enquanto o conjunto de impactos não estiver conferido.
      const acertosTaxaAplicados = entrada.alteracoes.some(a => a.origem === "TAXA_VALOR" || a.origem === "TAXA_VENCIMENTO")
        ? await tx.aplicacaoAcertoTaxaAditivo.count({ where: { proposta: { matriculaId: d.matriculaId, propostaAditivoId: d.propostaId } } }) : 0;
      const cobrancasExistentes = await tx.cobranca.count({ where: { matriculaId: d.matriculaId } });
      const aplicacao = await tx.aplicacaoCondicoesAditivo.findFirst({
        where: { matriculaId: d.matriculaId, propostaId: d.propostaId },
        select: { id: true, aplicadaEm: true, vigenciaInicio: true, condicoesHash: true,
          versaoCondicoes: { select: { condicoes: true, condicoesHash: true } } },
      });
      if (aplicacao && (hashSubstituicao(aplicacao.versaoCondicoes.condicoes) !== aplicacao.condicoesHash || aplicacao.condicoesHash !== aplicacao.versaoCondicoes.condicoesHash)) {
        throw new ErroRegra("A aplicação preservada exige conferência de integridade.");
      }
      return { ...planejarEfeitosAditivo(entrada.alteracoes, { cobrancaEmitida: cobrancasExistentes > 0 }), vigenciaInicio: p.vigenciaInicio,
        aplicacoesCampos, acertosTaxaAplicados,
        primeiraMensalidade: primeiraMensalidade ? { ...primeiraMensalidade, aplicacao: aplicacaoVencimento,
          pendencia: aplicacaoVencimento ? "Este aditivo possui acerto de vencimento aplicado. Consulte o histórico financeiro para conferir a cobrança atual." : primeiraMensalidade.pendencia } : null,
        moeda: alteraMoeda ? { formalizado: !!versaoFormalizada, aplicacao: aplicacaoMoeda, pendencias: alvoMoeda?.pendencias ?? [],
          pendencia: aplicacaoMoeda ? "Este aditivo possui troca de moeda aplicada. Novas cobranças nascem na moeda nova."
            : alvoMoeda?.pendencia ?? "A troca de moeda exige acerto financeiro próprio depois de formalizadas as condições do aditivo." } : null,
        adiantamento: alteraAdiantamento ? { formalizado: !!versaoFormalizada, aplicacao: aplicacaoAdiantamento,
          pendencia: aplicacaoAdiantamento ? "Este aditivo possui acerto de adiantamento aplicado. Consulte o histórico financeiro para conferir a cobrança atual."
            : alvoAdiantamento?.pendencia ?? "O adiantamento exige acerto financeiro próprio depois de formalizadas as condições do aditivo." } : null,
        aplicado: Boolean(aplicacao), aplicacao: aplicacao ? { id: aplicacao.id, aplicadaEm: aplicacao.aplicadaEm, vigenciaInicio: aplicacao.vigenciaInicio } : null };
    }, { isolationLevel: "RepeatableRead" });
  });
}
