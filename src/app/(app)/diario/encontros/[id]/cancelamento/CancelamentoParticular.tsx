"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { consultarCancelamentoParticular, proporCancelamentoParticular, decidirCancelamentoParticular } from "@/server/agenda/cancelamento-particular";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";

type Resposta = Awaited<ReturnType<typeof consultarCancelamentoParticular>>;
type Dados = Extract<Resposta, { ok: true }>["dado"];
export function CancelamentoParticular({ encontroId, dados, fusoExibicao }: { encontroId: string; dados: NonNullable<Dados>; fusoExibicao: string }) {
  // A chave só é trocada quando o motivo/origem mudam, e o servidor devolve a solicitação existente
  // quando ela se repete (server/agenda/cancelamento-particular.ts:46-49): reenviar é seguro.
  const proposta = useAcaoCliente({ idempotente: true });
  // A decisão não recebe chave (cancelamento-particular.ts:60); só a repetição idêntica pelo mesmo
  // decisor é reconhecida (:71-73). Conferir antes de repetir.
  const decisao = useAcaoCliente({ idempotente: false });
  // O erro da decisão aparece na solicitação cujo formulário a disparou.
  const [alvo, setAlvo] = useState<string | null>(null);
  const pendente = proposta.ocupado || decisao.ocupado;
  const chave = useRef<string | null>(null);
  const router = useRouter();
  return <div className="space-y-4">
    <p>{formatarInstanteExibicao(dados.inicio, fusoExibicao, dados.fuso).texto} · {fusoExibicao} · {dados.status}</p>
    {dados.podePropor && <form className="space-y-2" onSubmit={async e => {
      e.preventDefault(); const form = new FormData(e.currentTarget), motivo = String(form.get("motivo") ?? ""), origem = String(form.get("origem")) as "ESCOLA" | "ALUNO";
      chave.current ??= crypto.randomUUID(); const chaveIdempotencia = chave.current;
      const d = await proposta.executar(() => proporCancelamentoParticular({ encontroId, motivo, origem, chaveIdempotencia }));
      if (d?.tipo === "ok") { chave.current = null; router.refresh(); }
    }}>
      <label className="block">Motivo do cancelamento<textarea name="motivo" className="block w-full border p-2" required minLength={5} maxLength={2000} onChange={() => { chave.current = null; }} /></label>
      <label className="block">Quem cancelou?<select name="origem" required defaultValue="" className="block border p-2" onChange={() => { chave.current = null; }}><option value="" disabled>Selecione</option><option value="ESCOLA">Escola</option><option value="ALUNO">Aluno</option></select></label>
      <FeedbackAcao erro={proposta.erro} />
      <button disabled={pendente} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Solicitar cancelamento</button>
    </form>}
    {dados.propostas.map(p => <article key={p.id} className="space-y-2 rounded border p-4">
      <p>Origem: {p.origem === "ALUNO" ? "aluno" : "escola"}.</p><p>{p.motivo}</p><p>{p.decisao ? p.decisao.aprovada ? "Cancelamento aprovado" : "Solicitação rejeitada" : "Aguardando decisão de outra pessoa"}</p>
      {p.decisao && <p>Decisão: {p.decisao.motivo}</p>}
      {p.podeDecidir && <form className="space-y-2" onSubmit={async e => {
        e.preventDefault(); const form = new FormData(e.currentTarget);
        const motivo = String(form.get("motivo") ?? ""), aprovar = form.get("decisao") === "aprovar";
        setAlvo(p.id);
        const d = await decisao.executar(() => decidirCancelamentoParticular({ propostaId: p.id, motivo, aprovar }));
        if (d?.tipo === "ok") router.refresh();
      }}>
        <label className="block">Decisão<select name="decisao" required defaultValue="" className="block border p-2"><option value="" disabled>Selecione</option><option value="aprovar">Aprovar cancelamento</option><option value="rejeitar">Rejeitar solicitação</option></select></label>
        <label className="block">Justificativa da decisão<textarea name="motivo" className="block w-full border p-2" required minLength={5} maxLength={2000} /></label>
        <FeedbackAcao erro={alvo === p.id ? decisao.erro : null} />
        <button disabled={pendente} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Confirmar decisão</button>
      </form>}
    </article>)}
  </div>;
}
