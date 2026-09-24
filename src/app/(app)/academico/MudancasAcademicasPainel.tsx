"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  solicitarMudancaAcademica, registrarParecerMudanca, decidirMudancaAcademica,
  executarMudancaAcademica, cancelarMudancaAcademica,
} from "@/server/academico/acoes";
import type { ContextoMudancaAcademica, SolicitacaoAcademicaView } from "@/server/academico/consultas";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { MensagemStatus } from "@/components/MensagemStatus";

const campo = "w-full rounded-md border border-gray-300 bg-surface px-3 py-2 text-sm";
const botao = "rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50";
const principal = "rounded-md bg-brand-solid px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50";
const nomesStatus = { PENDENTE: "Aguardando decisão pedagógica", APROVADA: "Aprovada · aguardando execução", REJEITADA: "Rejeitada", EXECUTADA: "Executada", CANCELADA: "Cancelada" };

export function MudancasAcademicasPainel({ contexto, solicitacoes, erroConsulta, podeExecutarEquivalencia, fusoExibicao = "America/Sao_Paulo" }: {
  contexto?: ContextoMudancaAcademica | null;
  solicitacoes: SolicitacaoAcademicaView[];
  erroConsulta?: string | null;
  podeExecutarEquivalencia?: boolean;
  fusoExibicao?: string;
}) {
  const router = useRouter();
  const [destinoId, setDestinoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [horarioCompativel, setHorarioCompativel] = useState(false);
  const [entradas, setEntradas] = useState<Record<string, string>>({});
  const [horariosExecucao, setHorariosExecucao] = useState<Record<string, boolean>>({});
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const destino = contexto?.destinos.find((t) => t.id === destinoId);
  const podePrepararEquivalencia = contexto?.podePrepararEquivalencia === true;
  const data = (valor: string) => formatarInstanteExibicao(valor, fusoExibicao, "America/Sao_Paulo").texto;
  const valor = (id: string, chave: string) => entradas[`${id}:${chave}`] ?? "";
  const escrever = (id: string, chave: string, texto: string) => setEntradas((atual) => ({ ...atual, [`${id}:${chave}`]: texto }));

  async function executar(acao: () => Promise<{ ok: boolean; erro?: string }>, mensagem: string) {
    setOcupado(true); setErro(null); setAviso(null);
    try {
      const resultado = await acao();
      if (!resultado.ok) { setErro(resultado.erro ?? "Não foi possível concluir a operação."); return; }
      setAviso(mensagem);
      setDestinoId(""); setMotivo(""); setHorarioCompativel(false); setEntradas({}); setHorariosExecucao({});
      router.refresh();
    } catch {
      setErro("Não foi possível confirmar a resposta. Atualize a página para conferir o estado antes de tentar novamente.");
    } finally { setOcupado(false); }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!contexto || !destino || destino.tipo !== "EXCECAO" || !horarioCompativel) return;
    void executar(() => solicitarMudancaAcademica(contexto.alunoId, { matriculaId: contexto.origem?.matriculaId ?? undefined, alocacaoOrigemId: contexto.origem?.alocacaoId, turmaDestinoId: destino.id, motivo, horarioCompativel: true }), "Solicitação enviada. O aluno permanece na turma atual até a aprovação pedagógica e a execução pela secretaria.");
  }

  return <section className="space-y-5" aria-label="Mudanças acadêmicas">
    <p className="text-xs text-gray-500">Instantes administrativos exibidos em {fusoExibicao} (origem UTC).</p>
    {(erro || erroConsulta) && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro ?? erroConsulta}</p>}
    <MensagemStatus texto={aviso} className="rounded-md bg-blue-50 p-3 text-sm text-blue-700" />
    {contexto && <div className="space-y-3 rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="text-lg font-medium">Turma e nível do aluno</h2>
      <p className="text-sm">Turma atual: <strong>{contexto.origem?.label ?? "Sem alocação ativa"}</strong></p>
      {contexto.origem?.diasHorario && <p className="text-sm text-gray-500">Horário atual: {contexto.origem.diasHorario}</p>}
      {contexto.impedimento && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{contexto.impedimento}</p>}
      {contexto.pedidoAbertoId && <p className="text-sm text-gray-600">Existe uma solicitação aberta. Confira a decisão ou cancele a solicitação com motivo antes de propor outra mudança.</p>}
      {contexto.origem && !erroConsulta && ((podePrepararEquivalencia && !contexto.impedimento && !contexto.pedidoAbertoId) || (podeExecutarEquivalencia && contexto.origem.matriculaId)) && <nav aria-label="Aproveitamento em turma equivalente" className="space-y-2 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium">Transferência em turma equivalente</h3>
        {podePrepararEquivalencia && !contexto.impedimento && !contexto.pedidoAbertoId && <Link className="block text-sm text-brand-700 underline" href={`/academico/avaliacoes/${encodeURIComponent(contexto.origem.alocacaoId)}/equivalencia`}>Preparar aproveitamento para uma turma do mesmo nível</Link>}
        {podeExecutarEquivalencia && contexto.origem.matriculaId && <Link className="block text-sm text-brand-700 underline" href={`/academico/equivalencias?matriculaId=${encodeURIComponent(contexto.origem.matriculaId)}`}>Consultar propostas de aproveitamento autorizadas</Link>}
        <p className="text-xs text-gray-500">A preparação, decisão pedagógica e execução pela Secretaria são etapas separadas. Nenhuma transferência é feita por este atalho.</p>
      </nav>}
      {contexto.origem && !contexto.impedimento && !contexto.pedidoAbertoId && !erroConsulta && contexto.podeSolicitar && <form onSubmit={enviar} className="space-y-4 border-t border-gray-200 pt-4">
        <label className="block text-sm font-medium">Turma de destino
          <select className={`${campo} mt-1 font-normal`} value={destinoId} disabled={ocupado} required onChange={(e) => { setDestinoId(e.target.value); setHorarioCompativel(false); }}>
            <option value="">Selecione uma turma</option>
            {contexto.destinos.filter((t) => t.tipo === "EXCECAO").map((t) => <option key={t.id} value={t.id}>{t.label} · {t.vagas} vagas · exige aprovação</option>)}
          </select>
        </label>
        {contexto.destinos.length === 0 && <p className="text-sm text-gray-500">Não há turma de destino disponível no mesmo idioma, modalidade e formato.</p>}
        {destino && <div className="space-y-2 rounded-md bg-gray-50 p-3 text-sm">
          <p>Horário de destino: <strong>{destino.diasHorario ?? "A definir — confirme a disponibilidade com a escola"}</strong></p>
          <p>Mudança de nível: exige parecer docente ou dispensa justificada, decisão de outra pessoa da gestão pedagógica e execução pela secretaria.</p>
        </div>}
        <label className="block text-sm font-medium">Motivo da mudança
          <textarea className={`${campo} mt-1 font-normal`} rows={3} minLength={5} maxLength={2000} required disabled={ocupado} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={horarioCompativel} required disabled={ocupado || !destino} onChange={(e) => setHorarioCompativel(e.target.checked)} />Conferi o horário de destino com o aluno ou responsável e confirmei a compatibilidade.</label>
        <button type="submit" className={principal} disabled={ocupado || !destino || !horarioCompativel || motivo.trim().length < 5}>Enviar para aprovação pedagógica</button>
      </form>}
      <p className="text-xs text-gray-500">Este fluxo preserva idioma, modalidade, formato, contrato e pagamentos. Mudanças de curso ou condições comerciais precisam do fluxo correspondente. A conferência de horário é humana; a vaga é revalidada na execução.</p>
    </div>}

    {solicitacoes.length === 0 && !erroConsulta && <p className="rounded-lg border border-gray-200 bg-surface p-4 text-sm text-gray-500">Nenhuma solicitação acadêmica neste filtro.</p>}
    {solicitacoes.map((p) => <article key={p.id} className="space-y-4 rounded-lg border border-gray-200 bg-surface p-4" aria-labelledby={`pedido-${p.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 id={`pedido-${p.id}`} className="font-medium"><Link className="text-brand-700 hover:underline" href={`/alunos/${p.alunoId}/academico`}>{p.alunoNome}</Link></h2><p className="text-xs text-gray-500">Solicitado por {p.solicitante.nome} em {data(p.criadoEm)}</p></div>
        <span className={`rounded-full px-2 py-1 text-xs ${p.status === "EXECUTADA" ? "bg-green-50 text-green-700" : p.status === "PENDENTE" || p.status === "APROVADA" ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600"}`}>{nomesStatus[p.status]}</span>
      </header>
      <dl className="grid gap-3 rounded-md bg-gray-50 p-3 text-sm sm:grid-cols-2"><div><dt className="font-medium">Origem</dt><dd>{p.origem.label}<span className="block text-gray-500">{p.origem.diasHorario ?? "Horário a definir"}</span></dd></div><div><dt className="font-medium">Destino solicitado</dt><dd>{p.destino.label}<span className="block text-gray-500">{p.destino.diasHorario ?? "Horário a definir"}</span></dd></div></dl>
      <p className="whitespace-pre-wrap text-sm">{p.motivo}</p>
      {p.impedimento && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{p.impedimento}</p>}
      <div className="space-y-2"><h3 className="text-sm font-medium">Parecer docente</h3>
        {p.pareceres.length === 0 ? <p className="text-sm text-gray-500">Nenhum parecer registrado.</p> : p.pareceres.map((parecer) => <blockquote key={parecer.id} className="border-l-2 border-gray-300 pl-3 text-sm"><p className="whitespace-pre-wrap">{parecer.conteudo}</p><footer className="mt-1 text-xs text-gray-500">{parecer.autorNome} · {data(parecer.criadoEm)}</footer></blockquote>)}
        {p.podeDarParecer && <div className="space-y-2"><label className="block text-sm">Registrar parecer<textarea className={`${campo} mt-1`} rows={3} maxLength={2000} disabled={ocupado} value={valor(p.id, "parecer")} onChange={(e) => escrever(p.id, "parecer", e.target.value)} /></label><button className={botao} disabled={ocupado || valor(p.id, "parecer").trim().length < 5} onClick={() => void executar(() => registrarParecerMudanca(p.id, { conteudo: valor(p.id, "parecer") }), "Parecer registrado para análise da gestão pedagógica.")}>Registrar parecer docente</button></div>}
      </div>
      {p.aprovador && <p className="text-sm">Decisão de <strong>{p.aprovador.nome}</strong>{p.decididoEm ? ` em ${data(p.decididoEm)}` : ""}: {p.motivoDecisao}</p>}
      {p.justificativaDispensaParecer && <p className="text-sm">Dispensa de parecer justificada: {p.justificativaDispensaParecer}</p>}
      {p.executor && <p className="text-sm">Executado por <strong>{p.executor.nome}</strong>{p.executadoEm ? ` em ${data(p.executadoEm)}` : ""}: {p.motivoExecucao}</p>}
      {p.cancelador && <p className="text-sm">Cancelado por <strong>{p.cancelador.nome}</strong>{p.canceladoEm ? ` em ${data(p.canceladoEm)}` : ""}: {p.motivoCancelamento}</p>}
      {p.podeDecidir && <div className="space-y-3 border-t border-gray-200 pt-3">
        <label className="block text-sm">Fundamentação da decisão<textarea className={`${campo} mt-1`} rows={3} maxLength={2000} disabled={ocupado} value={valor(p.id, "decisao")} onChange={(e) => escrever(p.id, "decisao", e.target.value)} /></label>
        {!p.temParecerVigente && <label className="block text-sm">Justificativa para dispensar o parecer indisponível<span className="block text-xs text-gray-500">Obrigatória para aprovar sem parecer vigente do professor atual. A rejeição não exige dispensa.</span><textarea className={`${campo} mt-1`} rows={2} maxLength={2000} disabled={ocupado} value={valor(p.id, "dispensa")} onChange={(e) => escrever(p.id, "dispensa", e.target.value)} /></label>}
        <div className="flex flex-wrap gap-2"><button className={principal} disabled={ocupado || !!p.impedimento || valor(p.id, "decisao").trim().length < 5 || (!p.temParecerVigente && valor(p.id, "dispensa").trim().length < 5)} onClick={() => void executar(() => decidirMudancaAcademica(p.id, { aprovar: true, motivo: valor(p.id, "decisao"), ...(p.temParecerVigente ? {} : { justificativaDispensaParecer: valor(p.id, "dispensa") }) }), "Mudança aprovada. O aluno permanece na turma atual até a execução pela secretaria.")}>Aprovar mudança</button><button className={botao} disabled={ocupado || valor(p.id, "decisao").trim().length < 5} onClick={() => void executar(() => decidirMudancaAcademica(p.id, { aprovar: false, motivo: valor(p.id, "decisao") }), "Solicitação rejeitada. A turma do aluno foi preservada.")}>Rejeitar solicitação</button></div>
      </div>}
      {p.podeExecutar && <div className="space-y-3 border-t border-gray-200 pt-3">
        <label className="block text-sm">Registro da execução<textarea className={`${campo} mt-1`} rows={2} maxLength={2000} disabled={ocupado} value={valor(p.id, "execucao")} onChange={(e) => escrever(p.id, "execucao", e.target.value)} /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={ocupado} checked={horariosExecucao[p.id] ?? false} onChange={(e) => { const checked = e.target.checked; setHorariosExecucao((atual) => ({ ...atual, [p.id]: checked })); }} />Reconfirmei o horário aprovado com o aluno ou responsável.</label>
        <button className={principal} disabled={ocupado || !!p.impedimento || !horariosExecucao[p.id] || valor(p.id, "execucao").trim().length < 5} onClick={() => void executar(() => executarMudancaAcademica(p.id, { motivo: valor(p.id, "execucao"), horarioCompativel: true }), "Mudança executada. O aluno está na turma aprovada e os registros anteriores foram preservados.")}>Executar mudança aprovada</button>
      </div>}
      {p.status === "PENDENTE" && !p.podeDecidir && <p className="text-xs text-gray-500">A decisão cabe a outra pessoa da Gerência Pedagógica ou da Administração.</p>}
      {p.status === "APROVADA" && !p.podeExecutar && <p className="text-xs text-gray-500">Aguardando execução pela Secretaria ou Administração.</p>}
      {p.podeCancelar && <details className="border-t border-gray-200 pt-3 text-sm"><summary className="cursor-pointer">Cancelar esta solicitação</summary><div className="mt-3 space-y-2"><p className="text-gray-500">O cancelamento preserva a turma atual e permite uma nova solicitação.</p><label className="block">Motivo do cancelamento<textarea className={`${campo} mt-1`} rows={2} maxLength={2000} disabled={ocupado} value={valor(p.id, "cancelamento")} onChange={(e) => escrever(p.id, "cancelamento", e.target.value)} /></label><button className={botao} disabled={ocupado || valor(p.id, "cancelamento").trim().length < 5} onClick={() => void executar(() => cancelarMudancaAcademica(p.id, { motivo: valor(p.id, "cancelamento") }), "Solicitação cancelada. A turma atual foi preservada.")}>Confirmar cancelamento da solicitação</button></div></details>}
    </article>)}
  </section>;
}
