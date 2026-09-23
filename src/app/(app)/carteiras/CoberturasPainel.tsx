"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { concederCobertura, revogarCobertura } from "@/server/acesso/coberturas";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { useInicioDoPeriodo } from "@/lib/periodo-form";

export function CoberturasPainel({ vendedores, coberturas, preferenciaFusoExibicao = null }: { vendedores: { id: string; nome: string }[]; coberturas: { id: string; titular: string; substituto: string; inicio: string; fim: string; revogada: boolean; motivo: string }[]; preferenciaFusoExibicao?: string | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const periodo = useInicioDoPeriodo();
  const router = useRouter();
  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErro(null); setOcupado(true);
    const form = e.currentTarget; const dados = new FormData(form);
    try {
      const resultado = await concederCobertura({ titularId: String(dados.get("titularId")), substitutoId: String(dados.get("substitutoId")), inicio: new Date(String(dados.get("inicio"))).toISOString(), fim: new Date(String(dados.get("fim"))).toISOString(), motivo: String(dados.get("motivo")) });
      if (!resultado.ok) setErro(resultado.erro); else { form.reset(); router.refresh(); }
    } catch { setErro("Não foi possível registrar a cobertura. Confira o período."); } finally { setOcupado(false); }
  }
  async function revogar(id: string) { setErro(null); setOcupado(true); try { const r = await revogarCobertura(id); if (!r.ok) setErro(r.erro); else router.refresh(); } catch { setErro("Não foi possível revogar a cobertura. Tente novamente."); } finally { setOcupado(false); } }
  const estilo = "rounded border border-gray-300 p-2 text-sm";
  return <div className="space-y-5">
    <form onSubmit={salvar} className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
      {([['titularId', 'Titular da carteira'], ['substitutoId', 'Quem fará a cobertura']] as const).map(([name, label]) => <label key={name} className="grid gap-1 text-sm">{label}<select name={name} required className={estilo}><option value="">Selecione</option>{vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>)}
      <label className="grid gap-1 text-sm">Início<input name="inicio" type="datetime-local" required {...periodo.propsInicio} className={estilo} /></label>
      <label className="grid gap-1 text-sm">Fim<input name="fim" type="datetime-local" required min={periodo.min} className={estilo} /></label>
      <label className="grid gap-1 text-sm md:col-span-2">Motivo<input name="motivo" required minLength={5} maxLength={1000} className={estilo} /></label>
      <button disabled={ocupado} className="rounded bg-brand-solid px-4 py-2 text-sm text-white disabled:opacity-50">Conceder cobertura</button>
    </form>
    {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
    <ul className="space-y-2">{coberturas.map((c) => { const inicio = formatarInstanteExibicao(c.inicio, preferenciaFusoExibicao, "UTC"); const fim = formatarInstanteExibicao(c.fim, preferenciaFusoExibicao, "UTC"); return <li key={c.id} className="rounded border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{c.substituto} atende a carteira de {c.titular}</strong>{!c.revogada && <button disabled={ocupado} onClick={() => revogar(c.id)} className="text-brand-700">Revogar</button>}</div><p>{inicio.texto} até {fim.texto} (horário exibido em {inicio.fuso}; origem UTC){c.revogada ? " · Revogada" : ""}</p><p className="text-gray-500">{c.motivo}</p></li>; })}</ul>
    {!coberturas.length && <p className="text-sm text-gray-500">Nenhuma cobertura cadastrada.</p>}
  </div>;
}
