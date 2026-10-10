import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPropostasUsoCredito } from "@/server/financeiro/uso-credito-proposta";
import { consultarCabecalhoMatricula } from "@/server/matricula/cabecalho";
import { PropostaUsoCredito } from "./PropostaUsoCredito";
import { DevolucaoCredito } from "./DevolucaoCredito";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarDataCivil } from "@/lib/data-civil";
import { TIPO_COBRANCA_LABEL, rotular } from "@/lib/labels";
import { VoltarPara } from "@/components/VoltarPara";
import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro";

// Quem aprova uma utilização ou devolução de crédito vê de quem é o crédito (docs/42 L279; docs/43 §6 item 7):
// aluno e matrícula pelo cabeçalho de /matriculas/[id], e a cobrança de origem pelo código, não pelo id.
export default async function Page({ params }: { params: Promise<{ id: string; creditoId: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id, creditoId } = await params, r = await consultarPropostasUsoCredito({ alunoId: id, creditoId });
  const cabecalho = r.ok && r.dado ? await consultarCabecalhoMatricula(usuario, r.dado.matriculaId) : null;
  const origem = r.ok ? r.dado?.origemDesistencia?.cobranca ?? null : null;
  return <div className="space-y-4"><VoltarPara href={`/alunos/${id}`} para="Ficha do aluno" />
    <h1 className="text-2xl font-medium">Proposta de utilização de crédito</h1>
    {cabecalho && r.ok && r.dado && <IdentificacaoRegistro rotulo="Aluno e matrícula deste crédito" dados={{
      aluno: cabecalho.aluno, alunoHref: `/alunos/${encodeURIComponent(cabecalho.alunoId)}`, matriculaCodigo: cabecalho.codigo, matriculaComplemento: cabecalho.produto,
      registro: [`${r.dado.origemDesistencia ? "Crédito de acerto de desistência" : "Crédito da matrícula"} · saldo disponível ${formatarMoeda(r.dado.valorCredito, r.dado.moeda)}`],
    }} />}
    <p>Identifique a cobrança e a concordância do aluno. A proposta não reserva saldo. Outra pessoa do Financeiro com permissão de aprovação ou da Administração confere e aplica o abatimento, preservando os recebimentos em dinheiro.</p>
    {!r.ok && <p role="alert">{r.erro}</p>}{r.ok && r.dado && <>
      {r.dado.origemDesistencia && <section className="rounded border p-4 space-y-2" aria-label="Origem do crédito">
        <h2 className="font-medium">Crédito de acerto de desistência</h2>
        <p>Valor original: {formatarMoeda(r.dado.origemDesistencia.valorOriginal, r.dado.moeda)}. O crédito foi apurado em acerto aprovado; isso não comprova devolução de dinheiro.</p>
        <p>Cobrança de origem: {origem ? `${origem.codigo ?? "sem código"} · ${rotular(TIPO_COBRANCA_LABEL, origem.tipo)} · vencimento ${formatarDataCivil(origem.vencimento.slice(0, 10))}` : "consulte o acerto da matrícula"}.</p>
        <p>A aplicação e a decisão que geraram o crédito estão no acerto da matrícula.</p>
        <Link className="underline" href={`/matriculas/${r.dado.matriculaId}/desistencia/financeiro`}>Consultar o acerto da matrícula</Link>
      </section>}
      <PropostaUsoCredito dados={r.dado} /><DevolucaoCredito dados={r.dado} /></>}
  </div>;
}
