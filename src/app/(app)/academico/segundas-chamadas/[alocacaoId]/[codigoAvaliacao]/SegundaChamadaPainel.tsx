"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { decidirSegundaChamada, proporSegundaChamada } from "@/server/avaliacoes/segunda-chamada";
import { disponibilizarSegundaChamada } from "@/server/avaliacoes/segunda-chamada-disponibilizacao";
import { FormularioOcorrencia } from "./FormularioOcorrencia";
import { botaoClasses } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, rotular } from "@/lib/labels";

type Item = {
  id: string;
  motivo: string;
  evidencias: string;
  criadaEm: string;
  decisao: { aprovada: boolean; motivo: string } | null;
  podeDecidir: boolean;
  propostaHash: string | null;
  disponibilizacao: { id: string; prazoAte: string } | null;
  reserva: { id: string; status: string; encontroId: string | null } | null;
  podeOperar: boolean;
};

const data = (valor: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: fuso,
}).format(new Date(valor));

export function SegundaChamadaPainel({
  alocacaoId, codigoAvaliacao, itens, ativa, bloqueio, fuso, fusoEntrada,
}: {
  alocacaoId: string;
  codigoAvaliacao: string;
  itens: Item[];
  ativa: boolean;
  /** No lugar do formulário quando `ativa` é falso: o motivo e o que fazer (docs/42 L1670). */
  bloqueio?: ReactNode;
  fuso: string;
  fusoEntrada: string;
}) {
  const router = useRouter();
  // Uma ação por vez no painel (a trava do executor vale para os três formulários). Mensagem de falha sem
  // reenvio cego, como antes (MSG_RESULTADO_INCERTO_SEM_CHAVE): a decisão não leva chave de idempotência.
  const acao = useAcaoCliente({ idempotente: false });
  // Grupo que disparou a última ação: o resultado aparece junto dos botões dele, não no topo da página.
  const [origem, setOrigem] = useState<string | null>(null);
  const proposta = useRef<{ entrada: string; chave: string } | null>(null);
  const disponibilizacoes = useRef(new Map<string, { entrada: string; instante: string }>());

  async function executar<T>(grupo: string, chamada: () => Promise<Resultado<T>>, sucesso: string) {
    // A origem só muda quando a ação de fato roda (o executor ignora o clique durante outra execução).
    const d = await acao.executar(() => { setOrigem(grupo); return chamada(); }, sucesso);
    if (d?.tipo === "ok") router.refresh();
    return d;
  }
  const feedback = (grupo: string) => <FeedbackAcao erro={origem === grupo ? acao.erro : null} sucesso={origem === grupo ? acao.sucesso : null} />;

  return <div className="space-y-4">
    {!ativa && bloqueio}
    {ativa && <form className="space-y-2 rounded border p-4" onSubmit={async evento => {
      evento.preventDefault();
      const elemento = evento.currentTarget;
      const formulario = new FormData(elemento);
      const entrada = {
        alocacaoId,
        codigoAvaliacao,
        motivo: String(formulario.get("motivo")),
        evidencias: String(formulario.get("evidencias")),
      };
      const identificador = JSON.stringify(entrada);
      if (proposta.current?.entrada !== identificador) proposta.current = { entrada: identificador, chave: crypto.randomUUID() };
      const chaveIdempotencia = proposta.current.chave;
      const d = await executar("proposta", () => proporSegundaChamada({ ...entrada, chaveIdempotencia }), "Proposta de segunda chamada enviada.");
      // Proposta registrada: o formulário volta vazio e a próxima proposta ganha chave nova.
      if (d?.tipo === "ok") { proposta.current = null; elemento.reset(); }
    }}>
      <h2 className="font-medium">Propor segunda chamada</h2>
      <label className="block">Motivo<CampoTexto required minLength={5} maxLength={4000} name="motivo" className="block w-full border" /></label>
      <label className="block">Evidências<CampoTexto required minLength={5} maxLength={4000} name="evidencias" className="block w-full border" /></label>
      <button disabled={acao.ocupado} className={botaoClasses({ tamanho: "lg" })}>Enviar proposta</button>
      {feedback("proposta")}
    </form>}

    <section className="space-y-3" aria-label="Histórico da segunda chamada">
      {itens.map(item => <article key={item.id} className="space-y-2 rounded border p-4">
        <p><strong>Proposta:</strong> {item.motivo}</p>
        <p className="text-sm">Evidências: {item.evidencias}</p>
        <p className="text-sm">Criada em {data(item.criadaEm, fuso)} ({fuso}).</p>
        {item.podeOperar && <Link className="block underline" href={`/academico/segundas-chamadas/propostas/${encodeURIComponent(item.id)}/designacao`}>Gerenciar designação de professor</Link>}
        {item.decisao
          ? <p role="status">Decisão: {item.decisao.aprovada ? "autorizada" : "rejeitada"}. {item.decisao.motivo}</p>
          : <p role="status">Aguardando decisão independente.</p>}
        {item.podeDecidir && item.propostaHash && <form className="space-y-2" onSubmit={async evento => {
          evento.preventDefault();
          const formulario = new FormData(evento.currentTarget);
          const aprovada = formulario.get("aprovada") === "sim";
          await executar(`item:${item.id}`, () => decidirSegundaChamada({
            propostaId: item.id,
            propostaHash: item.propostaHash!,
            aprovada,
            motivo: String(formulario.get("motivoDecisao")),
          }), aprovada ? "Segunda chamada autorizada." : "Segunda chamada rejeitada.");
        }}>
          <label className="block">Decisão
            <select name="aprovada" required defaultValue="" className="block border">
              <option value="" disabled>Selecione</option>
              <option value="sim">Autorizar</option>
              <option value="nao">Rejeitar</option>
            </select>
          </label>
          <label className="block">Motivo da decisão<CampoTexto name="motivoDecisao" required minLength={5} maxLength={4000} className="block w-full border" /></label>
          <button disabled={acao.ocupado} className={botaoClasses({ tamanho: "lg" })}>Registrar decisão</button>
        </form>}
        {item.podeOperar && item.decisao?.aprovada && !item.disponibilizacao && <form className="space-y-2" onSubmit={async evento => {
          evento.preventDefault();
          const formulario = new FormData(evento.currentTarget);
          const entrada = JSON.stringify({
            propostaId: item.id,
            propostaHash: item.propostaHash ?? "",
            condicoes: String(formulario.get("condicoes")),
            evidenciaComunicacao: String(formulario.get("evidencia")),
          });
          const anterior = disponibilizacoes.current.get(item.id);
          const instante = anterior?.entrada === entrada ? anterior.instante : new Date().toISOString();
          disponibilizacoes.current.set(item.id, { entrada, instante });
          await executar(`item:${item.id}`, () => disponibilizarSegundaChamada({
            propostaId: item.id,
            propostaHash: item.propostaHash ?? "",
            disponibilizadaEm: instante,
            condicoes: String(formulario.get("condicoes")),
            evidenciaComunicacao: String(formulario.get("evidencia")),
          }), "Segunda chamada disponibilizada; prazo iniciado.");
        }}>
          <label className="block">Condições disponíveis<CampoTexto required minLength={5} maxLength={4000} name="condicoes" className="block w-full border" /></label>
          <label className="block">Evidência da comunicação<CampoTexto required minLength={5} maxLength={4000} name="evidencia" className="block w-full border" /></label>
          <button disabled={acao.ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Disponibilizar e iniciar prazo</button>
        </form>}
        {/* Fora dos formulários de decisão/disponibilização: depois do refresh eles somem, e o resultado fica.
            Só nos itens com ação (ou que acabaram de ter uma): os demais não ganham uma região vazia. */}
        {((item.podeDecidir && item.propostaHash) || (item.podeOperar && item.decisao?.aprovada && !item.disponibilizacao) || origem === `item:${item.id}`) && feedback(`item:${item.id}`)}
        {item.disponibilizacao && <p role="status">Disponibilizada. Prazo atual: {data(item.disponibilizacao.prazoAte, fuso)} ({fuso}).</p>}
        {item.podeOperar && item.disponibilizacao && !item.reserva && <Link className="block underline" href={`/academico/segundas-chamadas/propostas/${encodeURIComponent(item.id)}/agenda`}>Preparar e revisar agenda inicial</Link>}
        {item.podeOperar && item.reserva && <div className="space-y-2">
          <Link className="block underline" href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(item.reserva.id)}/cancelamento`}>Propor ou conferir cancelamento da agenda</Link>
          <Link className="block underline" href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(item.reserva.id)}/remarcacao`}>Propor ou conferir remarcação da agenda</Link>
          <p role="status">Reserva {item.reserva.status === "CONSUMIDA_FALTA" ? "consumida por falta; encontro não realizado" : item.reserva.status === "PENDENCIA_ESCOLA" ? "liberada sem consumo por impedimento da escola; revisão pendente" : rotular(STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, item.reserva.status)}. Encontro vinculado: {item.reserva.encontroId ? "registrado na agenda" : "não informado"}.</p>
          {item.reserva.status === "RESERVADA" && <FormularioOcorrencia reservaId={item.reserva.id} fuso={fusoEntrada} />}
        </div>}
      </article>)}
      {!itens.length && <EstadoVazio>Nenhuma proposta nesta avaliação.</EstadoVazio>}
    </section>
  </div>;
}
