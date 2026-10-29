"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { salvarAulaDiario } from "@/server/diario/acoes";
import { listarAlunosParaChamadaLocal, salvarAulaDiarioLocal } from "@/server/diario/diario-local";
import { valorCampoLocal } from "@/server/operacao/fuso-entrada";
import { CampoDataHoraLocal } from "@/components/CampoDataHoraLocal";
import type { AulaDiarioView, TurmaDiario } from "@/server/diario/consultas";
import { botaoClasses } from "@/components/Botao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { CampoCombobox } from "@/app/(app)/academico/controles";

const campo = "rounded-md border border-gray-200 px-3 py-2 text-sm";
const botao = botaoClasses({ tamanho: "lg" });
type RegistroForm = { alunoId: string; nomeAluno: string; presente: boolean | null; observacao: string; podeEditar: boolean };
type AlunoChamada = { alunoId: string; nomeAluno: string };
type TrocaPendente = { registros: RegistroForm[]; descartados: string[]; exigeConferencia: boolean; dataAnterior: string; conferenciaAnterior: boolean };

export function mesclarChamada(atuais: RegistroForm[], alunos: AlunoChamada[]): { registros: RegistroForm[]; descartados: string[] } {
  const porAluno = new Map(atuais.map((r) => [r.alunoId, r] as const));
  const ficam = new Set(alunos.map((a) => a.alunoId));
  return {
    registros: alunos.map((a) => {
      const anterior = porAluno.get(a.alunoId);
      return { ...a, presente: anterior ? anterior.presente : null, observacao: anterior ? anterior.observacao : "", podeEditar: true };
    }),
    descartados: atuais.filter((r) => !ficam.has(r.alunoId) && (r.presente !== null || r.observacao.trim() !== "")).map((r) => r.nomeAluno),
  };
}

export function DiarioAulas({ aulas, turmas, mensagemVazio, fusoEntrada }: { aulas: AulaDiarioView[]; turmas: TurmaDiario[];  mensagemVazio?: string; fusoEntrada: string }) {
  const dataLocal = (iso: string | Date = new Date()) => valorCampoLocal(iso, fusoEntrada);
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [edicao, setEdicao] = useState<AulaDiarioView | null>(null);
  const [turmaId, setTurmaId] = useState("");
  const [data, setData] = useState(() => dataLocal());
  const [conteudo, setConteudo] = useState("");
  const [registros, setRegistros] = useState<RegistroForm[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const consulta = useRef(0);
  const [carregando, setCarregando] = useState(false);
  const [conferencia, setConferencia] = useState(false);
  const [troca, setTroca] = useState<TrocaPendente | null>(null);

  async function escolherTurma(id: string, instante = data, preenchidos?: { registros: RegistroForm[]; dataAnterior: string; conferenciaAnterior: boolean }) {
    setTurmaId(id);
    const versao = ++consulta.current;
    if (!preenchidos) setRegistros([]);
    setErro(null); setConferencia(false); setCarregando(false); setTroca(null);
    if (!id || !instante) return;
    setCarregando(true);
    try {
      const r = await listarAlunosParaChamadaLocal({ turmaId: id, ocorridaLocal: instante, fuso: fusoEntrada });
      if (versao !== consulta.current) return;
      if (!r.ok) { setErro(r.erro); voltarDataSeFalhou(preenchidos); return; }
      const mescla = mesclarChamada(preenchidos?.registros ?? [], r.dado!.alunos);
      if (preenchidos && mescla.descartados.length) {
        setTroca({ registros: mescla.registros, descartados: mescla.descartados, exigeConferencia: r.dado!.exigeConferencia, dataAnterior: preenchidos.dataAnterior, conferenciaAnterior: preenchidos.conferenciaAnterior });
        return;
      }
      setConferencia(r.dado!.exigeConferencia);
      setRegistros(mescla.registros);
    } catch {
      if (versao === consulta.current) { setErro("Não foi possível carregar a chamada. Selecione a turma novamente."); voltarDataSeFalhou(preenchidos); }
    } finally {
      if (versao === consulta.current) setCarregando(false);
    }
  }
  function voltarDataSeFalhou(preenchidos?: { dataAnterior: string; conferenciaAnterior: boolean }) {
    if (!preenchidos) return;
    setData(preenchidos.dataAnterior); setConferencia(preenchidos.conferenciaAnterior);
  }
  function aplicarTroca() {
    if (!troca) return;
    setRegistros(troca.registros); setConferencia(troca.exigeConferencia); setTroca(null);
  }
  function manterData() {
    if (!troca) return;
    consulta.current++; setData(troca.dataAnterior); setConferencia(troca.conferenciaAnterior); setTroca(null);
  }
  function abrir(aula: AulaDiarioView | null) {
    consulta.current++; setCarregando(false); setConferencia(false); setTroca(null);
    setErro(null); setEdicao(aula); setAberto(true);
    setConteudo(aula?.conteudo ?? ""); setData(dataLocal(aula?.ocorridaEm ?? new Date()));
    if (aula) {
      setTurmaId(aula.turmaId ?? "");
      setRegistros(aula.registros.map((r) => ({ ...r, observacao: r.observacao ?? "" })));
    } else { setTurmaId(""); setRegistros([]); }
  }
  function salvar() {
    iniciar(async () => {
      const registrosEnvio = registros.map((r) => ({ alunoId: r.alunoId, presente: r.presente, observacao: r.observacao }));
      const resposta = edicao
        ? await salvarAulaDiario({ aulaId: edicao.id, turmaId, ocorridaEm: edicao.ocorridaEm, conteudo, registros: registrosEnvio })
        : await salvarAulaDiarioLocal({ turmaId, ocorridaLocal: data, fuso: fusoEntrada, conteudo, registros: registrosEnvio });
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
          {edicao ? <span className={campo}>{edicao.turma}</span> : <CampoCombobox className={campo} value={turmaId} onChange={async (e) => { await escolherTurma(e.target.value); }} placeholder="Selecione" vazio="Selecione" opcoes={[...turmas.map((t) => ({ valor: t.id, rotulo: t.label }))]} />}
        </label>
        <label className="flex flex-col gap-1 text-sm">Data e hora da aula
          <CampoDataHoraLocal fuso={fusoEntrada} className={campo} value={data} disabled={!!edicao} max={dataLocal()} onChange={async (e) => { const dataAnterior = data; setData(e.target.value); await escolherTurma(turmaId, e.target.value, { registros, dataAnterior, conferenciaAnterior: conferencia }); }} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">Conteúdo ministrado<CampoTexto className={campo} rows={3} value={conteudo} maxLength={10000} onChange={(e) => setConteudo(e.target.value)} /></label>
      <div className="space-y-3">
        <MensagemStatus texto={carregando ? "Carregando a chamada da data selecionada…" : null} />
        {troca && <div role="alert" className="space-y-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <p>Na nova data, {troca.descartados.join(", ")} {troca.descartados.length === 1 ? "não está" : "não estão"} na chamada. A presença e a observação já preenchidas para {troca.descartados.length === 1 ? "essa pessoa" : "essas pessoas"} serão descartadas; as dos demais alunos continuam.</p>
          <div className="flex flex-wrap gap-2"><button type="button" className={botaoClasses({ variante: "perigo", tamanho: "lg" })} onClick={aplicarTroca}>Descartar e usar a nova data</button><button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={manterData}>Manter a data anterior</button></div>
        </div>}
        {conferencia && <p role="alert" className="text-amber-700">Há vínculos com histórico incompleto. Solicite conferência à gestão antes de registrar esta chamada.</p>}
        {registros.map((r, i) => <div key={r.alunoId} className="grid gap-2 rounded-md border border-gray-100 p-3 sm:grid-cols-[1fr_160px_2fr]">
          <div className="text-sm font-medium">{r.nomeAluno}{!r.podeEditar && <p className="mt-1 text-xs font-normal text-gray-500">Histórico em leitura após saída da turma.</p>}</div>
          <label className="flex flex-col gap-1 text-xs">Presença de {r.nomeAluno}<CampoCombobox className={campo} disabled={!r.podeEditar || carregando || !!troca} value={r.presente === null ? "" : r.presente ? "sim" : "nao"} onChange={(e) => setRegistros((rs) => rs.map((v, pos) => pos === i ? { ...v, presente: e.target.value === "" ? null : e.target.value === "sim" } : v))} placeholder="Não informada" vazio="Não informada" opcoes={[{ valor: "sim", rotulo: "Presente" }, { valor: "nao", rotulo: "Ausente" }]} /></label>
          <label className="flex flex-col gap-1 text-xs">Observação pedagógica de {r.nomeAluno}<CampoTexto className={campo} disabled={!r.podeEditar || carregando || !!troca} maxLength={2000} rows={2} value={r.observacao} onChange={(e) => setRegistros((rs) => rs.map((v, pos) => pos === i ? { ...v, observacao: e.target.value } : v))} /></label>
        </div>)}
        {turmaId && !carregando && !erro && !troca && registros.length === 0 && <EstadoVazio>Nenhum aluno elegível na data selecionada.</EstadoVazio>}
      </div>
      <div className="flex gap-3"><button className={botao} disabled={pendente || carregando || conferencia || !!troca || !turmaId || !data || !conteudo.trim() || registros.length === 0} onClick={salvar}>{pendente ? "Salvando…" : "Salvar aula"}</button><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente} onClick={() => { consulta.current++; setAberto(false); }}>Cancelar</button></div>
    </section>}
    {aulas.length === 0 && <EstadoVazio bloco>{mensagemVazio ?? "Nenhuma aula registrada neste histórico."}</EstadoVazio>}
    {aulas.map((a) => <article key={a.id} className="rounded-lg border border-gray-200 bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium">{a.turma} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: a.fusoExibicao }).format(new Date(a.ocorridaEm))}</h2>{a.encontroParaEditar ? <Link className={botaoClasses({ variante: "secundario", tamanho: "lg" })} href={`/diario/encontros/${a.encontroParaEditar}`}>Completar diário do encontro</Link> : a.podeEditar ? <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => abrir(a)}>Editar registro</button> : <span className="rounded-full bg-surface-muted px-2 py-1 text-xs text-gray-600">Somente leitura</span>}</div>
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
