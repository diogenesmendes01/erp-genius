"use client";

import { useState } from "react";
import { consultarConferenciaAgendaAditivo, registrarPropostaAgendaAditivo } from "@/server/contratos/agenda-aditivo";
import Link from "next/link";
import { alternarEncontro, montarAlteracoesAgenda, professorSelecionado } from "./controle";
import { botaoClasses } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { EstadoVazio } from "@/components/EstadoVazio";
import { CampoFuso } from "@/components/CampoFuso";

type Encontro = { id: string; inicio: string; fim: string; fusoOrigem: string; professorId: string | null; professor: string };
type Professor = { id: string; nome: string };
type Resultado = { proposta: { encontros: { encontroId: string; professorAnteriorId: string; professorNovoId: string; professorAnteriorNome: string; professorNovoNome: string; inicioAnterior: string; fimAnterior: string; inicioNovo: string; fimNovo: string; fusoAnterior: string; fusoNovo: string; duracaoMinutos: number }[] }; pendencias: string[] };

const exibir = (valor: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(valor));
const campoData = (valor: string, fuso: string) => {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(valor));
  const parte = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? "00";
  return `${parte("year")}-${parte("month")}-${parte("day")}T${parte("hour")}:${parte("minute")}`;
};
export function ConferenciaAgendaFormulario({ matriculaId, encontros, professores }: { matriculaId: string; encontros: Encontro[]; professores: Professor[] }) {
  // A consulta só lê (não reserva nem grava): repetir com os mesmos dados é seguro, daí a mensagem de reenvio.
  const [selecionados, setSelecionados] = useState<string[]>([]), [resultado, setResultado] = useState<Resultado | null>(null), acao = useAcaoCliente({ idempotente: true });
  const pendente = acao.ocupado;
  const alternar = (id: string) => { setResultado(null); setSelecionados(atual => alternarEncontro(atual, id)); };
  const lerAlteracoes = (dados: FormData) => {
    try {
      const valores = Object.fromEntries(selecionados.map(encontroId => [encontroId, { professorNovoId: String(dados.get(`professor-${encontroId}`) ?? ""), fusoOrigem: String(dados.get(`fuso-${encontroId}`) ?? ""), inicioLocal: String(dados.get(`inicio-${encontroId}`) ?? ""), fimLocal: String(dados.get(`fim-${encontroId}`) ?? "") }]));
      return montarAlteracoesAgenda(selecionados, valores);
    } catch { return null; }
  };
  return <section className="space-y-4 rounded border p-4"><div><h2 className="text-xl">Conferência de agenda</h2><p>Conferência — não reserva nem altera agenda.</p></div>
    {!encontros.length ? <EstadoVazio role="status">Não há encontros particulares futuros disponíveis para esta matrícula.</EstadoVazio> : <form className="space-y-4" onChange={() => setResultado(null)} onSubmit={async evento => { evento.preventDefault(); acao.limpar(); setResultado(null); const alteracoes = lerAlteracoes(new FormData(evento.currentTarget)); if (!alteracoes) { acao.setErro("Informe datas, horários e fuso válidos."); return; } if (!alteracoes.length) { acao.setErro("Selecione pelo menos um encontro para conferir."); return; } const d = await acao.executar(() => consultarConferenciaAgendaAditivo({ matriculaId, encontros: alteracoes })); if (d?.tipo !== "ok") return; if (!d.dado) acao.setErro("Conferência indisponível."); else setResultado(d.dado); }}>
      <fieldset className="space-y-3" disabled={pendente}><legend className="font-medium">Encontros atuais</legend>{encontros.map(encontro => { const ativo = selecionados.includes(encontro.id), docenteAtual = professorSelecionado(encontro.professorId, professores); return <div key={encontro.id} className="rounded border p-3"><label className="flex gap-2"><input type="checkbox" checked={ativo} onChange={() => alternar(encontro.id)} disabled={pendente} /><span>{encontro.professor} · {exibir(encontro.inicio, encontro.fusoOrigem)}–{exibir(encontro.fim, encontro.fusoOrigem)} ({encontro.fusoOrigem})</span></label>{ativo && <div className="mt-3 grid gap-3 md:grid-cols-2"><label>Docente novo<select className="mt-1 block w-full rounded border p-2" name={`professor-${encontro.id}`} defaultValue={docenteAtual} required><option value="" disabled>Escolha o docente</option>{professores.map(professor => <option key={professor.id} value={professor.id}>{professor.nome}</option>)}</select></label><label>Fuso novo<CampoFuso className="mt-1 block w-full rounded border p-2" name={`fuso-${encontro.id}`} padrao={encontro.fusoOrigem} /></label><label>Início novo<input className="mt-1 block w-full rounded border p-2" type="datetime-local" name={`inicio-${encontro.id}`} defaultValue={campoData(encontro.inicio, encontro.fusoOrigem)} required /></label><label>Fim novo<input className="mt-1 block w-full rounded border p-2" type="datetime-local" name={`fim-${encontro.id}`} defaultValue={campoData(encontro.fim, encontro.fusoOrigem)} required /></label></div>}</div>; })}</fieldset>
      <FeedbackAcao erro={acao.erro} /><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente}>{pendente ? "Conferindo…" : "Conferir alterações"}</button>
    </form>}
    {resultado && <section className="space-y-3" aria-live="polite"><h3 className="text-lg">Resultado da conferência</h3>{resultado.proposta.encontros.map(encontro => <article key={encontro.encontroId} className="rounded border p-3"><p>Antes: {encontro.professorAnteriorNome} · {exibir(encontro.inicioAnterior, encontro.fusoAnterior)}–{exibir(encontro.fimAnterior, encontro.fusoAnterior)} ({encontro.fusoAnterior})</p><p>Depois: {encontro.professorNovoNome} · {exibir(encontro.inicioNovo, encontro.fusoNovo)}–{exibir(encontro.fimNovo, encontro.fusoNovo)} ({encontro.fusoNovo}) · {encontro.duracaoMinutos} min</p></article>)}{resultado.pendencias.length ? <section><h4 className="font-medium">Pendências</h4><ul className="list-disc pl-5">{resultado.pendencias.map(pendencia => <li key={pendencia}>{pendencia}</li>)}</ul></section> : <RegistrarFotografia matriculaId={matriculaId} resultado={resultado} />}</section>}
  </section>;
}

export function RegistrarFotografia({ matriculaId, resultado }: { matriculaId: string; resultado: Resultado }) {
  // Chave estável pela vida do componente: na falha de transporte, repetir consulta a mesma tentativa.
  const acao = useAcaoCliente({ idempotente: true }), [id, setId] = useState<string | null>(null), [chave] = useState(() => crypto.randomUUID());
  const registrar = async () => {
    const d = await acao.executar(() => registrarPropostaAgendaAditivo({ matriculaId, encontros: resultado.proposta.encontros.map(e => ({ encontroId: e.encontroId, professorNovoId: e.professorNovoId, inicioNovo: e.inicioNovo, fimNovo: e.fimNovo, duracaoMinutos: e.duracaoMinutos, fusoOrigem: e.fusoNovo })), chaveIdempotencia: chave }),
      (dado) => dado ? "Fotografia registrada. A Secretaria deve vinculá-la à proposta contratual." : null);
    if (d?.tipo !== "ok") return;
    if (!d.dado) { acao.setErro("Fotografia indisponível. Repita sem editar para consultar a mesma tentativa."); return; }
    setId(d.dado.id);
  };
  if (id) return <section className="rounded border p-3"><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /><Link className="underline" href={`/matriculas/${encodeURIComponent(matriculaId)}/contrato/aditivos?agenda=${encodeURIComponent(id)}`}>Vincular esta fotografia à proposta de aditivo</Link></section>;
  return <section className="rounded border p-3"><p>Nenhuma pendência identificada nesta conferência. Registrar preserva a fotografia e não cria nem aprova o aditivo.</p><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /><button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={registrar} disabled={acao.ocupado}>{acao.ocupado ? "Registrando…" : "Registrar fotografia da agenda"}</button></section>;
}
