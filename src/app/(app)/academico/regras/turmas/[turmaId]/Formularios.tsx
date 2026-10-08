"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { decidirMigracaoRegra, proporMigracaoRegra } from "@/server/avaliacoes/migracao-regra";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";

export function ProporMigracao({ turmaId, destinoId, estadoHash, versaoEsperada }: {
  turmaId: string; destinoId: string; estadoHash: string; versaoEsperada: number;
}) {
  const router = useRouter(); const chave = useRef<string | null>(null);
  // Chave de idempotência estável entre tentativas: na falha de transporte, reenviar sem alterar (MSG_RESULTADO_INCERTO).
  const acao = useAcaoCliente({ idempotente: true });
  return <form className="space-y-3" onChange={() => { chave.current = null; acao.limpar(); }} onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const chaveIdempotencia = (chave.current ??= crypto.randomUUID());
    const d = await acao.executar(() => proporMigracaoRegra({ turmaId, destinoId, estadoHash, versaoEsperada, motivo: String(form.get("motivo") ?? ""), chaveIdempotencia }),
      "Proposta registrada. Outra pessoa autorizada poderá conferir e decidir.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <fieldset disabled={acao.ocupado} className="space-y-3"><legend className="font-medium">Encaminhar para decisão independente</legend>
      <label className="block">Motivo da mudança<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block"><input type="checkbox" required /> Conferi as versões e os impactos apresentados.</label>
      <button className={botaoClasses({ tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Registrar proposta"}</button>
    </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}

export function DecidirMigracao({ propostaId, estadoHash, podeAprovar }: { propostaId: string; estadoHash: string; podeAprovar: boolean }) {
  // Sem chave de idempotência; a decisão incerta mantém o texto próprio (reenviar a mesma decisão).
  const router = useRouter(); const acao = useAcaoCliente({ idempotente: false });
  return <form className="space-y-3" onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const d = await acao.executar(() => decidirMigracaoRegra({ propostaId, estadoHash, aprovada: form.get("decisao") === "aprovar", motivo: String(form.get("motivo") ?? "") }),
      (dado) => dado?.aplicada ? "Mudança aprovada e aplicada." : "Proposta rejeitada.");
    if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
    else if (d?.tipo === "ok") router.refresh();
  }}>
    <fieldset disabled={acao.ocupado} className="space-y-3"><legend className="font-medium">Decisão desta proposta</legend>
      <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="">Selecione</option>{podeAprovar && <option value="aprovar">Aprovar e aplicar a mudança</option>}<option value="rejeitar">Rejeitar para revisão</option></select></label>
      <label className="block">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block"><input type="checkbox" required /> Conferi a proposta e seus impactos.</label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Registrar decisão"}</button>
    </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
