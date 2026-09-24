"use client";

import { useState, type FormEvent } from "react";
import { salvarConfiguracaoAvisosDiario } from "@/server/diario/avisos-pendencias-diario";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";

type Valores = { prazoRegularizacaoDiarioMinutos: number | null; intervaloLembreteDiarioMinutos: number | null };

export function AvisosDiarioFormulario({ valores }: { valores: Valores }) {
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    setOcupado(true); setMensagem("");
    try {
      const resultado = await salvarConfiguracaoAvisosDiario({
        prazoRegularizacaoDiarioMinutos: Number(form.get("prazoRegularizacaoDiarioMinutos")),
        intervaloLembreteDiarioMinutos: Number(form.get("intervaloLembreteDiarioMinutos")),
      });
      setMensagem(resultado.ok ? "Avisos do diário configurados." : resultado.erro);
    } catch {
      setMensagem("Não foi possível salvar os avisos do diário.");
    } finally { setOcupado(false); }
  }
  return <form onSubmit={salvar} className="space-y-3 rounded border p-4">
    <h2 className="font-medium">Avisos de pendências do diário</h2>
    <p className="text-sm text-gray-600">O prazo é contado a partir do término previsto da aula. O intervalo determina quando um novo lembrete pode aparecer no painel.</p>
    <fieldset disabled={ocupado} className="space-y-3">
      <label className="block text-sm">Prazo para regularização (minutos)<input className="mt-1 block w-full rounded border p-2" name="prazoRegularizacaoDiarioMinutos" type="number" min={1} max={2147483647} step={1} required defaultValue={valores.prazoRegularizacaoDiarioMinutos ?? ""} /></label>
      <label className="block text-sm">Intervalo entre lembretes (minutos)<input className="mt-1 block w-full rounded border p-2" name="intervaloLembreteDiarioMinutos" type="number" min={1} max={2147483647} step={1} required defaultValue={valores.intervaloLembreteDiarioMinutos ?? ""} /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "md" })} type="submit">{ocupado ? "Salvando…" : "Salvar avisos"}</button>
    </fieldset>
    <MensagemStatus texto={mensagem} className="text-sm" />
  </form>;
}
