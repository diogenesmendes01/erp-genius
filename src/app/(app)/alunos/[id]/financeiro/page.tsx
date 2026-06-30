import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import { obterFichaFinanceira } from "@/server/ajustes/consultas";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { nomeCompleto } from "@/lib/nome";
import { FichaFinanceira, type FichaFinanceiraDados } from "./FichaFinanceira";

export default async function FichaFinanceiraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Ficha financeira do aluno: papéis que operam o financeiro (doc 07).
  // Guard ANTES de consultar cobranças/ajustes/comissões.
  const usuario = await exigirSessaoPagina(
    Papel.FINANCEIRO,
    Papel.SECRETARIA_ACADEMICA,
    Papel.GERENTE_COMERCIAL,
    Papel.VENDEDOR,
  );
  const tem = (...p: Papel[]) => temPapel(usuario, ...p);

  // Escopo row-level (doc 07): vendedor só vê a ficha de alunos ligados a ele;
  // fora do escopo → consulta devolve null → notFound (nunca dados de terceiros).
  const f = await obterFichaFinanceira(id, usuario);
  if (!f) notFound();

  const dados: FichaFinanceiraDados = {
    aluno: { id: f.aluno.id, nome: nomeCompleto(f.aluno), codigo: f.aluno.codigo, pais: f.aluno.pais.nome },
    responsavelFinanceiro: f.responsavelFinanceiro,
    situacaoAtrasado: f.emAtraso.some((v) => v.valor > 0),
    acessoBloqueado: f.acessoBloqueado,
    historico: f.historico,
    tiles: {
      proximoVenc: f.proximo
        ? { valor: f.proximo.valorNegociado, moeda: f.proximo.moeda, data: f.proximo.vencimento.toISOString() }
        : null,
      ultimoPago: f.ultimoPago
        ? {
            valor: f.ultimoPago.valorRecebido ?? f.ultimoPago.valorNegociado,
            moeda: f.ultimoPago.moeda,
            data: f.ultimoPago.pagoEm!.toISOString(),
            forma: f.ultimoPago.formaPagamento,
          }
        : null,
      emAberto: f.emAberto,
      emAtraso: f.emAtraso,
    },
    contrato: f.aluno.matriculas.map((m) => ({
      produto: `${m.produto.idioma.nome} · ${m.produto.modalidade.nome}`,
      moeda: m.moeda,
      status: m.status,
    })),
    cobrancas: f.cobrancas.map((c) => {
      const r = f.reguaPorCobranca.get(c.id) ?? null;
      return {
        id: c.id,
        tipo: c.tipo,
        status: c.status,
        valorNegociado: c.valorNegociado,
        valorRecebido: c.valorRecebido ?? 0,
        saldo: c.saldo ?? c.valorNegociado - (c.valorRecebido ?? 0),
        moeda: c.moeda,
        vencimento: c.vencimento.toISOString(),
        pagoEm: c.pagoEm ? c.pagoEm.toISOString() : null,
        forma: c.formaPagamento,
        regua: r
          ? {
              estado: r.estado,
              passo: r.passo,
              tipoAcao: r.tipoAcao,
              rotuloAcao: r.rotuloAcao,
              promessaAte: r.promessaAte,
              precisaBloqueio: r.precisaBloqueio,
              diasAtraso: r.diasAtraso,
              tentativas: r.tentativas,
            }
          : null,
      };
    }),
    ajustes: f.ajustes.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      valorDe: a.valorDe,
      valorPara: a.valorPara,
      descontoValor: a.descontoValor,
      moeda: a.moeda,
      motivo: a.motivo,
      autor: a.autor.nome,
      criadoEm: a.criadoEm.toISOString(),
      vigencia: a.vigencia,
    })),
    comissoes: f.comissoes.map((c) => ({
      id: c.id,
      vendedor: c.vendedor.nome,
      valor: c.valor,
      moeda: c.moeda,
      percentual: c.percentual,
      status: c.status,
    })),
    permissoes: {
      registrarPagamento: tem(Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA),
      renegociar: tem(Papel.FINANCEIRO, Papel.VENDEDOR),
      perdao: usuario.papeis.includes(Papel.ADMINISTRADOR),
    },
  };

  return <FichaFinanceira dados={dados} />;
}
