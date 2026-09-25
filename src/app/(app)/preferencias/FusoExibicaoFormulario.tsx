"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";

const destaques = [["America/Sao_Paulo", "Brasil — São Paulo"], ["America/Costa_Rica", "Costa Rica"], ["UTC", "UTC — horário universal"], ["US/Eastern", "Estados Unidos — Leste"]] as const;
function todosOsFusos() { try { return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []; } catch { return []; } }
function valido(valor: string) { if (!valor.trim()) return true; try { new Intl.DateTimeFormat("pt-BR", { timeZone: valor.trim() }); return true; } catch { return false; } }

export function FusoExibicaoFormulario({ atual }: { atual: string | null }) {
  const [fuso, setFuso] = useState(atual ?? ""); const router = useRouter();
  // Sem chave de idempotência (a action sobrescreve a preferência): resultado incerto manda conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false }), ocupado = acao.ocupado;
  const fusos = useMemo(() => todosOsFusos(), []);
  function enviar() {
    const fusoExibicao = fuso.trim();
    if (!valido(fusoExibicao)) { acao.setErro("Escolha um fuso IANA válido, como America/Sao_Paulo."); return; }
    void acao.executar(() => salvarPreferenciaFusoEquipe({ fusoExibicao }), "Preferência salva.").then((d) => { if (d?.tipo === "ok") router.refresh(); });
  }
  return <form className="space-y-3 rounded border bg-surface p-5" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
    <label className="block">Fuso de exibição<input name="fusoExibicao" value={fuso} disabled={ocupado} onChange={(e) => setFuso(e.target.value)} list="fusos-exibicao" placeholder="Usar fuso de origem" className="mt-1 block w-full rounded border p-2" /></label>
    <datalist id="fusos-exibicao"><option value="">Usar fuso de origem do encontro</option>{destaques.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}{fusos.filter((f) => !destaques.some(([valor]) => valor === f)).map((f) => <option key={f} value={f} />)}</datalist>
    <p className="text-sm text-gray-600">Pesquise pelo local ou identificador IANA. Sem preferência, cada encontro continua no fuso de origem. Isso não altera calendário, cobrança ou mensagens.</p>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Salvando…" : "Salvar preferência"}</button>
  </form>;
}
