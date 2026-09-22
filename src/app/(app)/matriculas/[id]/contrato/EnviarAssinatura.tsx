"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { conciliarEnvioAssinatura, enviarContratoParaAssinatura } from "@/server/contratos/envio";

const textoEstado: Record<string, string> = {
  ENVIADO: "Documento registrado no serviço de assinatura. Isso ainda não comprova assinatura.",
  ENVIO_INCERTO: "O serviço não confirmou a criação. Não repita o envio: concilie o resultado antes de prosseguir.",
  PREPARADO: "O serviço confirmou que nada foi criado. Revise a pendência antes de enviar novamente.",
};

/** Envio: exige conferência registrada para a revisão atual. Conciliação: só para envio pendente. */
export function EnviarAssinatura(props: { matriculaId: string; servico: string; ambiente: string } &
  ({ modo: "ENVIAR"; artefatoId: string; conferenciaId: string } | { modo: "CONCILIAR"; processoId: string })) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const enviar = props.modo === "ENVIAR";
  return <form className="space-y-3 rounded border p-4" onSubmit={(e) => {
    e.preventDefault(); setMensagem("");
    iniciar(async () => {
      const r = props.modo === "ENVIAR"
        ? await enviarContratoParaAssinatura({ matriculaId: props.matriculaId, artefatoId: props.artefatoId, conferenciaId: props.conferenciaId })
        : await conciliarEnvioAssinatura({ matriculaId: props.matriculaId, processoId: props.processoId });
      if (!r.ok) setMensagem(r.erro); else { const estado = r.dado?.estado ?? ""; setMensagem(textoEstado[estado] ?? "Resultado registrado. Confira o estado do envio."); router.refresh(); }
    });
  }}>
    <p>Serviço: {props.servico}. Ambiente: {props.ambiente === "SANDBOX" ? "Teste — não comprova assinatura em produção" : "Produção"}.</p>
    <p>{enviar ? "O original preservado e os participantes conferidos serão enviados uma única vez. Falha de comunicação não autoriza repetir o envio."
      : "A conciliação consulta o serviço pela tentativa registrada. Só uma resposta conclusiva altera o estado do processo."}</p>
    {mensagem && <p role="status">{mensagem}</p>}
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Aguarde…" : enviar ? "Enviar para assinatura" : "Conciliar envio"}</button>
  </form>;
}
