"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Botao } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { PagamentoModal } from "@/components/PagamentoModal";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { formatarDataCivil } from "@/lib/data-civil";
import { formatarMoeda } from "@/lib/dinheiro";
import { registrarPromessaPagamento } from "@/server/cobrancas/acoes";
import type { AcoesContatoInbox, PessoasVinculo, VinculoContatoInbox } from "@/server/whatsapp/consultas-inbox";
import { desvincularContatoWhatsApp } from "@/server/whatsapp/desvincular-contato";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { buscarVinculosInbox, criarLeadDaConversa, editarNomeContatoWhatsApp, marcarConversaTratada, vincularContatoWhatsApp } from "@/server/whatsapp/acoes";

// Ações de cadastro e de cobrança no painel lateral do Inbox novo (C2 da R1 do #217, decisão do dono: portar
// tudo o que o Inbox antigo tinha na thread). As regras de quem vê cada botão vêm do servidor
// (carregarAcoesContatoInbox) e cada Server Action confere de novo a alçada.
// O telefone não aparece (regra 5): o nome identifica o contato.

export interface PropsAcoesContato {
  atendimentoId: string;
  acoes: AcoesContatoInbox;
  fuso: string | null;
  /** Contato em opt-out: sem "Retomar régua" (a régua não volta a falar com quem pediu para sair), como no Inbox antigo. */
  optOut?: boolean;
  /** Uma ação concluiu: a tela recarrega lista e painel. */
  aoMudar?: () => void;
}

/** Ficha de cada cadastro: a oportunidade mora no funil (a lista /leads saiu na Fase 2J). */
export function hrefCadastro(tipo: "aluno" | "lead", id: string): string {
  return tipo === "aluno" ? `/alunos/${id}` : `/funil?o=${encodeURIComponent(id)}`;
}

/** O nome na conversa vem de um cadastro com tela própria: o painel explica e leva até lá. */
export function avisoCadastroDoNome(a: Pick<AcoesContatoInbox, "fonteNome" | "alunoId" | "leadId">): { texto: string; href: string | null } | null {
  if (a.fonteNome === "aluno") return { texto: "Nesta conversa aparece o nome do cadastro do aluno.", href: a.alunoId ? hrefCadastro("aluno", a.alunoId) : null };
  if (a.fonteNome === "lead") return a.leadId
    ? { texto: "Nesta conversa aparece o nome do cadastro da oportunidade.", href: hrefCadastro("lead", a.leadId) }
    // Oportunidade de outra carteira (LC-L02): quem corrige é o dono da carteira.
    : { texto: "Nesta conversa aparece o nome de uma oportunidade de outra carteira; peça a correção a quem cuida dela.", href: null };
  if (a.fonteNome === "responsavel") return { texto: "Nesta conversa aparece o nome do cadastro do responsável; a correção é feita pela Secretaria.", href: null };
  return null;
}

type Aberto = null | "nome" | "vincular" | "desvincular";

export function AcoesContato({ atendimentoId, acoes, fuso, optOut = false, aoMudar }: PropsAcoesContato) {
  const [aberto, setAberto] = useState<Aberto>(null);
  // Idempotente por natureza (#166): com a conversa já vinculada, o servidor devolve a mesma oportunidade (e o
  // mesmo `criado` do vínculo feito por quem repete), sem gravar outro Evento (criarLeadDaConversa).
  const criar = useAcaoCliente({ idempotente: true });

  async function criarOportunidade() {
    const d = await criar.executar(() => criarLeadDaConversa(atendimentoId),
      (dado) => (dado?.criado ? "Oportunidade criada e vinculada à conversa." : "O contato já tinha oportunidade: a conversa foi vinculada a ela."));
    if (d?.tipo === "ok") aoMudar?.();
  }

  const podeDesvincular = acoes.vinculos.length > 0;
  const temCadastro = acoes.leadId || acoes.alunoId || acoes.podeCriarLead || acoes.podeEditarNome || acoes.podeVincular || podeDesvincular;
  return (
    <>
      {temCadastro && (
        <section aria-label="Cadastro do contato" className="space-y-2 border-t p-4 text-sm">
          {(acoes.leadId || acoes.alunoId) && (
            <p className="flex flex-wrap gap-x-3 gap-y-1">
              {acoes.leadId && <Link href={hrefCadastro("lead", acoes.leadId)} className="text-brand-800 underline">Abrir oportunidade</Link>}
              {acoes.alunoId && <Link href={hrefCadastro("aluno", acoes.alunoId)} className="text-brand-800 underline">Abrir cadastro do aluno</Link>}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {acoes.podeCriarLead && <Botao tamanho="sm" variante="secundario" ocupado={criar.ocupado} onClick={() => void criarOportunidade()}>Criar oportunidade</Botao>}
            {acoes.podeEditarNome && <Botao tamanho="sm" variante="secundario" aria-expanded={aberto === "nome"} onClick={() => setAberto(aberto === "nome" ? null : "nome")}>Editar nome</Botao>}
            {acoes.podeVincular && <Botao tamanho="sm" variante="secundario" aria-expanded={aberto === "vincular"} onClick={() => setAberto(aberto === "vincular" ? null : "vincular")}>Vincular</Botao>}
            {podeDesvincular && <Botao tamanho="sm" variante="secundario" aria-expanded={aberto === "desvincular"} onClick={() => setAberto(aberto === "desvincular" ? null : "desvincular")}>Desvincular</Botao>}
          </div>
          <FeedbackAcao erro={criar.erro} sucesso={criar.sucesso} />
          {aberto === "nome" && <EditarNomeContato atendimentoId={atendimentoId} acoes={acoes} aoFechar={() => setAberto(null)} aoMudar={aoMudar} />}
          {aberto === "vincular" && <VincularContato atendimentoId={atendimentoId} acoes={acoes} aoFechar={() => setAberto(null)} aoMudar={aoMudar} />}
          {aberto === "desvincular" && <DesvincularContato atendimentoId={atendimentoId} vinculos={acoes.vinculos} aoFechar={() => setAberto(null)} aoMudar={aoMudar} />}
        </section>
      )}
      {acoes.cobranca && <CobrancaContato atendimentoId={atendimentoId} cobranca={acoes.cobranca} fuso={fuso} optOut={optOut} aoMudar={aoMudar} />}
    </>
  );
}

export function EditarNomeContato({ atendimentoId, acoes, aoFechar, aoMudar }: { atendimentoId: string; acoes: AcoesContatoInbox; aoFechar(): void; aoMudar?: () => void }) {
  const [nome, setNome] = useState(acoes.nomeSalvo ?? "");
  // A gravação é condicional ao nome lido: depois de um sucesso que não chegou, reenviar não devolve o mesmo registro.
  const salvar = useAcaoCliente({ idempotente: false });
  const aviso = avisoCadastroDoNome(acoes);
  const id = useId();
  const idNota = `${id}-nota`, idDica = `${id}-dica`;

  async function enviar(e: { preventDefault(): void }) {
    e.preventDefault();
    const limpo = nome.trim();
    const d = await salvar.executar(() => editarNomeContatoWhatsApp({ atendimentoId, nome, nomeAnterior: acoes.nomeSalvo }),
      limpo ? `Contato salvo como ${limpo}.` : "Nome salvo removido: a conversa volta a mostrar o perfil do WhatsApp.");
    if (d?.tipo === "ok") aoMudar?.();
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="space-y-2 rounded border border-gray-200 bg-surface-muted p-3">
      {aviso && (
        <p id={idNota} role="note" className="text-xs text-gray-700">
          {aviso.texto}{" "}
          {aviso.href && <><Link href={aviso.href} className="text-brand-800 underline">Corrigir no cadastro</Link>{" "}</>}
          O nome salvo abaixo vale para as telas que não usam esse cadastro.
        </p>
      )}
      <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} aria-label="Nome salvo do contato"
        aria-describedby={aviso ? `${idNota} ${idDica}` : idDica} placeholder={acoes.nomePerfil ?? ""}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
      <p id={idDica} className="text-xs text-gray-600">
        {acoes.nomePerfil ? `Perfil no WhatsApp: ${acoes.nomePerfil}. ` : ""}Deixe em branco para voltar ao perfil do WhatsApp.
      </p>
      <div className="flex gap-2">
        <Botao type="submit" tamanho="sm" ocupado={salvar.ocupado} disabled={nome.trim() === (acoes.nomeSalvo ?? "")}>Salvar nome</Botao>
        <Botao tamanho="sm" variante="fantasma" onClick={aoFechar}>Fechar</Botao>
      </div>
      <FeedbackAcao erro={salvar.erro} sucesso={salvar.sucesso} />
    </form>
  );
}

type AlvoVinculo = { tipo: "aluno" | "responsavel" | "lead"; id: string };
type Escolha = { alvo: AlvoVinculo; nome: string; como: string };

export function VincularContato({ atendimentoId, acoes, aoFechar, aoMudar }: { atendimentoId: string; acoes: AcoesContatoInbox; aoFechar(): void; aoMudar?: () => void }) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<PessoasVinculo | null>(null);
  // Vincular amarra o histórico da conversa a outra pessoa (docs/42 L2298); desfazer cabe só à administração ou ao
  // gerente do setor, com motivo (D8). Escolher um nome só abre a confirmação; a action roda no ConfirmarAcao.
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const busca = useAcaoCliente({ idempotente: true });

  async function buscar(e: { preventDefault(): void }) {
    e.preventDefault();
    const q = termo.trim();
    if (q.length < 2) { busca.setErro("Digite ao menos 2 letras."); return; }
    const d = await busca.executar(() => buscarVinculosInbox(q, atendimentoId));
    if (d?.tipo === "ok") setResultados(d.dado ?? null);
  }

  const grupos: { titulo: string; tipo: AlvoVinculo["tipo"]; como: string; itens: { id: string; nome: string }[] }[] = resultados ? [
    { titulo: "Alunos", tipo: "aluno", como: "aluno", itens: resultados.alunos },
    { titulo: "Responsáveis", tipo: "responsavel", como: "responsável", itens: resultados.responsaveis },
    { titulo: "Oportunidades", tipo: "lead", como: "oportunidade", itens: resultados.leads.map((l) => ({ id: l.id, nome: l.codigo ? `${l.nome} (${l.codigo})` : l.nome })) },
  ] : [];

  return (
    <div className="space-y-2 rounded border border-gray-200 bg-surface-muted p-3">
      <form role="search" onSubmit={(e) => void buscar(e)} className="flex gap-2">
        <input value={termo} onChange={(e) => setTermo(e.target.value)} maxLength={100} aria-label="Buscar aluno, responsável ou oportunidade para vincular"
          placeholder="Nome do aluno, responsável ou oportunidade" className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <Botao type="submit" tamanho="sm" variante="secundario" ocupado={busca.ocupado}>Buscar</Botao>
        <Botao tamanho="sm" variante="fantasma" onClick={aoFechar}>Fechar</Botao>
      </form>
      <FeedbackAcao erro={busca.erro} sucesso={aviso} />
      {grupos.map((g) => (
        <div key={g.tipo}>
          <p className="text-xs font-medium text-gray-700">{g.titulo}</p>
          {g.itens.length === 0
            ? <EstadoVazio>Nenhum encontrado.</EstadoVazio>
            : <ul className="space-y-1">{g.itens.map((i) => (
                <li key={i.id}><Botao tamanho="sm" variante="fantasma" onClick={() => { setAviso(null); setEscolha({ alvo: { tipo: g.tipo, id: i.id }, nome: i.nome, como: g.como }); }}>Vincular a {i.nome}</Botao></li>
              ))}</ul>}
        </div>
      ))}
      {escolha && (
        <ConfirmarAcao
          folha
          titulo={`Vincular esta conversa a ${escolha.nome} (${escolha.como})?`}
          confirmacao="vínculo"
          idempotente={false}
          acao={() => vincularContatoWhatsApp({ contatoId: acoes.contatoId, atendimentoId, alvo: escolha.alvo })}
          aoConcluir={() => { setEscolha(null); setAviso(`Contato vinculado a ${escolha.nome}.`); aoMudar?.(); }}
          aoCancelar={() => setEscolha(null)}
        >
          <p>O contato {acoes.contatoNome} passa a ficar ligado a <strong>{escolha.nome}</strong> ({escolha.como}): o histórico desta conversa, e o das próximas mensagens deste número, aparece no cadastro.</p>
          <p>Para desfazer um vínculo errado, a administração ou o gerente do setor usa “Desvincular”, com motivo registrado.</p>
        </ConfirmarAcao>
      )}
    </div>
  );
}

const COMO_VINCULO: Record<VinculoContatoInbox["tipo"], string> = { aluno: "aluno", responsavel: "responsável", lead: "oportunidade" };
const MOTIVO_MINIMO = 10;

/**
 * "Desvincular contato" (D8, #175, docs/42 L2298): só aparece para quem o servidor autoriza (Administrador ou gerente do
 * setor). Escolhe o vínculo, exige o motivo e roda a action dentro do ConfirmarAcao, que diz o efeito.
 */
export function DesvincularContato({ atendimentoId, vinculos, aoFechar, aoMudar }: { atendimentoId: string; vinculos: VinculoContatoInbox[]; aoFechar(): void; aoMudar?: () => void }) {
  const [escolha, setEscolha] = useState<VinculoContatoInbox | null>(vinculos.length === 1 ? vinculos[0] : null);
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const id = useId();
  const motivoOk = motivo.trim().length >= MOTIVO_MINIMO;

  return (
    <div className="space-y-2 rounded border border-gray-200 bg-surface-muted p-3">
      <ul className="space-y-1">
        {vinculos.map((v) => (
          <li key={`${v.tipo}:${v.id}`}>
            <Botao tamanho="sm" variante="fantasma" onClick={() => { setAviso(null); setEscolha(v); }}>Desvincular de {v.nome}</Botao>
            <span className="ml-1 text-xs text-gray-600">({COMO_VINCULO[v.tipo]})</span>
          </li>
        ))}
      </ul>
      {escolha && (
        <>
          <label htmlFor={`${id}-motivo`} className="block text-xs font-medium text-gray-700">Motivo do desvínculo</label>
          <p className="text-xs text-gray-700">Desvincular de <strong>{escolha.nome}</strong> ({COMO_VINCULO[escolha.tipo]}). O motivo fica registrado no histórico do contato.</p>
          <CampoTexto id={`${id}-motivo`} value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={MOTIVO_MINIMO} maxLength={500} rows={2}
            aria-label="Motivo do desvínculo" className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </>
      )}
      <div className="flex gap-2">
        {escolha && <Botao tamanho="sm" disabled={!motivoOk} onClick={() => setConfirmar(true)}>Revisar desvínculo</Botao>}
        <Botao tamanho="sm" variante="fantasma" onClick={aoFechar}>Fechar</Botao>
      </div>
      <FeedbackAcao erro={null} sucesso={aviso} />
      {confirmar && escolha && (
        <ConfirmarAcao
          folha
          titulo={`Desvincular esta conversa de ${escolha.nome} (${COMO_VINCULO[escolha.tipo]})?`}
          confirmacao="desvínculo"
          idempotente={false}
          acao={() => desvincularContatoWhatsApp({ atendimentoId, alvo: { tipo: escolha.tipo, id: escolha.id }, motivo: motivo.trim() })}
          aoConcluir={() => { setConfirmar(false); setEscolha(null); setMotivo(""); setAviso(`Contato desvinculado de ${escolha.nome}.`); aoMudar?.(); }}
          aoCancelar={() => setConfirmar(false)}
        >
          <p>O contato deixa de ficar ligado a <strong>{escolha.nome}</strong> ({COMO_VINCULO[escolha.tipo]}): as próximas mensagens deste número não aparecem mais nesse cadastro.</p>
          <p>Nada é apagado: o cadastro, as mensagens e os atendimentos continuam. O desvínculo e o motivo ficam registrados.</p>
        </ConfirmarAcao>
      )}
    </div>
  );
}

export function CobrancaContato({ atendimentoId, cobranca, fuso, optOut = false, aoMudar }: { atendimentoId: string; cobranca: NonNullable<AcoesContatoInbox["cobranca"]>; fuso: string | null; optOut?: boolean; aoMudar?: () => void }) {
  const [pagar, setPagar] = useState(false);
  const [promessa, setPromessa] = useState(false);
  const [data, setData] = useState("");
  const retomar = useAcaoCliente({ idempotente: true });
  // A promessa recebe chave de idempotência (#166) e a marcação da conversa é por estado-alvo (a mesma de
  // `retomar`): o reenvio depois de um resultado incerto não grava segunda promessa.
  const prometer = useAcaoCliente({ idempotente: true });
  const tentativaPromessa = useChaveIdempotencia();
  const ativa = cobranca.ativa;

  async function retomarRegua() {
    const d = await retomar.executar(() => marcarConversaTratada({ conversaId: atendimentoId, motivo: "retomar_regua" }), "Régua retomada: o silêncio pós-resposta foi liberado.");
    if (d?.tipo === "ok") aoMudar?.();
  }
  async function registrarPromessa() {
    if (!ativa || !data) return;
    const d = await prometer.executar(async () => {
      const r = await registrarPromessaPagamento(ativa.id, data, tentativaPromessa.atual);
      if (!r.ok) return r;
      return marcarConversaTratada({ conversaId: atendimentoId, motivo: "promessa" });
    }, "Promessa registrada: régua pausada até a data.");
    tentativaPromessa.depoisDo(d);
    if (d?.tipo === "ok") { setPromessa(false); setData(""); aoMudar?.(); }
  }
  async function aposPagamento() {
    setPagar(false);
    // O pagamento já entrou; só a marcação da conversa pode ter ficado incerta.
    const d = await retomar.executar(() => marcarConversaTratada({ conversaId: atendimentoId, motivo: "pagamento" }), "Pagamento registrado.");
    if (d && d.tipo !== "ok") retomar.setErro("Pagamento registrado. Confira se a conversa ficou marcada como tratada.");
    aoMudar?.();
  }

  return (
    <section aria-label="Cobrança" className="space-y-2 border-t p-4 text-sm">
      {!optOut && cobranca.silencio.ativo && (
        <div className="space-y-2 rounded bg-highlight p-2 text-xs text-gray-800">
          <p>Régua automática em silêncio até {formatarInstanteExibicao(cobranca.silencio.ate!, fuso, "UTC").texto}: o contato respondeu e ninguém tratou (S4).</p>
          <Botao tamanho="sm" variante="secundario" ocupado={retomar.ocupado} onClick={() => void retomarRegua()}>Retomar régua</Botao>
        </div>
      )}
      {ativa && (
        <>
          <p>
            Cobrança ativa · {ativa.alunoNome} · {formatarMoeda(ativa.saldo > 0 ? ativa.saldo : ativa.valorNegociado, ativa.moeda)} · vence{" "}
            {ativa.vencimento.estado === "CONFIRMADO" ? formatarDataCivil(ativa.vencimento.dataCivil) : "em conferência"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao tamanho="sm" variante="secundario" onClick={() => setPagar(true)}>Registrar pagamento</Botao>
            <Botao tamanho="sm" variante="secundario" aria-expanded={promessa} onClick={() => setPromessa(!promessa)}>Promessa de pagamento</Botao>
          </div>
          {promessa && (
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data da promessa de pagamento" className="rounded border border-gray-300 px-2 py-1 text-sm" />
              <Botao tamanho="sm" ocupado={prometer.ocupado} disabled={!data} onClick={() => void registrarPromessa()}>Registrar promessa</Botao>
            </div>
          )}
        </>
      )}
      <FeedbackAcao erro={retomar.erro ?? prometer.erro} sucesso={retomar.sucesso ?? prometer.sucesso} />
      {pagar && ativa && (
        <PagamentoModal
          cobrancaId={ativa.id}
          alunoNome={ativa.alunoNome}
          moeda={ativa.moeda}
          valorEsperado={ativa.valorNegociado}
          jaRecebido={ativa.valorRecebido}
          saldoRestante={ativa.saldo}
          onClose={() => setPagar(false)}
          onDone={() => aposPagamento()}
        />
      )}
    </section>
  );
}
