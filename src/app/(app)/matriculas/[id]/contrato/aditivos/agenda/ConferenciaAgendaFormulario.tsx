"use client";

import { useState, useTransition } from "react";
import { consultarConferenciaAgendaAditivo, registrarPropostaAgendaAditivo } from "@/server/contratos/agenda-aditivo";
import Link from "next/link";
import { alternarEncontro, montarAlteracoesAgenda, professorSelecionado } from "./controle";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

type Encontro = { id: string; inicio: string; fim: string; fusoOrigem: string; professorId: string | null; professor: string };
type Professor = { id: string; nome: string };
type Resultado = { proposta: { encontros: { encontroId: string; professorAnteriorId: string; professorNovoId: string; professorAnteriorNome: string; professorNovoNome: string; inicioAnterior: string; fimAnterior: string; inicioNovo: string; fimNovo: string; fusoAnterior: string; fusoNovo: string; duracaoMinutos: number }[] }; pendencias: string[] };

const exibir = (valor: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(valor));
const campoData = (valor: string, fuso: string) => {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(valor));
  const parte = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? "00";
  return `${parte("year")}-${parte("month")}-${parte("day")}T${parte("hour")}:${parte("minute")}`;
};
export function ConferenciaAgendaFormulario({ matriculaId, encontros, professores, fusoExibicao = null }: { matriculaId: string; encontros: Encontro[]; professores: Professor[]; fusoExibicao?: string | null }) {
  const [selecionados, setSelecionados] = useState<string[]>([]), [resultado, setResultado] = useState<Resultado | null>(null), [mensagem, setMensagem] = useState(""), [pendente, iniciar] = useTransition();
  const alternar = (id: string) => { setResultado(null); setSelecionados(atual => alternarEncontro(atual, id)); };
  return <section className="space-y-4 rounded border p-4"><div><h2 className="text-xl">Conferência de agenda</h2><p>Conferência — não reserva nem altera agenda.</p></div>
    {!encontros.length ? <p role="status">Não há encontros particulares futuros disponíveis para esta matrícula.</p> : <form className="space-y-4" onChange={() => setResultado(null)} onSubmit={evento => { evento.preventDefault(); setMensagem(""); setResultado(null); const dados = new FormData(evento.currentTarget); try { const valores = Object.fromEntries(selecionados.map(encontroId => [encontroId, { professorNovoId: String(dados.get(`professor-${encontroId}`) ?? ""), fusoOrigem: String(dados.get(`fuso-${encontroId}`) ?? ""), inicioLocal: String(dados.get(`inicio-${encontroId}`) ?? ""), fimLocal: String(dados.get(`fim-${encontroId}`) ?? "") }])); const alteracoes = montarAlteracoesAgenda(selecionados, valores); if (!alteracoes.length) { setMensagem("Selecione pelo menos um encontro para conferir."); return; } iniciar(async () => { const r = await consultarConferenciaAgendaAditivo({ matriculaId, encontros: alteracoes }); if (!r.ok || !r.dado) setMensagem(r.ok ? "Conferência indisponível." : r.erro); else setResultado(r.dado); }); } catch { setMensagem("Informe datas, horários e fuso válidos."); } }}>
      <fieldset className="space-y-3" disabled={pendente}><legend className="font-medium">Encontros atuais</legend>{encontros.map(encontro => { const ativo = selecionados.includes(encontro.id), docenteAtual = professorSelecionado(encontro.professorId, professores), inicio = formatarInstanteExibicao(encontro.inicio, fusoExibicao, encontro.fusoOrigem); return <div key={encontro.id} className="rounded border p-3"><label className="flex gap-2"><input type="checkbox" checked={ativo} onChange={() => alternar(encontro.id)} disabled={pendente} /><span>{encontro.professor} · {inicio.texto}–{formatarInstanteExibicao(encontro.fim, fusoExibicao, encontro.fusoOrigem).texto} ({inicio.fuso})</span></label>{ativo && <div className="mt-3 grid gap-3 md:grid-cols-2"><label>Docente novo<select className="mt-1 block w-full rounded border p-2" name={`professor-${encontro.id}`} defaultValue={docenteAtual} required><option value="" disabled>Escolha o docente</option>{professores.map(professor => <option key={professor.id} value={professor.id}>{professor.nome}</option>)}</select></label><label>Fuso novo<input className="mt-1 block w-full rounded border p-2" name={`fuso-${encontro.id}`} defaultValue={encontro.fusoOrigem} required /></label><label>Início novo<input className="mt-1 block w-full rounded border p-2" type="datetime-local" name={`inicio-${encontro.id}`} defaultValue={campoData(encontro.inicio, encontro.fusoOrigem)} required /></label><label>Fim novo<input className="mt-1 block w-full rounded border p-2" type="datetime-local" name={`fim-${encontro.id}`} defaultValue={campoData(encontro.fim, encontro.fusoOrigem)} required /></label></div>}</div>; })}</fieldset>
      {mensagem && <p role="alert">{mensagem}</p>}<button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Conferindo…" : "Conferir alterações"}</button>
    </form>}
    {resultado && <section className="space-y-3" aria-live="polite"><h3 className="text-lg">Resultado da conferência</h3>{resultado.proposta.encontros.map(encontro => <article key={encontro.encontroId} className="rounded border p-3"><p>Antes: {encontro.professorAnteriorNome} · {exibir(encontro.inicioAnterior, encontro.fusoAnterior)}–{exibir(encontro.fimAnterior, encontro.fusoAnterior)} ({encontro.fusoAnterior})</p><p>Depois: {encontro.professorNovoNome} · {exibir(encontro.inicioNovo, encontro.fusoNovo)}–{exibir(encontro.fimNovo, encontro.fusoNovo)} ({encontro.fusoNovo}) · {encontro.duracaoMinutos} min</p></article>)}{resultado.pendencias.length ? <section><h4 className="font-medium">Pendências</h4><ul className="list-disc pl-5">{resultado.pendencias.map(pendencia => <li key={pendencia}>{pendencia}</li>)}</ul></section> : <RegistrarFotografia matriculaId={matriculaId} resultado={resultado} />}</section>}
  </section>;
}

export function RegistrarFotografia({ matriculaId, resultado }: { matriculaId: string; resultado: Resultado }) {
  const [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState(""), [id, setId] = useState<string | null>(null), [chave] = useState(() => crypto.randomUUID());
  const registrar = () => iniciar(async () => {
    try { const r = await registrarPropostaAgendaAditivo({ matriculaId, encontros: resultado.proposta.encontros.map(e => ({ encontroId: e.encontroId, professorNovoId: e.professorNovoId, inicioNovo: e.inicioNovo, fimNovo: e.fimNovo, duracaoMinutos: e.duracaoMinutos, fusoOrigem: e.fusoNovo })), chaveIdempotencia: chave });
      if (!r.ok || !r.dado) { setMensagem(r.ok ? "Fotografia indisponível. Repita sem editar para consultar a mesma tentativa." : r.erro); return; }
      setId(r.dado.id); setMensagem("Fotografia registrada. A Secretaria deve vinculá-la à proposta contratual.");
    } catch { setMensagem("Não foi possível confirmar o registro. Repita sem editar para consultar a mesma tentativa."); }
  });
  if (id) return <section className="rounded border p-3"><p role="status">{mensagem}</p><Link className="underline" href={`/matriculas/${encodeURIComponent(matriculaId)}/contrato/aditivos?agenda=${encodeURIComponent(id)}`}>Vincular esta fotografia à proposta de aditivo</Link></section>;
  return <section className="rounded border p-3"><p>Nenhuma pendência identificada nesta conferência. Registrar preserva a fotografia e não cria nem aprova o aditivo.</p>{mensagem && <p role="alert">{mensagem}</p>}<button type="button" className="rounded border px-4 py-2" onClick={registrar} disabled={pendente}>{pendente ? "Registrando…" : "Registrar fotografia da agenda"}</button></section>;
}
