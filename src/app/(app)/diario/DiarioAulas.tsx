"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { salvarAulaDiario } from "@/server/diario/acoes";
import { listarAlunosParaChamada } from "@/server/diario/chamada";
import type { AulaDiarioView, TurmaDiario } from "@/server/diario/consultas";

const campo = "rounded-md border border-gray-300 px-3 py-2 text-sm";
const botao = "rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
function dataLocal(iso = new Date().toISOString()) {
  const d = new Date(iso); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
type RegistroForm = { alunoId: string; nomeAluno: string; presente: boolean | null; observacao: string; podeEditar: boolean };

export function DiarioAulas({ aulas, turmas }: { aulas: AulaDiarioView[]; turmas: TurmaDiario[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [edicao, setEdicao] = useState<AulaDiarioView | null>(null);
  const [turmaId, setTurmaId] = useState("");
  const [data, setData] = useState(dataLocal);
  const [conteudo, setConteudo] = useState("");
  const [registros, setRegistros] = useState<RegistroForm[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const consulta = useRef(0);
  const [carregando, setCarregando] = useState(false);
  const [conferencia, setConferencia] = useState(false);

  function escolherTurma(id: string, instante = data) {
    setTurmaId(id);
    const versao = ++consulta.current;
    setRegistros([]); setErro(null); setConferencia(false); setCarregando(false);
    const ocorrida = new Date(instante);
    if (!id || !Number.isFinite(ocorrida.getTime())) return;
    setCarregando(true);
    void listarAlunosParaChamada({ turmaId: id, ocorridaEm: ocorrida.toISOString() }).then((r) => {
      if (versao !== consulta.current) return;
      if (!r.ok) { setErro(r.erro); return; }
      setConferencia(r.dado!.exigeConferencia);
      setRegistros(r.dado!.alunos.map((a) => ({ ...a, presente: null, observacao: "", podeEditar: true })));
    }).catch(() => {
      if (versao === consulta.current) setErro("Não foi possível carregar a chamada. Selecione a turma novamente.");
    }).finally(() => { if (versao === consulta.current) setCarregando(false); });
  }
  function abrir(aula: AulaDiarioView | null) {
    consulta.current++; setCarregando(false); setConferencia(false);
    setErro(null); setEdicao(aula); setAberto(true);
    setConteudo(aula?.conteudo ?? ""); setData(dataLocal(aula?.ocorridaEm));
    if (aula) {
      setTurmaId(aula.turmaId ?? "");
      setRegistros(aula.registros.map((r) => ({ ...r, observacao: r.observacao ?? "" })));
    } else { setTurmaId(""); setRegistros([]); }
  }
  function salvar() {
    iniciar(async () => {
      const resposta = await salvarAulaDiario({
        aulaId: edicao?.id, turmaId, ocorridaEm: edicao?.ocorridaEm ?? new Date(data).toISOString(), conteudo,
        registros: registros.map((r) => ({ alunoId: r.alunoId, presente: r.presente, observacao: r.observacao })),
      });
      if (!resposta.ok) setErro(resposta.erro);
      else { setAberto(false); router.refresh(); }
    });
  }
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-medium">Diário de aulas</h1><p className="mt-1 text-sm text-gray-500">Conteúdo ministrado, presença e observações pedagógicas.</p></div>
      {turmas.length > 0 && <button className={botao} onClick={() => abrir(null)}>Registrar aula</button>}
    </header>
    {aberto && <section className="space-y-4 rounded-lg border border-gray-200 bg-surface p-5" aria-label={edicao ? "Editar registro de aula" : "Registrar aula"}>
      <h2 className="font-medium">{edicao ? "Editar aula registrada" : "Nova aula"}</h2>
      {erro && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">Turma
          {edicao ? <span className={campo}>{edicao.turma}</span> : <select className={campo} value={turmaId} onChange={(e) => escolherTurma(e.target.value)}><option value="">Selecione</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>}
        </label>
        <label className="flex flex-col gap-1 text-sm">Data e hora da aula (seu fuso local)
          <input className={campo} type="datetime-local" value={data} disabled={!!edicao} max={dataLocal()} onChange={(e) => { setData(e.target.value); escolherTurma(turmaId, e.target.value); }} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">Conteúdo ministrado<textarea className={campo} rows={3} value={conteudo} maxLength={10000} onChange={(e) => setConteudo(e.target.value)} /></label>
      <div className="space-y-3">
        {carregando && <p role="status">Carregando a chamada da data selecionada…</p>}
        {conferencia && <p role="alert" className="text-amber-700">Há vínculos com histórico incompleto. Solicite conferência à gestão antes de registrar esta chamada.</p>}
        {registros.map((r, i) => <div key={r.alunoId} className="grid gap-2 rounded-md border border-gray-100 p-3 sm:grid-cols-[1fr_160px_2fr]">
          <div className="text-sm font-medium">{r.nomeAluno}{!r.podeEditar && <p className="mt-1 text-xs font-normal text-gray-500">Histórico em leitura após saída da turma.</p>}</div>
          <label className="flex flex-col gap-1 text-xs">Presença de {r.nomeAluno}<select className={campo} disabled={!r.podeEditar} value={r.presente === null ? "" : r.presente ? "sim" : "nao"} onChange={(e) => setRegistros((rs) => rs.map((v, pos) => pos === i ? { ...v, presente: e.target.value === "" ? null : e.target.value === "sim" } : v))}><option value="">Não informada</option><option value="sim">Presente</option><option value="nao">Ausente</option></select></label>
          <label className="flex flex-col gap-1 text-xs">Observação pedagógica de {r.nomeAluno}<textarea className={campo} disabled={!r.podeEditar} maxLength={2000} rows={2} value={r.observacao} onChange={(e) => setRegistros((rs) => rs.map((v, pos) => pos === i ? { ...v, observacao: e.target.value } : v))} /></label>
        </div>)}
        {turmaId && !carregando && !erro && registros.length === 0 && <p className="text-sm text-gray-500">Nenhum aluno elegível na data selecionada.</p>}
      </div>
      <div className="flex gap-3"><button className={botao} disabled={pendente || carregando || conferencia || !turmaId || !data || !conteudo.trim() || registros.length === 0} onClick={salvar}>{pendente ? "Salvando…" : "Salvar aula"}</button><button className={campo} disabled={pendente} onClick={() => { consulta.current++; setAberto(false); }}>Cancelar</button></div>
    </section>}
    {aulas.length === 0 && <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">Nenhuma aula registrada neste histórico.</p>}
    {aulas.map((a) => <article key={a.id} className="rounded-lg border border-gray-200 bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium">{a.turma} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: a.fusoExibicao }).format(new Date(a.ocorridaEm))}</h2>{a.encontroParaEditar ? <Link className={campo} href={`/diario/encontros/${a.encontroParaEditar}`}>Completar diário do encontro</Link> : a.podeEditar ? <button className={campo} onClick={() => abrir(a)}>Editar registro</button> : <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">Somente leitura</span>}</div>
      <p className="mt-1 text-xs text-gray-500">Exibido em {a.fusoExibicao}</p>
      <p className="mt-1 text-xs text-gray-500">Professor: {a.professor}</p>
      {a.encontroParaCorrecao && <Link className="mt-2 inline-block text-sm text-brand-700 underline" href={`/diario/encontros/${a.encontroParaCorrecao}/correcao`}>Propor ou conferir correção</Link>}
      {!a.encontroParaCorrecao && a.encontroParaHistoricoCorrecao && <Link className="mt-2 inline-block text-sm text-brand-700 underline" href={`/diario/encontros/${a.encontroParaHistoricoCorrecao}/correcao`}>Consultar histórico de correções</Link>}
      {a.correcaoPublicada && <p className="mt-2 text-sm text-green-700">Correção publicada · versão {a.correcaoPublicada.versao}.</p>}
      {a.encontroParaGravacao && <Link className="mt-2 block text-sm text-brand-700 underline" href={`/diario/encontros/${a.encontroParaGravacao}/gravacao`}>Assistir à gravação</Link>}
      <p className="my-4 whitespace-pre-wrap text-sm text-gray-700">{a.conteudo}</p>
      <ul className="divide-y divide-gray-100 text-sm">{a.registros.map((r) => <li key={r.alunoId} className="py-2"><span className="font-medium">{r.nomeAluno}</span><span className="ml-3 text-gray-500">{r.participacao === "IMPEDIDO_POR_RESTRICAO" ? "Impedido por restrição" : r.presente === null ? "Presença não informada" : r.presente ? "Presente" : "Ausente"}</span>{r.observacao && <p className="mt-1 whitespace-pre-wrap text-gray-600">{r.observacao}</p>}</li>)}</ul>
    </article>)}
  </div>;
}
