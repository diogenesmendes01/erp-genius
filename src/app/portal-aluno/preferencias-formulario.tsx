"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarPreferenciaFusoPortalAluno } from "@/server/portal-aluno/preferencia-fuso";
import { MensagemStatus } from "@/components/MensagemStatus";

const destaques = [["America/Sao_Paulo", "Brasil — São Paulo"], ["America/Costa_Rica", "Costa Rica"], ["UTC", "UTC — horário universal"], ["US/Eastern", "Estados Unidos — Leste"]] as const;
function todosOsFusos() { try { return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []; } catch { return []; } }
function valido(valor: string) { if (!valor.trim()) return true; try { new Intl.DateTimeFormat("pt-BR", { timeZone: valor.trim() }); return true; } catch { return false; } }

export function PreferenciasFusoPortalFormulario({ atual }: { atual: string | null }) {
  const [ocupado, iniciar] = useTransition(), [erro, setErro] = useState(""), [feito, setFeito] = useState(""), [fuso, setFuso] = useState(atual ?? ""); const router = useRouter();
  const fusos = useMemo(todosOsFusos, []);
  function enviar() {
    const fusoExibicao = fuso.trim(); setErro(""); setFeito("");
    if (!valido(fusoExibicao)) { setErro("Escolha um fuso IANA válido, como America/Costa_Rica."); return; }
    iniciar(async () => { try { await salvarPreferenciaFusoPortalAluno({ fusoExibicao }); setFeito("Preferência salva."); router.refresh(); } catch { setErro("Não foi possível salvar a preferência. Confira sua sessão e o fuso informado."); } });
  }
  return <form className="mt-5 space-y-3 rounded border bg-surface p-4" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
    <label className="block text-sm">Fuso de exibição<input name="fusoExibicao" value={fuso} disabled={ocupado} onChange={(e) => setFuso(e.target.value)} list="fusos-portal" placeholder="Usar fuso de origem" className="mt-1 block w-full rounded border p-2" /></label>
    <datalist id="fusos-portal"><option value="">Usar fuso de origem do encontro</option>{destaques.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}{fusos.filter((f) => !destaques.some(([valor]) => valor === f)).map((f) => <option key={f} value={f} />)}</datalist>
    <p className="text-sm text-gray-600">Pesquise pelo local ou identificador IANA. Sem preferência, os horários continuam no fuso de origem.</p><button disabled={ocupado} className="rounded border px-3 py-2 text-sm">{ocupado ? "Salvando…" : "Salvar"}</button><MensagemStatus texto={feito} />{erro && <p role="alert" className="text-red-700">{erro}</p>}
  </form>;
}
