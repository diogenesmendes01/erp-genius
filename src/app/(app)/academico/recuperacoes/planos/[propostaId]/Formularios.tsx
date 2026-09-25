"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { disponibilizarRecuperacaoLocal, realizarRecuperacaoLocal } from "@/server/avaliacoes/recuperacao-operacao-local";
import { reservarTentativaRecuperacao } from "@/server/avaliacoes/recuperacao-reserva";
import { cancelarReservaRecuperacaoPelaEscola } from "@/server/avaliacoes/recuperacao-cancelamento";
import type { HABILIDADES } from "@/server/avaliacoes/calculo";
import { CampoFuso } from "@/components/CampoFuso";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
type Habilidade = typeof HABILIDADES[number];
type Resposta = { ok: true; dado?: unknown } | { ok: false; erro: string };

export function Formulario({ titulo, executar, children }: { titulo: string; executar: (data: FormData) => Promise<Resposta>; children: React.ReactNode }) {
  const [erro, setErro] = useState(""), [enviando, setEnviando] = useState(false), router = useRouter();
  return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
    e.preventDefault(); if (enviando) return;
    const data = new FormData(e.currentTarget); setEnviando(true); setErro("");
    try { const r = await executar(data); if (!r.ok) setErro(r.erro); else router.refresh(); }
    catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); }
    finally { setEnviando(false); }
  }}><h3 className="font-medium">{titulo}</h3><fieldset disabled={enviando} className="space-y-3">{children}<button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="submit">{enviando ? "Registrando…" : titulo}</button></fieldset>{erro && <p role="alert">{erro}</p>}</form>;
}
export function Horario({ rotulo = "Data e horário efetivos", fusoInstitucional }: { rotulo?: string; fusoInstitucional: string | null }) {
  return <><label className="block">{rotulo}<input name="dataHora" type="datetime-local" step="0.001" required className="block rounded border p-2" /></label>
    <label className="block">Fuso desse horário<CampoFuso padrao={fusoInstitucional ?? ""} className="block rounded border p-2" /></label><p>Informe o fuso, por exemplo America/Sao_Paulo ou America/Costa_Rica. Horários ambíguos ou inexistentes precisam ser corrigidos.</p></>;
}
const campo = (d: FormData, nome: string) => String(d.get(nome) ?? "");
export function Disponibilizar({ propostaId, propostaHash, autorizacaoPreparacaoId, fusoInstitucional }: { propostaId: string; propostaHash: string; autorizacaoPreparacaoId?: string; fusoInstitucional: string | null }) {
  return <Formulario titulo="Registrar disponibilização" executar={d => disponibilizarRecuperacaoLocal({ propostaId, propostaHash, dataHora: campo(d, "dataHora"), fuso: campo(d, "fuso"), condicoes: campo(d, "condicoes"), evidenciaComunicacao: campo(d, "evidencia"), autorizacaoPreparacaoId })}>
    <Horario fusoInstitucional={fusoInstitucional} />
    <label className="block">Condições disponibilizadas ao aluno<textarea name="condicoes" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
    <label className="block">Evidência de comunicação ao aluno<textarea name="evidencia" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
export function Reservar({ propostaId, propostaHash, saldo }: { propostaId: string; propostaHash: string; saldo: { habilidade: Habilidade; disponiveis: number }[] }) {
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  return <Formulario titulo="Reservar tentativa" executar={async d => {
    const habilidades = saldo.filter(h => d.get(h.habilidade) === "on").map(h => h.habilidade), motivo = campo(d, "motivo");
    const entrada = JSON.stringify({ propostaId, propostaHash, habilidades, motivo });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const r = await reservarTentativaRecuperacao({ propostaId, propostaHash, habilidades, motivo, chaveIdempotencia: tentativa.current.chave });
    if (r.ok) tentativa.current = null;
    return r;
  }}>
    {saldo.map(h => <label key={h.habilidade} className="block"><input type="checkbox" name={h.habilidade} disabled={h.disponiveis === 0} /> {h.habilidade.replaceAll("_", " ")} — {h.disponiveis} disponíveis</label>)}
    <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
export function Realizar({ itemReservaId, professoresHistoricos = [], somenteHistorica = false, fusoInstitucional }: { itemReservaId: string; professoresHistoricos?: { id: string; nome: string }[]; somenteHistorica?: boolean; fusoInstitucional: string | null }) {
  const [realizadaPorId, setRealizadaPorId] = useState("");
  return <Formulario titulo={somenteHistorica ? "Registrar realização histórica" : "Registrar realização"} executar={d => realizarRecuperacaoLocal({ itemReservaId, realizadaPorId: realizadaPorId || undefined, motivoRegularizacao: realizadaPorId ? campo(d, "motivoRegularizacao") : undefined, dataHora: campo(d, "dataHora"), fuso: campo(d, "fuso"), evidencia: campo(d, "evidencia") })}>
    <MensagemStatus texto={somenteHistorica ? "Registre somente uma avaliação comprovadamente realizada antes da pausa ou do encerramento. Uma nova realização continua exigindo autorização específica vigente." : null} />
    <Horario rotulo={somenteHistorica ? "Data e horário históricos da realização" : undefined} fusoInstitucional={fusoInstitucional} />
    {professoresHistoricos.length > 0 && <label className="block">Quem realizou a avaliação?<select value={realizadaPorId} onChange={e => setRealizadaPorId(e.target.value)} className="block rounded border p-2"><option value="">Eu realizei</option>{professoresHistoricos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>}
    {realizadaPorId && <label className="block">Motivo da regularização<textarea name="motivoRegularizacao" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>}
    <label className="block">Evidência da avaliação realizada<textarea name="evidencia" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
export function CancelarPelaEscola({ reservaId }: { reservaId: string }) {
  return <Formulario titulo="Registrar cancelamento pela escola" executar={d => cancelarReservaRecuperacaoPelaEscola({ reservaId, motivo: campo(d, "motivo"), evidencia: campo(d, "evidencia") })}>
    <p>Libera somente habilidades ainda não realizadas. Use esta operação para cancelamento pela escola, não para falta ou cancelamento do aluno.</p>
    <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <label className="block">Evidência<textarea name="evidencia" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
