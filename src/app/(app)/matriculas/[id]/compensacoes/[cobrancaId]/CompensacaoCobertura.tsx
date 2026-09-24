"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirCompensacaoCobertura, prepararCompensacaoCobertura } from "@/server/matricula/compensacao-cobertura";
import { consultarCompensacoesCobertura } from "@/server/matricula/compensacao-cobertura-consulta";
import { MensagemStatus } from "@/components/MensagemStatus";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarCompensacoesCobertura>>, { ok: true }>["dado"]>;

function dataCivil(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${valor}T00:00:00Z`));
}

export function CompensacaoCobertura({ matriculaId, dados: d }: { matriculaId: string; dados: Dados }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [dias, setDias] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const chave = useRef<string | null>(null);
  const classe = "block w-full rounded border p-2";
  const diasComDireito = new Set(d.diasComDireito);
  const diasSelecionaveis = d.apuracao.diasConfirmados.filter((dia) => !diasComDireito.has(dia));
  const parcial = d.apuracao.classificacao === "PARCIAL";

  function alternarDia(dia: string, marcado: boolean) {
    chave.current = null;
    setDias((atuais) => marcado ? [...atuais, dia].sort() : atuais.filter((atual) => atual !== dia));
  }

  return <div className="space-y-4">
    <section className="space-y-2 rounded border p-4">
      <h2 className="text-lg">Apuração da cobertura</h2>
      <p>Mensalidade: {dataCivil(d.cobranca.coberturaInicio)} a {dataCivil(d.cobranca.coberturaFim)}.</p>
      <p>{d.apuracao.diasConfirmados.length} de {d.apuracao.totalDias} dias com indisponibilidade confirmada.</p>
      {d.apuracao.classificacao === "NENHUMA" && <p role="status">Não há dias confirmados nesta cobertura para propor compensação.</p>}
      {d.apuracao.classificacao === "INTEGRAL" && <p role="status">A indisponibilidade cobre todo o período. O caso exige o fluxo específico de crédito ou cobertura futura escolhido pela escola e pelo aluno; esta tela não oferece compensação parcial.</p>}
      {d.apuracao.classificacao === "INTEGRAL" && <Link className="underline" href={`/matriculas/${matriculaId}/compensacoes/${d.cobranca.id}/periodo-integral`}>Registrar escolha para o período integral</Link>}
      {d.diasComDireito.length > 0 && <p role="status">Dias com direito de compensação já reconhecido: {d.diasComDireito.map(dataCivil).join(", ")}. Eles não podem ser selecionados novamente.</p>}
    </section>

    {parcial && <form className="space-y-3 rounded border p-4" onChange={() => { chave.current = null; }} onSubmit={evento => {
      evento.preventDefault();
      if (!dias.length) {
        setErro("Selecione ao menos um dia confirmado que ainda não possua direito de compensação.");
        return;
      }
      const elemento = evento.currentTarget;
      const formulario = new FormData(elemento);
      chave.current ??= crypto.randomUUID();
      iniciar(async () => {
        setMensagem("");
        setErro("");
        try {
          const resultado = await prepararCompensacaoCobertura({
            matriculaId,
            cobrancaId: d.cobranca.id,
            versaoCobranca: d.cobranca.versao,
            dias,
            motivo: String(formulario.get("motivo")),
            evidenciaCondicoes: String(formulario.get("evidencia")),
            chaveIdempotencia: chave.current!,
          });
          if (resultado.ok) {
            setMensagem("Direito de compensação proposto para decisão independente.");
            elemento.reset();
            setDias([]);
            chave.current = null;
            router.refresh();
          } else setErro(resultado.erro);
        } catch {
          setErro("Atualize a consulta para conferir o resultado antes de repetir a proposta.");
        }
      });
    }}>
      <fieldset disabled={ocupado} className="space-y-3">
        <legend>Propor dias de compensação</legend>
        {!diasSelecionaveis.length ? <p role="status">Todos os dias confirmados já possuem direito reconhecido.</p> : <div className="space-y-2"><p>Selecione os dias confirmados ainda sem direito de compensação.</p>{diasSelecionaveis.map((dia) => <label key={dia} className="flex gap-2"><input type="checkbox" checked={dias.includes(dia)} onChange={(evento) => alternarDia(dia, evento.target.checked)} />{dataCivil(dia)}</label>)}</div>}
        <label className="block" htmlFor="motivo">Motivo<textarea id="motivo" className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
        <label className="block" htmlFor="evidencia">Evidência das condições de compensação<textarea id="evidencia" className={classe} name="evidencia" minLength={5} maxLength={2000} required /></label>
        <button className="rounded border p-2">{ocupado ? "Enviando…" : "Propor direito de compensação"}</button>
      </fieldset>
    </form>}

    <MensagemStatus texto={mensagem} />
    {erro && <p role="alert">{erro}</p>}
    <section className="space-y-3">
      <h2 className="text-lg">Últimas propostas</h2>
      {!d.propostas.length && <p>Nenhuma proposta de compensação para esta mensalidade.</p>}
      {d.propostas.map((proposta) => <article key={proposta.id} className="space-y-2 rounded border p-4">
        <p>{proposta.status === "PENDENTE" ? "Aguardando decisão" : proposta.status === "APROVADA" ? "Direito aprovado" : "Proposta rejeitada"}.</p>
        <p>Dias propostos: {proposta.dias.map(dataCivil).join(", ")}.</p>
        <p className="whitespace-pre-wrap">Motivo: {proposta.motivo}</p>
        <p className="whitespace-pre-wrap">Evidência: {proposta.evidenciaCondicoes}</p>
        {proposta.motivoDecisao && <p className="whitespace-pre-wrap">Justificativa da decisão: {proposta.motivoDecisao}</p>}
        {proposta.podeDecidir && <form className="space-y-2" onSubmit={evento => {
          evento.preventDefault();
          const formulario = new FormData(evento.currentTarget);
          iniciar(async () => {
            setMensagem("");
            setErro("");
            try {
              const resultado = await decidirCompensacaoCobertura({
                id: proposta.id,
                aprovar: formulario.get("decisao") === "aprovar",
                motivo: String(formulario.get("motivo")),
              });
              if (resultado.ok) {
                setMensagem("Decisão registrada. Recomposição, extensão de cobertura e acerto financeiro continuam em fluxos próprios.");
                router.refresh();
              } else setErro(resultado.erro);
            } catch {
              setErro("Atualize a consulta para conferir a decisão antes de repetir.");
            }
          });
        }}>
          <fieldset disabled={ocupado} className="space-y-2">
            <legend>Decisão independente</legend>
            <label className="block" htmlFor={`decisao-${proposta.id}`}>Decisão<select id={`decisao-${proposta.id}`} className={classe} name="decisao" defaultValue="" required><option value="" disabled>Selecione</option><option value="aprovar">Aprovar direito</option><option value="rejeitar">Rejeitar proposta</option></select></label>
            <label className="block" htmlFor={`motivo-${proposta.id}`}>Justificativa<textarea id={`motivo-${proposta.id}`} className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
            <button className="rounded border p-2">Registrar decisão</button>
          </fieldset>
        </form>}
      </article>)}
    </section>
  </div>;
}
