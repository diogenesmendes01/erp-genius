"use client";

import { useRouter } from "next/navigation";
import { conciliarEnvioAditivo, enviarAditivoParaAssinatura } from "@/server/contratos/aditivo-envio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { botaoClasses } from "@/components/Botao";
import { mensagemResultadoEnvio } from "../resultado-envio";

/** Envio/conciliação integrados do aditivo. A ação revalida processo, conferência e serviço ativo. */
export function EnvioAditivoFormulario({ matriculaId, propostaId, processoId, modo }: { matriculaId: string; propostaId: string; processoId: string; modo: "ENVIAR" | "CONCILIAR" }) {
  const router = useRouter(), acao = useAcaoCliente({ idempotente: true }), chave = useChaveIdempotencia(), enviar = modo === "ENVIAR";
  return <form className="space-y-2" onSubmit={async event => {
    event.preventDefault(); acao.limpar();
    const d = await acao.executar(() => (enviar ? enviarAditivoParaAssinatura : conciliarEnvioAditivo)({ matriculaId, propostaId, processoId, chaveIdempotencia: chave.atual }),
      r => mensagemResultadoEnvio(r?.estado));
    chave.depoisDo(d);
    if (d?.tipo === "ok") router.refresh();
  }}>
    <p>{enviar ? "O original preservado e os participantes conferidos serão enviados uma única vez. Falha de comunicação não autoriza repetir o envio."
      : "A conciliação consulta o serviço pela tentativa registrada. Só uma resposta conclusiva altera o estado do processo."}</p>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={acao.ocupado}>{acao.ocupado ? "Aguarde…" : enviar ? "Enviar aditivo para assinatura" : "Conciliar envio do aditivo"}</button>
  </form>;
}
