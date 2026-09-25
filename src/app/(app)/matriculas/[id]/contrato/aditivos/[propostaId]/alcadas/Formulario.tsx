"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirAlcadaAditivo } from "@/server/contratos/aditivo-alcadas";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

type Alcada = "FINANCEIRA" | "COMERCIAL" | "PEDAGOGICA";

export function FormularioAlcada({ matriculaId, propostaId, propostaHash, alcada }: { matriculaId: string; propostaId: string; propostaHash: string; alcada: Alcada }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={event => { event.preventDefault(); const dados = new FormData(event.currentTarget), decisao = dados.get("decisao");
    if (decisao !== "aprovar" && decisao !== "rejeitar") { setMensagem("Escolha uma decisão."); return; }
    iniciar(async () => { try {
      const resultado = await decidirAlcadaAditivo({ matriculaId, propostaId, propostaHash, alcada, aprovada: decisao === "aprovar", motivo: String(dados.get("motivo") ?? "") });
      if (!resultado.ok) setMensagem(resultado.erro); else { setMensagem("Decisão de alçada registrada."); router.refresh(); }
    } catch { setMensagem(MSG_DECISAO_INCERTA); } });
  }}>
    <h2 className="text-xl">Decisão da alçada</h2>
    <fieldset disabled={pendente} className="space-y-2"><legend>Decisão</legend>
      <label className="block"><input type="radio" name="decisao" value="aprovar" /> Aprovar para a etapa seguinte</label>
      <label className="block"><input type="radio" name="decisao" value="rejeitar" /> Rejeitar</label>
    </fieldset>
    <label className="block">Justificativa<CampoTexto className="mt-1 block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={pendente} /></label>
    {mensagem && <p role="alert">{mensagem}</p>}<button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente}>{pendente ? "Registrando…" : "Registrar decisão"}</button>
  </form>;
}
