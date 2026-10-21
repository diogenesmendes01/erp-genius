"use client";
import { useRouter } from "next/navigation";
import { conciliarEnvioAssinatura, enviarContratoParaAssinatura } from "@/server/contratos/envio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { botaoClasses } from "@/components/Botao";
import { mensagemResultadoEnvio } from "./resultado-envio";

/** Envio: exige conferência registrada para a revisão atual. Conciliação: só para envio pendente. A ação revalida tudo. */
export function EnviarAssinatura(props: { matriculaId: string; servico: string } &
  ({ modo: "ENVIAR"; artefatoId: string; conferenciaId: string } | { modo: "CONCILIAR"; processoId: string })) {
  const router = useRouter(), acao = useAcaoCliente({ idempotente: true }), chave = useChaveIdempotencia();
  const enviar = props.modo === "ENVIAR";
  return <form className="space-y-3 rounded border p-4" onSubmit={async (e) => {
    e.preventDefault(); acao.limpar();
    const d = await acao.executar(() => props.modo === "ENVIAR"
      ? enviarContratoParaAssinatura({ matriculaId: props.matriculaId, artefatoId: props.artefatoId, conferenciaId: props.conferenciaId, chaveIdempotencia: chave.atual })
      : conciliarEnvioAssinatura({ matriculaId: props.matriculaId, processoId: props.processoId, chaveIdempotencia: chave.atual }), r => mensagemResultadoEnvio(r?.estado));
    chave.depoisDo(d);
    if (d?.tipo === "ok") router.refresh();
  }}>
    <p>Serviço: {props.servico}.</p>
    <p>{enviar ? "O original preservado e os participantes conferidos serão enviados uma única vez. Falha de comunicação não autoriza repetir o envio."
      : "A conciliação consulta o serviço pela tentativa registrada. Só uma resposta conclusiva altera o estado do processo."}</p>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={acao.ocupado}>{acao.ocupado ? "Aguarde…" : enviar ? "Enviar para assinatura" : "Conciliar envio"}</button>
  </form>;
}
