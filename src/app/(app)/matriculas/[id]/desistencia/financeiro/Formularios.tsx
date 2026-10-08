"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { proporCancelamentoFinanceiroDesistenciaPreparacao, decidirCancelamentoFinanceiroDesistenciaPreparacao } from "@/server/matricula/desistencia-financeira";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function PropostaFormulario({ pedidoId, estadoHash }: { pedidoId: string; estadoHash: string }) {
  const router = useRouter();
  const [chave] = useState(() => crypto.randomUUID());
  const [concluido, setConcluido] = useState(false);
  // Chave de idempotência estável: na falha de transporte, reenviar confere a mesma proposta (MSG_RESULTADO_INCERTO).
  const acao = useAcaoCliente({ idempotente: true });
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const dados = new FormData(event.currentTarget);
    const d = await acao.executar(
      () => proporCancelamentoFinanceiroDesistenciaPreparacao({ pedidoId, estadoHash, motivo: String(dados.get("motivo") ?? ""), evidenciaCondicoes: String(dados.get("evidencia") ?? ""), chaveIdempotencia: chave }),
      "Proposta registrada. Outra pessoa autorizada deve decidir.",
    );
    if (d?.tipo === "ok") { setConcluido(true); router.refresh(); }
  }
  return <form onSubmit={enviar} className="space-y-3 rounded border p-4"><h2 className="text-lg font-medium">Propor cancelamento das cobranças</h2>
    <p>A proposta abrange todas as cobranças pendentes ou atrasadas listadas. Valores e saldo históricos serão preservados; não haverá registro de pagamento.</p>
    <fieldset disabled={acao.ocupado || concluido} className="space-y-3">
      <label className="block">Motivo<CampoTexto className="block w-full rounded border p-2" name="motivo" required minLength={10} maxLength={3000} /></label>
      <label className="block">Condições e evidências que autorizam o cancelamento integral<CampoTexto className="block w-full rounded border p-2" name="evidencia" required minLength={10} maxLength={3000} /></label>
      <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Submeter proposta financeira"}</button>
    </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></form>;
}

export function DecisaoFormulario({ propostaId, propostaHash, podeAprovar }: { propostaId: string; propostaHash: string; podeAprovar: boolean }) {
  const router = useRouter();
  const [concluido, setConcluido] = useState(false);
  // Sem chave (a decisão é presa ao propostaHash); na falha de transporte, o texto fixo da decisão incerta.
  const acao = useAcaoCliente({ idempotente: false });
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const dados = new FormData(event.currentTarget);
    const d = await acao.executar(
      () => decidirCancelamentoFinanceiroDesistenciaPreparacao({ propostaId, propostaHash, aprovada: dados.get("decisao") === "aprovar", motivo: String(dados.get("motivo") ?? "") }),
      "Decisão registrada. A Secretaria efetiva a desistência após nova conferência.",
    );
    if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
    if (d?.tipo === "ok") { setConcluido(true); router.refresh(); }
  }
  return <form onSubmit={enviar} className="space-y-3"><fieldset disabled={acao.ocupado || concluido} className="space-y-3">
    <label className="block">Decisão<select name="decisao" required className="ml-2 rounded border p-2"><option value="">Selecione</option>{podeAprovar && <option value="aprovar">Aprovar cancelamento integral</option>}<option value="rejeitar">Rejeitar proposta</option></select></label>
    {!podeAprovar && <p>Esta versão não pode ser aprovada. É possível registrar sua rejeição.</p>}
    <label className="block">Justificativa<CampoTexto name="motivo" required minLength={10} maxLength={3000} className="block w-full rounded border p-2" /></label>
    <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Registrar decisão independente"}</button>
  </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></form>;
}
