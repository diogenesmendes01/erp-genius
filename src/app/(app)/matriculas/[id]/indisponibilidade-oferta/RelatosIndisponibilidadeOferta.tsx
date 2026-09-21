"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarRelatoIndisponibilidadeOferta } from "@/server/matricula/indisponibilidade-oferta-confirmacao";
import { consultarRelatosIndisponibilidadeOferta, registrarRelatoIndisponibilidadeOferta } from "@/server/matricula/indisponibilidade-oferta-relato";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarRelatosIndisponibilidadeOferta>>, { ok: true }>['dado']>;
const dataCivil = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${valor.slice(0, 10)}T00:00:00Z`));

function instanteDoEvento(valor: string, fusoExibicao: string | null, fusoInstitucional: string | null) {
  const instante = new Date(valor);
  if (!fusoInstitucional && !fusoExibicao) return `${instante.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")} (fuso institucional não configurado)`;
  const exibicao = formatarInstanteExibicao(instante, fusoExibicao, fusoInstitucional ?? "UTC");
  return `${exibicao.texto} (${exibicao.fuso})`;
}

export function RelatosIndisponibilidadeOferta({ matriculaId, dados: d, fusoInstitucional, fusoExibicao = null }: { matriculaId: string; dados: Dados; fusoInstitucional: string | null; fusoExibicao?: string | null }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const chave = useRef<string | null>(null);
  const classe = "block w-full rounded border p-2";
  const paginaAnterior = d.pagina > 1 ? d.pagina - 1 : null;

  return <div className="space-y-4">
    {mensagem && <p role="status">{mensagem}</p>}
    {erro && <p role="alert">{erro}</p>}
    {d.podeRegistrar && <form className="space-y-3 rounded border p-4" onSubmit={evento => {
      evento.preventDefault();
      const elemento = evento.currentTarget;
      const formulario = new FormData(elemento);
      chave.current ??= crypto.randomUUID();
      iniciar(async () => {
        setMensagem("");
        setErro("");
        try {
          const resultado = await registrarRelatoIndisponibilidadeOferta({
            matriculaId,
            inicio: String(formulario.get("inicio")),
            fim: String(formulario.get("fim") || "") || null,
            motivo: String(formulario.get("motivo")),
            evidenciaTexto: String(formulario.get("evidencia")),
            chaveIdempotencia: chave.current!,
          });
          if (resultado.ok) {
            setMensagem("Relato registrado e aguardando confirmação independente.");
            elemento.reset(); chave.current = null; router.refresh();
          } else setErro(resultado.erro);
        } catch {
          setErro("Atualize o histórico para conferir o resultado antes de repetir o relato.");
        }
      });
    }}>
      <fieldset disabled={ocupado} className="space-y-3">
        <legend>Novo relato</legend>
        <label className="block" htmlFor="inicio">Início civil<input id="inicio" className={classe} name="inicio" type="date" required /></label>
        <label className="block" htmlFor="fim">Fim civil, se já conhecido<input id="fim" className={classe} name="fim" type="date" /></label>
        <label className="block" htmlFor="motivo">Motivo<textarea id="motivo" className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
        <label className="block" htmlFor="evidencia">Evidência do relato<textarea id="evidencia" className={classe} name="evidencia" minLength={5} maxLength={4000} required /></label>
        <button className="rounded border p-2">{ocupado ? "Registrando…" : "Registrar relato"}</button>
      </fieldset>
    </form>}
    <h2 className="text-lg">Histórico de relatos</h2>
    {!d.relatos.length && <p>Nenhum relato registrado nesta página.</p>}
    {d.relatos.map(relato => <article key={relato.id} className="space-y-2 rounded border p-4">
      <h3>{dataCivil(relato.inicio)}{relato.fim ? ` a ${dataCivil(relato.fim)}` : relato.terminoAprovado ? ` a ${dataCivil(relato.terminoAprovado.fim)}` : " em aberto"}</h3>
      {relato.terminoAprovado && <p role="status">Último dia de indisponibilidade aprovado: {dataCivil(relato.terminoAprovado.fim)}.</p>}
      <p className="whitespace-pre-wrap">{relato.motivo}</p>
      <p className="whitespace-pre-wrap">Evidência: {relato.evidenciaTexto}</p>
      <p>Relatado em {instanteDoEvento(relato.criadaEm, fusoExibicao, fusoInstitucional)}.</p>
      {relato.confirmacao ? <section className="rounded bg-gray-50 p-3"><p>{relato.confirmacao.confirmada ? "Indisponibilidade confirmada" : "Indisponibilidade recusada"} em {instanteDoEvento(relato.confirmacao.confirmadaEm, fusoExibicao, fusoInstitucional)}.</p><p className="whitespace-pre-wrap">{relato.confirmacao.motivo}</p><p className="whitespace-pre-wrap">Evidência da decisão: {relato.confirmacao.evidenciaTexto}</p></section> : <p role="status">Aguardando confirmação independente.</p>}
      {relato.confirmacao?.confirmada && relato.fim === null && <Link className="underline" href={`/matriculas/${matriculaId}/indisponibilidade-oferta/${relato.id}/termino`}>{relato.terminoAprovado ? "Ver histórico do término" : "Registrar o último dia de indisponibilidade"}</Link>}
      {relato.podeConfirmar && <form className="space-y-2" onSubmit={evento => {
        evento.preventDefault();
        const formulario = new FormData(evento.currentTarget);
        iniciar(async () => {
          setMensagem("");
          setErro("");
          try {
            const resultado = await confirmarRelatoIndisponibilidadeOferta({
              registroId: relato.id,
              confirmada: formulario.get("decisao") === "confirmar",
              motivo: String(formulario.get("motivo")),
              evidenciaTexto: String(formulario.get("evidencia")),
            });
            if (resultado.ok) { setMensagem("Decisão registrada."); router.refresh(); }
            else setErro(resultado.erro);
          } catch {
            setErro("Atualize o histórico para conferir a decisão antes de repetir.");
          }
        });
      }}>
        <fieldset disabled={ocupado} className="space-y-2"><legend>Confirmação independente</legend>
          <label className="block" htmlFor={`decisao-${relato.id}`}>Decisão<select id={`decisao-${relato.id}`} className={classe} name="decisao" defaultValue="" required><option value="" disabled>Selecione</option><option value="confirmar">Confirmar indisponibilidade</option><option value="recusar">Recusar relato</option></select></label>
          <label className="block" htmlFor={`motivo-${relato.id}`}>Justificativa<textarea id={`motivo-${relato.id}`} className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
          <label className="block" htmlFor={`evidencia-${relato.id}`}>Evidência da decisão<textarea id={`evidencia-${relato.id}`} className={classe} name="evidencia" minLength={5} maxLength={4000} required /></label>
          <button className="rounded border p-2">Registrar decisão</button>
        </fieldset>
      </form>}
    </article>)}
    <nav className="flex gap-4">
      {paginaAnterior && <Link className="underline" href={`?pagina=${paginaAnterior}`}>Relatos mais recentes</Link>}
      {d.temProxima && <Link className="underline" href={`?pagina=${d.pagina + 1}`}>Relatos anteriores</Link>}
    </nav>
  </div>;
}
