"use client";

import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { useEffect, useRef, useState } from "react";
import type { Papel, StatusAtendimentoWhatsApp } from "@prisma/client";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Modal } from "@/components/Modal";
import { AVISO_RECURSO_MOTOR } from "@/components/conversa/recursos-canal";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import { podeExecutar } from "@/server/inbox/permissoes";
import { PRAZO_MAXIMO_CONVITE_DIAS } from "@/server/whatsapp/participantes";
import { assumirAtendimento, atribuirAtendimento, convidarParticipante, devolverParaFila, revogarParticipante, transferirAtendimento } from "@/server/whatsapp/acoes-atendimento";
import { agendarMensagemNoAtendimento, cancelarAgendamentoDoAtendimento, registrarNotaAtendimento } from "@/server/whatsapp/acoes-conversa";
import { listarConvitesEAgendamentos, listarPessoasParaAtendimento, type AgendamentoAtivo, type ConviteAtivo } from "@/server/whatsapp/consultas-acoes-atendimento";
import { encerrarAtendimentoWhatsApp } from "@/server/whatsapp/operacoes-atendimento";
import { alternarFixada, silenciarConversa } from "@/server/whatsapp/preferencias";
import type { Resultado } from "@/server/_shared/resultado";
import type { Setor } from "@/server/whatsapp/setor";

export interface DestinoTransferencia { chave: string; nome: string; finalidade: Setor; disponivel?: boolean }

export interface PropsAcoesAtendimento {
  atendimento: { id: string; finalidade: Setor; responsavelId: string | null; status: StatusAtendimentoWhatsApp };
  usuario: { id: string; papeis: Papel[] };
  setoresDoNumero: Setor[];
  fixada: boolean;
  silenciada: boolean;
  /** Atendimento COMERCIAL de linha de vendas e o dono da linha: decidem se "Assumir" aparece (C3 da revisão da 3C). */
  linhaComercial?: boolean;
  donoLinhaId?: string | null;
  /** Destinos com contexto (FINANCEIRO e PEDAGOGICO exigem escolher a matrícula/aluno); vêm de `listarOpcoesAtendimento`. */
  destinos?: DestinoTransferencia[];
  /** Depois de qualquer ação concluída (a tela recarrega a lista). */
  aoMudar?: () => void;
  /** Fuso de exibição de quem lê (o pessoal; sem ele, o da escola), já resolvido pela página do Inbox. */
  fuso: string | null;
}

const SILENCIO_HORAS = 8;
const CLASSE_CONTROLE = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

/** Horário de agendamento: vazio, inválido ou que não é futuro são recusados na própria tela (a action revalida). */
export function validarQuando(quando: string, agora: Date = new Date()): string | null {
  if (!quando) return "Escolha o dia e a hora do envio.";
  const t = new Date(quando).getTime();
  if (Number.isNaN(t)) return "Data e hora inválidas.";
  if (t <= agora.getTime()) return "Escolha um horário no futuro.";
  return null;
}

/** Setores para onde transferir: os do número, menos o atual. */
export function setoresParaTransferir(setoresDoNumero: Setor[], atual: Setor): Setor[] {
  return setoresDoNumero.filter((s) => s !== atual);
}

type Dialogo = null | "atribuir" | "transferir" | "convidar" | "nota" | "agendar" | "pendentes" | "encerrar";

export function AcoesAtendimento({ atendimento, usuario, setoresDoNumero, fixada, silenciada, linhaComercial = false, donoLinhaId = null, destinos = [], aoMudar, fuso }: PropsAcoesAtendimento) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const direta = useAcaoCliente({ idempotente: false });
  const aberto = atendimento.status !== "ENCERRADO";
  const ctx = { setor: atendimento.finalidade, responsavelId: atendimento.responsavelId, linhaComercial, donoLinhaId };
  const pode = (a: Parameters<typeof podeExecutar>[1]) => aberto && podeExecutar(usuario, a, ctx);

  async function rodar(acao: () => Promise<Resultado>, sucesso: string) {
    setAviso(null);
    const d = await direta.executar(acao, sucesso);
    if (d?.tipo === "ok") { setAviso(sucesso); aoMudar?.(); }
  }
  const concluir = (msg: string) => { setDialogo(null); setAviso(msg); aoMudar?.(); };
  // Revogar convite / cancelar agendamento: o diálogo de pendências continua aberto para as próximas.
  const avisar = (qual: "convite" | "agendamento") => { setAviso(qual === "convite" ? "Convite revogado." : "Agendamento cancelado."); aoMudar?.(); };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ações do atendimento">
        {pode("assumir") && <Botao tamanho="sm" ocupado={direta.ocupado} onClick={() => void rodar(() => assumirAtendimento(atendimento.id), "Atendimento assumido.")}>Assumir</Botao>}
        {pode("devolver") && <Botao tamanho="sm" variante="secundario" ocupado={direta.ocupado} onClick={() => void rodar(() => devolverParaFila(atendimento.id), "Devolvido para a fila.")}>Devolver para a fila</Botao>}
        {pode("atribuir") && <Botao tamanho="sm" variante="secundario" onClick={() => setDialogo("atribuir")}>Atribuir</Botao>}
        {pode("transferir") && <Botao tamanho="sm" variante="secundario" onClick={() => setDialogo("transferir")}>Transferir</Botao>}
        {pode("convidar") && <Botao tamanho="sm" variante="secundario" onClick={() => setDialogo("convidar")}>Convidar</Botao>}
        {pode("notaInterna") && <Botao tamanho="sm" variante="secundario" onClick={() => setDialogo("nota")}>Nota interna</Botao>}
        {pode("agendar") && <Botao tamanho="sm" variante="secundario" onClick={() => setDialogo("agendar")}>Agendar mensagem</Botao>}
        {(pode("convidar") || pode("agendar")) && <Botao tamanho="sm" variante="secundario" onClick={() => setDialogo("pendentes")}>Convites e agendamentos</Botao>}
        {pode("encerrar") && <Botao tamanho="sm" variante="perigo" onClick={() => setDialogo("encerrar")}>Encerrar atendimento</Botao>}
        {pode("bloquear") && <Botao tamanho="sm" variante="secundario" disabled title={AVISO_RECURSO_MOTOR}>Bloquear</Botao>}
        <Botao tamanho="sm" variante="fantasma" ocupado={direta.ocupado} aria-pressed={fixada} onClick={() => void rodar(() => alternarFixada(atendimento.id), fixada ? "Conversa desafixada." : "Conversa fixada.")}>{fixada ? "Desafixar" : "Fixar"}</Botao>
        <Botao tamanho="sm" variante="fantasma" ocupado={direta.ocupado} aria-pressed={silenciada} onClick={() => void rodar(() => silenciarConversa(atendimento.id, silenciada ? null : new Date(Date.now() + SILENCIO_HORAS * 3_600_000).toISOString()), silenciada ? "Notificações reativadas." : `Silenciada por ${SILENCIO_HORAS} horas.`)}>{silenciada ? "Reativar notificações" : "Silenciar"}</Botao>
      </div>
      <p className="text-xs text-gray-500">Fixar e silenciar valem só para você.</p>
      <FeedbackAcao erro={direta.erro} sucesso={aviso} />

      {dialogo === "atribuir" && <DialogoPessoa atendimentoId={atendimento.id} modo="atribuir" aoFechar={() => setDialogo(null)} aoConcluir={() => concluir("Atendimento atribuído.")} />}
      {dialogo === "convidar" && <DialogoPessoa atendimentoId={atendimento.id} modo="convidar" aoFechar={() => setDialogo(null)} aoConcluir={() => concluir("Convite enviado.")} />}
      {dialogo === "transferir" && <DialogoTransferir atendimentoId={atendimento.id} finalidade={atendimento.finalidade} setoresDoNumero={setoresDoNumero} destinos={destinos} aoFechar={() => setDialogo(null)} aoConcluir={() => concluir("Atendimento transferido.")} />}
      {dialogo === "nota" && <DialogoNota atendimentoId={atendimento.id} aoFechar={() => setDialogo(null)} aoConcluir={() => concluir("Nota registrada.")} />}
      {dialogo === "agendar" && <DialogoAgendar atendimentoId={atendimento.id} aoFechar={() => setDialogo(null)} aoConcluir={() => concluir("Mensagem agendada.")} />}
      {dialogo === "pendentes" && <DialogoPendentes atendimentoId={atendimento.id} fuso={fuso} aoFechar={() => setDialogo(null)} aoConcluir={avisar} />}
      {dialogo === "encerrar" && (
        <ConfirmarAcao
          folha
          titulo="Encerrar este atendimento?"
          confirmacao="encerramento"
          idempotente={false}
          acao={() => encerrarAtendimentoWhatsApp(atendimento.id)}
          aoConcluir={() => concluir("Atendimento encerrado.")}
          aoCancelar={() => setDialogo(null)}
        >
          <p>O atendimento sai da fila e das listas abertas. Uma nova mensagem do contato abre outro atendimento; este não é reaberto.</p>
        </ConfirmarAcao>
      )}
    </div>
  );
}

interface PropsDialogo { aoFechar: () => void; aoConcluir: () => void }

/** Rodapé comum: erro da action em FeedbackAcao, dentro do diálogo. */
function Rodape({ ocupado, aoFechar, children }: { ocupado: boolean; aoFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <Botao variante="secundario" disabled={ocupado} onClick={aoFechar}>Cancelar</Botao>
      {children}
    </div>
  );
}

export function DialogoTransferir({ atendimentoId, finalidade, setoresDoNumero, destinos = [], aoFechar, aoConcluir }: PropsDialogo & { atendimentoId: string; finalidade: Setor; setoresDoNumero: Setor[]; destinos?: DestinoTransferencia[] }) {
  const acao = useAcaoCliente({ idempotente: false });
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
    const d = await acao.executar(() => transferirAtendimento({ atendimentoId, destino, destinoChave: exigeChave ? chave : null, contexto }));
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
  // Convidar: convidarParticipante recebe chave de idempotência (#166) e o reenvio devolve o convite já criado.
  // Atribuir é por estado-alvo, mas fica sem chave como antes. `modo` não muda na vida do diálogo.
  const acao = useAcaoCliente({ idempotente: modo === "convidar" });
  const tentativa = useChaveIdempotencia();
  // O fim do convite é calculado no clique; dentro da mesma tentativa ele não muda (senão o reenvio vira outra entrada).
  const fimDaTentativa = useRef<{ chave: string; dias: number; fim: string } | null>(null);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[] | null>(null);
  const [usuarioId, setUsuarioId] = useState("");
  const [podeEnviar, setPodeEnviar] = useState(false);
  const [dias, setDias] = useState(7);
  const [motivo, setMotivo] = useState("");
  // Carga fora do render: em StrictMode o efeito roda duas vezes, mas a resposta descartada não é aplicada.
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
      // O id do participante não interessa à tela: só o desfecho.
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
  // registrarNotaAtendimento recebe chave de idempotência (#166): o reenvio não grava uma segunda nota.
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

function DialogoAgendar({ atendimentoId, aoFechar, aoConcluir }: PropsDialogo & { atendimentoId: string }) {
  // agendarMensagemNoAtendimento recebe chave de idempotência (#166): o reenvio não agenda um segundo envio ao contato.
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const [texto, setTexto] = useState("");
  const [quando, setQuando] = useState("");
  const [erroQuando, setErroQuando] = useState<string | null>(null);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const erro = validarQuando(quando);
    setErroQuando(erro);
    if (erro) return;
    const d = await acao.executar(() => agendarMensagemNoAtendimento({ atendimentoId, texto, quando: new Date(quando).toISOString(), chaveIdempotencia: tentativa.atual }));
    tentativa.depoisDo(d);
    if (d?.tipo === "ok") aoConcluir();
  }
  return (
    <Modal folha titulo="Agendar mensagem" aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-3">
        <Campo rotulo="Mensagem" obrigatorio>
          {(c) => <CampoTexto {...c} className={CLASSE_CONTROLE} rows={4} maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)} />}
        </Campo>
        <Campo rotulo="Enviar em" obrigatorio erro={erroQuando}>
          {(c) => <input {...c} type="datetime-local" className={CLASSE_CONTROLE} value={quando} onChange={(e) => { setQuando(e.target.value); setErroQuando(null); }} />}
        </Campo>
        <FeedbackAcao erro={acao.erro} />
        <Rodape ocupado={acao.ocupado} aoFechar={aoFechar}><Botao type="submit" ocupado={acao.ocupado} disabled={!texto.trim()}>Agendar</Botao></Rodape>
      </form>
    </Modal>
  );
}

type AlvoPendente = { tipo: "convite"; item: ConviteAtivo } | { tipo: "agendamento"; item: AgendamentoAtivo };
/** Fim do convite e horário do agendamento no fuso de exibição (antes, no fuso do navegador). */
export const quandoPendente = (iso: string | Date, fuso: string | null) => formatarInstanteExibicao(iso, fuso, "UTC").texto;

/** Convites ativos e mensagens agendadas do atendimento; "Revogar convite" e "Cancelar agendamento" pedem confirmação. */
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
        idempotente={false}
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
