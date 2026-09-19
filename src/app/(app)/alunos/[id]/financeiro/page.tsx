import Link from "next/link";
import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import { obterFichaFinanceira, obterResumoComercialFinanceiro } from "@/server/ajustes/consultas";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { nomeCompleto } from "@/lib/nome";
import { ResumoFinanceiroComercial } from "./ResumoFinanceiroComercial";
import { InformesPagamento } from "@/app/(app)/financeiro/InformesPagamento";
import { AcessoAulasPainel } from "@/app/(app)/financeiro/AcessoAulasPainel";
import { listarInformesPagamento } from "@/server/financeiro/consultas";
import { prisma } from "@/lib/prisma";
import { FichaFinanceira, type FichaFinanceiraDados } from "./FichaFinanceira";
import { ConcluirMatriculas } from "./ConcluirMatriculas";
import { RetomadasPainel } from "@/app/(app)/financeiro/RetomadasPainel";
import { listarContextoRetomada, listarPropostasRetomada } from "@/server/retomada/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";

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
  const operacional = tem(Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
  if (!operacional) {
    const resumo = await obterResumoComercialFinanceiro(id, usuario);
    if (!resumo) notFound();
    return <ResumoFinanceiroComercial dados={resumo} />;
  }
  const [f, informes, concessoes, contextoRetomada, propostasRetomada, preferencia] = await Promise.all([
    obterFichaFinanceira(id, usuario), listarInformesPagamento(id),
    prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id }, select: { permissoes: true } }),
    listarContextoRetomada(id), listarPropostasRetomada(id),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!f) notFound();
  const podeVerRegularizacaoIntegral = usuario.papeis.includes(Papel.FINANCEIRO) || usuario.papeis.includes(Papel.ADMINISTRADOR);

  const dados: FichaFinanceiraDados = {
    aluno: { id: f.aluno.id, nome: nomeCompleto(f.aluno), codigo: f.aluno.codigo, pais: f.aluno.pais.nome },
    responsavelFinanceiro: f.responsavelFinanceiro,
    situacaoAtrasado: f.emAtraso.some((v) => v.valor > 0),
    acessoBloqueado: f.acessoBloqueado,
    historico: f.historico,
    tiles: {
      proximoVenc: f.proximo
        ? { valor: f.proximo.valorNegociado, moeda: f.proximo.moeda, vencimento: f.referenciaVencimentoPorCobranca.get(f.proximo.id) ?? { estado: "A_CONFERIR", motivo: "A referência civil deste vencimento não foi carregada." } }
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
      const aplicacao = c.aplicacoesPeriodoIntegral[0] ?? null;
      const escolhaRegularizacao = aplicacao?.decisao.proposta.escolha;
      return {
        compensacaoHref: tem(Papel.FINANCEIRO) && c.tipo === "MENSALIDADE" && c.coberturaInicio && c.coberturaFim
          ? `/matriculas/${c.matriculaId}/compensacoes/${c.id}` : undefined,
        regularizacaoIntegral: podeVerRegularizacaoIntegral && aplicacao && (escolhaRegularizacao === "CREDITO" || escolhaRegularizacao === "COBERTURA_FUTURA") ? {
          escolha: escolhaRegularizacao,
          aplicadaEm: aplicacao.aplicadaEm.toISOString(),
          href: `/matriculas/${c.matriculaId}/compensacoes/${c.id}/periodo-integral`,
        } : undefined,
        id: c.id,
        tipo: c.tipo,
        status: c.status,
        valorNegociado: c.valorNegociado,
        valorRecebido: c.valorRecebido ?? 0,
        saldo: c.saldo ?? c.valorNegociado - (c.valorRecebido ?? 0),
        moeda: c.moeda,
        vencimento: f.referenciaVencimentoPorCobranca.get(c.id) ?? { estado: "A_CONFERIR", motivo: "A referência civil deste vencimento não foi carregada." },
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
      tipo: c.tipo,
      status: c.status,
    })),
    permissoes: {
      registrarPagamento: tem(Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA),
      somenteInformar: !tem(Papel.FINANCEIRO) && !concessoes.permissoes.includes("pagamento.caixa"),
      renegociar: tem(Papel.FINANCEIRO, Papel.VENDEDOR),
      perdao: usuario.papeis.includes(Papel.ADMINISTRADOR),
    },
  };

  const mostrarRetomada = !contextoRetomada.ok || !propostasRetomada.ok || contextoRetomada.dado?.status === "PAUSADO" || (propostasRetomada.dado?.length ?? 0) > 0;
  return <div className="space-y-8">
    <FichaFinanceira dados={dados} />
    <Link className="block text-sm text-brand-700 underline" href={`/alunos/${id}/movimentacoes`}>Pausa, retomada e encerramento por matrícula</Link>
    {tem(Papel.FINANCEIRO) && f.aluno.matriculas.map(m => <Link key={m.id} href={`/matriculas/${m.id}/ocorrencias-financeiras`} className="block underline">Conferir particulares da matrícula {m.codigo ?? m.id}</Link>)}
    {mostrarRetomada && <RetomadasPainel
      contexto={contextoRetomada.ok ? contextoRetomada.dado ?? null : null}
      propostas={propostasRetomada.ok ? propostasRetomada.dado ?? [] : []}
      erroConsulta={!contextoRetomada.ok ? contextoRetomada.erro : !propostasRetomada.ok ? propostasRetomada.erro : null}
    />}
    <AcessoAulasPainel alunoId={id} /><InformesPagamento informes={informes} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} />
    <ConcluirMatriculas matriculas={f.aluno.matriculas.filter((m) => m.status === "AGUARDANDO" || m.status === "RASCUNHO").map((m) => ({ id: m.id, nome: `${m.codigo ?? "Matrícula"} · ${m.produto.idioma.nome} · ${m.produto.modalidade.nome}` }))} />
    {tem(Papel.SECRETARIA_ACADEMICA) && f.aluno.matriculas.map((m) => <Link key={m.id} className="block text-sm text-brand-700 underline" href={`/secretaria?matriculaId=${m.id}`}>Consultar cadastro e confirmação documental da matrícula {m.codigo}</Link>)}
  </div>;
}
