import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import { obterFichaFinanceira } from "@/server/ajustes/consultas";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
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

  const f = await obterFichaFinanceira(id);
  if (!f) notFound();

  const moeda = f.cobrancas[0]?.moeda ?? f.aluno.matriculas[0]?.moeda ?? "";

  const dados: FichaFinanceiraDados = {
    aluno: { id: f.aluno.id, nome: f.aluno.nome, codigo: f.aluno.codigo, pais: f.aluno.pais.nome },
    responsavelFinanceiro: f.responsavelFinanceiro,
    situacaoAtrasado: f.emAtraso > 0,
    moeda,
    tiles: {
      proximoVenc: f.proximo ? { valor: f.proximo.valorNegociado, data: f.proximo.vencimento.toISOString() } : null,
      ultimoPago: f.ultimoPago
        ? {
            valor: f.ultimoPago.valorRecebido ?? f.ultimoPago.valorNegociado,
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
    cobrancas: f.cobrancas.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      status: c.status,
      valorNegociado: c.valorNegociado,
      moeda: c.moeda,
      vencimento: c.vencimento.toISOString(),
      pagoEm: c.pagoEm ? c.pagoEm.toISOString() : null,
      forma: c.formaPagamento,
    })),
    ajustes: f.ajustes.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      valorDe: a.valorDe,
      valorPara: a.valorPara,
      descontoValor: a.descontoValor,
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
