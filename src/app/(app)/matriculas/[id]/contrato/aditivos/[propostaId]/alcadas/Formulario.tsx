"use client";

import { useRouter } from "next/navigation";
import { decidirAlcadaAditivo } from "@/server/contratos/aditivo-alcadas";
import { botaoClasses } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";

type Alcada = "FINANCEIRA" | "COMERCIAL" | "PEDAGOGICA";

export function FormularioAlcada({ matriculaId, propostaId, propostaHash, alcada }: { matriculaId: string; propostaId: string; propostaHash: string; alcada: Alcada }) {
  // A decisão não leva chave; na falha de transporte vale a mensagem própria de decisão (MSG_DECISAO_INCERTA).
  const router = useRouter(), acao = useAcaoCliente({ idempotente: false });
  return <form className="space-y-3 rounded border p-4" onSubmit={async event => { event.preventDefault(); const dados = new FormData(event.currentTarget), decisao = dados.get("decisao");
    if (decisao !== "aprovar" && decisao !== "rejeitar") { acao.limpar(); acao.setErro("Escolha uma decisão."); return; }
    const d = await acao.executar(() => decidirAlcadaAditivo({ matriculaId, propostaId, propostaHash, alcada, aprovada: decisao === "aprovar", motivo: String(dados.get("motivo") ?? "") }), "Decisão de alçada registrada.");
    if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
    if (d?.tipo === "ok") router.refresh();
  }}>
    <h2 className="text-xl">Decisão da alçada</h2>
    <fieldset disabled={acao.ocupado} className="space-y-2"><legend>Decisão</legend>
      <label className="block"><input type="radio" name="decisao" value="aprovar" /> Aprovar para a etapa seguinte</label>
      <label className="block"><input type="radio" name="decisao" value="rejeitar" /> Rejeitar</label>
    </fieldset>
    <label className="block">Justificativa<CampoTexto className="mt-1 block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={acao.ocupado} /></label>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={acao.ocupado}>{acao.ocupado ? "Registrando…" : "Registrar decisão"}</button>
  </form>;
}
