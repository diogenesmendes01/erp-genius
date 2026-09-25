"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decidirMigracaoRegra, proporMigracaoRegra } from "@/server/avaliacoes/migracao-regra";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

export function ProporMigracao({ turmaId, destinoId, estadoHash, versaoEsperada }: {
  turmaId: string; destinoId: string; estadoHash: string; versaoEsperada: number;
}) {
  const router = useRouter(); const chave = useRef<string | null>(null);
  const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3" onChange={() => { chave.current = null; setMensagem(""); }} onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    chave.current ??= crypto.randomUUID(); setOcupado(true); setMensagem("");
    try {
      const r = await proporMigracaoRegra({ turmaId, destinoId, estadoHash, versaoEsperada, motivo: String(form.get("motivo") ?? ""), chaveIdempotencia: chave.current });
      if (!r.ok) setMensagem(r.erro); else { setMensagem("Proposta registrada. Outra pessoa autorizada poderá conferir e decidir."); router.refresh(); }
    } catch { setMensagem(MSG_RESULTADO_INCERTO); }
    finally { setOcupado(false); }
  }}>
    <fieldset disabled={ocupado} className="space-y-3"><legend className="font-medium">Encaminhar para decisão independente</legend>
      <label className="block">Motivo da mudança<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block"><input type="checkbox" required /> Conferi as versões e os impactos apresentados.</label>
      <button className={botaoClasses({ tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar proposta"}</button>
    </fieldset><MensagemStatus texto={mensagem} />
  </form>;
}

export function DecidirMigracao({ propostaId, estadoHash, podeAprovar }: { propostaId: string; estadoHash: string; podeAprovar: boolean }) {
  const router = useRouter(); const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3" onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget); setOcupado(true); setMensagem("");
    try {
      const r = await decidirMigracaoRegra({ propostaId, estadoHash, aprovada: form.get("decisao") === "aprovar", motivo: String(form.get("motivo") ?? "") });
      if (!r.ok) setMensagem(r.erro); else { setMensagem(r.dado?.aplicada ? "Mudança aprovada e aplicada." : "Proposta rejeitada."); router.refresh(); }
    } catch { setMensagem(MSG_DECISAO_INCERTA); }
    finally { setOcupado(false); }
  }}>
    <fieldset disabled={ocupado} className="space-y-3"><legend className="font-medium">Decisão desta proposta</legend>
      <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="">Selecione</option>{podeAprovar && <option value="aprovar">Aprovar e aplicar a mudança</option>}<option value="rejeitar">Rejeitar para revisão</option></select></label>
      <label className="block">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block"><input type="checkbox" required /> Conferi a proposta e seus impactos.</label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar decisão"}</button>
    </fieldset><MensagemStatus texto={mensagem} />
  </form>;
}
