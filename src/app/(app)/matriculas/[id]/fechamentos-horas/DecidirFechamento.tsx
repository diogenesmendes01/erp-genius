"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { decidirFechamentoHoras } from "@/server/matricula/fechamento-horas-decisao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";

export function DecidirFechamento({ alunoId, matriculaId, rascunhoId }: { alunoId: string; matriculaId: string; rascunhoId: string }) {
  // A decisão não leva chave de idempotência; na falha de transporte vale a orientação própria (MSG_DECISAO_INCERTA).
  const router = useRouter(), acao = useAcaoCliente({ idempotente: false }), [decisao, setDecisao] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const d = await acao.executar(() => decidirFechamentoHoras({ alunoId, matriculaId, rascunhoId, aprovar: decisao === "APROVAR",
      confirmaReferenciaContratual: f.get("referencia") === "on", motivo: String(f.get("motivo")) }), "Decisão registrada. Nenhuma cobrança emitida.");
    if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
    if (d?.tipo === "ok") router.refresh();
  }}><fieldset disabled={acao.ocupado} className="space-y-3"><legend className="font-medium">Decisão independente</legend>
    <label className="block">Decisão<select className="block w-full rounded border p-2" required value={decisao} onChange={e => setDecisao(e.target.value)}>
      <option value="">Selecione</option><option value="APROVAR">Aprovar a proposta apresentada</option><option value="REJEITAR">Rejeitar a proposta</option>
    </select></label>
    {decisao === "APROVAR" && <label className="block"><input name="referencia" type="checkbox" required /> Conferi no contrato a referência, o período, o fuso e o vencimento propostos, além da escolha de aguardar ou propor emissão parcial.</label>}
    <label className="block">Justificativa<CampoTexto className="block w-full rounded border p-2" name="motivo" required minLength={5} maxLength={2000} /></label>
    <p>Aprovar revalida as origens. Se mudaram, prepare nova versão. A decisão não emite cobrança.</p>
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Registrar decisão"}</button>
  </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></form>;
}
