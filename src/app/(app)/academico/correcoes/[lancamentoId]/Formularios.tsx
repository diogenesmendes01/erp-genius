"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { proporCorrecaoNota, decidirCorrecaoNota } from "@/server/avaliacoes/correcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { HABILIDADE_LABEL } from "@/lib/labels";
type Nota = { habilidade: "FALA" | "COMPREENSAO_ORAL" | "LEITURA" | "ESCRITA"; nota: string | null; comentarioAluno: string };

export function ProporCorrecao({ lancamentoId, origemHash, versaoEsperada, notas }: { lancamentoId: string; origemHash: string; versaoEsperada: number; notas: Nota[] }) {
  const router = useRouter(), chave = useRef<string | null>(null);
  // Chave de idempotência estável entre tentativas: na falha de transporte, reenviar sem alterar (MSG_RESULTADO_INCERTO).
  const acao = useAcaoCliente({ idempotente: true });
  return <form className="space-y-3" onChange={() => { chave.current = null; acao.limpar(); }} onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form); const chaveIdempotencia = (chave.current ??= crypto.randomUUID());
    const d = await acao.executar(() => proporCorrecaoNota({ lancamentoId, origemHash, versaoEsperada, chaveIdempotencia, motivo: String(f.get("motivo") ?? ""),
      notas: notas.map(n => ({ habilidade: n.habilidade, nota: String(f.get(`nota-${n.habilidade}`) ?? "").trim().replace(",", ".") || null, comentarioAluno: String(f.get(`comentario-${n.habilidade}`) ?? "") })) }),
    "Proposta registrada. As notas permanecem vigentes até aprovação independente.");
    // Registrada: o formulário fica montado (sem key de versão), mas volta às notas vigentes e ao motivo vazio —
    // repetir o clique não cria outra proposta idêntica (R1 da #155, C1); a próxima é outra tentativa (chave nova).
    if (d?.tipo === "ok") { form.reset(); chave.current = null; router.refresh(); }
  }}><fieldset disabled={acao.ocupado} className="space-y-3"><legend className="font-medium">Propor correção</legend>
    {notas.map(n => <div key={n.habilidade} className="space-y-2 rounded border p-3"><p>{HABILIDADE_LABEL[n.habilidade]} — nota vigente: {n.nota}</p>
      <label className="block">Nova nota<input name={`nota-${n.habilidade}`} required maxLength={100} inputMode="decimal" defaultValue={n.nota ?? ""} className="block rounded border p-2" /></label>
      <label className="block">Comentário para o aluno<CampoTexto name={`comentario-${n.habilidade}`} maxLength={2000} defaultValue={n.comentarioAluno} className="block w-full rounded border p-2" /></label>
    </div>)}
    <label className="block">Motivo da correção<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <label className="block"><input type="checkbox" required /> Conferi os valores vigentes e as alterações propostas.</label>
    <button className={botaoClasses({ tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Registrar proposta"}</button>
  </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></form>;
}

export function DecidirCorrecao({ propostaId, propostaHash, impactosHash, podeAprovar }: { propostaId: string; propostaHash: string; impactosHash: string; podeAprovar: boolean }) {
  // Sem chave de idempotência; a decisão incerta mantém o texto próprio (reenviar a mesma decisão).
  const router = useRouter(); const acao = useAcaoCliente({ idempotente: false });
  return <form className="space-y-3" onSubmit={async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const d = await acao.executar(() => decidirCorrecaoNota({ propostaId, propostaHash, impactosHash, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo") ?? "") }),
      (dado) => dado?.aplicada ? "Correção aprovada e aplicada." : "Proposta rejeitada.");
    if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
    else if (d?.tipo === "ok") router.refresh();
  }}><fieldset disabled={acao.ocupado} className="space-y-3"><legend className="font-medium">Decisão independente</legend>
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="">Selecione</option>{podeAprovar && <option value="aprovar">Aprovar e aplicar</option>}<option value="rejeitar">Rejeitar</option></select></label>
    <label className="block">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <label className="block"><input type="checkbox" required /> Conferi notas, comentários e impactos apresentados.</label>
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Registrar decisão"}</button>
  </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></form>;
}
