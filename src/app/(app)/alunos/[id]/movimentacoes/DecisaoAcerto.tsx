"use client";
import { decidirAcertoEncerramento } from "@/server/matricula/encerramento-decisao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
export function DecisaoAcerto({ alunoId, rascunhoId }: { alunoId: string; rascunhoId: string }) {
  // A decisão não recebe chave de idempotência; na falha de transporte vale a mensagem própria de decisão.
  const acao = useAcaoCliente({ idempotente: false });
  return <form onSubmit={async event => {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    const d = await acao.executar(() => decidirAcertoEncerramento({ alunoId, rascunhoId, aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")), autorizaRetroatividade: f.has("retro"), autorizaExcecaoMulta: f.has("multa") }),
      "Decisão registrada. Atualize a conferência para consultar o histórico. Encerramento ainda não efetivado.");
    if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
  }}><fieldset disabled={acao.ocupado} className="grid gap-2 border p-3"><legend>Decisão financeira independente</legend>
    <label>Decisão<select name="decisao" required defaultValue=""><option value="">Selecione</option><option value="aprovar">Aprovar acerto conferido</option><option value="rejeitar">Rejeitar esta versão</option></select></label>
    <label>Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} /></label>
    <label><input type="checkbox" name="retro" /> Autorizo a retroatividade identificada no pedido.</label>
    <label><input type="checkbox" name="multa" /> Autorizo as exceções de multa identificadas nesta versão.</label>
    <button className={botaoClasses({ tamanho: "lg" })}>Registrar decisão</button>
  </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></form>;
}
