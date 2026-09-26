"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  consultarTerminosIndisponibilidadeOferta,
  decidirTerminoIndisponibilidadeOferta,
  proporTerminoIndisponibilidadeOferta,
} from "@/server/matricula/indisponibilidade-oferta-termino";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarTerminosIndisponibilidadeOferta>>, { ok: true }>["dado"]>;

function dataCivil(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${valor.slice(0, 10)}T00:00:00Z`));
}

function instanteDoEvento(valor: string, fusoInstitucional: string | null) {
  const instante = new Date(valor);
  if (!fusoInstitucional) return `${instante.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")} (fuso institucional não configurado)`;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fusoInstitucional }).format(instante);
}

export function TerminoIndisponibilidadeOferta({
  registroId,
  inicio,
  dados: d,
  fusoInstitucional,
}: {
  registroId: string;
  inicio: string;
  dados: Dados;
  fusoInstitucional: string | null;
}) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const chave = useRef<string | null>(null);
  const classe = "block w-full rounded border p-2";
  const paginaAnterior = d.pagina > 1 ? d.pagina - 1 : null;

  return <div className="space-y-4">
    <p>Indisponibilidade relatada desde {dataCivil(inicio)}.</p>
    <MensagemStatus texto={mensagem} />
    {erro && <p role="alert">{erro}</p>}

    {d.podePropor && <form className="space-y-3 rounded border p-4" onSubmit={evento => {
      evento.preventDefault();
      const elemento = evento.currentTarget;
      const formulario = new FormData(elemento);
      chave.current ??= crypto.randomUUID();
      iniciar(async () => {
        setMensagem("");
        setErro("");
        try {
          const resultado = await proporTerminoIndisponibilidadeOferta({
            registroId,
            fim: String(formulario.get("fim")),
            motivo: String(formulario.get("motivo")),
            evidenciaTexto: String(formulario.get("evidencia")),
            chaveIdempotencia: chave.current!,
          });
          if (resultado.ok) {
            setMensagem("Último dia proposto e aguardando decisão independente.");
            elemento.reset();
            chave.current = null;
            router.refresh();
          } else setErro(resultado.erro);
        } catch {
          setErro(MSG_RESULTADO_INCERTO);
        }
      });
    }}>
      <fieldset disabled={ocupado} className="space-y-3">
        <legend>Propor término</legend>
        <p className="text-sm">Informe o último dia de indisponibilidade; não informe a data de retorno.</p>
        <label className="block" htmlFor="fim">Último dia indisponível<input id="fim" className={classe} name="fim" type="date" min={inicio.slice(0, 10)} required /></label>
        <label className="block" htmlFor="motivo">Motivo<CampoTexto id="motivo" className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
        <label className="block" htmlFor="evidencia">Evidência<CampoTexto id="evidencia" className={classe} name="evidencia" minLength={5} maxLength={4000} required /></label>
        <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Propor último dia"}</button>
      </fieldset>
    </form>}

    <h2 className="text-lg">Histórico de propostas</h2>
    {!d.propostas.length && <EstadoVazio>Nenhuma proposta registrada nesta página.</EstadoVazio>}
    {d.propostas.map(proposta => <article key={proposta.id} className="space-y-2 rounded border p-4">
      <h3>Último dia indisponível: {dataCivil(proposta.fim)}</h3>
      <p className="whitespace-pre-wrap">{proposta.motivo}</p>
      <p className="whitespace-pre-wrap">Evidência: {proposta.evidenciaTexto}</p>
      <p>Proposta registrada em {instanteDoEvento(proposta.criadaEm, fusoInstitucional)}.</p>
      {proposta.decisao ? <section className="rounded bg-gray-50 p-3"><p>{proposta.decisao.aprovada ? "Término aprovado" : "Término rejeitado"} em {instanteDoEvento(proposta.decisao.decididaEm, fusoInstitucional)}.</p><p className="whitespace-pre-wrap">{proposta.decisao.motivo}</p><p className="whitespace-pre-wrap">Evidência da decisão: {proposta.decisao.evidenciaTexto}</p></section> : <p role="status">Aguardando decisão independente.</p>}
      {proposta.podeDecidir && <form className="space-y-2" onSubmit={evento => {
        evento.preventDefault();
        const formulario = new FormData(evento.currentTarget);
        iniciar(async () => {
          setMensagem("");
          setErro("");
          try {
            const resultado = await decidirTerminoIndisponibilidadeOferta({
              propostaId: proposta.id,
              aprovada: formulario.get("decisao") === "aprovar",
              motivo: String(formulario.get("motivo")),
              evidenciaTexto: String(formulario.get("evidencia")),
            });
            if (resultado.ok) {
              setMensagem("Decisão registrada.");
              router.refresh();
            } else setErro(resultado.erro);
          } catch {
            setErro(MSG_DECISAO_INCERTA);
          }
        });
      }}>
        <fieldset disabled={ocupado} className="space-y-2">
          <legend>Decisão independente</legend>
          <label className="block" htmlFor={`decisao-${proposta.id}`}>Decisão<select id={`decisao-${proposta.id}`} className={classe} name="decisao" defaultValue="" required><option value="" disabled>Selecione</option><option value="aprovar">Aprovar término</option><option value="rejeitar">Rejeitar proposta</option></select></label>
          <label className="block" htmlFor={`motivo-${proposta.id}`}>Justificativa<CampoTexto id={`motivo-${proposta.id}`} className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
          <label className="block" htmlFor={`evidencia-${proposta.id}`}>Evidência da decisão<CampoTexto id={`evidencia-${proposta.id}`} className={classe} name="evidencia" minLength={5} maxLength={4000} required /></label>
          <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar decisão</button>
        </fieldset>
      </form>}
    </article>)}
    <nav className="flex gap-4">
      {paginaAnterior && <Link className="underline" href={`?pagina=${paginaAnterior}`}>Propostas mais recentes</Link>}
      {d.temProxima && <Link className="underline" href={`?pagina=${d.pagina + 1}`}>Propostas anteriores</Link>}
    </nav>
  </div>;
}
