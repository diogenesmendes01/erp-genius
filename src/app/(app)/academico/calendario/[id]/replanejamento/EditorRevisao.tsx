"use client";
import { useState, useTransition } from "react";
import { preverReplanejamentoCalendario } from "@/server/agenda/replanejamento-consulta";
import type { AjusteReplanejamento } from "@/server/agenda/replanejamento-ajustes";
import { ConteudoRevisao } from "./ConteudoRevisao";
import { SalvarRevisao } from "./SalvarRevisao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";

type Revisao = NonNullable<Extract<Awaited<ReturnType<typeof preverReplanejamentoCalendario>>, { ok: true }>["dado"]>;
export function EditorRevisao({ inicial, preferenciaFusoExibicao = null }: { inicial: Revisao; preferenciaFusoExibicao?: string | null }) {
  // Sem key de estado ou de versão (docs/43 §6 item 3): um router.refresh() que traga outro estado não remonta o
  // editor nem apaga os ajustes digitados. A conferência feita aqui vale enquanto o servidor estiver no estado em
  // que ela foi feita; com outro estado, volta a prévia nova e os ajustes ficam para conferir de novo.
  const base = `${inicial.estadoHash}:${inicial.versaoRascunho}`;
  const [conferida, setConferida] = useState<{ base: string; revisao: Revisao } | null>(null);
  const revisao = conferida && conferida.base === base ? conferida.revisao : inicial;
  const [ajustes, setAjustes] = useState<AjusteReplanejamento[]>(inicial.ajustes);
  // Alterado = os ajustes diferem dos da última conferência (comparados pelo conteúdo).
  const alterado = JSON.stringify(ajustes) !== JSON.stringify(revisao.ajustes);
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const opcoes = revisao.revisoes.flatMap((t) => t.previsao?.propostas.map((p, i) => ({ id: p.encontroId, nome: `${t.codigo ?? "Turma sem código"} · Encontro ${i + 1} · ${t.fusoOrigem}` })) ?? []);
  function mudar(indice: number, valor: Partial<AjusteReplanejamento>) {
    setAjustes((a) => a.map((v, i) => i === indice ? { ...v, ...valor } : v));
  }
  function conferir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    iniciar(async () => {
      setErro("");
      try {
        const r = await preverReplanejamentoCalendario({ calendarioId: inicial.calendarioId, ajustes });
        if (!r.ok || !r.dado) { setErro(r.ok ? "Conferência indisponível." : r.erro); return; }
        setConferida({ base, revisao: r.dado }); setAjustes(r.dado.ajustes);
      } catch { setErro("Não foi possível conferir os ajustes. Tente novamente."); }
    });
  }
  const campo = "mt-1 block w-full rounded border bg-[var(--surface)] p-2";
  return <div className="space-y-5">
    <form onSubmit={conferir} className="space-y-3 rounded border p-4">
      <h2 className="font-medium">Ajustar datas sugeridas</h2>
      <p>Informe data e horário no fuso de origem indicado para a turma. A duração permanece a mesma. Dias não letivos exigem decisão explícita da exceção antes da aplicação.</p>
      <fieldset disabled={ocupado} className="space-y-3">
        {ajustes.map((a, i) => <fieldset key={i} className="grid gap-3 rounded border p-3 sm:grid-cols-2">
          <legend>Ajuste {i + 1}</legend>
          <label>Encontro<select required value={a.encontroId} onChange={(e) => mudar(i, { encontroId: e.target.value })} className={campo}>
            <option value="">Escolha o encontro</option>{opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select></label>
          <label>Data no fuso da turma<input required type="date" value={a.data} onChange={(e) => mudar(i, { data: e.target.value })} className={campo} /></label>
          <label>Horário no fuso da turma<input required type="time" value={a.horario} onChange={(e) => mudar(i, { horario: e.target.value })} className={campo} /></label>
          <label>Motivo do ajuste<CampoTexto required minLength={5} maxLength={2000} value={a.motivo} onChange={(e) => mudar(i, { motivo: e.target.value })} className={campo} /></label>
          <button type="button" className={`${botaoClasses({ variante: "perigo", tamanho: "lg" })} justify-self-start`} onClick={() => setAjustes((v) => v.filter((_, j) => i !== j))}>Remover ajuste {i + 1}</button>
        </fieldset>)}
        <div className="flex gap-3">
          <button type="button" disabled={ajustes.length >= opcoes.length} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => setAjustes((v) => [...v, { encontroId: "", data: "", horario: "", motivo: "" }])}>Adicionar ajuste</button>
          <button className={botaoClasses({ tamanho: "lg" })}>{ocupado ? "Conferindo…" : "Conferir datas e conflitos"}</button>
        </div>
      </fieldset>
      {erro && <p role="alert">{erro}</p>}
    </form>
    <MensagemStatus texto={alterado ? "Há ajustes ainda não conferidos. O resultado abaixo corresponde à última conferência; confira novamente para guardar a revisão." : null} />
    <ConteudoRevisao r={revisao} preferenciaFusoExibicao={preferenciaFusoExibicao} />
    {/* Sempre montado (docs/42 L1081): com ajustes não conferidos o botão fica desabilitado e diz por quê, em vez
        de o bloco sumir; sem key, o motivo digitado sobrevive a uma nova conferência. */}
    <SalvarRevisao calendarioId={revisao.calendarioId} estadoHash={revisao.estadoHash} versaoAnterior={revisao.versaoRascunho} ajustes={revisao.ajustes.length ? revisao.ajustes : undefined} desatualizado={alterado || ocupado} />
  </div>;
}
