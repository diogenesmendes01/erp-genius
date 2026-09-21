"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarCondicoesEntrada } from "@/server/secretaria/condicoes-entrada";
export function CondicoesFormulario({ matriculaId, pagadorId, versao, regime, temAdiantamento }: { matriculaId: string; pagadorId: string; versao: number; regime: string; temAdiantamento: boolean }) {
  const router = useRouter(), chave = useRef<string | null>(null), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  return <form className="space-y-3" onSubmit={async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget), texto = (n: string) => String(f.get(n) ?? ""); setOcupado(true); setErro("");
    try {
      chave.current ??= crypto.randomUUID();
      const aulas = regime === "MENSALIDADE" ? { regime: "MENSALIDADE" as const, cobertura: { referencia: texto("referencia") as "MES_CIVIL" | "CICLO_MATRICULA", inicio: texto("inicio") }, primeiroVencimento: texto("primeiro"), diaVencimentoContratado: Number(texto("dia")) } : { regime: "HORA_PARTICULAR" as const, ...(temAdiantamento ? { vencimentoAdiantamento: texto("adiantamento") } : {}) };
      const r = await registrarCondicoesEntrada({ matriculaId, pagadorRegistroId: pagadorId, versaoEsperada: versao, taxaVencimento: texto("taxa"), aulas, motivo: texto("motivo"), chaveIdempotencia: chave.current });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } catch { setErro("Resultado não confirmado. Reenvie os mesmos dados ou consulte o registro antes de alterar."); }
    finally { setOcupado(false); }
  }}>
    <h2 className="text-xl">Registrar condições</h2>
    <label className="block">Vencimento da taxa<input name="taxa" type="date" required className="ml-2 rounded border p-2" /></label>
    {regime === "MENSALIDADE" ? <>
      <label className="block">Referência da cobertura<select name="referencia" required defaultValue="" className="ml-2 rounded border p-2"><option value="">Selecione</option><option value="MES_CIVIL">Mês civil</option><option value="CICLO_MATRICULA">Ciclo da matrícula</option></select></label>
      <label className="block">Início da cobertura<input name="inicio" type="date" required className="ml-2 rounded border p-2" /></label>
      <p>Para mês civil, informe o primeiro dia do mês. Cobertura é separada do vencimento.</p>
      <label className="block">Primeiro vencimento<input name="primeiro" type="date" required className="ml-2 rounded border p-2" /></label>
      <label className="block">Dia de vencimento contratado<input name="dia" type="number" min="1" max="31" step="1" required className="ml-2 rounded border p-2" /></label>
    </> : temAdiantamento ? <label className="block">Vencimento do adiantamento<input name="adiantamento" type="date" required className="ml-2 rounded border p-2" /></label> : <p>Particular por hora sem antecipação: não será registrada uma mensalidade.</p>}
    <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block rounded border p-2" /></label>
    <button disabled={ocupado} className="rounded border p-2">{ocupado ? "Registrando…" : "Registrar condições de entrada"}</button>{erro && <p role="alert">{erro}</p>}
  </form>;
}
