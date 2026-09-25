"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  consultarRegularizacoesPeriodoIntegral,
  aplicarRegularizacaoPeriodoIntegral,
  decidirRegularizacaoPeriodoIntegral,
  proporRegularizacaoPeriodoIntegral,
} from "@/server/matricula/periodo-integral";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { useInicioDoPeriodo } from "@/lib/periodo-form";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarMoeda } from "@/lib/dinheiro";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { EstadoVazio } from "@/components/EstadoVazio";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarRegularizacoesPeriodoIntegral>>, { ok: true }>["dado"]>;
type Escolha = "" | "CREDITO" | "COBERTURA_FUTURA";
type Memoria = {
  escolha: "CREDITO" | "COBERTURA_FUTURA";
  moeda: string;
  coberturaOriginal: { inicio: string; fim: string };
  valores: {
    valorOriginal: string;
    valorNegociado: string;
    valorRecebido: string;
    valorLiquidadoCredito: string;
    saldoReconciliado: string;
  };
  saldoADesobrigar?: string;
  creditoPorRecebimentos?: string;
  creditoPorLiquidacaoPrevia?: string;
  creditoAConstituir?: string;
  saldoAConservar?: string;
  transferenciaCoberturaPendente?: true;
};

function dataCivil(valor: string | null) {
  if (!valor) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${valor.slice(0, 10)}T00:00:00Z`));
}

function MemoriaCalculo({ memoria }: { memoria: Memoria }) {
  const valores = memoria.valores;
  const opcional = (valor?: string) => valor == null ? "—" : formatarMoeda(valor, memoria.moeda);
  return <section className="space-y-2 rounded bg-gray-50 p-3" aria-label="Memória de cálculo da proposta">
    <h3 className="font-medium">Memória de cálculo</h3>
    <p>Cobertura original: {dataCivil(memoria.coberturaOriginal.inicio)} a {dataCivil(memoria.coberturaOriginal.fim)} · moeda {memoria.moeda}.</p>
    <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
      <div><dt>Valor original</dt><dd>{formatarMoeda(valores.valorOriginal, memoria.moeda)}</dd></div>
      <div><dt>Valor negociado</dt><dd>{formatarMoeda(valores.valorNegociado, memoria.moeda)}</dd></div>
      <div><dt>Valor recebido</dt><dd>{formatarMoeda(valores.valorRecebido, memoria.moeda)}</dd></div>
      <div><dt>Liquidado com crédito</dt><dd>{formatarMoeda(valores.valorLiquidadoCredito, memoria.moeda)}</dd></div>
      <div><dt>Saldo reconciliado</dt><dd>{formatarMoeda(valores.saldoReconciliado, memoria.moeda)}</dd></div>
    </dl>
    {memoria.escolha === "CREDITO" ? <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
      <div><dt>Saldo a desobrigar</dt><dd>{opcional(memoria.saldoADesobrigar)}</dd></div>
      <div><dt>Crédito pelos recebimentos</dt><dd>{opcional(memoria.creditoPorRecebimentos)}</dd></div>
      <div><dt>Crédito por liquidação prévia</dt><dd>{opcional(memoria.creditoPorLiquidacaoPrevia)}</dd></div>
      <div><dt>Crédito a constituir</dt><dd>{opcional(memoria.creditoAConstituir)}</dd></div>
    </dl> : <p>Saldo a conservar: {opcional(memoria.saldoAConservar)}. A transferência de cobertura permanece pendente.</p>}
  </section>;
}

export function PeriodoIntegral({
  matriculaId,
  cobrancaId,
  dados: d,
  preferenciaFusoExibicao = null,
}: {
  matriculaId: string;
  cobrancaId: string;
  dados: Dados;
  preferenciaFusoExibicao?: string | null;
}) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const baseReconferencia = d.podeReconferir ? d.propostas[0] ?? null : null;
  const [escolha, setEscolha] = useState<Escolha>(baseReconferencia?.escolha === "CREDITO" || baseReconferencia?.escolha === "COBERTURA_FUTURA" ? baseReconferencia.escolha : "");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const periodo = useInicioDoPeriodo();
  const chave = useRef<string | null>(null);
  const classe = "block w-full rounded border p-2";
  const instanteAdministrativo = (valor: string) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };

  return <div className="space-y-4">
    <p>Esta tela registra a proposta e a decisão. A aplicação financeira permanece em uma etapa posterior.</p>
    {d.motivoFonteIndisponivel && <p role="alert">{d.motivoFonteIndisponivel}</p>}
    {d.previaCredito && <section className="space-y-2 rounded border p-4"><h2 className="text-lg">Prévia da fonte atual</h2><p>Confira esta memória antes de preparar uma proposta de crédito. Ela não cria crédito nem altera a cobrança.</p><MemoriaCalculo memoria={d.previaCredito} /></section>}
    <MensagemStatus texto={d.podeReconferir ? "A fonte ou a aprovação anterior exige reconferência. Revise a escolha, a cláusula, a evidência e o motivo antes de propor a nova versão." : null} />
    <MensagemStatus texto={mensagem} />
    {erro && <p role="alert">{erro}</p>}

    {d.podePropor && <form className="space-y-3 rounded border p-4" onChange={() => { chave.current = null; }} onSubmit={evento => {
      evento.preventDefault();
      const elemento = evento.currentTarget;
      const formulario = new FormData(elemento);
      if (escolha === "") {
        setErro("Escolha o tratamento registrado pelo aluno.");
        return;
      }
      chave.current ??= crypto.randomUUID();
      iniciar(async () => {
        setMensagem("");
        setErro("");
        try {
          const resultado = await proporRegularizacaoPeriodoIntegral({
            matriculaId,
            cobrancaId,
            escolha,
            coberturaFutura: escolha === "COBERTURA_FUTURA" ? {
              inicio: String(formulario.get("inicio")),
              fim: String(formulario.get("fim")),
            } : undefined,
            clausula: String(formulario.get("clausula")),
            evidenciaEscolha: String(formulario.get("evidenciaEscolha")),
            motivo: String(formulario.get("motivo")),
            chaveIdempotencia: chave.current!,
          });
          if (resultado.ok) {
            setMensagem("Escolha registrada para decisão independente.");
            elemento.reset();
            setEscolha("");
            chave.current = null;
            router.refresh();
          } else setErro(resultado.erro);
        } catch {
          setErro(MSG_RESULTADO_INCERTO);
        }
      });
    }}>
      <fieldset disabled={ocupado} className="space-y-3">
        <legend>{d.podeReconferir ? "Reconferir escolha do aluno" : "Escolha do aluno"}</legend>
        <label className="block" htmlFor="escolha">Tratamento escolhido<select id="escolha" className={classe} name="escolha" value={escolha} onChange={evento => setEscolha(evento.target.value as Escolha)} required><option value="" disabled>Selecione</option><option value="CREDITO">Crédito a constituir em etapa posterior</option><option value="COBERTURA_FUTURA">Cobertura futura a definir</option></select></label>
        {escolha === "COBERTURA_FUTURA" && <fieldset className="space-y-2 rounded border p-3"><legend>Período de cobertura futura</legend><label className="block" htmlFor="inicio">Início civil<input id="inicio" className={classe} name="inicio" type="date" defaultValue={baseReconferencia?.coberturaFutura?.inicio ?? ""} {...periodo.propsInicio} required /></label><label className="block" htmlFor="fim">Fim civil<input id="fim" className={classe} name="fim" type="date" defaultValue={baseReconferencia?.coberturaFutura?.fim ?? ""} min={periodo.min} required /></label></fieldset>}
        <label className="block" htmlFor="clausula">Cláusula contratual aplicável<textarea id="clausula" className={classe} name="clausula" defaultValue={baseReconferencia?.clausula ?? ""} minLength={5} maxLength={2000} required /></label>
        <label className="block" htmlFor="evidenciaEscolha">Evidência da escolha do aluno<textarea id="evidenciaEscolha" className={classe} name="evidenciaEscolha" defaultValue={baseReconferencia?.evidenciaEscolha ?? ""} minLength={5} maxLength={2000} required /></label>
        <label className="block" htmlFor="motivo">Motivo<textarea id="motivo" className={classe} name="motivo" defaultValue={baseReconferencia?.motivo ?? ""} minLength={5} maxLength={2000} required /></label>
        <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Enviando…" : "Propor regularização"}</button>
      </fieldset>
    </form>}

    <section className="space-y-3">
      <h2 className="text-lg">Histórico de propostas</h2>
      {!d.propostas.length && <EstadoVazio>Nenhuma proposta registrada para esta mensalidade.</EstadoVazio>}
      {d.propostas.map(proposta => <article key={proposta.id} className="space-y-2 rounded border p-4">
        <h3 className="font-medium">Versão {proposta.versao}</h3>
        <MensagemStatus texto={proposta.superada ? "Substituída por nova proposta." : null} />
        <p>Escolha registrada: {proposta.escolha === "CREDITO" ? "crédito a constituir" : "cobertura futura"}.</p>
        {proposta.coberturaFutura && <p>Cobertura futura proposta: {dataCivil(proposta.coberturaFutura.inicio)} a {dataCivil(proposta.coberturaFutura.fim)}.</p>}
        <p className="whitespace-pre-wrap">Cláusula contratual: {proposta.clausula}</p>
        <p className="whitespace-pre-wrap">Evidência da escolha: {proposta.evidenciaEscolha}</p>
        <p className="whitespace-pre-wrap">Motivo: {proposta.motivo}</p>
        {proposta.memoria ? <MemoriaCalculo memoria={proposta.memoria} /> : <p role="alert">A memória de cálculo desta proposta não está disponível; ela não pode ser aprovada nesta tela.</p>}
        {proposta.decisao ? <><p>{proposta.decisao.aprovada ? "Proposta aprovada." : "Proposta rejeitada."}</p><p className="whitespace-pre-wrap">Justificativa da decisão: {proposta.decisao.motivo}</p>
          {proposta.decisao.aplicacao ? <section className="space-y-1 rounded bg-gray-50 p-3"><p>Aplicada em {instanteAdministrativo(proposta.decisao.aplicacao.aplicadaEm)}.</p>{proposta.escolha === "CREDITO" ? <><p>Crédito efetivamente constituído: {proposta.decisao.aplicacao.credito ? formatarMoeda(proposta.decisao.aplicacao.credito.valor, proposta.decisao.aplicacao.credito.moeda) : "nenhum valor adicional"}.</p><p>Saldo retirado da cobrança conforme a memória: {proposta.memoria?.escolha === "CREDITO" ? formatarMoeda(proposta.memoria.saldoADesobrigar, proposta.memoria.moeda) : "valor histórico indisponível"}.</p></> : <><p>{proposta.superada ? "Cobertura reprogramada nesta aplicação" : "Cobertura efetivamente reprogramada"}: {proposta.coberturaFutura ? `${dataCivil(proposta.coberturaFutura.inicio)} a ${dataCivil(proposta.coberturaFutura.fim)}` : "período histórico indisponível"}.</p><p>Os valores e o vencimento da mesma cobrança foram preservados.</p></>}</section> : proposta.decisao.aprovada && <p role="status">Aprovada; aplicação pendente.</p>}
        </> : <p role="status">Aguardando decisão independente.</p>}
        {proposta.podeDecidir && proposta.memoria && <form className="space-y-2" onSubmit={evento => {
          evento.preventDefault();
          const formulario = new FormData(evento.currentTarget);
          iniciar(async () => {
            setMensagem("");
            setErro("");
            try {
              const resultado = await decidirRegularizacaoPeriodoIntegral({
                propostaId: proposta.id,
                aprovada: formulario.get("decisao") === "aprovar",
                motivo: String(formulario.get("motivo")),
              });
              if (resultado.ok) {
                setMensagem("Decisão registrada. A aplicação financeira continua pendente.");
                router.refresh();
              } else setErro(resultado.erro);
            } catch {
              setErro(MSG_DECISAO_INCERTA);
            }
          });
        }}>
          <fieldset disabled={ocupado} className="space-y-2">
            <legend>Decisão independente</legend>
            <label className="block" htmlFor={`decisao-${proposta.id}`}>Decisão<select id={`decisao-${proposta.id}`} className={classe} name="decisao" defaultValue="" required><option value="" disabled>Selecione</option><option value="aprovar">Aprovar proposta</option><option value="rejeitar">Rejeitar proposta</option></select></label>
            <label className="block" htmlFor={`motivo-${proposta.id}`}>Justificativa<textarea id={`motivo-${proposta.id}`} className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
            <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar decisão</button>
          </fieldset>
        </form>}
        {proposta.podeAplicar && proposta.decisao && <button type="button" disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => {
          iniciar(async () => {
            setMensagem("");
            setErro("");
            try {
              const resultado = await aplicarRegularizacaoPeriodoIntegral({ decisaoId: proposta.decisao!.id });
              if (resultado.ok) {
                setMensagem("Aplicação registrada. Confira o efeito materializado abaixo.");
                router.refresh();
              } else setErro(resultado.erro);
            } catch {
              setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE);
            }
          });
        }}>{ocupado ? "Aplicando…" : "Aplicar regularização aprovada"}</button>}
      </article>)}
    </section>
  </div>;
}
