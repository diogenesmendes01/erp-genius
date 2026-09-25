"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { decidirSegundaChamada, proporSegundaChamada } from "@/server/avaliacoes/segunda-chamada";
import { disponibilizarSegundaChamada } from "@/server/avaliacoes/segunda-chamada-disponibilizacao";
import { FormularioOcorrencia } from "./FormularioOcorrencia";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

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

type Resultado = { ok: boolean; erro?: string };

const data = (valor: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: fuso,
}).format(new Date(valor));

export function SegundaChamadaPainel({
  alocacaoId, codigoAvaliacao, itens, ativa, fuso, fusoEntrada,
}: {
  alocacaoId: string;
  codigoAvaliacao: string;
  itens: Item[];
  ativa: boolean;
  fuso: string;
  fusoEntrada: string;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const ocupadoRef = useRef(false);
  const proposta = useRef<{ entrada: string; chave: string } | null>(null);
  const disponibilizacoes = useRef(new Map<string, { entrada: string; instante: string }>());

  const executar = async (acao: () => Promise<Resultado>) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    setErro("");
    try {
      const r = await acao();
      if (!r.ok) {
        setErro(r.erro ?? "Não foi possível concluir a ação.");
        return;
      }
      window.location.reload();
    } catch {
      setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  };

  return <div className="space-y-4">
    {erro && <p role="alert">{erro}</p>}
    {ativa && <form className="space-y-2 rounded border p-4" onSubmit={evento => {
      evento.preventDefault();
      const formulario = new FormData(evento.currentTarget);
      const entrada = {
        alocacaoId,
        codigoAvaliacao,
        motivo: String(formulario.get("motivo")),
        evidencias: String(formulario.get("evidencias")),
      };
      const identificador = JSON.stringify(entrada);
      if (proposta.current?.entrada !== identificador) proposta.current = { entrada: identificador, chave: crypto.randomUUID() };
      const chaveIdempotencia = proposta.current.chave;
      void executar(() => proporSegundaChamada({ ...entrada, chaveIdempotencia }));
    }}>
      <h2 className="font-medium">Propor segunda chamada</h2>
      <label className="block">Motivo<CampoTexto required minLength={5} maxLength={4000} name="motivo" className="block w-full border" /></label>
      <label className="block">Evidências<CampoTexto required minLength={5} maxLength={4000} name="evidencias" className="block w-full border" /></label>
      <button disabled={ocupado} className={botaoClasses({ tamanho: "lg" })}>Enviar proposta</button>
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
        {item.podeDecidir && item.propostaHash && <form className="space-y-2" onSubmit={evento => {
          evento.preventDefault();
          const formulario = new FormData(evento.currentTarget);
          void executar(() => decidirSegundaChamada({
            propostaId: item.id,
            propostaHash: item.propostaHash!,
            aprovada: formulario.get("aprovada") === "sim",
            motivo: String(formulario.get("motivoDecisao")),
          }));
        }}>
          <label className="block">Decisão
            <select name="aprovada" required defaultValue="" className="block border">
              <option value="" disabled>Selecione</option>
              <option value="sim">Autorizar</option>
              <option value="nao">Rejeitar</option>
            </select>
          </label>
          <label className="block">Motivo da decisão<CampoTexto name="motivoDecisao" required minLength={5} maxLength={4000} className="block w-full border" /></label>
          <button disabled={ocupado} className={botaoClasses({ tamanho: "lg" })}>Registrar decisão</button>
        </form>}
        {item.podeOperar && item.decisao?.aprovada && !item.disponibilizacao && <form className="space-y-2" onSubmit={evento => {
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
          void executar(() => disponibilizarSegundaChamada({
            propostaId: item.id,
            propostaHash: item.propostaHash ?? "",
            disponibilizadaEm: instante,
            condicoes: String(formulario.get("condicoes")),
            evidenciaComunicacao: String(formulario.get("evidencia")),
          }));
        }}>
          <label className="block">Condições disponíveis<CampoTexto required minLength={5} maxLength={4000} name="condicoes" className="block w-full border" /></label>
          <label className="block">Evidência da comunicação<CampoTexto required minLength={5} maxLength={4000} name="evidencia" className="block w-full border" /></label>
          <button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Disponibilizar e iniciar prazo</button>
        </form>}
        {item.disponibilizacao && <p role="status">Disponibilizada. Prazo atual: {data(item.disponibilizacao.prazoAte, fuso)} ({fuso}).</p>}
        {item.podeOperar && item.disponibilizacao && !item.reserva && <Link className="block underline" href={`/academico/segundas-chamadas/propostas/${encodeURIComponent(item.id)}/agenda`}>Preparar e revisar agenda inicial</Link>}
        {item.podeOperar && item.reserva && <div className="space-y-2">
          <Link className="block underline" href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(item.reserva.id)}/cancelamento`}>Propor ou conferir cancelamento da agenda</Link>
          <Link className="block underline" href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(item.reserva.id)}/remarcacao`}>Propor ou conferir remarcação da agenda</Link>
          <p role="status">Reserva {item.reserva.status === "CONSUMIDA_FALTA" ? "consumida por falta; encontro não realizado" : item.reserva.status === "PENDENCIA_ESCOLA" ? "liberada sem consumo por impedimento da escola; revisão pendente" : item.reserva.status}. Encontro vinculado: {item.reserva.encontroId ?? "não informado"}.</p>
          {item.reserva.status === "RESERVADA" && <FormularioOcorrencia reservaId={item.reserva.id} fuso={fusoEntrada} />}
        </div>}
      </article>)}
      {!itens.length && <p>Nenhuma proposta nesta avaliação.</p>}
    </section>
  </div>;
}
