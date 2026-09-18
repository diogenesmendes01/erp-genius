"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { prepararAcertoDesistenciaContratual, decidirAcertoDesistenciaContratual } from "@/server/matricula/desistencia-acerto-contratual";
import { aplicarAcertoDesistenciaContratual } from "@/server/matricula/desistencia-acerto-aplicacao";

function useOperacao() {
  const router = useRouter(), chave = useRef(crypto.randomUUID());
  const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  return { ocupado, mensagem, async executar(acao: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    setOcupado(true); setMensagem("");
    try { const r = await acao(); if (!r.ok) setMensagem(r.erro ?? "Não foi possível concluir a operação."); else { setMensagem(sucesso); chave.current = crypto.randomUUID(); router.refresh(); } }
    catch { setMensagem("Não foi possível confirmar o resultado. Reenvie os mesmos dados para conferir a operação."); }
    finally { setOcupado(false); }
  }, chave };
}

export function PrepararAcertoContratualFormulario({ pedidoId, condicoesId, reapresentacao }: { pedidoId: string; condicoesId: string; reapresentacao?: { id: string; versao: number; aprovada: boolean } | null }) {
  const op = useOperacao();
  return <form className="space-y-3 rounded border p-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void op.executar(() => prepararAcertoDesistenciaContratual({ pedidoId, condicoesId, motivo: String(f.get("motivo") ?? ""), ...(reapresentacao ? { anteriorId: reapresentacao.id, motivoReapresentacao: String(f.get("motivoReapresentacao") ?? "") } : {}), chaveIdempotencia: op.chave.current }), "Memória contratual preparada. Outra pessoa autorizada deve decidir."); }}>
    <h2 className="text-lg font-medium">Preparar acerto pela regra contratual</h2><p>A memória reúne todas as cobranças, recebimentos, créditos já apurados e a versão contratual vigente. Não altera valores nesta etapa.</p>
    {reapresentacao && <p role="status">Reapresentação da versão {reapresentacao.versao}, antes {reapresentacao.aprovada ? "aprovada" : "rejeitada"}. Se foi aprovada, o servidor exige fotografia financeira ou condição contratual diferente antes de gravar a nova versão.</p>}
    <fieldset disabled={op.ocupado}><label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label>{reapresentacao && <label className="mt-2 block">Motivo da reapresentação<textarea name="motivoReapresentacao" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label>}<button className="mt-3 rounded border px-3 py-2">{op.ocupado ? "Preparando…" : reapresentacao ? "Reapresentar memória contratual" : "Preparar memória contratual"}</button></fieldset>{op.mensagem && <p role="status">{op.mensagem}</p>}
  </form>;
}

export function DecidirAcertoContratualFormulario({ propostaId, fotografiaHash }: { propostaId: string; fotografiaHash: string }) {
  const op = useOperacao();
  return <form className="space-y-3" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void op.executar(() => decidirAcertoDesistenciaContratual({ propostaId, fotografiaHash, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo") ?? ""), chaveIdempotencia: op.chave.current }), "Decisão independente registrada."); }}>
    <fieldset disabled={op.ocupado}><label>Decisão<select name="decisao" required className="ml-2 rounded border p-2"><option value="">Selecione</option><option value="aprovar">Aprovar acerto</option><option value="rejeitar">Rejeitar acerto</option></select></label><label className="mt-2 block">Justificativa<textarea name="motivo" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label><button className="mt-3 rounded border px-3 py-2">{op.ocupado ? "Registrando…" : "Registrar decisão independente"}</button></fieldset>{op.mensagem && <p role="status">{op.mensagem}</p>}
  </form>;
}

export function AplicarAcertoContratualFormulario({ decisaoId }: { decisaoId: string }) {
  const op = useOperacao();
  return <div className="space-y-2"><p>A aplicação ajusta os valores aprovados e cria crédito somente para excedente comprovado. A Secretaria ainda efetiva a desistência.</p><button disabled={op.ocupado} className="rounded border px-3 py-2" onClick={() => void op.executar(() => aplicarAcertoDesistenciaContratual({ decisaoId, chaveIdempotencia: op.chave.current }), "Acerto aplicado. A Secretaria pode efetivar a desistência.")}>{op.ocupado ? "Aplicando…" : "Aplicar acerto aprovado"}</button>{op.mensagem && <p role="status">{op.mensagem}</p>}</div>;
}
