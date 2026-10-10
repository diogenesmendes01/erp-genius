"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarPreferenciaFusoPortalAluno } from "@/server/portal-aluno/preferencia-fuso";
import { MensagemStatus } from "@/components/MensagemStatus";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { CampoFuso, validadeDoFuso, type SugestaoFuso } from "@/components/CampoFuso";

const destaques: readonly SugestaoFuso[] = [["America/Sao_Paulo", "Brasil — São Paulo"], ["America/Costa_Rica", "Costa Rica"], ["UTC", "UTC — horário universal"], ["US/Eastern", "Estados Unidos — Leste"]];

export function PreferenciasFusoPortalFormulario({ atual }: { atual: string | null }) {
  const [ocupado, iniciar] = useTransition(), [erro, setErro] = useState(""), [feito, setFeito] = useState(""), [fuso, setFuso] = useState(atual ?? ""); const router = useRouter();
  function enviar() {
    const fusoExibicao = fuso.trim(); setErro(""); setFeito("");
    // Mesma validação do campo e do servidor (fusoIanaValido); vazio é "sem preferência". Sem o jargão "IANA" (docs/42 L2652).
    const invalido = validadeDoFuso(fusoExibicao);
    if (invalido) { setErro(invalido); return; }
    iniciar(async () => { try { await salvarPreferenciaFusoPortalAluno({ fusoExibicao }); setFeito("Preferência salva."); router.refresh(); } catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); } });
  }
  return <form className="mt-5 space-y-3 rounded border bg-surface p-4" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
    <label className="block text-sm">Fuso de exibição<CampoFuso name="fusoExibicao" valor={fuso} onChange={setFuso} required={false} disabled={ocupado} placeholder="Usar fuso de origem" sugestoes={destaques} todos opcaoVazia="Usar fuso de origem do encontro" className="mt-1 block w-full rounded border p-2" /></label>
    <p className="text-sm text-gray-600">Pesquise pelo local ou identificador IANA. Sem preferência, os horários continuam no fuso de origem.</p><button disabled={ocupado} className="rounded border px-3 py-2 text-sm">{ocupado ? "Salvando…" : "Salvar"}</button><MensagemStatus texto={feito} />{erro && <p role="alert" className="text-red-700">{erro}</p>}
  </form>;
}
