"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consultarPropostasUsoCredito, proporUtilizacaoCredito } from "@/server/financeiro/uso-credito-proposta";
import { decidirUtilizacaoCredito } from "@/server/financeiro/uso-credito-decisao";
import { parseMoeda } from "@/lib/dinheiro";
import { CampoMoeda } from "@/components/CampoMoeda";
type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarPropostasUsoCredito>>, { ok: true }>["dado"]>;
const estilo = "block rounded border p-2";
export function PropostaUsoCredito({ dados }: { dados: Dados }) {
  const [erro, setErro] = useState(""); const [ocupado, iniciar] = useTransition(); const chave = useRef(""); const router = useRouter();
  const [valor, setValor] = useState("");
  return <div className="space-y-4"><p>Crédito disponível após utilizações aprovadas: {dados.valorCredito} {dados.moeda}.</p>
    {erro && <p role="alert">{erro}</p>}
    {!dados.cobrancas.length ? <p>Nenhuma cobrança em aberto disponível nesta matrícula.</p> : <form onChange={() => { chave.current = ""; }} onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget); chave.current ||= crypto.randomUUID(); const chaveIdempotencia = chave.current;
      iniciar(async () => { setErro(""); try {
        const numero = parseMoeda(valor); if (numero === null) { setErro("Informe um valor válido, com no máximo duas casas decimais."); return; }
        const r = await proporUtilizacaoCredito({ creditoId: dados.creditoId, cobrancaId: String(f.get("cobranca")), valor: numero.toFixed(2), concordancia: String(f.get("concordancia")), motivo: String(f.get("motivo")), chaveIdempotencia });
        if (!r.ok) { setErro(r.erro); return; } chave.current = ""; setValor(""); router.refresh();
      } catch { setErro("Consulte novamente antes de repetir: o resultado precisa ser conferido."); } });
    }}><fieldset disabled={ocupado} className="space-y-2"><legend>Nova proposta</legend>
      <label className="block">Cobrança da mesma matrícula<select name="cobranca" required defaultValue="" className={estilo}><option value="" disabled>Selecione</option>{dados.cobrancas.map(c => <option key={c.id} value={c.id}>{c.codigo ?? c.id} · saldo {c.saldo} {dados.moeda}</option>)}</select></label>
      <label className="block">Valor a utilizar<CampoMoeda name="valor" moeda={dados.moeda} value={valor} onChange={setValor} required className={estilo} /></label>
      <label className="block">Evidência da concordância do aluno<textarea name="concordancia" required minLength={5} maxLength={2000} className={estilo} /></label>
      <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className={estilo} /></label><button className={estilo}>Guardar proposta para conferência</button>
    </fieldset></form>}
    {dados.propostas.map(p => <article key={p.id} className="space-y-1 rounded border p-3"><h2>Proposta {p.versao} · {p.decisao ? p.decisao.aprovada ? "aplicada" : "rejeitada" : "aguardando decisão"}</h2><p>Cobrança: {dados.cobrancas.find(c => c.id === p.cobrancaId)?.codigo ?? p.cobrancaId}</p><p>{p.valor} {dados.moeda}</p><p>{p.concordancia}</p><p>{p.motivo}</p>
      {p.decisao && <p>Decisão: {p.decisao.motivo}</p>}
      {p.podeDecidir && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget);
        iniciar(async () => { setErro(""); try { const r = await decidirUtilizacaoCredito({ propostaId: p.id, aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")) }); if (!r.ok) { setErro(r.erro); return; } router.refresh(); } catch { setErro("Confira o resultado antes de repetir."); } });
      }}><fieldset disabled={ocupado} className="space-y-2"><label className="block">Decisão<select name="decisao" required defaultValue="" className={estilo}><option value="" disabled>Selecione</option><option value="aprovar">Aprovar e aplicar o abatimento</option><option value="rejeitar">Rejeitar proposta</option></select></label><label className="block">Justificativa<textarea required name="motivo" minLength={5} maxLength={2000} className={estilo} /></label><button className={estilo}>Confirmar decisão</button></fieldset></form>}
    </article>)}
  </div>;
}
