"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepararJanelaAdmissao, decidirJanelaAdmissao } from "@/server/matricula/janela-admissao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";

export function JanelaFormulario({ turmaId, versaoAnterior, fusoConferido }: { turmaId: string; versaoAnterior: number; fusoConferido: string }) {
  const router = useRouter(), tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  const [limiteEntrada, setLimite] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = { turmaId, versaoAnterior, fusoConferido, limiteEntrada, motivo }, assinatura = JSON.stringify(dados);
    if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    iniciar(async () => {
      setErro("");
      try {
        const r = await prepararJanelaAdmissao({ ...dados, chaveIdempotencia });
        if (!r.ok) { setErro(r.erro); return; }
        router.refresh();
      } catch { setErro(MSG_RESULTADO_INCERTO); }
    });
  }
  return <form onSubmit={enviar} className="space-y-3 rounded border p-4"><h2 className="font-medium">Preparar nova janela</h2>
    <p>Data final incluída, no fuso {fusoConferido}. A regra vigente só muda após aprovação independente.</p>
    <fieldset disabled={ocupado} className="space-y-3">
      <label className="block">Último dia para nova admissão<input type="date" required value={limiteEntrada} onChange={(e) => setLimite(e.target.value)} className="mt-1 block rounded border bg-[var(--surface)] p-2" /></label>
      <label className="block">Motivo da janela<CampoTexto required minLength={5} maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 block w-full rounded border bg-[var(--surface)] p-2" /></label>
      <button className={botaoClasses({ tamanho: "lg" })} disabled={motivo.trim().length < 5}>{ocupado ? "Preparando…" : "Preparar para decisão"}</button>
    </fieldset>{erro && <p role="alert">{erro}</p>}
  </form>;
}

export function DecidirJanela({ propostaId, podeAprovar }: { propostaId: string; podeAprovar: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  function decidir(aprovar: boolean) {
    iniciar(async () => {
      setErro("");
      try {
        const r = await decidirJanelaAdmissao({ propostaId, aprovar, motivo });
        if (!r.ok) { setErro(r.erro); return; } router.refresh();
      } catch { setErro(MSG_DECISAO_INCERTA); }
    });
  }
  return <fieldset disabled={ocupado} className="space-y-2 rounded border p-3"><legend>Decisão desta versão</legend>
    <label className="block">Motivo da decisão<CampoTexto value={motivo} maxLength={2000} onChange={(e) => setMotivo(e.target.value)} className="mt-1 block w-full rounded border bg-[var(--surface)] p-2" /></label>
    <div className="flex gap-3"><button disabled={!podeAprovar || motivo.trim().length < 5} onClick={() => decidir(true)} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Aprovar janela</button>
      <button disabled={motivo.trim().length < 5} onClick={() => decidir(false)} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Rejeitar janela</button></div>
    {!podeAprovar && <p>Confira a versão mais recente, o fuso e a situação da turma antes de aprovar.</p>}
    {erro && <p role="alert">{erro}</p>}
  </fieldset>;
}
