"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarLancamentoAvaliacaoLocal, oficializarLancamentoAvaliacao } from "@/server/avaliacoes/lancamentos";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { HABILIDADE_LABEL } from "@/lib/labels";

type Habilidade = "FALA" | "COMPREENSAO_ORAL" | "LEITURA" | "ESCRITA";
type Nota = { habilidade: Habilidade; nota: string | null; comentarioAluno: string };

export function LancarNotas({ alocacaoId, codigoAvaliacao, versaoEsperada, habilidades, escala, anterior, fuso, realizadores, registradorId }: {
  alocacaoId: string; codigoAvaliacao: string; versaoEsperada: number; habilidades: Habilidade[];
  escala: { minimo: string; maximo: string }; anterior: { realizadaEm: string; notas: Nota[] } | null; fuso: string;
  realizadores: { id: string; nome: string }[]; registradorId: string;
}) {
  const router = useRouter(), chave = useRef<string | null>(null);
  // Chave de idempotência estável entre tentativas: na falha de transporte, reenviar sem alterar (MSG_RESULTADO_INCERTO).
  const acao = useAcaoCliente({ idempotente: true });
  const [realizador, setRealizador] = useState("");
  return <form className="space-y-3" onChange={() => { chave.current = null; acao.limpar(); }} onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const realizada = String(form.get("realizadaEm") ?? "");
    if (!realizada) return;
    const chaveIdempotencia = (chave.current ??= crypto.randomUUID());
    const d = await acao.executar(() => salvarLancamentoAvaliacaoLocal({ alocacaoId, codigoAvaliacao, versaoEsperada, chaveIdempotencia,
      realizadaLocal: realizada, fuso, submetida: form.get("modo") === "submeter",
      ...(realizador ? { realizadaPorId: realizador } : {}),
      ...(realizador && realizador !== registradorId ? { motivoRegularizacao: String(form.get("motivoRegularizacao") ?? ""), evidenciasRegularizacao: String(form.get("evidenciasRegularizacao") ?? "") } : {}),
      notas: habilidades.map(habilidade => ({ habilidade, nota: String(form.get(`nota-${habilidade}`) ?? "").trim().replace(",", ".") || null, comentarioAluno: String(form.get(`comentario-${habilidade}`) ?? "") })),
    }), "Versão registrada. A submissão exige conferência de outra pessoa da gestão.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <fieldset disabled={acao.ocupado} className="space-y-4"><legend className="font-medium">Registrar avaliação realizada</legend>
      <label className="block">Data e horário da realização ({fuso})<input type="datetime-local" name="realizadaEm" step="0.001" required defaultValue={anterior?.realizadaEm} className="block rounded border p-2" /></label>
      {!!realizadores.length && <label className="block">Quem realizou a avaliação?<select required value={realizador} onChange={e => setRealizador(e.target.value)} className="block rounded border p-2"><option value="">Selecione o professor</option>{realizadores.map(p => <option key={p.id} value={p.id}>{p.nome}{p.id === registradorId ? " (eu)" : ""}</option>)}</select></label>}
      {realizador && realizador !== registradorId && <>
        <label className="block">Motivo da regularização<CampoTexto name="motivoRegularizacao" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
        <label className="block">Evidências utilizadas<CampoTexto name="evidenciasRegularizacao" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
        <p>Identifique os registros utilizados para conferir a avaliação e as notas. Seu nome ficará registrado como responsável pelo lançamento.</p>
      </>}
      <p>Escala: {escala.minimo} a {escala.maximo}. Campo de nota vazio permanece pendente no rascunho.</p>
      {habilidades.map(h => { const n = anterior?.notas.find(n => n.habilidade === h); return <div key={h} className="space-y-2 rounded border p-3">
        <label className="block">Nota de {HABILIDADE_LABEL[h]}<input name={`nota-${h}`} inputMode="decimal" maxLength={100} defaultValue={n?.nota ?? ""} className="block rounded border p-2" /></label>
        <label className="block">Comentário para o aluno — {HABILIDADE_LABEL[h]}<CampoTexto name={`comentario-${h}`} maxLength={2000} defaultValue={n?.comentarioAluno ?? ""} className="block w-full rounded border p-2" /></label>
      </div>; })}
      <label className="block">Encaminhamento<select name="modo" required defaultValue="" className="block rounded border p-2"><option value="">Selecione</option><option value="rascunho">Salvar rascunho</option><option value="submeter">Submeter para conferência</option></select></label>
      <button className={botaoClasses({ tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Registrar versão"}</button>
    </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}

export function ConferirNotas({ lancamentoId, conteudoHash, podeAprovar }: { lancamentoId: string; conteudoHash: string; podeAprovar: boolean }) {
  // Sem chave de idempotência; a decisão incerta mantém o texto próprio (reenviar a mesma decisão).
  const router = useRouter(); const acao = useAcaoCliente({ idempotente: false });
  return <form className="space-y-3" onSubmit={async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const d = await acao.executar(() => oficializarLancamentoAvaliacao({ lancamentoId, conteudoHash, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo") ?? "") }), "Decisão registrada.");
    if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
    else if (d?.tipo === "ok") router.refresh();
  }}>
    <fieldset disabled={acao.ocupado} className="space-y-3"><legend className="font-medium">Conferência independente</legend>
      <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="">Selecione</option>{podeAprovar && <option value="aprovar">Oficializar notas desta versão</option>}<option value="devolver">Devolver para revisão</option></select></label>
      <label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block"><input type="checkbox" required /> Conferi data, habilidades, notas e comentários desta versão.</label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Registrar decisão"}</button>
    </fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
