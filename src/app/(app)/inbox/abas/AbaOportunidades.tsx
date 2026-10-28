"use client";
import { useEffect, useRef, useState } from "react";
import type { EtapaLead } from "@prisma/client";
import { IconHandStop, IconThumbDown } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import type { Resultado } from "@/server/_shared/resultado";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { formatarMoedaOuIndefinida } from "@/lib/dinheiro";
import type { DestinoArraste } from "@/server/crm/etapas";
import { moverEtapaNoInbox } from "@/server/inbox/acoes-painel";
import type { OportunidadesPainel } from "@/server/inbox/painel-oportunidades";
import type { CapacidadesPainel } from "@/server/inbox/permissoes";
import { BarraEtapas } from "./BarraEtapas";
import { opcoesEtapa } from "./etapas-painel";
import { TarefasOportunidade } from "./TarefasOportunidade";
import { OutrasOportunidades } from "./OutrasOportunidades";
import { CartaoExperimental } from "./CartaoExperimental";
import { PrevisaoOportunidade } from "./PrevisaoOportunidade";
import { QualificacaoOportunidadeInbox } from "./QualificacaoOportunidadeInbox";
import { AcoesFechamentoOportunidade, type SecaoFechamentoInbox } from "./AcoesFechamentoOportunidade";

type Props = { dados: OportunidadesPainel; capacidades: CapacidadesPainel; atendimentoId: string; fuso: string | null; fusoEscola?: string; aoMudar(): void; aoNovaTarefa?(): void; aoAdicionarNota?(): void; aoEditarTarefa?(t: import("@/server/inbox/painel-tarefas").TarefaPainel): void; aoAbrirPerda(): void; podeAbrirFunil?: boolean; podeCriarOportunidade?: boolean; contextoAria?: boolean; podeAssumir?: boolean; aoAssumir?(): Promise<Resultado> };
export function AbaOportunidades(props: Props) {
  return <OportunidadeDoAtendimento key={JSON.stringify([props.atendimentoId, props.dados.atual?.id ?? null])} {...props} />;
}
function OportunidadeDoAtendimento({ dados, capacidades, atendimentoId, fuso, fusoEscola, aoMudar, aoNovaTarefa, aoAdicionarNota, aoEditarTarefa, aoAbrirPerda, podeAbrirFunil = false, podeCriarOportunidade = false, podeAssumir = false, contextoAria = false, aoAssumir }: Props) {
  const acao = useAcaoCliente({ idempotente: true }), vivo = useRef(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [secao, setSecao] = useState<SecaoFechamentoInbox | null>(null);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const chaveAssumir = JSON.stringify([atendimentoId, dados.atual?.id, contextoAria, podeAssumir]);
  const [ofertaAssumir, setOfertaAssumir] = useState(() => ({ chave: chaveAssumir, token: Symbol("assumir") }));
  if (ofertaAssumir.chave !== chaveAssumir) setOfertaAssumir({ chave: chaveAssumir, token: Symbol("assumir") });
  const cicloAssumir = useRef({ ativo: false, token: ofertaAssumir.token });
  useEffect(() => { const atual = { ativo: podeAssumir && contextoAria, token: ofertaAssumir.token }; cicloAssumir.current = atual; return () => { atual.ativo = false; }; }, [ofertaAssumir.token, contextoAria, podeAssumir]);
  const o = dados.atual;
  const tarefas = capacidades.tarefas ? <TarefasOportunidade atendimentoId={atendimentoId} tarefas={dados.tarefas} fusoEscola={dados.fusoEscola} fuso={fuso} podeCriar={!!aoNovaTarefa} aoNova={aoNovaTarefa} aoEditar={aoEditarTarefa} aoMudar={aoMudar}/> : null;
  const entradaTarefa=capacidades.tarefas&&aoNovaTarefa?<Botao variante="fantasma" tamanho="md" onClick={aoNovaTarefa}>Criar tarefa</Botao>:null;
  const entradaNota=aoAdicionarNota?<Botao variante="fantasma" tamanho="md" onClick={aoAdicionarNota}>Adicionar nota</Botao>:null;
  if (!o) return <div className="space-y-4"><p className="text-sm text-gray-600">Sem oportunidade visível para você.</p>{tarefas}{entradaTarefa}{entradaNota}</div>;
  async function mover(etapa: EtapaLead) {
    const r = await acao.executar(() => moverEtapaNoInbox(atendimentoId, etapa, o!.id));
    if (r?.tipo === "ok" && vivo.current) aoMudar();
  }
  async function assumir() {
    if (!podeAssumir || !aoAssumir || acao.ocupado) return;
    const ciclo = cicloAssumir.current;
    if (contextoAria && (!ciclo.ativo || ciclo.token !== ofertaAssumir.token)) return;
    setErroLocal(null);
    const r = await acao.executar(async () => {
      try { const resultado = await aoAssumir(); return contextoAria && !ciclo.ativo ? { ok: true as const } : resultado; }
      catch (e) { if (contextoAria && !ciclo.ativo) return { ok: true as const }; throw e; }
    }, contextoAria ? undefined : "Atendimento assumido.");
    if (r?.tipo === "ok" && vivo.current && (!contextoAria || (ciclo.ativo && cicloAssumir.current === ciclo))) {
      if (contextoAria) acao.setSucesso("Atendimento assumido."); aoMudar();
    }
  }
  const destinoPerda = opcoesEtapa(o.etapa).find(e => e.etapa === "PERDIDO")?.destino;
  function escolher(etapa: EtapaLead, destino: DestinoArraste) {
    if (!capacidades.moverEtapa || acao.ocupado) return;
    acao.limpar(); setErroLocal(null); setSecao(null);
    if (destino.tipo === "nenhum") return;
    if (destino.tipo === "recusar") { setErroLocal(destino.motivo); return; }
    if (destino.tipo === "acao") {
      if (destino.acao === "marcarPerdido") { aoAbrirPerda(); return; }
      setSecao(destino.acao); return;
    }
    void mover(etapa);
  }
  const encerrada = o.etapa === "MATRICULADO" || o.etapa === "PERDIDO";
  const podeFechar = capacidades.moverEtapa && !encerrada;
  return <div className="min-w-0 space-y-4">
    <header className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs"><h3 className="font-medium text-brand-700">Oportunidade atual</h3><span className="text-gray-500">Funil Matrículas</span></div>
      <p className="text-[15px] font-semibold [overflow-wrap:anywhere]">{o.produto ?? o.titulo}</p>
      <p className="text-[17px] font-semibold">{o.valor === null ? "Sem valor" : formatarMoedaOuIndefinida(o.valor, o.moeda)}</p>
    </header>
    <BarraEtapas etapa={o.etapa} podeMover={capacidades.moverEtapa} ocupado={acao.ocupado} aoEscolher={escolher} />
    <CartaoExperimental oportunidade={o} fuso={fuso} fusoEscola={fusoEscola ?? fuso ?? ""} podeAbrirFunil={podeAbrirFunil} podeMover={capacidades.moverEtapa} />
    <QualificacaoOportunidadeInbox atendimentoId={atendimentoId} oportunidadeId={o.id} temperatura={o.temperatura} etapa={o.etapa} podeEditar={podeFechar} resumo={{ interesse: o.interesse ?? null, objetivo: o.objetivo ?? null, urgencia: o.urgencia ?? null, orcamento: o.orcamento ?? null, objecao: o.objecao ?? null, proximaAcao: o.proximaAcao ?? null }} aoMudar={aoMudar} />
    <AcoesFechamentoOportunidade atendimentoId={atendimentoId} oportunidade={o} fuso={fusoEscola ?? fuso ?? ""} podeAgir={podeFechar} secao={secao} aoMudar={aoMudar} />
    <FeedbackAcao erro={erroLocal ?? acao.erro} sucesso={acao.sucesso} />
    <dl className="space-y-2 text-[13px]">
      {([['Responsável', o.responsavel?.nome ?? 'Sem responsável'], ['Produto', o.produto ?? '—']] as const).map(([rotulo, valor]) => <div key={rotulo} className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-2"><dt className="text-gray-600">{rotulo}</dt><dd className="min-w-0 [overflow-wrap:anywhere]">{valor}</dd></div>)}
    </dl>
    <PrevisaoOportunidade atendimentoId={atendimentoId} oportunidadeId={o.id} probabilidadePct={o.probabilidadePct} previsaoFechamento={o.previsaoFechamento} podeEditar={o.podeEditarPrevisao} aoMudar={aoMudar}/>
    <div className="flex flex-col items-start">
      {podeAssumir && aoAssumir && <Botao variante="fantasma" tamanho="md" disabled={acao.ocupado} aria-busy={acao.ocupado || undefined} onClick={() => void assumir()} className="min-h-11 justify-start gap-4 px-0 text-brand-700"><IconHandStop size={17} aria-hidden />Assumir conversa</Botao>}
      {capacidades.moverEtapa && destinoPerda?.tipo === "acao" && destinoPerda.acao === "marcarPerdido" && <Botao variante="fantasma" tamanho="md" disabled={acao.ocupado} onClick={() => escolher("PERDIDO", destinoPerda)} className="min-h-11 justify-start gap-4 px-0 text-red-700"><IconThumbDown size={17} aria-hidden />Marcar como perdido</Botao>}
    </div>
    {tarefas}
    {entradaTarefa}
    {entradaNota}
    <OutrasOportunidades outras={dados.outras} pessoaId={dados.pessoaId} podeCriar={podeCriarOportunidade} verContato={capacidades.verContato} podeAbrirFunil={podeAbrirFunil} />
  </div>;
}
