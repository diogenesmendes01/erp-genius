import { Papel, Prisma } from "@prisma/client";
import { ErroPermissao, ErroRegra } from "@/server/_shared";
import { docenteAtual } from "@/server/diario/permissoes";
import { bloquearLancamento } from "./lancamento-tx";
import { NotasLancamentoSchema } from "./lancamento-schema";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { calcularNotasNivel, HABILIDADES } from "./calculo";
import { z } from "zod";
import { carregarAproveitamentoAplicadoTx } from "./aproveitamento-aplicado-tx";
import { carregarFontesEquivalenciaTx } from "./fontes-equivalencia-tx";

const chaveRequisito = (codigo: string, habilidade: string) => codigo + "\u0000" + habilidade;

export type ContextoConsolidadoAvaliacoesBloqueado = {
  alocacao: { id: string; matriculaId: string; turmaId: string };
  turma: {
    id: string;
    nivelId: string;
    regraAvaliacao: { id: string; versao: number; conteudo: unknown } | null;
  };
};

/** BASE_PLANO compara as fontes de notas da proposta aprovada. A realização ainda
 * sem nota não muda essa base nem invalida as demais etapas do próprio plano.
 * ACOMPANHAMENTO inclui essas pendências e deve ser usado na revisão do resultado. */
/**
 * Coleta interna sem autorização própria. O chamador deve, na mesma transação,
 * obter `alocacao` por `bloquearLancamento` e já ter autorizado a leitura.
 * Não aceite dados de vínculo, regra ou notas vindos do cliente neste ponto.
 */
export async function coletarConsolidadoAvaliacoesDoVinculoTx(
  tx: Prisma.TransactionClient,
  contexto: ContextoConsolidadoAvaliacoesBloqueado,
  finalidade: "BASE_PLANO" | "ACOMPANHAMENTO",
) {
      const { alocacao: a, turma: t } = contexto;
      if (t.id !== a.turmaId) throw new ErroRegra("O contexto da turma não corresponde ao vínculo conferido.");
      if (!t.regraAvaliacao) throw new ErroRegra("Confira a regra de avaliação da turma antes de consolidar.");
      const regra = ConteudoRegraAvaliacaoSchema.parse(t.regraAvaliacao.conteudo);
      const registros = await tx.registroAvaliacaoMatricula.findMany({ where: { matriculaId: a.matriculaId, turmaId: a.turmaId },
        select: { alocacaoId: true, regraId: true, codigoAvaliacao: true, versoes: { orderBy: { versao: "desc" }, take: 1,
          select: { id: true, notas: true, decisao: { select: { aprovada: true } }, propostasCorrecao: { where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" }, take: 1, select: { id: true, notas: true } } } } } });
      if (registros.some(r => r.alocacaoId !== a.id || r.regraId !== t.regraAvaliacao!.id)) throw new ErroRegra("Há registros de outro vínculo ou regra. Confira o aproveitamento antes de consolidar.");
      // Aproveitamento aplicado já é fonte acadêmica efetiva do vínculo de
      // destino. BASE_PLANO também o inclui para que recuperação posterior
      // compare a habilidade contra a base correta; a realização sem nota
      // continua excluída pela regra própria de BASE_PLANO abaixo.
      const aproveitamento = await carregarAproveitamentoAplicadoTx(tx, {
        matriculaId: a.matriculaId,
        alocacaoDestinoId: a.id,
        turmaDestinoId: a.turmaId,
        nivelDestinoId: t.nivelId,
        regraDestinoId: t.regraAvaliacao.id,
      }, (origem) => carregarFontesEquivalenciaTx(tx, origem));
      const aproveitamentoPorRequisito = new Map((aproveitamento?.itens ?? []).map((item) => [
        chaveRequisito(item.codigoAvaliacao, item.habilidade), item,
      ]));
      const fontes = regra.avaliacoes.map(av => {
        const v = registros.find(r => r.codigoAvaliacao === av.codigo)?.versoes[0];
        const correcao = v?.propostasCorrecao[0];
        const notas = v ? NotasLancamentoSchema.parse(correcao?.notas ?? v.notas) : [];
        return { codigo: av.codigo, titulo: av.titulo, lancamentoId: v?.id ?? null, correcaoId: correcao?.id ?? null, oficial: v?.decisao?.aprovada === true,
          etapa: av.etapa, peso: av.peso, notas: av.habilidades.map(habilidade => {
            const notaLocal = notas.find(n => n.habilidade === habilidade)?.nota ?? null;
            const aplicada = aproveitamentoPorRequisito.get(chaveRequisito(av.codigo, habilidade));
            // A nota local, quando oficial, já foi removida do aproveitamento
            // pelo coletor. Só a fonte aplicada ainda vigente entra onde não
            // há esse lançamento, sem duplicar o requisito.
            const notaAproveitada = aplicada?.situacao === "APROVEITADO" ? aplicada.notaParaConsolidado : null;
            return {
              habilidade,
              nota: v?.decisao?.aprovada === true ? notaLocal : (notaAproveitada ?? notaLocal),
              oficial: v?.decisao?.aprovada === true || notaAproveitada !== null,
            };
          }) };
      });
      const realizadas = await tx.realizacaoRecuperacao.findMany({
        where: { itemReserva: { reserva: { proposta: { alocacaoId: a.id, matriculaId: a.matriculaId, nivelId: t.nivelId, regraId: t.regraAvaliacao.id, decisao: { aprovada: true } } } }, ...(finalidade === "BASE_PLANO" ? { notas: { some: {} } } : {}) },
        orderBy: [{ realizadaEm: "asc" }, { id: "asc" }],
        include: { notas: { orderBy: { versao: "desc" }, take: 1, include: { decisao: true, correcoes: { where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" }, take: 1 } } }, itemReserva: { include: { reserva: { include: { proposta: true } } } } },
      });
      const recuperacoes = realizadas.map((r, index) => {
        const n = r.notas[0], p = r.itemReserva.reserva.proposta;
        return { id: r.id, planoAprovadoId: p.id, matriculaId: p.matriculaId, nivelId: p.nivelId, regraVersao: p.regraId, ordem: index + 1,
          habilidadesDoPlano: z.array(z.object({ habilidade: z.enum(HABILIDADES) })).parse(p.atividades).map(h => h.habilidade),
          notas: [{ habilidade: z.enum(HABILIDADES).parse(r.itemReserva.habilidade), nota: n?.correcoes[0]?.nota ?? n?.nota ?? null, oficial: n?.decisao?.aprovada === true }] };
      });
      const resultado = calcularNotasNivel({ matriculaId: a.matriculaId, nivelId: t.nivelId, regraVersao: t.regraAvaliacao.id,
        escala: regra.escala, minimoGeral: regra.minimoGeral, habilidades: regra.habilidades.map(({ habilidade, peso, minimo }) => ({ habilidade, peso, minimo })),
        avaliacoes: fontes.map(f => ({ id: f.codigo, etapa: f.etapa, peso: f.peso, notas: f.notas })),
        recuperacoes,
      });
      return { regraVersao: t.regraAvaliacao.versao, resultado,
        ...(realizadas.length ? { fontesRecuperacao: realizadas.map(r => ({ realizacaoId: r.id, notaId: r.notas[0]?.id ?? null, ...(r.notas[0]?.correcoes.length ? { correcaoId: r.notas[0].correcoes[0].id, correcaoHash: r.notas[0].correcoes[0].entradaHash } : {}), entradaHash: r.notas[0]?.entradaHash ?? null, decisaoId: r.notas[0]?.decisao?.id ?? null })) } : {}),
        fontes: fontes.map(({ codigo, titulo, lancamentoId, correcaoId, oficial }) => ({ codigo, titulo, lancamentoId, correcaoId, oficial })),
        ...(aproveitamento ? { aproveitamento: {
          aplicacaoId: aproveitamento.aplicacaoId,
          pendencias: aproveitamento.pendencias,
          conflitosLocais: aproveitamento.conflitosLocais,
          fontes: aproveitamento.fontesAproveitadas.flatMap((fonte) => fonte.tipoFonte === "APROVEITAMENTO" ? [{
            referenciaId: fonte.referenciaId, tipoFonte: fonte.tipoFonte, codigoAvaliacao: fonte.codigoAvaliacao,
            habilidade: fonte.habilidade, aplicacaoId: fonte.aplicacaoId,
            referenciaFonteAplicadaId: fonte.referenciaFonteAplicadaId, fonteHash: fonte.fonteHash,
          }] : []),
        } } : {}),
        estado: "ACOMPANHAMENTO_REGULAR" as const };
}

/** BASE_PLANO compara as fontes de notas da proposta aprovada. A realização ainda
 * sem nota não muda essa base nem invalida as demais etapas do próprio plano.
 * ACOMPANHAMENTO inclui essas pendências e deve ser usado na revisão do resultado. */
export async function carregarConsolidadoAvaliacoesTx(tx: Prisma.TransactionClient, autorId: string, id: string, finalidade: "BASE_PLANO" | "ACOMPANHAMENTO") {
      const a = await bloquearLancamento(tx, id);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
      if (!fresco?.ativo) throw new ErroPermissao();
      const t = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { vinculosDocentes: true, regraAvaliacao: true } });
      const gestao = fresco.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      if (!gestao && !(fresco.papeis.includes(Papel.PROFESSOR) && docenteAtual(autorId, t))) throw new ErroPermissao();
      return coletarConsolidadoAvaliacoesDoVinculoTx(tx, { alocacao: a, turma: t }, finalidade);
}
