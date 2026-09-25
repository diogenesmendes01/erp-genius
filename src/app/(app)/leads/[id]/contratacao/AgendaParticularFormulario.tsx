"use client";
import { useState } from "react";
import { consultarProfessoresParticular, revisarAgendaParticularComercial } from "@/server/matricula/preparacao-comercial";
import { botaoClasses } from "@/components/Botao";
export type AgendaConferida = { ofertaId: string; versaoOferta: number; professorId: string; fusoOrigem: string; encontros: { data: string; horario: string; duracaoMinutos: number }[]; estadoHash: string; horariosAcordadosConferidos: true };
type Revisao = NonNullable<Extract<Awaited<ReturnType<typeof revisarAgendaParticularComercial>>, { ok: true }>["dado"]>;
export function AgendaParticularFormulario({ leadId, ofertaId, versaoOferta, fixa, onChange }: { leadId: string; ofertaId: string; versaoOferta: number; fixa: boolean; onChange: (agenda: AgendaConferida | null) => void }) {
  const [busca, setBusca] = useState(""), [pagina, setPagina] = useState(1), [mais, setMais] = useState(false);
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([]), [professorId, setProfessor] = useState("");
  const [fuso, setFuso] = useState(""), [horarios, setHorarios] = useState([{ data: "", horario: "", minutos: "" }]);
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState(""), [revisao, setRevisao] = useState<Revisao | null>(null), [confirmado, setConfirmado] = useState(false);
  function limpar() { setRevisao(null); setConfirmado(false); onChange(null); }
  const agenda = () => ({ ofertaId, versaoOferta, professorId, fusoOrigem: fuso, encontros: horarios.map((h) => ({ data: h.data, horario: h.horario, duracaoMinutos: Number(h.minutos) })) });
  async function buscar(p: number) {
    limpar(); setProfessor(""); setOcupado(true); setErro("");
    try { const r = await consultarProfessoresParticular({ leadId, busca, pagina: p }); if (!r.ok || !r.dado) { setErro(r.ok ? "Consulta indisponível." : r.erro); return; } setProfessores(r.dado.professores); setPagina(p); setMais(r.dado.possuiMais); setProfessor(""); limpar(); }
    catch { setErro("Não foi possível buscar professores."); } finally { setOcupado(false); }
  }
  async function conferir() {
    limpar(); setOcupado(true); setErro("");
    try { const r = await revisarAgendaParticularComercial({ leadId, ...agenda() }); if (!r.ok || !r.dado) { setErro(r.ok ? "Revisão indisponível." : r.erro); return; } setRevisao(r.dado); }
    catch { setErro("Não foi possível conferir os horários."); } finally { setOcupado(false); }
  }
  const mensagens: Record<string, string> = { PROFESSOR_INAPTO: "Selecione um professor ativo.", HORARIO_PASSADO: "Escolha apenas horários futuros.", EXCECAO_NAO_LETIVA_NECESSARIA: "Há período não letivo; ajuste a data ou encaminhe a exceção à gestão.", CONFLITO_AGENDA: "Há conflito com aulas já agendadas.", HORARIO_RESERVADO: "Há horário ocupado por outra reserva.", INDISPONIBILIDADE_DOCENTE: "O professor está indisponível no período.", CONFLITO_ENTRE_HORARIOS_PROPOSTOS: "Os encontros informados se sobrepõem." };
  return <fieldset disabled={ocupado} className="space-y-3 rounded border p-3"><legend>Agenda particular {fixa ? "com grade fixa" : "flexível"}</legend>
    <p>{fixa ? "Informe todos os encontros recorrentes acordados para esta contratação." : "Reserve ao menos o primeiro encontro acordado. Os seguintes dependem de novo agendamento."}</p>
    <label className="block">Buscar professor<input value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={100} className="block rounded border p-2" /></label>
    <button type="button" onClick={() => buscar(1)} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Buscar professores</button>
    <div>{pagina > 1 && <button type="button" onClick={() => buscar(pagina - 1)}>Professores anteriores</button>} {mais && <button type="button" onClick={() => buscar(pagina + 1)}>Mais professores</button>}</div>
    <label className="block">Professor<select required value={professorId} onChange={(e) => { setProfessor(e.target.value); limpar(); }} className="block rounded border p-2"><option value="">Selecione após buscar</option>{professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <label className="block">Fuso dos horários<input required value={fuso} placeholder="America/Sao_Paulo" onChange={(e) => { setFuso(e.target.value); limpar(); }} className="block rounded border p-2" /></label>
    {horarios.map((h, i) => <div key={i} className="flex flex-wrap gap-3"><label>Data {i + 1}<input type="date" required value={h.data} onChange={(e) => { setHorarios(horarios.map((v, j) => j === i ? { ...v, data: e.target.value } : v)); limpar(); }} className="block rounded border p-2" /></label><label>Horário<input type="time" required value={h.horario} onChange={(e) => { setHorarios(horarios.map((v, j) => j === i ? { ...v, horario: e.target.value } : v)); limpar(); }} className="block rounded border p-2" /></label><label>Duração em minutos<input type="number" min="1" max="1440" step="1" required value={h.minutos} onChange={(e) => { setHorarios(horarios.map((v, j) => j === i ? { ...v, minutos: e.target.value } : v)); limpar(); }} className="block rounded border p-2" /></label>{horarios.length > 1 && <button type="button" onClick={() => { setHorarios(horarios.filter((_, j) => i !== j)); limpar(); }}>Remover encontro {i + 1}</button>}</div>)}
    <button type="button" disabled={horarios.length >= 1000} onClick={() => { setHorarios([...horarios, { data: "", horario: "", minutos: "" }]); limpar(); }} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Adicionar encontro</button>
    <button type="button" onClick={conferir} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Conferir disponibilidade</button>
    {erro && <p role="alert">{erro}</p>}
    {revisao && <div aria-live="polite"><p>Conferência de horários — ainda sem reserva.</p><ul>{revisao.encontros.map((e) => <li key={e.indice}>{new Intl.DateTimeFormat("pt-BR", { timeZone: fuso.trim(), dateStyle: "short", timeStyle: "short" }).format(new Date(e.inicio))} — {new Intl.DateTimeFormat("pt-BR", { timeZone: fuso.trim(), dateStyle: "short", timeStyle: "short" }).format(new Date(e.fim))}{e.conflito ? " · Horário ocupado" : ""}{e.docenteIndisponivel ? " · Professor indisponível" : ""}{e.naoLetivo ? " · Período não letivo" : ""}</li>)}</ul>
      {revisao.impedimentos.length ? <ul role="alert">{revisao.impedimentos.map((i) => <li key={i}>{mensagens[i] ?? "Confira a pendência com a gestão."}</li>)}</ul> : <label className="block"><input type="checkbox" checked={confirmado} onChange={(e) => { setConfirmado(e.target.checked); onChange(e.target.checked ? { ...agenda(), estadoHash: revisao.estadoHash, horariosAcordadosConferidos: true } : null); }} /> Conferi os horários acordados e apresentados acima.</label>}
    </div>}
  </fieldset>;
}
