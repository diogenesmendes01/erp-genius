"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consultarCondicoesContinuidadeMensal, decidirCondicoesContinuidadeMensal, prepararCondicoesContinuidadeMensal } from "@/server/matricula/condicoes-continuidade-mensal";
import { useInicioDoPeriodo } from "@/lib/periodo-form";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarCondicoesContinuidadeMensal>>, { ok: true }>['dado']>;
type Referencia = "" | "MES_CIVIL" | "CICLO_MATRICULA";
type ReferenciaVencimento = "" | "MES_COBERTURA" | "MES_ANTERIOR" | "MES_SEGUINTE";
type AjusteVencimento = "" | "MANTER_DATA" | "PROXIMO_DIA_UTIL";

const rotuloReferenciaVencimento: Record<Exclude<ReferenciaVencimento, "">, string> = {
  MES_COBERTURA: "No mês da cobertura",
  MES_ANTERIOR: "No mês anterior à cobertura",
  MES_SEGUINTE: "No mês seguinte à cobertura",
};
const diasDaSemana: Array<[number, string]> = [[0, "Domingo"], [1, "Segunda-feira"], [2, "Terça-feira"], [3, "Quarta-feira"], [4, "Quinta-feira"], [5, "Sexta-feira"], [6, "Sábado"]];
const rotuloDiaSemana = new Map(diasDaSemana);

const data = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${valor.slice(0, 10)}T00:00:00Z`));

export function CondicoesContinuidadeMensal({ dados: d }: { dados: Dados }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");
  const periodo = useInicioDoPeriodo();
  const [referencia, setReferencia] = useState<Referencia>("");
  const [referenciaVencimento, setReferenciaVencimento] = useState<ReferenciaVencimento>("");
  const [ajusteVencimento, setAjusteVencimento] = useState<AjusteVencimento>("");
  const [diasSemanaUteis, setDiasSemanaUteis] = useState<number[]>([]);
  const [feriados, setFeriados] = useState<string[]>([]);
  const classe = "block w-full rounded border p-2";

  return <div className="space-y-4">
    <p>Matrícula {d.codigo ?? d.matriculaId} · moeda contratual {d.moeda}</p>
    {d.impedimento && <p role="status">{d.impedimento}</p>}
    {mensagem && <p role="status">{mensagem}</p>}
    {d.podePreparar && d.documentoId && <form className="space-y-3 rounded border p-4" onSubmit={evento => {
      evento.preventDefault();
      const formulario = new FormData(evento.currentTarget);
      const documentoId = d.documentoId;
      if (!documentoId) return;
      iniciar(async () => {
        setMensagem("");
        try {
          if (!referencia || !referenciaVencimento || !ajusteVencimento) {
            setMensagem("Selecione as referências de cobertura, vencimento e o ajuste de vencimento previstos no contrato.");
            return;
          }
          if (ajusteVencimento === "PROXIMO_DIA_UTIL" && (!diasSemanaUteis.length || feriados.some(feriado => !feriado))) {
            setMensagem("Informe os dias úteis e todos os feriados do calendário financeiro.");
            return;
          }
          const regraCobertura = referencia === "MES_CIVIL"
            ? { referencia: "MES_CIVIL" as const }
            : { referencia: "CICLO_MATRICULA" as const, dataReferencia: String(formulario.get("ancora")) };
          const resultado = await prepararCondicoesContinuidadeMensal({
            matriculaId: d.matriculaId,
            documentoId,
            motivo: String(formulario.get("motivo")),
            regras: {
              continuidadeContratada: { contratada: true, clausula: String(formulario.get("clausula")), evidenciaId: documentoId },
              regraCobertura,
              diaVencimento: Number(formulario.get("diaVencimento")),
              antecedenciaDias: Number(formulario.get("antecedenciaDias")),
              referenciaVencimento,
              valorOriginal: String(formulario.get("valorOriginal")),
              valorNegociado: String(formulario.get("valorNegociado")),
              moeda: d.moeda,
              vigenteDesde: String(formulario.get("vigenteDesde")),
              ajusteVencimento: ajusteVencimento === "MANTER_DATA"
                ? { regra: "MANTER_DATA" as const }
                : {
                    regra: "PROXIMO_DIA_UTIL" as const,
                    calendario: {
                      id: String(formulario.get("calendarioId")),
                      versao: Number(formulario.get("calendarioVersao")),
                      referencia: String(formulario.get("calendarioReferencia")),
                      inicioVigencia: String(formulario.get("calendarioInicioVigencia")),
                      fimVigencia: String(formulario.get("calendarioFimVigencia")),
                      diasSemanaUteis,
                      feriados,
                    },
                  },
            },
          });
          setMensagem(resultado.ok ? "Versão preparada para revisão independente." : resultado.erro);
          if (resultado.ok) router.refresh();
        } catch (erro) {
          setMensagem(erro instanceof Error ? erro.message : "Atualize o histórico para conferir o resultado antes de repetir.");
        }
      });
    }}>
      <fieldset disabled={ocupado} className="space-y-3">
        <legend>Nova transcrição do contrato confirmado</legend>
        <p>Documento de evidência: contrato confirmado desta matrícula. A evidência é vinculada automaticamente e não pode ser alterada aqui.</p>
        <label className="block" htmlFor="clausula">Cláusula de continuidade contratada<textarea id="clausula" className={classe} name="clausula" maxLength={4000} required /></label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block" htmlFor="valor-original">Preço original ({d.moeda})<input id="valor-original" className={classe} name="valorOriginal" inputMode="decimal" pattern="(?:0|[1-9][0-9]{0,9})(?:[.][0-9]{1,2})?" required /></label>
          <label className="block" htmlFor="valor-negociado">Preço negociado ({d.moeda})<input id="valor-negociado" className={classe} name="valorNegociado" inputMode="decimal" pattern="(?:0|[1-9][0-9]{0,9})(?:[.][0-9]{1,2})?" required /></label>
        </div>
        <p>Use ponto para os centavos, por exemplo 1000.00. A moeda é a da matrícula e não pode ser alterada.</p>
        <label className="block" htmlFor="vigente-desde">Vigência civil desde<input id="vigente-desde" className={classe} name="vigenteDesde" type="date" required /></label>
        <fieldset className="space-y-2 rounded border p-3">
          <legend>Referência da cobertura mensal</legend>
          <label className="block" htmlFor="referencia-cobertura">Tipo de cobertura<select id="referencia-cobertura" className={classe} value={referencia} onChange={evento => setReferencia(evento.target.value as Referencia)} required><option value="" disabled>Selecione</option><option value="MES_CIVIL">Mês civil</option><option value="CICLO_MATRICULA">Ciclo da matrícula</option></select></label>
          {referencia === "MES_CIVIL" && <p>A cobertura começa no primeiro dia de cada mês civil.</p>}
          {referencia === "CICLO_MATRICULA" && <label className="block" htmlFor="ancora-cobertura">Data âncora do ciclo<input id="ancora-cobertura" className={classe} name="ancora" type="date" required /></label>}
        </fieldset>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block" htmlFor="dia-vencimento">Dia do vencimento<input id="dia-vencimento" className={classe} name="diaVencimento" type="number" min="1" max="31" step="1" required /></label>
          <label className="block" htmlFor="antecedencia-dias">Antecedência para emissão, em dias<input id="antecedencia-dias" className={classe} name="antecedenciaDias" type="number" min="0" step="1" required /></label>
        </div>
        <fieldset className="space-y-2 rounded border p-3">
          <legend>Ajuste de vencimento</legend>
          <p>Escolha a regra registrada no contrato. Nenhuma regra é presumida.</p>
          <label className="block" htmlFor="ajuste-vencimento">Regra de ajuste<select id="ajuste-vencimento" className={classe} value={ajusteVencimento} onChange={evento => setAjusteVencimento(evento.target.value as AjusteVencimento)} required><option value="" disabled>Selecione</option><option value="MANTER_DATA">Manter a data calculada</option><option value="PROXIMO_DIA_UTIL">Prorrogar para o próximo dia útil</option></select></label>
          {ajusteVencimento === "PROXIMO_DIA_UTIL" && <div className="space-y-3 rounded border p-3">
            <p>Transcreva o calendário financeiro aplicável. País, fins de semana e feriados não são presumidos.</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block" htmlFor="calendario-id">Identificador do calendário<input id="calendario-id" className={classe} name="calendarioId" required /></label>
              <label className="block" htmlFor="calendario-versao">Versão do calendário<input id="calendario-versao" className={classe} name="calendarioVersao" type="number" min="1" step="1" required /></label>
              <label className="block" htmlFor="calendario-referencia">Referência do calendário<input id="calendario-referencia" className={classe} name="calendarioReferencia" required /></label>
              <label className="block" htmlFor="calendario-inicio">Início da vigência<input id="calendario-inicio" className={classe} name="calendarioInicioVigencia" type="date" required {...periodo.propsInicio} /></label>
              <label className="block" htmlFor="calendario-fim">Fim da vigência<input id="calendario-fim" className={classe} name="calendarioFimVigencia" type="date" required min={periodo.min} /></label>
            </div>
            <fieldset className="space-y-1"><legend>Dias da semana considerados úteis</legend>{diasDaSemana.map(([dia, nome]) => <label key={dia} className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={diasSemanaUteis.includes(dia)} onChange={evento => setDiasSemanaUteis(atual => evento.target.checked ? [...atual, dia] : atual.filter(valor => valor !== dia))} />{nome}</label>)}</fieldset>
            <fieldset className="space-y-2"><legend>Feriados do calendário</legend>{feriados.map((feriado, indice) => <div key={indice} className="flex gap-2"><input className={classe} type="date" value={feriado} aria-label={`Feriado ${indice + 1}`} onChange={evento => setFeriados(atual => atual.map((valor, posicao) => posicao === indice ? evento.target.value : valor))} required /><button type="button" className="rounded border px-2" onClick={() => setFeriados(atual => atual.filter((_, posicao) => posicao !== indice))}>Remover</button></div>)}<button type="button" className="rounded border p-2" onClick={() => setFeriados(atual => [...atual, ""])}>Adicionar feriado</button></fieldset>
          </div>}
        </fieldset>
        <fieldset className="space-y-2 rounded border p-3">
          <legend>Referência do vencimento</legend>
          <label className="block" htmlFor="referencia-vencimento">Quando o vencimento se relaciona à cobertura<select id="referencia-vencimento" className={classe} value={referenciaVencimento} onChange={evento => setReferenciaVencimento(evento.target.value as ReferenciaVencimento)} required><option value="" disabled>Selecione</option><option value="MES_COBERTURA">No mês da cobertura</option><option value="MES_ANTERIOR">No mês anterior à cobertura</option><option value="MES_SEGUINTE">No mês seguinte à cobertura</option></select></label>
          <p>Informe a regra contratada. Esta escolha não é presumida para versões novas nem para o histórico.</p>
        </fieldset>
        <label className="block" htmlFor="motivo">Motivo da transcrição<textarea id="motivo" className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
        <button className="rounded border p-2">{ocupado ? "Registrando…" : "Preparar para revisão"}</button>
      </fieldset>
    </form>}
    <h2 className="text-lg">Histórico das condições</h2>
    {!d.versoes.length && <p>Nenhuma versão registrada.</p>}
    {d.versoes.map(versao => <article key={versao.id} className="space-y-2 rounded border p-4">
      <h3>Versão {versao.versao} · {versao.status === "APROVADA" ? "Aprovada" : versao.status === "REJEITADA" ? "Rejeitada" : "Aguardando revisão"}</h3>
      <p>{versao.preparador.nome} · {data(versao.criadaEm)} · contrato vinculado</p>
      {versao.regras ? <>
        <p>Vigente desde {data(versao.regras.vigenteDesde)} · {versao.regras.valorOriginal} {versao.regras.moeda} original · {versao.regras.valorNegociado} {versao.regras.moeda} negociado</p>
        <p>{versao.regras.regraCobertura.referencia === "MES_CIVIL" ? "Cobertura por mês civil" : `Cobertura por ciclo desde ${versao.regras.regraCobertura.dataReferencia}`} · vencimento no dia {versao.regras.diaVencimento} · antecedência de {versao.regras.antecedenciaDias} dias</p>
        <p>Referência do vencimento: {rotuloReferenciaVencimento[versao.regras.referenciaVencimento]}</p>
        {typeof versao.regras.ajusteVencimento === "string"
          ? <p>Ajuste de vencimento: {versao.regras.ajusteVencimento === "MANTER_DATA" ? "manter a data calculada" : versao.regras.ajusteVencimento}</p>
          : <><p>Ajuste de vencimento: {versao.regras.ajusteVencimento.regra === "MANTER_DATA" ? "manter a data calculada" : "prorrogar para o próximo dia útil"}</p>{versao.regras.ajusteVencimento.regra === "PROXIMO_DIA_UTIL" && <section className="space-y-1 rounded border p-3" aria-label="Calendário financeiro aplicado"><p>Calendário aplicado: {versao.regras.ajusteVencimento.calendario.referencia} · ID {versao.regras.ajusteVencimento.calendario.id} · versão {versao.regras.ajusteVencimento.calendario.versao}</p><p>Vigência: {data(versao.regras.ajusteVencimento.calendario.inicioVigencia)} a {data(versao.regras.ajusteVencimento.calendario.fimVigencia)}</p><p>Dias da semana úteis: {versao.regras.ajusteVencimento.calendario.diasSemanaUteis.map(dia => rotuloDiaSemana.get(dia) ?? `Dia ${dia}`).join(", ")}</p><p>Feriados: {versao.regras.ajusteVencimento.calendario.feriados.length ? versao.regras.ajusteVencimento.calendario.feriados.map(feriado => data(feriado)).join(", ") : "Nenhum feriado informado."}</p></section>}</>}
        <p className="whitespace-pre-wrap">Cláusula: {versao.regras.continuidadeContratada.clausula}</p>
      </> : <p role="alert">{versao.naoConferida ? "Esta versão não informa a referência do vencimento. Ela precisa de conferência; prepare uma nova versão completa para substituí-la, sem alterar este histórico." : "As regras desta versão precisam de conferência."}</p>}
      <p>{versao.motivo}</p>
      {versao.decisor && <p>Decisão de {versao.decisor.nome}: {versao.motivoDecisao}{versao.decididaEm && ` · ${data(versao.decididaEm)}`}</p>}
      {versao.podeDecidir && <form className="space-y-2" onSubmit={evento => {
        evento.preventDefault();
        const formulario = new FormData(evento.currentTarget);
        iniciar(async () => {
          try {
            const resultado = await decidirCondicoesContinuidadeMensal({ id: versao.id, aprovar: formulario.get("decisao") === "aprovar", motivo: String(formulario.get("motivo")) });
            setMensagem(resultado.ok ? "Decisão registrada." : resultado.erro);
            if (resultado.ok) router.refresh();
          } catch {
            setMensagem("Atualize o histórico para conferir a decisão antes de repetir.");
          }
        });
      }}>
        <fieldset disabled={ocupado} className="space-y-2">
          <legend>Revisão administrativa independente</legend>
          <label className="block" htmlFor={`decisao-${versao.id}`}>Decisão<select id={`decisao-${versao.id}`} className={classe} name="decisao" defaultValue="" required><option value="" disabled>Selecione</option><option value="aprovar">Aprovar transcrição</option><option value="rejeitar">Rejeitar transcrição</option></select></label>
          <label className="block" htmlFor={`motivo-${versao.id}`}>Justificativa<textarea id={`motivo-${versao.id}`} className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
          <button className="rounded border p-2">Registrar decisão</button>
        </fieldset>
      </form>}
    </article>)}
  </div>;
}
