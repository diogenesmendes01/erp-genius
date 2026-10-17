"use client";

import { useState } from "react";
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
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import { podeExecutar } from "@/server/inbox/permissoes";
import { PRAZO_MAXIMO_CONVITE_DIAS } from "@/server/whatsapp/participantes";
import { assumirAtendimento, atribuirAtendimento, convidarParticipante, devolverParaFila, transferirAtendimento } from "@/server/whatsapp/acoes-atendimento";
import { agendarMensagemNoAtendimento, registrarNotaAtendimento } from "@/server/whatsapp/acoes-conversa";
import { listarPessoasParaAtendimento } from "@/server/whatsapp/consultas-acoes-atendimento";
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

type Dialogo = null | "atribuir" | "transferir" | "convidar" | "nota" | "agendar" | "encerrar";

export function AcoesAtendimento({ atendimento, usuario, setoresDoNumero, fixada, silenciada, linhaComercial = false, donoLinhaId = null, destinos = [], aoMudar }: PropsAcoesAtendimento) {
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
      {dialogo === "encerrar" && (
        <ConfirmarAcao
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
    <Modal titulo="Transferir atendimento" aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
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

function DialogoPessoa({ atendimentoId, modo, aoFechar, aoConcluir }: PropsDialogo & { atendimentoId: string; modo: "atribuir" | "convidar" }) {
  const acao = useAcaoCliente({ idempotente: false });
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[] | null>(null);
  const [usuarioId, setUsuarioId] = useState("");
  const [podeEnviar, setPodeEnviar] = useState(false);
  const [dias, setDias] = useState(7);
  const [motivo, setMotivo] = useState("");
  const [carregou, setCarregou] = useState(false);
  if (!carregou) {
    setCarregou(true);
    void listarPessoasParaAtendimento(atendimentoId, modo).then(setPessoas).catch(() => setPessoas([]));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const d = await acao.executar(async (): Promise<Resultado> => modo === "atribuir"
      ? atribuirAtendimento({ atendimentoId, usuarioId })
      : { ...(await convidarParticipante({ atendimentoId, usuarioId, podeEnviar, fim: new Date(Date.now() + dias * 86_400_000).toISOString(), motivo })), dado: undefined } as Resultado);
    if (d?.tipo === "ok") aoConcluir();
  }

  return (
    <Modal titulo={modo === "atribuir" ? "Atribuir atendimento" : "Convidar participante"} aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
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
  const acao = useAcaoCliente({ idempotente: false });
  const [nota, setNota] = useState("");
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const d = await acao.executar(() => registrarNotaAtendimento({ atendimentoId, nota }));
    if (d?.tipo === "ok") aoConcluir();
  }
  return (
    <Modal titulo="Nota interna" aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
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
  const acao = useAcaoCliente({ idempotente: false });
  const [texto, setTexto] = useState("");
  const [quando, setQuando] = useState("");
  const [erroQuando, setErroQuando] = useState<string | null>(null);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const erro = validarQuando(quando);
    setErroQuando(erro);
    if (erro) return;
    const d = await acao.executar(() => agendarMensagemNoAtendimento({ atendimentoId, texto, quando: new Date(quando).toISOString() }));
    if (d?.tipo === "ok") aoConcluir();
  }
  return (
    <Modal titulo="Agendar mensagem" aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
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
