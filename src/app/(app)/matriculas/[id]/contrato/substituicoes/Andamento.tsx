import Link from "next/link";
import type { carregarAndamentoSubstituicao } from "@/server/contratos/substituicao-andamento";

type Dados = Awaited<ReturnType<typeof carregarAndamentoSubstituicao>>;
const etapas: Record<Dados["etapa"], { titulo: string; descricao: string }> = {
  AGUARDANDO_APROVACAO: { titulo: "Aguardando aprovação", descricao: "Outra pessoa da Administração precisa conferir a proposta." },
  PROPOSTA_REJEITADA: { titulo: "Proposta rejeitada", descricao: "A decisão e os documentos permanecem no histórico." },
  PROPOSTA_SUPERADA: { titulo: "Proposta superada", descricao: "Existe uma versão mais recente para revisão." },
  CANCELAMENTO_NAO_INICIADO: { titulo: "Cancelamento não iniciado", descricao: "A proposta foi aprovada, mas ainda não há intenção de cancelamento registrada." },
  CANCELAMENTO_A_CONCILIAR: { titulo: "Cancelamento aguardando confirmação", descricao: "A intenção está registrada. Falta um retorno conclusivo; uma nova solicitação não deve ser feita antes da conciliação." },
  CONFIRMADO_AGUARDANDO_APLICACAO: { titulo: "Cancelamento confirmado; aplicação pendente", descricao: "Há confirmação preservada. As condições devem continuar válidas para encerrar o processo anterior no ERP e preparar o substituto." },
  SUBSTITUTO_PREPARADO: { titulo: "Novo processo preparado", descricao: "O processo anterior foi encerrado no ERP. O novo documento ainda não foi enviado para assinatura." },
  ENVIO_EM_ANDAMENTO: { titulo: "Envio iniciado", descricao: "Existe uma tentativa registrada para o novo documento; ainda falta o resultado do serviço de assinatura." },
  ENVIO_A_CONCILIAR: { titulo: "Envio com resultado incerto", descricao: "É necessário conferir o retorno do serviço antes de tentar outro envio." },
  SUBSTITUTO_ENVIADO: { titulo: "Novo documento enviado", descricao: "O envio está confirmado. Isso não comprova a conclusão das assinaturas nem o aceite pela Secretaria." },
  SUBSTITUTO_CANCELADO: { titulo: "Processo substituto encerrado", descricao: "Este processo também foi cancelado. Consulte seu histórico para acompanhar a continuidade." },
  CONFLITO_ASSINATURA: { titulo: "Assinatura anterior exige conferência", descricao: "Há conclusão de assinatura no processo anterior ou em sua cadeia. Preserve os documentos e encaminhe o caso à Administração para o tratamento contratual aplicável; novos envios e aceite do substituto ficam bloqueados." },
};
const data = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19) + " UTC";

export function AndamentoSubstituicao({ dados, matriculaId, propostaId }: { dados: Dados; matriculaId: string; propostaId: string }) {
  const texto = etapas[dados.etapa], base = `/matriculas/${encodeURIComponent(matriculaId)}/contrato/substituicoes/${encodeURIComponent(propostaId)}`;
  return <section className="space-y-3 rounded border p-4" aria-label="Andamento da substituição">
    <h2 className="text-xl">{texto.titulo}</h2><p role={dados.conflitoAssinatura ? "alert" : "status"}>{texto.descricao}</p>
    {dados.ambiente === "SANDBOX" && <p role="status">Ambiente de teste: estes registros não comprovam assinatura ou cancelamento em produção.</p>}
    {dados.intencao && <p>Intenção registrada por {dados.intencao.executor} em {data(dados.intencao.criadaEm)}.</p>}
    {dados.aplicacao && <p>Aplicação registrada por {dados.aplicacao.executor} em {data(dados.aplicacao.aplicadaEm)}. <Link className="underline" href={`/matriculas/${encodeURIComponent(matriculaId)}/contrato/originais/${encodeURIComponent(dados.aplicacao.artefatoSubstitutoId)}`}>Consultar o novo original e suas assinaturas</Link></p>}
    {dados.intencao && <section className="space-y-2"><h3 className="font-medium">Retornos preservados do cancelamento</h3>
      {dados.observacoes.length ? <ol className="list-inside list-decimal space-y-1">{dados.observacoes.map(o => <li key={o.id}>{data(o.registradaEm)} · {o.resultado === "CONFIRMADO" ? "Cancelamento confirmado" : "Resultado incerto"}</li>)}</ol> : <p>Nenhum retorno nesta página.</p>}
      <nav className="flex gap-4" aria-label="Páginas dos retornos">{dados.pagina > 1 && <Link href={`${base}?retornos=${dados.pagina - 1}`}>Retornos mais recentes</Link>}<span>Página {dados.pagina}</span>{dados.temProxima && <Link href={`${base}?retornos=${dados.pagina + 1}`}>Retornos anteriores</Link>}</nav>
    </section>}
  </section>;
}
