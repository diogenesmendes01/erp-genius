"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { proporCancelamentoFinanceiroDesistenciaPreparacao, decidirCancelamentoFinanceiroDesistenciaPreparacao } from "@/server/matricula/desistencia-financeira";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

export function PropostaFormulario({ pedidoId, estadoHash }: { pedidoId: string; estadoHash: string }) {
  const router = useRouter();
  const [chave] = useState(() => crypto.randomUUID());
  const [ocupado, setOcupado] = useState(false), [concluido, setConcluido] = useState(false), [mensagem, setMensagem] = useState("");
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const dados = new FormData(event.currentTarget); setOcupado(true); setMensagem("");
    try {
      const r = await proporCancelamentoFinanceiroDesistenciaPreparacao({ pedidoId, estadoHash, motivo: String(dados.get("motivo") ?? ""), evidenciaCondicoes: String(dados.get("evidencia") ?? ""), chaveIdempotencia: chave });
      if (r.ok) { setConcluido(true); setMensagem("Proposta registrada. Outra pessoa autorizada deve decidir."); router.refresh(); } else setMensagem(r.erro);
    } catch { setMensagem(MSG_RESULTADO_INCERTO); } finally { setOcupado(false); }
  }
  return <form onSubmit={enviar} className="space-y-3 rounded border p-4"><h2 className="text-lg font-medium">Propor cancelamento das cobranças</h2>
    <p>A proposta abrange todas as cobranças pendentes ou atrasadas listadas. Valores e saldo históricos serão preservados; não haverá registro de pagamento.</p>
    <fieldset disabled={ocupado || concluido} className="space-y-3">
      <label className="block">Motivo<CampoTexto className="block w-full rounded border p-2" name="motivo" required minLength={10} maxLength={3000} /></label>
      <label className="block">Condições e evidências que autorizam o cancelamento integral<CampoTexto className="block w-full rounded border p-2" name="evidencia" required minLength={10} maxLength={3000} /></label>
      <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Submeter proposta financeira"}</button>
    </fieldset><MensagemStatus texto={mensagem} /></form>;
}

export function DecisaoFormulario({ propostaId, propostaHash, podeAprovar }: { propostaId: string; propostaHash: string; podeAprovar: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false), [concluido, setConcluido] = useState(false), [mensagem, setMensagem] = useState("");
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const dados = new FormData(event.currentTarget); setOcupado(true); setMensagem("");
    try {
      const r = await decidirCancelamentoFinanceiroDesistenciaPreparacao({ propostaId, propostaHash, aprovada: dados.get("decisao") === "aprovar", motivo: String(dados.get("motivo") ?? "") });
      if (r.ok) { setConcluido(true); setMensagem("Decisão registrada. A Secretaria efetiva a desistência após nova conferência."); router.refresh(); } else setMensagem(r.erro);
    } catch { setMensagem(MSG_DECISAO_INCERTA); } finally { setOcupado(false); }
  }
  return <form onSubmit={enviar} className="space-y-3"><fieldset disabled={ocupado || concluido} className="space-y-3">
    <label className="block">Decisão<select name="decisao" required className="ml-2 rounded border p-2"><option value="">Selecione</option>{podeAprovar && <option value="aprovar">Aprovar cancelamento integral</option>}<option value="rejeitar">Rejeitar proposta</option></select></label>
    {!podeAprovar && <p>Esta versão não pode ser aprovada. É possível registrar sua rejeição.</p>}
    <label className="block">Justificativa<CampoTexto name="motivo" required minLength={10} maxLength={3000} className="block w-full rounded border p-2" /></label>
    <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar decisão independente"}</button>
  </fieldset><MensagemStatus texto={mensagem} /></form>;
}
