"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporCancelamentoAgendaSegundaChamadaLocal } from "@/server/avaliacoes/segunda-chamada-cancelamento-local";
import { decidirCancelamentoAgendaSegundaChamada } from "@/server/avaliacoes/segunda-chamada-cancelamento";
import { CampoFuso } from "@/components/CampoFuso";
type Props = { reservaId: string; estadoConferido: string; proposta?: { id: string; hash: string }; fusoInstitucional: string | null };
export function Formulario({ reservaId, estadoConferido, proposta, fusoInstitucional }: Props) {
 const router = useRouter(), trava = useRef(false), tentativa = useRef<{ entrada: string; chave: string } | null>(null);
 const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
 return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
  e.preventDefault(); if (trava.current) return;
  const f = new FormData(e.currentTarget);
  trava.current = true; setOcupado(true); setErro("");
  try {
   let resultado;
   if (proposta) resultado = await decidirCancelamentoAgendaSegundaChamada({ propostaId: proposta.id, propostaHash: proposta.hash, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")) });
   else {
    const dados = { reservaId, estadoConferido, origem: String(f.get("origem")) as "ESCOLA" | "ALUNO", dataHoraLocal: String(f.get("dataHoraLocal")), fuso: String(f.get("fuso")), motivo: String(f.get("motivo")), evidencia: String(f.get("evidencia")) };
    const entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    resultado = await proporCancelamentoAgendaSegundaChamadaLocal({ ...dados, chaveIdempotencia: tentativa.current.chave });
   }
   if (!resultado.ok) setErro(resultado.erro); else router.refresh();
  } catch { setErro("Resultado não confirmado. Confira o histórico antes de tentar novamente."); }
  finally { trava.current = false; setOcupado(false); }
 }}>
 <fieldset disabled={ocupado} className="space-y-3">
 {proposta ? <label className="block">Decisão<select name="decisao" required defaultValue="" className="block border p-2"><option value="" disabled>Selecione</option><option value="aprovar">Aprovar e cancelar</option><option value="rejeitar">Rejeitar</option></select></label> : <>
 <p>Propor não cancela o encontro. Outra pessoa autorizada precisa revisar e aprovar.</p>
 <label className="block">Origem<select name="origem" required defaultValue="" className="block border p-2"><option value="" disabled>Selecione</option><option value="ESCOLA">Escola</option><option value="ALUNO">Aluno</option></select></label>
 <label className="block">Data e hora da ocorrência<input name="dataHoraLocal" type="datetime-local" step="0.001" required className="block border p-2" /></label>
 <label className="block">Fuso da data informada<CampoFuso padrao={fusoInstitucional ?? ""} className="block border p-2" /><span className="text-sm">Exemplo: America/Sao_Paulo ou America/Costa_Rica.</span></label>
 <label className="block">Evidência<textarea name="evidencia" required minLength={5} maxLength={4000} className="block w-full border p-2" /></label>
 </>}
 <label className="block">{proposta ? "Motivo da decisão" : "Motivo do cancelamento"}<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full border p-2" /></label>
 <button disabled={ocupado} className="rounded border px-3 py-2">{ocupado ? "Salvando…" : proposta ? "Registrar decisão" : "Enviar proposta"}</button>
 </fieldset>{erro && <p role="alert">{erro}</p>}
 </form>;
}
