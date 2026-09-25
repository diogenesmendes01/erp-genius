"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporRemarcacaoAgendaSegundaChamadaLocal } from "@/server/avaliacoes/segunda-chamada-remarcacao-local";
import { decidirRemarcacaoAgendaSegundaChamada } from "@/server/avaliacoes/segunda-chamada-remarcacao";
import { useInicioDoPeriodo } from "@/lib/periodo-form";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
type Props = {
 reservaId: string;
 estadoConferido: string;
 proposta?: { id: string; hash: string; podeAprovar: boolean; impedimentoAprovacao: string | null; periodosNaoLetivos: string[] };
};
export function Formulario({ reservaId, estadoConferido, proposta }: Props) {
 const router = useRouter(), trava = useRef(false), tentativa = useRef<{ entrada: string; chave: string } | null>(null);
 const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState(""), [decisao, setDecisao] = useState("");
 const periodo = useInicioDoPeriodo();
 return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
  e.preventDefault(); if (trava.current) return;
  const f = new FormData(e.currentTarget);
  trava.current = true; setOcupado(true); setErro("");
  try {
   let resultado;
   if (proposta) resultado = await decidirRemarcacaoAgendaSegundaChamada({
    propostaId: proposta.id,
    propostaHash: proposta.hash,
    aprovada: f.get("decisao") === "aprovar",
    autorizarDiaNaoLetivo: f.get("decisao") === "aprovar" && f.get("autorizarDiaNaoLetivo") === "on",
    motivo: String(f.get("motivo")),
   });
   else {
    const dados = { reservaId, estadoConferido, inicioLocal: String(f.get("inicioLocal")), fimLocal: String(f.get("fimLocal")), fusoOrigem: String(f.get("fusoOrigem")), motivo: String(f.get("motivo")), evidencia: String(f.get("evidencia")), motivoExcecaoNaoLetiva: String(f.get("motivoExcecaoNaoLetiva") ?? "").trim() || undefined };
    const entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    resultado = await proporRemarcacaoAgendaSegundaChamadaLocal({ ...dados, chaveIdempotencia: tentativa.current.chave });
   }
   if (!resultado.ok) setErro(resultado.erro); else router.refresh();
  } catch { setErro(MSG_RESULTADO_INCERTO); }
  finally { trava.current = false; setOcupado(false); }
 }}>
 <fieldset disabled={ocupado} className="space-y-3">
 {proposta ? <>
  <label className="block">Decisão<select name="decisao" required defaultValue="" onChange={e => setDecisao(e.target.value)} className="block border p-2"><option value="" disabled>Selecione</option>{proposta.podeAprovar && <option value="aprovar">Aprovar e remarcar</option>}<option value="rejeitar">Rejeitar</option></select></label>
  {!proposta.podeAprovar && <p className="text-sm" role="status">{proposta.impedimentoAprovacao ?? "A aprovação exige conferência de calendário registrada na proposta; esta versão histórica ainda pode ser rejeitada."}</p>}
  {proposta.periodosNaoLetivos.length > 0 && <label className="block"><input name="autorizarDiaNaoLetivo" type="checkbox" disabled={decisao !== "aprovar"} required={decisao === "aprovar"} /> Autorizar explicitamente a exceção para os {proposta.periodosNaoLetivos.length} período(s) não letivo(s) revisados.</label>}
 </> : <>
 <p>A proposta mantém o horário atual até outra pessoa autorizada aprovar. O prazo da avaliação e a oportunidade reservada permanecem os mesmos.</p>
 <label className="block">Novo início<input name="inicioLocal" type="datetime-local" required {...periodo.propsInicio} className="block border p-2" /></label>
 <label className="block">Novo término<input name="fimLocal" type="datetime-local" required min={periodo.min} className="block border p-2" /></label>
 <label className="block">Fuso dos horários<input name="fusoOrigem" required maxLength={100} placeholder="America/Sao_Paulo" className="block border p-2" /><span className="text-sm">Informe o fuso em que preencheu início e término.</span></label>
 <label className="block">Evidência<textarea name="evidencia" required minLength={5} maxLength={4000} className="block w-full border p-2" /></label>
 <label className="block">Justificativa de exceção não letiva, se o horário a atingir<textarea name="motivoExcecaoNaoLetiva" minLength={5} maxLength={2000} className="block w-full border p-2" /><span className="text-sm">Se houver período não letivo, esta justificativa será revisada e a aprovação exigirá autorização explícita.</span></label>
 </>}
 <label className="block">{proposta ? "Motivo da decisão" : "Motivo da remarcação"}<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full border p-2" /></label>
 <button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Salvando…" : proposta ? "Registrar decisão" : "Enviar proposta"}</button>
 </fieldset>{erro && <p role="alert">{erro}</p>}
 </form>;
}
