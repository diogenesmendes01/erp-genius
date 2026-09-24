import type { consultarPreviaContinuidadeMensal } from "@/server/matricula/continuidade-previa";
import { formatarMoeda } from "@/lib/dinheiro";

type Resultado = Awaited<ReturnType<typeof consultarPreviaContinuidadeMensal>>;

const data = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${valor}T00:00:00Z`));

function mesReferencia(valor: string): string {
  const [ano, mes] = valor.split("-");
  return `${mes}/${ano}`;
}

function referenciaDoVencimento(coberturaInicio: string, vencimento: string): string {
  const [anoCobertura, mesCobertura] = coberturaInicio.split("-").map(Number);
  const [anoVencimento, mesVencimento] = vencimento.split("-").map(Number);
  const distancia = (anoVencimento - anoCobertura) * 12 + mesVencimento - mesCobertura;
  const descricao = distancia === -1
    ? "Mês anterior à cobertura"
    : distancia === 0
      ? "Mês da cobertura"
      : distancia === 1
        ? "Mês seguinte à cobertura"
        : "Mês calculado para o vencimento";
  return `${descricao} (${mesReferencia(vencimento)})`;
}

function situacaoOferta(estado: "INDISPONIVEL" | "PENDENTE_CONFERENCIA" | "SEM_RELATO"): string {
  if (estado === "INDISPONIVEL") return "Indisponibilidade confirmada";
  if (estado === "PENDENTE_CONFERENCIA") return "Relato pendente de conferência";
  return "Sem relato de indisponibilidade";
}

export function PreviaContinuidadeMensal({ resultado }: { resultado: Resultado }) {
  return <section className="space-y-3 rounded border p-4">
    <h2 className="text-lg">Prévia da próxima continuidade</h2>
    {!resultado.ok || !resultado.dado ? <p role="status">{resultado.ok ? "A prévia ainda não está disponível." : resultado.erro}</p> : <>
      <p>{resultado.dado.motivo}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div><dt className="font-medium">Próxima cobertura</dt><dd>{data(resultado.dado.plano.cobertura.inicio)} a {data(resultado.dado.plano.cobertura.fim)}</dd></div>
        <div><dt className="font-medium">Condição contratual usada</dt><dd>Versão {resultado.dado.memoriaPreco.referencia.versaoCondicoes}</dd></div>
        <div><dt className="font-medium">Referência do vencimento</dt><dd>{referenciaDoVencimento(resultado.dado.plano.cobertura.inicio, resultado.dado.plano.memoriaVencimento.dataCalculada)}</dd></div>
        <div><dt className="font-medium">Vencimento base calculado</dt><dd>{data(resultado.dado.plano.memoriaVencimento.dataCalculada)}</dd></div>
        <div><dt className="font-medium">Vencimento efetivo</dt><dd>{data(resultado.dado.plano.memoriaVencimento.dataAjustada)}</dd></div>
        <div><dt className="font-medium">Regra aplicada ao vencimento</dt><dd>{resultado.dado.plano.memoriaVencimento.regraAplicada === "MANTER_DATA" ? "Manter a data calculada" : "Prorrogar para o próximo dia útil"}</dd></div>
        <div><dt className="font-medium">Calendário financeiro</dt><dd>{resultado.dado.plano.memoriaVencimento.referenciaCalendarioAplicada ? `${resultado.dado.plano.memoriaVencimento.referenciaCalendarioAplicada.referencia} · versão ${resultado.dado.plano.memoriaVencimento.referenciaCalendarioAplicada.versao}` : "Não aplicado"}</dd></div>
        <div><dt className="font-medium">Marco calculado para emissão</dt><dd>{data(resultado.dado.plano.emissaoEm)}</dd></div>
        <div><dt className="font-medium">Situação do marco</dt><dd>{resultado.dado.plano.status === "PRONTA_PARA_EMISSAO" ? "Data alcançada; a emissão ainda depende do fluxo próprio" : "Aguardar a data calculada"}</dd></div>
        <div><dt className="font-medium">Preço de referência da preparação</dt><dd>{formatarMoeda(resultado.dado.memoriaPreco.referencia.valorOriginalReferencia, resultado.dado.plano.moeda)}</dd></div>
        <div><dt className="font-medium">Preço contratado na preparação</dt><dd>{formatarMoeda(resultado.dado.memoriaPreco.referencia.valorNegociadoPreparacao, resultado.dado.plano.moeda)}</dd></div>
        <div><dt className="font-medium">Preço original aplicado</dt><dd>{formatarMoeda(resultado.dado.plano.valorOriginal, resultado.dado.plano.moeda)}</dd></div>
        <div><dt className="font-medium">Preço negociado aplicado</dt><dd>{formatarMoeda(resultado.dado.plano.valorNegociado, resultado.dado.plano.moeda)}</dd></div>
        <div><dt className="font-medium">Oferta para a cobertura</dt><dd>{situacaoOferta(resultado.dado.oferta.estado)}</dd></div>
      </dl>
      <p>Comprovação de oferta: {resultado.dado.comprovacaoOferta.estado === "COMPROVADA_POR_AGENDA" ? "agenda e vínculo conferidos para o período" : resultado.dado.comprovacaoOferta.estado === "CONFIRMADA_PELA_GESTAO" ? "confirmada pela Gestão Pedagógica para o período" : resultado.dado.comprovacaoOferta.estado === "BLOQUEADA_POR_INDISPONIBILIDADE" ? "há indisponibilidade confirmada ou aguardando conferência" : "necessária confirmação específica da Gestão Pedagógica"}.</p>
      {resultado.dado.plano.memoriaCobertura?.origemRecomposicao && <p>Novo ciclo após compensação: referência em {data(resultado.dado.plano.memoriaCobertura.origemRecomposicao.dataReferencia)}. A origem é uma recomposição de cobertura já aplicada.</p>}
      {resultado.dado.plano.memoriaCobertura?.origemAditivo && <p>Ciclo definido por aditivo com acerto de cobertura aprovado. Referência: {resultado.dado.plano.memoriaCobertura.regraAplicada.referencia === "MES_CIVIL" ? "mês civil" : data(resultado.dado.plano.memoriaCobertura.regraAplicada.dataReferencia)}.</p>}
      <p>Esta é uma prévia de cálculo. Nenhuma cobrança será criada por esta consulta. A rotina de emissão confere novamente o contrato, o prazo e a oferta antes de emitir.</p>
    </>}
  </section>;
}
