"use client";
import { useRef, useState } from "react";
import { Formulario } from "../../planos/[propostaId]/Formularios";
import { proporCorrecaoRecuperacao, revisarCorrecaoRecuperacao, decidirCorrecaoRecuperacao } from "@/server/avaliacoes/recuperacao-correcao";
import { botaoClasses } from "@/components/Botao";
type Revisao = NonNullable<Extract<Awaited<ReturnType<typeof revisarCorrecaoRecuperacao>>, { ok: true }>["dado"]>;
const campo = (d: FormData, n: string) => String(d.get(n) ?? "");

export function Propor({ notaId, origemId, nota, comentarioAluno, versaoEsperada }: { notaId: string; origemId: string; nota: string; comentarioAluno: string; versaoEsperada: number }) {
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  return <Formulario titulo="Propor correção" executar={async d => {
    const dados = { notaId, origemId, nota: campo(d,"nota"), comentarioAluno: campo(d,"comentarioAluno"), motivo: campo(d,"motivo"), versaoEsperada }, entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const r = await proporCorrecaoRecuperacao({ ...dados, chaveIdempotencia: tentativa.current.chave });
    if (r.ok) tentativa.current = null;
    return r;
  }}>
    <label className="block">Nota corrigida<input name="nota" defaultValue={nota} required inputMode="decimal" maxLength={100} className="block rounded border p-2" /></label>
    <label className="block">Comentário ao aluno<textarea name="comentarioAluno" defaultValue={comentarioAluno} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <label className="block">Motivo da correção<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}

export function Revisar({ propostaId }: { propostaId: string }) {
  const [revisao, setRevisao] = useState<Revisao | null>(null), [erro, setErro] = useState(""), [carregando, setCarregando] = useState(false);
  return <div className="space-y-3"><button disabled={carregando} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={async () => {
    setCarregando(true); setErro(""); setRevisao(null);
    try { const r = await revisarCorrecaoRecuperacao(propostaId); if (r.ok && r.dado) setRevisao(r.dado); else setErro(r.ok ? "Consulta indisponível." : r.erro); }
    catch { setErro("Não foi possível conferir os impactos. Tente novamente."); }
    finally { setCarregando(false); }
  }}>{carregando ? "Conferindo…" : "Conferir proposta e impactos"}</button>
    {erro && <p role="alert">{erro}</p>}
    {revisao && <><p>Nota vigente: {revisao.anterior.nota}. Proposta: {revisao.proposta.nota}.</p>
      <p>{revisao.impactos.planos.length} plano(s) aprovado(s) de recuperação vinculado(s) serão conferidos contra o resultado corrigido nas próximas operações.</p>
      <p>{revisao.impactos.mudancas.length} mudança(s) de nível aprovada(s) ou executada(s) exigirão revisão, sem movimentação automática do aluno.</p>
      <ul>{revisao.impactos.mudancas.map(m => <li key={m.id}>Solicitação {m.id}: {m.status}</li>)}</ul>
      {!revisao.podeAprovar && <p>Esta proposta não pode ser aprovada no estado atual. Confira a versão vigente.</p>}
      <Formulario titulo="Registrar decisão" executar={d => decidirCorrecaoRecuperacao({ propostaId, propostaHash: revisao.propostaHash, impactosHash: revisao.impactosHash, aprovada: campo(d,"decisao") === "aprovar", motivo: campo(d,"motivo") })}>
        <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option><option value="aprovar" disabled={!revisao.podeAprovar}>Aprovar e aplicar</option><option value="rejeitar">Rejeitar</option></select></label>
        <label className="block">Justificativa<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      </Formulario></>}
  </div>;
}
