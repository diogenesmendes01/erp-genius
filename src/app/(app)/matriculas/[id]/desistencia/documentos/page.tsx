import Link from "next/link";
import { EstadoEnvioAssinatura, Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarDocumentosDesistenciaPreparacao } from "@/server/matricula/desistencia-documental";

const estados: Record<EstadoEnvioAssinatura, string> = {
  PREPARADO: "Preparado para envio", ENVIANDO: "Envio em andamento", ENVIO_INCERTO: "Resultado do envio incerto",
  ENVIADO: "Enviado", CANCELADO: "Cancelamento registrado",
};
const cancelamentos = {
  NAO_INICIADO: "Nenhum cancelamento para substituição registrado.",
  PENDENTE_SEM_RESULTADO: "Cancelamento para substituição iniciado, ainda sem resultado registrado.",
  RESULTADO_INCERTO: "Cancelamento para substituição com resultado incerto.",
  RESULTADO_CONFIRMADO: "Resultado confirmado de cancelamento para substituição. Essa confirmação não autoriza a desistência.",
};

export default async function DocumentosDesistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const { id } = await params;
  const resposta = await consultarDocumentosDesistenciaPreparacao({ matriculaId: id });
  if (!resposta.ok || !resposta.dado) return <p role="alert">{resposta.ok ? "Conferência indisponível." : resposta.erro}</p>;
  const d = resposta.dado;
  return <section className="space-y-5">
    <Link className="underline" href={`/matriculas/${encodeURIComponent(id)}/desistencia`}>Voltar ao pedido de desistência</Link>
    <h1 className="text-2xl font-medium">Conferência documental · {d.matricula.codigo ?? "Matrícula em preparação"}</h1>
    <p>Confira os documentos e processos desta contratação. Esta consulta não cancela assinaturas, não efetiva a desistência e não autoriza devolução de valores.</p>
    <p>{d.pedido ? `Pedido mais recente: versão ${d.pedido.versao}.` : "Ainda não existe pedido de desistência registrado."}</p>
    <section className="space-y-2 rounded border p-4"><h2 className="text-lg font-medium">Pendências documentais</h2>
      {d.possuiPendenciaDocumental ? <ul className="list-disc pl-5">{d.pendencias.map((p, i) => <li key={i}>{p}</li>)}</ul>
        : <p>Nenhuma pendência documental identificada nos registros consultados. A equipe ainda deve conferir os canais externos e os demais requisitos da desistência.</p>}
    </section>
    <section className="space-y-2"><h2 className="text-lg font-medium">Documentos registrados</h2>
      {!d.documentos.length ? <p>Nenhum documento registrado nesta matrícula.</p> : <ul className="list-disc pl-5">{d.documentos.map(doc => <li key={doc.id}>{doc.nome}</li>)}</ul>}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-medium">Processos de assinatura</h2>
      {!d.processos.length && <p>Nenhum processo de assinatura registrado nesta matrícula.</p>}
      {d.processos.map((p, i) => <article key={p.id} className="space-y-2 rounded border p-4">
        <h3 className="font-medium">Processo {i + 1} · {estados[p.estado]}</h3>
        <p>Serviço: {p.fornecedor} · Ambiente: {p.ambiente === "SANDBOX" ? "Teste" : p.ambiente === "PRODUCAO" ? "Produção" : p.ambiente}</p>
        <p>{p.referenciaExternaPresente ? "Referência externa registrada." : "Sem referência externa registrada; isso não comprova ausência de envio."}</p>
        <p>{p.conclusaoRegistrada ? "Conclusão das assinaturas registrada; exige tratamento contratual próprio." : "Sem conclusão de assinaturas registrada nesta consulta."}</p>
        <p>{cancelamentos[p.cancelamentoSubstituicao.situacao]}</p>
      </article>)}
    </section>
  </section>;
}
