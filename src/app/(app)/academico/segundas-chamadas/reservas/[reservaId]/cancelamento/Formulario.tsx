"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporCancelamentoAgendaSegundaChamadaLocal } from "@/server/avaliacoes/segunda-chamada-cancelamento-local";
import { decidirCancelamentoAgendaSegundaChamada } from "@/server/avaliacoes/segunda-chamada-cancelamento";
import { CampoFuso } from "@/components/CampoFuso";
import { PreviaConversao } from "@/components/PreviaConversao";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoSelect, CampoInstante, SelectItem } from "@/app/(app)/academico/controles";
type Props = { reservaId: string; estadoConferido: string; proposta?: { id: string; hash: string }; fusoInstitucional: string | null; fusoExibicao?: string };
export function Formulario({ reservaId, estadoConferido, proposta, fusoInstitucional, fusoExibicao }: Props) {
 const router = useRouter(), trava = useRef(false), tentativa = useRef<{ entrada: string; chave: string } | null>(null);
 const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
 const [dataHoraLocal, setDataHoraLocal] = useState(""), [fuso, setFuso] = useState(fusoInstitucional ?? "");
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
  } catch { setErro(MSG_RESULTADO_INCERTO); }
  finally { trava.current = false; setOcupado(false); }
 }}>
 <fieldset disabled={ocupado} className="space-y-3">
 {proposta ? <label className="block">Decisão<CampoSelect name="decisao" required defaultValue="" className="block border p-2" placeholder="Selecione"><SelectItem value={"aprovar"}>Aprovar e cancelar</SelectItem><SelectItem value={"rejeitar"}>Rejeitar</SelectItem></CampoSelect></label> : <>
 <p>Propor não cancela o encontro. Outra pessoa autorizada precisa revisar e aprovar.</p>
 <label className="block">Origem<CampoSelect name="origem" required defaultValue="" className="block border p-2" placeholder="Selecione"><SelectItem value={"ESCOLA"}>Escola</SelectItem><SelectItem value={"ALUNO"}>Aluno</SelectItem></CampoSelect></label>
 <label className="block">Data e hora da ocorrência<CampoInstante name="dataHoraLocal" step="0.001" required onChange={e => setDataHoraLocal(e.target.value)} className="block border p-2" /></label>
 <label className="block">Fuso da data informada<CampoFuso padrao={fusoInstitucional ?? ""} onChange={setFuso} className="block border p-2" /><span className="text-sm">Exemplo: America/Sao_Paulo ou America/Costa_Rica.</span></label>
 {fusoExibicao ? <PreviaConversao local={dataHoraLocal} fuso={fuso} fusoExibicao={fusoExibicao} /> : null}
 <label className="block">Evidência<CampoTexto name="evidencia" required minLength={5} maxLength={4000} className="block w-full border p-2" /></label>
 </>}
 <label className="block">{proposta ? "Motivo da decisão" : "Motivo do cancelamento"}<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full border p-2" /></label>
 <button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Salvando…" : proposta ? "Registrar decisão" : "Enviar proposta"}</button>
 </fieldset>{erro && <p role="alert">{erro}</p>}
 </form>;
}
