"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { decidirDesistenciaAdministrativa } from "@/server/matricula/desistencia-administrativa";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function DecisaoFormulario({ pedidoId, estadoHash, podeAprovar }: { pedidoId: string; estadoHash: string; podeAprovar: boolean }) {
  const router = useRouter();
  const [concluido, setConcluido] = useState(false);
  // Sem chave de idempotência (a decisão é presa ao estadoHash); na falha de transporte, o texto fixo
  // da decisão incerta (MSG_DECISAO_INCERTA) — erro em role="alert", sucesso em role="status".
  const acao = useAcaoCliente({ idempotente: false });
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dados = new FormData(event.currentTarget);
    const d = await acao.executar(
      () => decidirDesistenciaAdministrativa({ pedidoId, estadoHash, aprovada: dados.get("decisao") === "aprovar", motivo: String(dados.get("motivo") ?? "") }),
      "Decisão registrada. A efetivação ainda depende das conferências e dos tratamentos aplicáveis.",
    );
    if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
    if (d?.tipo === "ok") { setConcluido(true); router.refresh(); }
  }
  return <form onSubmit={enviar} className="space-y-3"><fieldset disabled={acao.ocupado || concluido} className="space-y-3">
    <label className="block">Decisão<select name="decisao" required className="ml-2 rounded border p-2"><option value="">Selecione</option>
      {podeAprovar && <option value="aprovar">Aprovar o pedido</option>}<option value="rejeitar">Rejeitar o pedido</option>
    </select></label>
    {!podeAprovar && <p>Esta versão não está disponível para aprovação. A rejeição pode ser registrada no histórico.</p>}
    <label className="block">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={3000} className="block w-full rounded border p-2" /></label>
    <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Registrar decisão administrativa"}</button>
  </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></form>;
}
