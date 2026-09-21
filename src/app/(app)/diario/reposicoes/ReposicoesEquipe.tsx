"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { decidirReposicaoIndividual, solicitarReposicaoIndividual } from "@/server/diario/reposicao-individual";
import { agendarReposicaoIndividual, consultarPreviaAgendaReposicaoIndividual, decidirCancelamentoReposicaoIndividual, decidirRemarcacaoReposicaoIndividual, proporCancelamentoReposicaoIndividual, proporRemarcacaoReposicaoIndividual } from "@/server/diario/reposicao-agenda";
import { OperacaoEntregaReposicao, type OperacaoEntrega } from "./OperacaoEntregaReposicao";
import { RelatarIndisponibilidadeReposicao } from "./RelatarIndisponibilidadeReposicao";
import { criarControleAgendaParticular } from "./AgendaParticularControle";
import { ExcecaoAgendaReposicao, type HorarioExcecaoProposto } from "./ExcecaoAgendaReposicao";

export type OrigemReposicao = {
  aulaOriginalId: string;
  matriculaId: string;
  participacao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO";
  inicio: string;
  fim: string;
  fuso: string;
  turma: string | null;
};

const rotuloParticipacaoOrigem: Record<OrigemReposicao["participacao"], string> = {
  PRESENTE: "presença corrigida na aula de origem",
  FALTA: "falta na aula de origem",
  IMPEDIDO_POR_RESTRICAO: "impedimento por restrição na aula de origem",
};

export function descreverParticipacaoOrigem(participacao: OrigemReposicao["participacao"]) {
  return rotuloParticipacaoOrigem[participacao];
}

export type ReposicaoEquipe = {
  id: string;
  modalidade: "PARTICULAR" | "GRAVACAO";
  origem: OrigemReposicao;
  solicitadaEm: string;
  solicitadaPor: string;
  motivo: string;
  evidencia: string;
  decisao: null | { aprovada: boolean; motivo: string; decididaEm: string; decisor: string };
  conclusao: null | { concluida: boolean; dataResultado: string | null; versao: number };
  podeDecidir: boolean;
  cicloAgenda?: null | {
    agendaId: string; encontroId: string; professorId: string | null; fusoOrigem: string; statusBeneficio: "RESERVADA" | "CONSUMIDA" | "DEVOLVIDA" | "ISENTA_EXCECAO"; encontroStatus: string;
    cancelamentoId: string | null; cancelamentoAutorId: string | null; remarcacaoId: string | null; remarcacaoAutorId: string | null;
  };
  agendaInicial?: null | {
    fuso: string | null;
    professores: { id: string; nome: string }[];
    autorizacoesExcepcionais: { id: string; motivo: string; decididaEm: string }[];
  };
  excecoesAgenda?: { id: string; professor: string; inicio: string; fim: string; fuso: string; motivo: string; evidencia: string; solicitante: string; criadaEm: string; versao: number; decisao: null | { aprovada: boolean; motivo: string; decididaEm: string; decisor: string }; podeDecidir: boolean }[];
};

const formato = (valor: string, fuso: string) => {
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(valor)); }
  catch { return valor.replace("T", " ").replace("Z", " UTC"); }
};

export function SolicitarReposicao({ origem }: { origem: OrigemReposicao }) {
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const chave = useRef<string | null>(null);
  const router = useRouter();
  return <form className="space-y-3 rounded border p-4" onChange={() => { chave.current = null; setErro(""); }} onSubmit={e => {
    e.preventDefault(); const dados = new FormData(e.currentTarget);
    chave.current ??= crypto.randomUUID();
    iniciar(async () => {
      setErro("");
      try {
        const r = await solicitarReposicaoIndividual({ aulaOriginalId: origem.aulaOriginalId, matriculaId: origem.matriculaId, modalidade: String(dados.get("modalidade")) as "PARTICULAR" | "GRAVACAO", motivo: String(dados.get("motivo") ?? ""), evidencia: String(dados.get("evidencia") ?? ""), chaveIdempotencia: chave.current! });
        if (!r.ok) { setErro(r.erro); return; }
        router.refresh();
      } catch { setErro("O pedido não foi confirmado. Consulte as reposições antes de reenviar."); }
    });
  }}>
    <h2 className="text-lg font-medium">Solicitar reposição individual</h2>
    <p>Origem: {descreverParticipacaoOrigem(origem.participacao)}, de {formato(origem.inicio, origem.fuso)} a {formato(origem.fim, origem.fuso)} ({origem.fuso}). A participação da aula de origem é conferida novamente pelo servidor.</p>
    <label className="block">Modalidade<select name="modalidade" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option><option value="PARTICULAR">Aula particular de reposição</option><option value="GRAVACAO">Gravação com resumo e atividade</option></select></label>
    <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
    <label className="block">Evidência do pedido<textarea name="evidencia" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
    <p className="text-sm">A solicitação não agenda particular, não publica gravação e não regulariza a frequência. Outra pessoa autorizada ainda precisa decidir.</p>
    <button className="rounded border px-4 py-2" disabled={ocupado}>{ocupado ? "Registrando…" : "Registrar pedido"}</button>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}

export function ReposicoesEquipe({ reposicoes, operacoes = {}, mostrarRelatoEquipe = false, mostrarCorrecoes = false, fusoExibicao, preferenciaFusoExibicao = null }: { reposicoes: ReposicaoEquipe[]; operacoes?: Record<string, OperacaoEntrega>; mostrarRelatoEquipe?: boolean; mostrarCorrecoes?: boolean; fusoExibicao: string; preferenciaFusoExibicao?: string | null }) {
  return <section className="space-y-4">
    <h1 className="text-2xl font-medium">Reposições individuais por matrícula</h1>
    <p>Esta lista mostra apenas a origem acadêmica e o estado da reposição. Não expõe dados pessoais nem financeiros do aluno.</p>
    {!reposicoes.length && <p>Nenhuma reposição encontrada no escopo consultado.</p>}
    {reposicoes.map(reposicao => <article key={reposicao.id} className="space-y-3 rounded border p-4">
      <h2 className="text-lg font-medium">{reposicao.modalidade === "PARTICULAR" ? "Particular de reposição" : "Gravação de reposição"}</h2>
      <p>Origem: {descreverParticipacaoOrigem(reposicao.origem.participacao)}, de {formato(reposicao.origem.inicio, fusoExibicao)} a {formato(reposicao.origem.fim, fusoExibicao)} (exibido em {fusoExibicao}; origem {reposicao.origem.fuso}).</p>
      {reposicao.origem.participacao === "PRESENTE" && <p role="status" className="text-sm text-gray-600">A participação da aula de origem foi corrigida para presença. Esta reposição permanece no histórico e essa correção não conclui nem regulariza o pedido.</p>}
      <p>Solicitada por {reposicao.solicitadaPor} em {formato(reposicao.solicitadaEm, fusoExibicao)} ({fusoExibicao}).</p>
      <p className="whitespace-pre-wrap">Motivo: {reposicao.motivo}</p><p className="whitespace-pre-wrap">Evidência: {reposicao.evidencia}</p>
      {reposicao.decisao ? <div className="rounded bg-gray-50 p-3"><p className="font-medium">{reposicao.decisao.aprovada ? "Autorizada; aguarda conclusão" : "Pedido rejeitado"}</p><p>Decisão de {reposicao.decisao.decisor} em {formato(reposicao.decisao.decididaEm, fusoExibicao)} ({fusoExibicao}).</p><p className="whitespace-pre-wrap">{reposicao.decisao.motivo}</p></div> : reposicao.podeDecidir ? <DecidirReposicao reposicaoId={reposicao.id} /> : <p role="status">Aguardando decisão independente.</p>}
      {reposicao.conclusao ? <p role="status">{reposicao.conclusao.concluida ? `Reposta em ${reposicao.conclusao.dataResultado ? formato(reposicao.conclusao.dataResultado, fusoExibicao) : "data a conferir"}.` : "Conclusão registrada sem regularização."} Versão {reposicao.conclusao.versao}.</p> : reposicao.decisao?.aprovada && <p role="status">A autorização não confirma a reposição nem altera a frequência.</p>}
      {mostrarCorrecoes && reposicao.conclusao && <Link className="inline-block text-sm text-brand-700 underline" href={`/academico/reposicoes/correcoes/${encodeURIComponent(reposicao.id)}`}>Consultar ou corrigir a conclusão</Link>}
      {reposicao.modalidade === "PARTICULAR" && reposicao.decisao?.aprovada && reposicao.agendaInicial && <AgendarParticular reposicaoId={reposicao.id} opcoes={reposicao.agendaInicial} excecoes={reposicao.excecoesAgenda ?? []} preferenciaFusoExibicao={preferenciaFusoExibicao} />}
      {reposicao.modalidade === "PARTICULAR" && reposicao.decisao?.aprovada && !reposicao.agendaInicial && <ExcecaoAgendaReposicao reposicaoId={reposicao.id} excecoes={reposicao.excecoesAgenda ?? []} preferenciaFusoExibicao={preferenciaFusoExibicao} />}
      {reposicao.modalidade === "PARTICULAR" && reposicao.decisao?.aprovada && reposicao.cicloAgenda && <CicloAgenda agenda={reposicao.cicloAgenda} />}
      {reposicao.modalidade === "GRAVACAO" && reposicao.decisao?.aprovada && mostrarRelatoEquipe && <RelatarIndisponibilidadeReposicao reposicaoId={reposicao.id} />}
      {reposicao.modalidade === "GRAVACAO" && reposicao.decisao?.aprovada && operacoes[reposicao.id] && <OperacaoEntregaReposicao operacao={operacoes[reposicao.id]} fusoExibicao={fusoExibicao} />}
    </article>)}
  </section>;
}

type PreviaAgenda = {
  periodo: null | { inicio: string; fimExclusivo: string };
  quantidadePorPeriodo: number | null; saldo: number | null;
  conflitos: { encontros: number; indisponibilidades: number; reservas: number };
  diasNaoLetivos: unknown[]; excecaoAgendaAprovada: boolean; exigeAutorizacaoExcecao: boolean; podeAgendar: boolean;
};

function AgendarParticular({ reposicaoId, opcoes, excecoes, preferenciaFusoExibicao }: { reposicaoId: string; opcoes: NonNullable<ReposicaoEquipe["agendaInicial"]>; excecoes: NonNullable<ReposicaoEquipe["excecoesAgenda"]>; preferenciaFusoExibicao: string | null }) {
  const [ocupado, iniciar] = useTransition(); const [erro, setErro] = useState(""); const [sucesso, setSucesso] = useState(""); const [previa, setPrevia] = useState<PreviaAgenda | null>(null); const [horarioConferido, setHorarioConferido] = useState<HorarioExcecaoProposto | null>(null);
  const controle = useRef(criarControleAgendaParticular(() => crypto.randomUUID())).current; const router = useRouter();
  if (!opcoes.fuso || !opcoes.professores.length) return <p role="status">Não há docente ativo ou fuso institucional disponível para preparar esta agenda.</p>;
  const ler = (form: HTMLFormElement) => ({ reposicaoId, professorId: String(new FormData(form).get("professorId") ?? ""), inicioLocal: String(new FormData(form).get("inicioLocal") ?? ""), fimLocal: String(new FormData(form).get("fimLocal") ?? ""), fuso: String(new FormData(form).get("fuso") ?? ""), autorizacaoExcecaoId: String(new FormData(form).get("autorizacaoExcecaoId") ?? "") || undefined });
  const conferir = (form: HTMLFormElement) => {
    const entrada = ler(form), revisaoSolicitada = controle.iniciarPrevia();
    setErro(""); setSucesso(""); setPrevia(null); setHorarioConferido(null); iniciar(async () => {
    try { const r = await consultarPreviaAgendaReposicaoIndividual(entrada); if (!controle.previaAindaAtual(revisaoSolicitada)) return; if (!r.ok || !r.dado) { setErro(r.ok ? "A prévia não foi confirmada." : r.erro); return; } setPrevia(r.dado); const professor = opcoes.professores.find(p => p.id === entrada.professorId); setHorarioConferido(professor ? { professorId: entrada.professorId, professor: professor.nome, inicioLocal: entrada.inicioLocal, fimLocal: entrada.fimLocal, fuso: entrada.fuso } : null); }
    catch { if (controle.previaAindaAtual(revisaoSolicitada)) setErro("A prévia não foi confirmada. Consulte a agenda antes de tentar novamente."); }
    });
  };
  return <><form className="space-y-3 border-t pt-3" onChange={() => { controle.alterar(); setPrevia(null); setHorarioConferido(null); setErro(""); setSucesso(""); }} onSubmit={e => {
    e.preventDefault(); const form = e.currentTarget;
    if (!previa?.podeAgendar) { conferir(form); return; }
    const dados = new FormData(form), entrada = { ...ler(form), motivo: String(dados.get("motivo") ?? "") }, chaveIdempotencia = controle.chavePara(JSON.stringify(entrada));
    iniciar(async () => {
      setErro(""); setSucesso("");
      try { const r = await agendarReposicaoIndividual({ ...entrada, chaveIdempotencia }); if (!r.ok) { setErro(r.erro); return; } setSucesso("Agendamento confirmado. Atualizando a consulta."); router.refresh(); }
      catch { setErro("O agendamento não foi confirmado. Consulte a agenda antes de reenviar."); }
    });
  }}>
    <fieldset disabled={ocupado} className="space-y-3"><h3 className="font-medium">Agendar aula particular autorizada</h3>
    <p className="text-sm">Confira cota, período e conflitos antes de confirmar. O servidor confere tudo novamente no envio; uma data não letiva exige a aprovação específica daquele horário.</p>
    <label className="block">Docente<select name="professorId" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione o docente</option>{opcoes.professores.map((professor) => <option key={professor.id} value={professor.id}>{professor.nome}</option>)}</select></label>
    <div className="grid gap-3 md:grid-cols-2"><label className="block">Início local<input name="inicioLocal" type="datetime-local" required className="block w-full rounded border p-2" /></label><label className="block">Fim local<input name="fimLocal" type="datetime-local" required className="block w-full rounded border p-2" /></label></div>
    <label className="block">Fuso horário<input name="fuso" required defaultValue={opcoes.fuso} className="block w-full rounded border p-2" /></label><p className="text-sm">Use o identificador do local, por exemplo, America/Sao_Paulo.</p>
    {opcoes.autorizacoesExcepcionais.length > 0 && <label className="block">Autorização excepcional aprovada (somente se não houver benefício)<select name="autorizacaoExcecaoId" defaultValue="" className="block rounded border p-2"><option value="">Usar benefício normal</option>{opcoes.autorizacoesExcepcionais.map((autorizacao) => <option key={autorizacao.id} value={autorizacao.id}>Autorização aprovada: {autorizacao.motivo}</option>)}</select></label>}
    <label className="block">Motivo do agendamento<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <button type="button" onClick={e => conferir(e.currentTarget.form!)} disabled={ocupado} className="rounded border px-4 py-2">{ocupado ? "Conferindo…" : "Conferir agenda"}</button>
    {previa && <div role="status" className="rounded bg-gray-50 p-3"><p>{previa.quantidadePorPeriodo === null ? "Sem benefício normal vigente." : `Cota: ${previa.saldo} de ${previa.quantidadePorPeriodo} disponível no período de ${previa.periodo?.inicio} até ${previa.periodo?.fimExclusivo} (fim exclusivo).`}</p><p>Conflitos: {previa.conflitos.encontros} encontro(s), {previa.conflitos.indisponibilidades ? "indisponibilidade docente" : "sem indisponibilidade docente"}, {previa.conflitos.reservas ? "reserva contratada" : "sem reserva contratada"}.</p>{previa.exigeAutorizacaoExcecao && <p>Sem benefício normal, selecione uma autorização excepcional aprovada para esta reposição.</p>}{previa.diasNaoLetivos.length > 0 && <p>{previa.excecaoAgendaAprovada ? "A exceção de agenda deste docente e horário já está aprovada." : "O horário atinge dia não letivo e requer exceção de agenda aprovada para este mesmo docente e intervalo."}</p>}{previa.podeAgendar ? <button className="mt-2 rounded border px-4 py-2">Confirmar agendamento</button> : <p className="mt-2">A prévia não permite confirmar este horário.</p>}</div>}
    </fieldset>
    {erro && <p role="alert">{erro}</p>}
    {sucesso && <p role="status">{sucesso}</p>}
  </form><ExcecaoAgendaReposicao reposicaoId={reposicaoId} proposta={previa?.diasNaoLetivos.length && !previa.excecaoAgendaAprovada ? horarioConferido : null} excecoes={excecoes} preferenciaFusoExibicao={preferenciaFusoExibicao} /></>;
}

function CicloAgenda({ agenda }: { agenda: NonNullable<ReposicaoEquipe["cicloAgenda"]> }) {
  const [ocupado, iniciar] = useTransition(); const [erro, setErro] = useState(""); const router = useRouter();
  if (agenda.encontroStatus !== "PREVISTO" || !["RESERVADA", "ISENTA_EXCECAO"].includes(agenda.statusBeneficio)) return <p role="status">A agenda está {agenda.encontroStatus.toLowerCase()} e não aceita cancelamento ou remarcação.</p>;
  const executar = (acao: () => Promise<{ ok: boolean; erro?: string }>) => iniciar(async () => { setErro(""); try { const r = await acao(); if (!r.ok) { setErro(r.erro ?? "A ação não foi confirmada."); return; } router.refresh(); } catch { setErro("A ação não foi confirmada. Consulte a agenda antes de reenviar."); } });
  return <section className="space-y-3 border-t pt-3" aria-label="Ciclo da agenda particular">
    <h3 className="font-medium">Cancelar ou remarcar agenda particular</h3>
    <p className="text-sm">A decisão independente define se o benefício é devolvido ou consumido. Remarcar conserva a reserva e substitui somente o encontro deste pedido.</p>
    {!agenda.cancelamentoId && !agenda.remarcacaoId && <div className="grid gap-3 md:grid-cols-2">
      <form className="space-y-2 rounded border p-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); executar(() => proporCancelamentoReposicaoIndividual({ agendaId: agenda.agendaId, motivo: String(f.get("motivo") ?? ""), evidencia: String(f.get("evidencia") ?? ""), chaveIdempotencia: crypto.randomUUID() })); }}>
        <p className="font-medium">Propor cancelamento</p><label className="block">Motivo<textarea name="motivo" required minLength={5} className="block w-full rounded border p-2" /></label><label className="block">Evidência<textarea name="evidencia" required minLength={5} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border px-3 py-2">Propor cancelamento</button>
      </form>
      <form className="space-y-2 rounded border p-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); executar(() => proporRemarcacaoReposicaoIndividual({ agendaId: agenda.agendaId, professorId: String(f.get("professorId") ?? ""), inicioLocal: String(f.get("inicioLocal") ?? ""), fimLocal: String(f.get("fimLocal") ?? ""), fuso: String(f.get("fuso") ?? ""), motivo: String(f.get("motivo") ?? ""), evidencia: String(f.get("evidencia") ?? ""), chaveIdempotencia: crypto.randomUUID() })); }}>
        <p className="font-medium">Propor remarcação</p><label className="block">ID do professor<input name="professorId" required defaultValue={agenda.professorId ?? ""} className="block w-full rounded border p-2" /></label><label className="block">Início local<input name="inicioLocal" type="datetime-local" required className="block w-full rounded border p-2" /></label><label className="block">Fim local<input name="fimLocal" type="datetime-local" required className="block w-full rounded border p-2" /></label><input name="fuso" type="hidden" value={agenda.fusoOrigem} readOnly /><label className="block">Motivo<textarea name="motivo" required minLength={5} className="block w-full rounded border p-2" /></label><label className="block">Evidência<textarea name="evidencia" required minLength={5} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border px-3 py-2">Propor remarcação</button>
      </form>
    </div>}
    {agenda.cancelamentoId && <DecidirCiclo tipo="cancelamento" propostaId={agenda.cancelamentoId} executar={executar} ocupado={ocupado} />}
    {agenda.remarcacaoId && <DecidirCiclo tipo="remarcacao" propostaId={agenda.remarcacaoId} executar={executar} ocupado={ocupado} />}
    {erro && <p role="alert">{erro}</p>}
  </section>;
}

function DecidirCiclo({ tipo, propostaId, executar, ocupado }: { tipo: "cancelamento" | "remarcacao"; propostaId: string; executar: (acao: () => Promise<{ ok: boolean; erro?: string }>) => void; ocupado: boolean }) {
  return <form className="space-y-2 rounded border p-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const aprovar = f.get("decisao") === "aprovar"; executar(() => tipo === "cancelamento" ? decidirCancelamentoReposicaoIndividual({ propostaId, aprovar, motivo: String(f.get("motivo") ?? "") }) : decidirRemarcacaoReposicaoIndividual({ propostaId, aprovar, motivo: String(f.get("motivo") ?? "") })); }}>
    <p className="font-medium">Decidir {tipo} proposto</p><label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label><label className="block">Justificativa<textarea name="motivo" required minLength={5} className="block w-full rounded border p-2" /></label><button disabled={ocupado} className="rounded border px-3 py-2">Registrar decisão</button>
  </form>;
}

function DecidirReposicao({ reposicaoId }: { reposicaoId: string }) {
  const [ocupado, iniciar] = useTransition(); const [erro, setErro] = useState(""); const router = useRouter();
  return <form className="space-y-3 border-t pt-3" onSubmit={e => {
    e.preventDefault(); const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      setErro("");
      try { const r = await decidirReposicaoIndividual({ reposicaoId, aprovar: dados.get("decisao") === "aprovar", motivo: String(dados.get("motivo") ?? "") }); if (!r.ok) { setErro(r.erro); return; } router.refresh(); }
      catch { setErro("O resultado não foi confirmado. Consulte a reposição antes de repetir."); }
    });
  }}><fieldset disabled={ocupado} className="space-y-3"><legend className="font-medium">Decisão independente</legend>
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option><option value="aprovar">Autorizar a reposição</option><option value="rejeitar">Rejeitar pedido</option></select></label>
    <label className="block">Justificativa<textarea name="motivo" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
    <label className="block"><input type="checkbox" required /> Conferi a falta ou impedimento de origem e o alcance desta matrícula.</label>
    <button className="rounded border px-4 py-2">{ocupado ? "Registrando…" : "Registrar decisão"}</button>
  </fieldset>{erro && <p role="alert">{erro}</p>}</form>;
}
