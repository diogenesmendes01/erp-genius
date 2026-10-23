import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarDocumentosDesistenciaPreparacao } from "@/server/matricula/desistencia-documental";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { AMBIENTE_ASSINATURA_LABEL, ESTADO_ENVIO_ASSINATURA_LABEL, rotular } from "@/lib/labels";
import { consultarDesistenciaPreparacao } from "@/server/matricula/desistencia-preparacao";
import { consultarIntegracaoAssinatura } from "@/server/contratos/envio";
import { rotuloFornecedorAssinatura } from "@/server/contratos/provedor-assinatura";
import { AvisoAssinaturaSimulada } from "../../contrato/AvisoAssinaturaSimulada";
import { CancelarAssinatura } from "./CancelarAssinatura";

const cancelamentos = {
  NAO_INICIADO: "Nenhum cancelamento para substituição registrado.",
  PENDENTE_SEM_RESULTADO: "Cancelamento para substituição iniciado, ainda sem resultado registrado.",
  RESULTADO_INCERTO: "Cancelamento para substituição com resultado incerto.",
  RESULTADO_CONFIRMADO: "Resultado confirmado de cancelamento para substituição. Essa confirmação não autoriza a desistência.",
};
const cancelamentosDesistencia = {
  NAO_INICIADO: null,
  PENDENTE_SEM_RESULTADO: "Cancelamento por desistência iniciado, ainda sem resposta do serviço de assinatura.",
  RESULTADO_INCERTO: "Cancelamento por desistência com resultado incerto. Repita o cancelamento para conciliar com o serviço.",
  RESULTADO_CONFIRMADO: "O serviço de assinatura confirmou o cancelamento do envio pela desistência. Isso não efetiva a desistência.",
};

export default async function DocumentosDesistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const { id } = await params;
  const resposta = await consultarDocumentosDesistenciaPreparacao({ matriculaId: id });
  if (!resposta.ok || !resposta.dado) return <p role="alert">{resposta.ok ? "Conferência indisponível." : resposta.erro}</p>;
  const d = resposta.dado;
  // Cancelamento integrado: só com driver ativo, processo do mesmo serviço/ambiente enviado e sem conclusão,
  // e o pedido mais recente ainda não efetivado. A ação revalida decisão administrativa e acerto aplicado.
  const consultaIntegracao = await consultarIntegracaoAssinatura();
  const integracao = consultaIntegracao.ok ? consultaIntegracao.dado : null;
  const cancelavel = (p: typeof d.processos[number]) => !!integracao && p.estado === "ENVIADO" && !p.conclusaoRegistrada && p.referenciaExternaPresente
    && p.fornecedor === integracao.fornecedor && p.ambiente === integracao.ambiente;
  const preparacao = d.pedido && d.processos.some(cancelavel) ? await consultarDesistenciaPreparacao({ matriculaId: id }) : null;
  const pedidoAtual = preparacao?.ok && preparacao.dado && !preparacao.dado.efetivacao ? preparacao.dado.pedidos[0] ?? null : null;
  const cancelamento = pedidoAtual && pedidoAtual.id === d.pedido?.id ? { pedidoId: pedidoAtual.id, estadoHash: pedidoAtual.estadoHash } : null;
  const simulado = d.processos.some(p => p.fornecedor === "SIMULADO") || (!!cancelamento && !!integracao?.simulado);
  return <section className="space-y-5">
    <VoltarPara href={`/matriculas/${encodeURIComponent(id)}/desistencia`} para="Pedido de desistência" />
    <h1 className="text-2xl font-medium">Conferência documental · {d.matricula.codigo ?? "Matrícula em preparação"}</h1>
    <p>Confira os documentos e processos desta contratação. {cancelamento ? "O cancelamento de um envio aberto é uma ação própria em cada processo; nada aqui" : "Esta consulta não cancela assinaturas,"} não efetiva a desistência e não autoriza devolução de valores.</p>
    {!consultaIntegracao.ok && <p role="alert">{consultaIntegracao.erro}</p>}
    {simulado && <AvisoAssinaturaSimulada />}
    <p>{d.pedido ? `Pedido mais recente: versão ${d.pedido.versao}.` : "Ainda não existe pedido de desistência registrado."}</p>
    <section className="space-y-2 rounded border p-4"><h2 className="text-lg font-medium">Pendências documentais</h2>
      {d.possuiPendenciaDocumental ? <ul className="list-disc pl-5">{d.pendencias.map((p, i) => <li key={i}>{p}</li>)}</ul>
        : <p>Nenhuma pendência documental identificada nos registros consultados. A equipe ainda deve conferir os canais externos e os demais requisitos da desistência.</p>}
    </section>
    <section className="space-y-2"><h2 className="text-lg font-medium">Documentos registrados</h2>
      {!d.documentos.length ? <EstadoVazio>Nenhum documento registrado nesta matrícula.</EstadoVazio> : <ul className="list-disc pl-5">{d.documentos.map(doc => <li key={doc.id}>{doc.nome}</li>)}</ul>}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-medium">Processos de assinatura</h2>
      {!d.processos.length && <EstadoVazio>Nenhum processo de assinatura registrado nesta matrícula.</EstadoVazio>}
      {d.processos.map((p, i) => <article key={p.id} className="space-y-2 rounded border p-4">
        <h3 className="font-medium">Processo {i + 1} · {ESTADO_ENVIO_ASSINATURA_LABEL[p.estado]}</h3>
        <p>Serviço: {rotuloFornecedorAssinatura(p.fornecedor)} · Ambiente: {rotular(AMBIENTE_ASSINATURA_LABEL, p.ambiente)}</p>
        <p>{p.referenciaExternaPresente ? "Referência externa registrada." : "Sem referência externa registrada; isso não comprova ausência de envio."}</p>
        <p>{p.conclusaoRegistrada ? "Conclusão das assinaturas registrada; exige tratamento contratual próprio." : "Sem conclusão de assinaturas registrada nesta consulta."}</p>
        <p>{cancelamentos[p.cancelamentoSubstituicao.situacao]}</p>
        {cancelamentosDesistencia[p.cancelamentoDesistencia.situacao] && <p>{cancelamentosDesistencia[p.cancelamentoDesistencia.situacao]}</p>}
        {cancelamento && cancelavel(p) && <CancelarAssinatura pedidoId={cancelamento.pedidoId} processoId={p.id} estadoHash={cancelamento.estadoHash} />}
      </article>)}
    </section>
  </section>;
}
