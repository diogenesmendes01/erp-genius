"use client";

import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { useEffect, useRef, useState } from "react";
import type { Papel, StatusAtendimentoWhatsApp } from "@prisma/client";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { recontarNaoLidasInbox } from "@/components/SeloNaoLidasInbox";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import {validarQuando as validarQuandoAgendar} from "./fluxos/agendar/validar-quando";
import { Modal } from "@/components/Modal";
import { MensagemStatus } from "@/components/MensagemStatus";
import { useSugestaoAgendamento } from "./insights/useSugestaoAgendamento";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import { podeExecutar } from "@/server/inbox/permissoes";
import { PRAZO_MAXIMO_CONVITE_DIAS } from "@/server/whatsapp/participantes";
import { assumirAtendimento, assumirConversaDaAria, atribuirAtendimento, convidarParticipante, devolverParaFila, revogarParticipante, transferirAtendimento } from "@/server/whatsapp/acoes-atendimento";
import { agendarMensagemNoAtendimentoLocal, cancelarAgendamentoDoAtendimento, registrarNotaAtendimento } from "@/server/whatsapp/acoes-conversa";
import { fusoDoCampoLocal } from "@/server/operacao/fuso-entrada";
import { CampoDataHoraLocal } from "@/components/CampoDataHoraLocal";
import { listarConvitesEAgendamentos, listarPessoasParaAtendimento, type AgendamentoAtivo, type ConviteAtivo } from "@/server/whatsapp/consultas-acoes-atendimento";
import { encerrarAtendimentoWhatsApp } from "@/server/whatsapp/operacoes-atendimento";
import { alternarFixada, silenciarConversa, marcarNaoLida } from "@/server/whatsapp/preferencias";
import type { Resultado } from "@/server/_shared/resultado";
import type { Setor } from "@/server/whatsapp/setor";

import { itensDoMenuConversa, type AcoesCabecalho } from "./MenuConversa";

export interface DestinoTransferencia { chave: string; nome: string; finalidade: Setor; disponivel?: boolean }

export interface PropsAcoesAtendimento {
  contextoAria?: boolean;
  versaoInsights?: number;
  podeUsarInsights?: boolean;
  podeAssumirAria?: boolean;
  grupo?: boolean;
  aoCriarTarefa?: () => void;
  aoAgendar?: (ancora?:HTMLElement) => void;
  atendimento: { id: string; finalidade: Setor; responsavelId: string | null; status: StatusAtendimentoWhatsApp };
  usuario: { id: string; papeis: Papel[] };
  setoresDoNumero: Setor[];
  fixada: boolean;
  silenciada: boolean;
  linhaComercial?: boolean;
  donoLinhaId?: string | null;
  destinos?: DestinoTransferencia[];
  aoMudar?: () => void;
  fuso: string | null;
}

const SILENCIO_HORAS = 8;
const CLASSE_CONTROLE = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

export function validarQuando(quando:string,fuso:string,agora:Date=new Date()):string|null {
  const erro=validarQuandoAgendar(quando,fuso,agora);
  return erro==="Esse horário já passou. Escolha uma data e hora no futuro."?"Escolha um horário no futuro.":erro;
}

export function setoresParaTransferir(setoresDoNumero: Setor[], atual: Setor): Setor[] {
  return setoresDoNumero.filter((s) => s !== atual);
}

type Dialogo = null | "atribuir" | "transferir" | "convidar" | "nota" | "agendar" | "pendentes" | "encerrar";

export function useAcoesAtendimento({ versaoInsights=0, podeUsarInsights=false, contextoAria = false, podeAssumirAria = false, atendimento, usuario, setoresDoNumero, fixada, silenciada, linhaComercial = false, donoLinhaId = null, destinos = [], aoMudar, fuso, grupo = false, aoBuscar, aoCriarTarefa, aoAgendar }: PropsAcoesAtendimento & { aoBuscar(): void }): AcoesCabecalho {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const direta = useAcaoCliente({ idempotente: false });
  const responsavel = useAcaoCliente({ idempotente: true });
  const aberto = atendimento.status !== "ENCERRADO";
  const ctx = { setor: atendimento.finalidade, responsavelId: atendimento.responsavelId, linhaComercial, donoLinhaId };
  const pode = (a: Parameters<typeof podeExecutar>[1]) => !grupo && (aberto || a === "notaInterna") && podeExecutar(usuario, a, ctx);

  async function rodar(acao: () => Promise<Resultado>, sucesso: string, executor: typeof direta = direta, aposSucesso?: () => void) {
    setAviso(null);
    direta.limpar(); responsavel.limpar();
    const d = await executor.executar(acao, sucesso);
    if (d?.tipo === "ok") { aposSucesso?.(); setAviso(sucesso); aoMudar?.(); }
  }
  const concluir = (msg: string) => { setDialogo(null); setAviso(msg); aoMudar?.(); };
  const avisar = (qual: "convite" | "agendamento") => { setAviso(qual === "convite" ? "Convite revogado." : "Agendamento cancelado."); aoMudar?.(); };

  const ocupado = direta.ocupado || responsavel.ocupado;
  const abrirAgendar = pode("agendar") ? (aoAgendar??(()=>setDialogo("agendar"))) : null;
  const chaveAssumir = JSON.stringify([atendimento.id, atendimento.responsavelId, usuario.id, usuario.papeis, contextoAria, podeAssumirAria, grupo, aberto, linhaComercial, donoLinhaId]);
  const [ofertaAssumir, setOfertaAssumir] = useState(() => ({ chave: chaveAssumir, token: Symbol("assumir") }));
  if (ofertaAssumir.chave !== chaveAssumir) setOfertaAssumir({ chave: chaveAssumir, token: Symbol("assumir") });
  const cicloAssumir = useRef({ ativo: false, token: ofertaAssumir.token });
  useEffect(() => {
    const atual = { ativo: contextoAria && podeAssumirAria && !grupo && aberto, token: ofertaAssumir.token };
    cicloAssumir.current = atual;
    return () => { atual.ativo = false; };
  }, [ofertaAssumir.token, contextoAria, podeAssumirAria, grupo, aberto]);
  async function assumirAria(token: symbol) {
    const atual = cicloAssumir.current;
    if (!atual.ativo || atual.token !== token) return;
    const d = await responsavel.executar(async () => {
      try { const r = await assumirConversaDaAria(atendimento.id); return atual.ativo ? r : { ok: true as const }; }
      catch (e) { if (!atual.ativo) return { ok: true as const }; throw e; }
    });
    if (d?.tipo === "ok" && atual.ativo && cicloAssumir.current === atual) { setAviso("Atendimento assumido."); aoMudar?.(); }
  }
  const assumir = contextoAria
    ? !grupo && aberto && podeAssumirAria ? { rotulo: "Assumir conversa", ocupado, aoEscolher: () => void assumirAria(ofertaAssumir.token) } : null
    : pode("assumir") ? { rotulo: "Assumir conversa", ocupado, aoEscolher: () => void rodar(() => assumirAtendimento(atendimento.id), "Atendimento assumido.", responsavel) } : null;
  const transferir = pode("transferir") ? { rotulo: "Transferir", ocupado, aoEscolher: () => setDialogo("transferir") } : null;
  const menu = itensDoMenuConversa({ pode, fixada, silenciada, acoes: {
    naoLida: () => void rodar(() => marcarNaoLida(atendimento.id), "Conversa marcada como não lida só para você.", responsavel, recontarNaoLidasInbox),
    fixar: () => void rodar(() => alternarFixada(atendimento.id), fixada ? "Conversa desafixada." : "Conversa fixada."),
    silenciar: () => void rodar(() => silenciarConversa(atendimento.id, silenciada ? null : new Date(Date.now() + SILENCIO_HORAS * 3_600_000).toISOString()), silenciada ? "Notificações reativadas." : "Silenciada por " + SILENCIO_HORAS + " horas."),
    ...(!grupo && aoCriarTarefa ? { criarTarefa: aoCriarTarefa } : {}),
    nota: () => setDialogo("nota"), agendar: () => abrirAgendar?.(), pendentes: () => setDialogo("pendentes"), buscar: aoBuscar,
    atribuir: () => setDialogo("atribuir"), devolver: () => void rodar(() => devolverParaFila(atendimento.id), "Devolvido para a fila.", responsavel),
    convidar: () => setDialogo("convidar"), encerrar: () => setDialogo("encerrar"), bloquear: () => {},
  }}).map(item => ({ ...item, desabilitado: item.desabilitado || ocupado }));
  const erro = direta.erro ?? responsavel.erro;
  const feedback = erro || aviso ? <div className="border-b border-gray-200 bg-surface px-3 py-1.5"><FeedbackAcao erro={erro} sucesso={aviso} /></div> : null;
  const dialogos = (
    <>
      {dialogo === "atribuir" && <DialogoPessoa atendimentoId={atendimento.id} modo="atribuir" aoFechar={() => setDialogo(null)} aoConcluir={() => concluir("Atendimento atribuído.")} />}
      {dialogo === "convidar" && <DialogoPessoa atendimentoId={atendimento.id} modo="convidar" aoFechar={() => setDialogo(null)} aoConcluir={() => concluir("Convite enviado.")} />}
      {dialogo === "transferir" && <DialogoTransferir atendimentoId={atendimento.id} finalidade={atendimento.finalidade} setoresDoNumero={setoresDoNumero} destinos={destinos} aoFechar={() => setDialogo(null)} aoConcluir={() => concluir("Atendimento transferido.")} />}
      {dialogo === "nota" && <DialogoNota atendimentoId={atendimento.id} aoFechar={() => setDialogo(null)} aoConcluir={() => concluir("Nota registrada.")} />}
      {dialogo === "agendar" && !aoAgendar && <DialogoAgendar atendimentoId={atendimento.id} versaoInsights={versaoInsights} insightsAplicaveis={podeUsarInsights && atendimento.finalidade === "COMERCIAL" && !grupo} fuso={fusoDoCampoLocal(fuso, null)} aoFechar={() => setDialogo(null)} aoConcluir={() => concluir("Mensagem agendada.")} />}
      {dialogo === "pendentes" && <DialogoPendentes atendimentoId={atendimento.id} fuso={fuso} aoFechar={() => setDialogo(null)} aoConcluir={avisar} />}
      {dialogo === "encerrar" && (
        <ConfirmarAcao
          folha
          titulo="Encerrar este atendimento?"
          confirmacao="encerramento"
          idempotente
          acao={() => encerrarAtendimentoWhatsApp(atendimento.id)}
          aoConcluir={() => concluir("Atendimento encerrado.")}
          aoCancelar={() => setDialogo(null)}
        >
          <p>O atendimento sai da fila e das listas abertas. Uma nova mensagem do contato abre outro atendimento; este não é reaberto.</p>
        </ConfirmarAcao>
      )}
    </>
  );
  return { assumir, transferir, menu, dialogos, feedback, abrirAgendar };
}

interface PropsDialogo { aoFechar: () => void; aoConcluir: () => void }

function Rodape({ ocupado, aoFechar, children }: { ocupado: boolean; aoFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <Botao variante="secundario" disabled={ocupado} onClick={aoFechar}>Cancelar</Botao>
      {children}
    </div>
  );
}

export function DialogoTransferir({ atendimentoId, finalidade, setoresDoNumero, destinos = [], aoFechar, aoConcluir }: PropsDialogo & { atendimentoId: string; finalidade: Setor; setoresDoNumero: Setor[]; destinos?: DestinoTransferencia[] }) {
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const setores = setoresParaTransferir(setoresDoNumero, finalidade);
  const [destino, setDestino] = useState<Setor | "">(setores[0] ?? "");
  const [chave, setChave] = useState("");
  const [contexto, setContexto] = useState("");
  const exigeChave = destino === "FINANCEIRO" || destino === "PEDAGOGICO";
  const opcoes = destinos.filter((d) => d.finalidade === destino && d.disponivel !== false);
  const semDestino = !destino || (exigeChave && (!chave || !opcoes.some((o) => o.chave === chave)));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!destino || semDestino) return;
    const d = await acao.executar(() => transferirAtendimento({ atendimentoId, destino, destinoChave: exigeChave ? chave : null, contexto, chaveIdempotencia: tentativa.atual }));
    tentativa.depoisDo(d);
    if (d?.tipo === "ok") aoConcluir();
  }

  return (
    <Modal folha titulo="Transferir atendimento" aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-3">
        {setores.length === 0 ? <EstadoVazio>Este número não atende outro setor.</EstadoVazio> : (
          <>
            <Campo rotulo="Setor de destino" obrigatorio>
              {(c) => (
                <select {...c} className={CLASSE_CONTROLE} value={destino} onChange={(e) => { setDestino(e.target.value as Setor); setChave(""); }}>
                  {setores.map((s) => <option key={s} value={s}>{rotular(SETOR_ATENDIMENTO_LABEL, s)}</option>)}
                </select>
              )}
            </Campo>
            {exigeChave && (
              <Campo rotulo="Contexto do destino" obrigatorio dica={opcoes.length === 0 ? "Nenhuma matrícula ou aluno disponível para este setor." : undefined}>
                {(c) => (
                  <select {...c} className={CLASSE_CONTROLE} value={chave} onChange={(e) => setChave(e.target.value)}>
                    <option value="">Escolha…</option>
                    {opcoes.map((o) => <option key={o.chave} value={o.chave}>{o.nome}</option>)}
                  </select>
                )}
              </Campo>
            )}
            <Campo rotulo="Contexto da transferência" obrigatorio>
              {(c) => <CampoTexto {...c} className={CLASSE_CONTROLE} rows={3} minLength={12} maxLength={1000} value={contexto} onChange={(e) => setContexto(e.target.value)} />}
            </Campo>
          </>
        )}
        <FeedbackAcao erro={acao.erro} />
        <Rodape ocupado={acao.ocupado} aoFechar={aoFechar}><Botao type="submit" ocupado={acao.ocupado} disabled={setores.length === 0 || semDestino || contexto.trim().length < 12}>Transferir</Botao></Rodape>
      </form>
    </Modal>
  );
}

export function DialogoPessoa({ atendimentoId, modo, aoFechar, aoConcluir }: PropsDialogo & { atendimentoId: string; modo: "atribuir" | "convidar" }) {
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const fimDaTentativa = useRef<{ chave: string; dias: number; fim: string } | null>(null);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[] | null>(null);
  const [usuarioId, setUsuarioId] = useState("");
  const [podeEnviar, setPodeEnviar] = useState(false);
  const [dias, setDias] = useState(7);
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    let ativo = true;
    void listarPessoasParaAtendimento(atendimentoId, modo)
      .then((l) => { if (ativo) setPessoas(l); })
      .catch(() => { if (ativo) setPessoas([]); });
    return () => { ativo = false; };
  }, [atendimentoId, modo]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const d = await acao.executar(async (): Promise<Resultado> => {
      if (modo === "atribuir") return atribuirAtendimento({ atendimentoId, usuarioId });
      const chave = tentativa.atual;
      const anterior = fimDaTentativa.current;
      const fim = anterior && anterior.chave === chave && anterior.dias === dias ? anterior.fim : new Date(Date.now() + dias * 86_400_000).toISOString();
      fimDaTentativa.current = { chave, dias, fim };
      const r = await convidarParticipante({ atendimentoId, usuarioId, podeEnviar, fim, motivo, chaveIdempotencia: chave });
      return r.ok ? { ok: true } : { ok: false, erro: r.erro };
    });
    if (modo === "convidar") tentativa.depoisDo(d);
    if (d?.tipo === "ok") aoConcluir();
  }

  return (
    <Modal folha titulo={modo === "atribuir" ? "Atribuir atendimento" : "Convidar participante"} aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-3">
        <Campo rotulo="Pessoa" obrigatorio dica={pessoas && pessoas.length === 0 ? "Ninguém disponível." : undefined}>
          {(c) => (
            <select {...c} className={CLASSE_CONTROLE} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} disabled={!pessoas}>
              <option value="">{pessoas ? "Escolha…" : "Carregando…"}</option>
              {(pessoas ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
        </Campo>
        {modo === "convidar" && (
          <>
            <Campo rotulo="Duração do convite (dias)" obrigatorio dica={`No máximo ${PRAZO_MAXIMO_CONVITE_DIAS} dias; começa agora.`}>
              {(c) => <input {...c} type="number" min={1} max={PRAZO_MAXIMO_CONVITE_DIAS} className={CLASSE_CONTROLE} value={dias} onChange={(e) => setDias(Math.min(PRAZO_MAXIMO_CONVITE_DIAS, Math.max(1, Number(e.target.value) || 1)))} />}
            </Campo>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={podeEnviar} onChange={(e) => setPodeEnviar(e.target.checked)} /> Pode enviar mensagens</label>
            <Campo rotulo="Motivo do convite" obrigatorio>
              {(c) => <CampoTexto {...c} className={CLASSE_CONTROLE} rows={3} minLength={10} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
            </Campo>
          </>
        )}
        <FeedbackAcao erro={acao.erro} />
        <Rodape ocupado={acao.ocupado} aoFechar={aoFechar}><Botao type="submit" ocupado={acao.ocupado} disabled={!usuarioId || (modo === "convidar" && motivo.trim().length < 10)}>{modo === "atribuir" ? "Atribuir" : "Convidar"}</Botao></Rodape>
      </form>
    </Modal>
  );
}

function DialogoNota({ atendimentoId, aoFechar, aoConcluir }: PropsDialogo & { atendimentoId: string }) {
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const [nota, setNota] = useState("");
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const d = await acao.executar(() => registrarNotaAtendimento({ atendimentoId, nota, chaveIdempotencia: tentativa.atual }));
    tentativa.depoisDo(d);
    if (d?.tipo === "ok") aoConcluir();
  }
  return (
    <Modal folha titulo="Nota interna" aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-3">
        <Campo rotulo="Nota" obrigatorio dica="Fica só para a equipe e não é enviada ao contato.">
          {(c) => <CampoTexto {...c} className={CLASSE_CONTROLE} rows={4} maxLength={2000} value={nota} onChange={(e) => setNota(e.target.value)} />}
        </Campo>
        <FeedbackAcao erro={acao.erro} />
        <Rodape ocupado={acao.ocupado} aoFechar={aoFechar}><Botao type="submit" ocupado={acao.ocupado} disabled={!nota.trim()}>Registrar nota</Botao></Rodape>
      </form>
    </Modal>
  );
}

function DialogoAgendar({ atendimentoId, fuso, aoFechar, aoConcluir,versaoInsights=0, insightsAplicaveis=false }: PropsDialogo & { atendimentoId: string; fuso: string;versaoInsights?:number;insightsAplicaveis?:boolean }) {
  const [revisaoTexto,setRevisaoTexto]=useState(0);
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const [texto, setTexto] = useState("");
  const [quando, setQuando] = useState("");
  const [erroQuando, setErroQuando] = useState<string | null>(null);
  const sugestao=useSugestaoAgendamento({atendimentoId,ativo:insightsAplicaveis,versao:versaoInsights,texto,revisao:revisaoTexto,ocupado:acao.ocupado,aoTexto(t){setTexto(t);setRevisaoTexto(r=>r+1);}});
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const erro = validarQuando(quando, fuso);
    setErroQuando(erro);
    if (erro) return;
    const d = await acao.executar(() => agendarMensagemNoAtendimentoLocal({ atendimentoId, texto, quandoLocal: quando, fuso, chaveIdempotencia: tentativa.atual }));
    tentativa.depoisDo(d);
    if (d?.tipo === "ok") aoConcluir();
  }
  return (
    <Modal folha titulo="Agendar mensagem" aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-3">
        <Campo rotulo="Mensagem" obrigatorio>
          {(c) => <CampoTexto {...c} className={CLASSE_CONTROLE} rows={4} maxLength={4000} value={texto} onChange={(e) => {setTexto(e.target.value);setRevisaoTexto(r=>r+1);}} />}
        </Campo>
        {insightsAplicaveis && <><Botao variante="iaFantasma" tamanho="sm" disabled={!sugestao.disponivel} ocupado={sugestao.ocupado} onClick={sugestao.pedirUso}>Escrever com Aria</Botao>
        <MensagemStatus texto={sugestao.aviso} progresso={sugestao.carregando?"Carregando sugestão…":null}/>
        <FeedbackAcao erro={sugestao.erro} sucesso={sugestao.sucesso}/>
        {sugestao.confirmacao}</>}
        <Campo rotulo="Enviar em" obrigatorio erro={erroQuando}>
          {(c) => <CampoDataHoraLocal {...c} fuso={fuso} className={CLASSE_CONTROLE} value={quando} onChange={(e) => { setQuando(e.target.value); setErroQuando(null); }} />}
        </Campo>
        <FeedbackAcao erro={acao.erro} />
        <Rodape ocupado={acao.ocupado} aoFechar={aoFechar}><Botao type="submit" ocupado={acao.ocupado} disabled={!texto.trim()}>Agendar</Botao></Rodape>
      </form>
    </Modal>
  );
}

type AlvoPendente = { tipo: "convite"; item: ConviteAtivo } | { tipo: "agendamento"; item: AgendamentoAtivo };
export const quandoPendente = (iso: string | Date, fuso: string | null) => formatarInstanteExibicao(iso, fuso, "UTC").texto;

export function DialogoPendentes({ atendimentoId, fuso, aoFechar, aoConcluir }: { atendimentoId: string; fuso: string | null; aoFechar: () => void; aoConcluir: (qual: "convite" | "agendamento") => void }) {
  const [dados, setDados] = useState<{ convites: ConviteAtivo[]; agendamentos: AgendamentoAtivo[] } | null>(null);
  const [alvo, setAlvo] = useState<AlvoPendente | null>(null);
  const [versao, setVersao] = useState(0);
  const carregar = () => setVersao((v) => v + 1);
  useEffect(() => {
    let ativo = true;
    void listarConvitesEAgendamentos(atendimentoId)
      .then((d) => { if (ativo) setDados(d); })
      .catch(() => { if (ativo) setDados({ convites: [], agendamentos: [] }); });
    return () => { ativo = false; };
  }, [atendimentoId, versao]);

  if (alvo) {
    const convite = alvo.tipo === "convite";
    return (
      <ConfirmarAcao
        folha
        titulo={convite ? `Revogar o convite de ${alvo.item.nome}?` : "Cancelar esta mensagem agendada?"}
        confirmacao={convite ? "revogação" : "cancelamento"}
        idempotente
        acao={() => (convite ? revogarParticipante(alvo.item.id) : cancelarAgendamentoDoAtendimento({ atendimentoId, intencaoId: alvo.item.id }))}
        aoConcluir={() => { aoConcluir(convite ? "convite" : "agendamento"); setAlvo(null); setDados(null); carregar(); }}
        aoCancelar={() => setAlvo(null)}
      >
        {convite
          ? <p>{alvo.item.nome} perde o acesso a este atendimento agora, e o que a pessoa deixou pendente ou agendado aqui é cancelado. Não há desfazer; só um novo convite devolve o acesso.</p>
          : <p>A mensagem não será enviada ao contato. Não há desfazer; para enviar, é preciso agendar de novo.</p>}
      </ConfirmarAcao>
    );
  }

  return (
    <Modal folha titulo="Convites e agendamentos" aoFechar={aoFechar}>
      {!dados ? <p className="text-sm text-gray-600">Carregando…</p> : (
        <div className="space-y-4">
          <section aria-label="Convites ativos" className="space-y-2">
            <h4 className="text-sm font-medium">Convites ativos</h4>
            {dados.convites.length === 0 ? <EstadoVazio>Nenhum convite ativo que você possa revogar.</EstadoVazio> : (
              <ul className="space-y-2">
                {dados.convites.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{c.nome} até {quandoPendente(c.fim, fuso)}{c.podeEnviar ? " (pode enviar)" : " (só leitura)"}</span>
                    <Botao tamanho="sm" variante="perigo" onClick={() => setAlvo({ tipo: "convite", item: c })}>Revogar convite</Botao>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Mensagens agendadas" className="space-y-2">
            <h4 className="text-sm font-medium">Mensagens agendadas</h4>
            {dados.agendamentos.length === 0 ? <EstadoVazio>Nenhuma mensagem agendada que você possa cancelar.</EstadoVazio> : (
              <ul className="space-y-2">
                {dados.agendamentos.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{quandoPendente(m.agendadaPara, fuso)}: {m.texto}</span>
                    <Botao tamanho="sm" variante="perigo" onClick={() => setAlvo({ tipo: "agendamento", item: m })}>Cancelar agendamento</Botao>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      <div className="mt-4 flex justify-end"><Botao variante="secundario" onClick={aoFechar}>Fechar</Botao></div>
    </Modal>
  );
}
