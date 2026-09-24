"use client";
import { ImpactosAcademicosAcerto } from "./ImpactosAcademicosAcerto";
import { LancamentosEncerramento } from "./LancamentosEncerramento";
import { EfetivarAcerto } from "./EfetivarAcerto";
import { DecisaoAcerto } from "./DecisaoAcerto";
import { OutrasCobrancasResumo } from "./OutrasCobrancasResumo";
import { useRef, useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { CompensacoesEncerramento, CompensacoesEncerramentoSchema } from "./CompensacoesEncerramento";
import { useOperacao } from "./useOperacao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { formatarMoeda } from "@/lib/dinheiro";
import { consultarContextoEncerramento } from "@/server/matricula/encerramento-contexto";
import { preverComponenteMensalEncerramento } from "@/server/matricula/encerramento-previa";
import { consultarRascunhoAcertoEncerramento, salvarRascunhoAcertoEncerramento } from "@/server/matricula/encerramento-rascunho";
import { conferirValidadeRascunhoEncerramento } from "@/server/matricula/encerramento-validade";
import { PreviaMensalPedidoEncerramentoSchema, type PreviaMensalPedidoEncerramentoInput } from "@/server/matricula/encerramento-previa-schema";
import { identificacaoContrato } from "./identificacaoContrato";
import { MensagemStatus } from "@/components/MensagemStatus";

type Contexto = NonNullable<Extract<Awaited<ReturnType<typeof consultarContextoEncerramento>>, { ok: true }>["dado"]>;
type Rascunho = NonNullable<Extract<Awaited<ReturnType<typeof consultarRascunhoAcertoEncerramento>>, { ok: true }>["dado"]>;
export function EfetivacaoAcertoHistorico({ executor, aplicadaEm, preferenciaFusoExibicao }: { executor: string; aplicadaEm: string; preferenciaFusoExibicao?: string | null }) {
  const exibicao = formatarInstanteExibicao(aplicadaEm, preferenciaFusoExibicao, "UTC");
  return <p>Efetivado por {executor} em {exibicao.texto} (horário exibido em {exibicao.fuso}; origem UTC).</p>;
}

export function mensagemConferenciaAcerto({ atual, motivos, conferidoEm, preferenciaFusoExibicao }: { atual: boolean; motivos: string[]; conferidoEm: string; preferenciaFusoExibicao?: string | null }) {
  const exibicao = formatarInstanteExibicao(conferidoEm, preferenciaFusoExibicao, "UTC");
  return `${atual ? "Origens conferidas sem alterações nesta consulta. Isso não aprova o acerto." : motivos.join(" ")} Conferido em ${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC).`;
}
const ResumoSchema = z.object({ contratos: z.array(z.object({ calculo: z.object({
  matriculaId: z.string(), moeda: z.string(), totalServico: z.string(), saldoDevidoSemCompensarCreditos: z.string(), creditoApuradoSemUtilizacao: z.string(),
  multa: z.object({ valor: z.string() }),
  parcelas: z.array(z.object({ cobrancaId: z.string(), diasCobertos: z.number(), diasPeriodo: z.number(), valorDevido: z.string(), saldoDevido: z.string(), creditoApurado: z.string(), memoria: z.object({ base: z.string(), desconto: z.string() }) })),
}), consolidacao: z.object({ pendencias: z.array(z.string()), totais: z.object({ saldoDevidoSemCompensarCreditos: z.string(), creditoApuradoSemUtilizacao: z.string(), multaContratual: z.string(), multaProposta: z.string() }).nullable() }).optional(), horasAntecipadas: z.object({ pendencias: z.array(z.string()), calculo: z.object({ creditoApurado: z.string() }).nullable() }).optional(), compensacaoFinanceira: z.object({ consolidado: z.object({ totalServico: z.string(), multaContratual: z.string(), saldoDevidoSemCompensarCreditos: z.string(), creditoApuradoSemUtilizacao: z.string() }).nullable().optional(), pendencias: z.array(z.string()), ajustes: z.array(z.object({ cobrancaId: z.string(), valorServicoAposCompensacao: z.string(), saldoDevido: z.string(), creditoApurado: z.string(), apuracao: z.object({ valorAjusteApurado: z.string(), quantidadePendente: z.number() }) })) }).optional(), origem: z.object({ compensacoes: CompensacoesEncerramentoSchema.optional() }).optional(), propostaExcecaoMulta: z.object({ tipo: z.enum(["DISPENSAR", "ALTERAR"]), motivo: z.string(), valorContratual: z.string(), valorProposto: z.string(), saldoPropostoSemCompensarCreditos: z.string(), saldoPropostoAposCompensacao: z.string().nullable().optional(), exigeAprovacaoIndependente: z.literal(true) }).nullable().optional() })) });

function Resumo({ snapshot }: { snapshot: unknown }) {
  const resultado = ResumoSchema.safeParse(snapshot);
  if (!resultado.success) return <p role="alert">Esta versão não pode ser apresentada. Confira sua estrutura antes de continuar.</p>;
  return <div className="space-y-3">{resultado.data.contratos.map(({ calculo: c, propostaExcecaoMulta: excecao, origem, compensacaoFinanceira, horasAntecipadas, consolidacao }) => <div key={c.matriculaId} className="space-y-2 overflow-x-auto rounded bg-gray-50 p-3">
    <p className="font-medium">Matrícula {c.matriculaId} · {c.moeda}</p>
    <table className="w-full text-left text-sm"><caption className="text-left">Memória do componente mensal</caption><thead><tr><th>Cobrança</th><th>Base</th><th>Desconto</th><th>Dias cobertos</th><th>Devido</th><th>Saldo</th><th>Crédito apurado</th></tr></thead>
      <tbody>{c.parcelas.map((p) => <tr key={p.cobrancaId}><td>{p.cobrancaId}</td><td>{p.memoria.base}</td><td>{p.memoria.desconto}</td><td>{p.diasCobertos}/{p.diasPeriodo}</td><td>{p.valorDevido}</td><td>{p.saldoDevido}</td><td>{p.creditoApurado}</td></tr>)}</tbody>
    </table>
    <p>Serviço: {formatarMoeda(c.totalServico, c.moeda)} · Multa: {formatarMoeda(c.multa.valor, c.moeda)} · Saldo devido: {formatarMoeda(c.saldoDevidoSemCompensarCreditos, c.moeda)} · Crédito apurado: {formatarMoeda(c.creditoApuradoSemUtilizacao, c.moeda)}</p>
    <p>Crédito separado do saldo devido; nenhuma utilização ou devolução foi executada.</p>
    <details><summary>Compensações preservadas nesta versão</summary>{origem?.compensacoes ? <CompensacoesEncerramento compensacoes={origem.compensacoes} /> : <p>Esta versão antiga não contém o registro das compensações. Atualize a conferência antes de preparar uma nova versão.</p>}</details>
    {consolidacao && <div className="rounded border p-2"><h4>Prévia consolidada para aprovação</h4>{consolidacao.pendencias.map(p => <p key={p} className="text-amber-800">{p}</p>)}{consolidacao.totais && <p>Saldo devido: {formatarMoeda(consolidacao.totais.saldoDevidoSemCompensarCreditos, c.moeda)} · Crédito apurado separado: {formatarMoeda(consolidacao.totais.creditoApuradoSemUtilizacao, c.moeda)}. Multa proposta incluída no saldo: {formatarMoeda(consolidacao.totais.multaProposta, c.moeda)}. Nenhuma utilização ou devolução executada.</p>}</div>}{horasAntecipadas && <div><h4>Horas antecipadas</h4>{horasAntecipadas.pendencias.map(p => <p key={p} className="text-amber-800">{p}</p>)}{horasAntecipadas.calculo && <p>Crédito apurado pelas horas restantes: {formatarMoeda(horasAntecipadas.calculo.creditoApurado, c.moeda)}. Créditos já emitidos foram descontados. Este valor aguarda consolidação e aprovação do acerto.</p>}</div>}{compensacaoFinanceira && <div><h4>Apuração adicional de compensações</h4>{compensacaoFinanceira.pendencias.map((p) => <p key={p} className="text-amber-800">{p}</p>)}{compensacaoFinanceira.ajustes.map((a) => <p key={a.cobrancaId}>Cobrança {a.cobrancaId}: {a.apuracao.quantidadePendente} dias ainda devidos, ajuste {formatarMoeda(a.apuracao.valorAjusteApurado, c.moeda)}. Serviço após ajuste: {formatarMoeda(a.valorServicoAposCompensacao, c.moeda)}; saldo: {formatarMoeda(a.saldoDevido, c.moeda)}; crédito apurado: {formatarMoeda(a.creditoApurado, c.moeda)}. Valores substituem os da mesma cobrança na conferência; não devem ser somados aos saldos anteriores.</p>)}</div>}
    {compensacaoFinanceira?.consolidado && <div className="rounded border p-2"><h4>Componente mensal após compensações</h4><p>Serviço: {formatarMoeda(compensacaoFinanceira.consolidado.totalServico, c.moeda)} · Multa contratual: {formatarMoeda(compensacaoFinanceira.consolidado.multaContratual, c.moeda)} · Saldo devido: {formatarMoeda(compensacaoFinanceira.consolidado.saldoDevidoSemCompensarCreditos, c.moeda)} · Crédito separado: {formatarMoeda(compensacaoFinanceira.consolidado.creditoApuradoSemUtilizacao, c.moeda)}.</p><p>Este subtotal substitui o componente mensal anterior. O acerto completo ainda depende dos demais ajustes e da aprovação.</p></div>}
    {compensacaoFinanceira?.consolidado === null && <p className="text-amber-800">Subtotal após compensações indisponível até resolver as pendências.</p>}
    {excecao && <div className="rounded border border-amber-200 p-2"><p>Exceção de multa proposta, ainda sem aprovação: {excecao.tipo === "DISPENSAR" ? "dispensa" : "alteração"}.</p><p>Multa contratual: {formatarMoeda(excecao.valorContratual, c.moeda)}; proposta: {formatarMoeda(excecao.valorProposto, c.moeda)}. Saldo proposto antes das compensações: {formatarMoeda(excecao.saldoPropostoSemCompensarCreditos, c.moeda)}.</p>{excecao.saldoPropostoAposCompensacao != null && <p>Saldo proposto após compensações: {formatarMoeda(excecao.saldoPropostoAposCompensacao, c.moeda)}, mantendo o crédito separado.</p>}<p>Motivo: {excecao.motivo}. Exige aprovação independente específica.</p></div>}
  </div>)}</div>;
}

function ResumoConcluido({ snapshot }: { snapshot: unknown }) {
  const r = ResumoSchema.safeParse(snapshot);
  if (!r.success) return <p>Memória indisponível para apresentação.</p>;
  return <div className="space-y-2">{r.data.contratos.map(c => <div key={c.calculo.matriculaId} className="rounded border p-3">
    <p>Matrícula {c.calculo.matriculaId} · {c.calculo.moeda}</p>
    {c.consolidacao?.totais && <><p>Saldo devido no acerto: {formatarMoeda(c.consolidacao.totais.saldoDevidoSemCompensarCreditos, c.calculo.moeda)}.</p>
      <p>Crédito apurado: {formatarMoeda(c.consolidacao.totais.creditoApuradoSemUtilizacao, c.calculo.moeda)}. Multa aplicada: {formatarMoeda(c.consolidacao.totais.multaProposta, c.calculo.moeda)}.</p></>}
  </div>)}</div>;
}
export function AcertoEncerramento({ alunoId, solicitacaoId, matriculas, preferenciaFusoExibicao = null }: { alunoId: string; solicitacaoId: string; matriculas: { id: string; codigo: string | null }[]; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  const [ocupado, iniciar] = useOperacao();
  const [contextos, setContextos] = useState<Contexto[] | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [validade, setValidade] = useState<string | null>(null);
  const [entrada, setEntrada] = useState<PreviaMensalPedidoEncerramentoInput | null>(null);
  const [previa, setPrevia] = useState<unknown>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [geracao, setGeracao] = useState(0);
  const [excecoes, setExcecoes] = useState<Record<string, string>>({});
  const chave = useRef("");
  const estilo = "rounded border p-2 text-sm";
  function limparPrevia() { setEntrada(null); setPrevia(null); chave.current = ""; setAviso(null); }
  function carregar() { void iniciar(async () => {
    setErro(null); limparPrevia(); setContextos(null); setValidade(null);
    try {
      const r = await consultarRascunhoAcertoEncerramento({ alunoId, solicitacaoId });
      if (!r.ok) throw new Error(r.erro);
      setRascunho(r.dado ?? null);
      if (r.dado?.efetivacao) return;
      const fontes: Contexto[] = [];
      for (const m of matriculas) {
        const r = await consultarContextoEncerramento({ alunoId, matriculaId: m.id });
        if (!r.ok || !r.dado) throw new Error(r.ok ? "Contexto indisponível." : r.erro);
        fontes.push(r.dado);
      }
      setRascunho(r.dado ?? null); setContextos(fontes); setExcecoes({}); setGeracao((n) => n + 1);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao carregar conferência."); }
  }); }
  if (rascunho?.efetivacao) return <section className="space-y-3 border-t pt-3">
    <h3 className="font-medium">Encerramento concluído</h3>
    <EfetivacaoAcertoHistorico executor={rascunho.efetivacao.executor.nome} aplicadaEm={rascunho.efetivacao.aplicadaEm} preferenciaFusoExibicao={preferenciaFusoExibicao} />
    <p>Memória da versão {rascunho.versao} aprovada. Consulte a ficha financeira para recebimentos, utilização de créditos e devoluções posteriores.</p>
    <ResumoConcluido snapshot={rascunho.snapshot} />
    <a href={`/alunos/${alunoId}/financeiro`}>Abrir ficha financeira</a>
  </section>;
  return <section className="space-y-3 border-t pt-3">
    <h3 className="font-medium">Preparação financeira do encerramento</h3>
    <p>Conferência das mensalidades e multa. Taxas, compensações, horas antecipadas e demais ajustes precisam compor o acerto completo antes da aprovação.</p>
    <button type="button" disabled={ocupado} onClick={carregar} className={estilo}>Carregar / atualizar conferência</button>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}<MensagemStatus texto={aviso} />
    {rascunho && <details><summary>Rascunho salvo · versão {rascunho.versao} · {rascunho.preparador.nome}</summary><p>{rascunho.motivo}</p><Resumo snapshot={rascunho.snapshot} /><LancamentosEncerramento snapshot={rascunho.snapshot} /><ImpactosAcademicosAcerto snapshot={rascunho.snapshot} />{rascunho.decisao && <p>{rascunho.decisao.aprovada ? "Acerto aprovado, aguardando efetivação" : "Versão rejeitada"}: {rascunho.decisao.motivo}</p>}{rascunho.podeEfetivar && rascunho.decisao && <EfetivarAcerto alunoId={alunoId} decisaoId={rascunho.decisao.id} atualizar={carregar} />}{rascunho.podeDecidir && <DecisaoAcerto alunoId={alunoId} rascunhoId={rascunho.id} />}<OutrasCobrancasResumo snapshot={rascunho.snapshot} />
      <button type="button" disabled={ocupado} className={estilo} onClick={() => { void iniciar(async () => {
        setErro(null); setValidade(null);
        try {
          const r = await conferirValidadeRascunhoEncerramento({ alunoId, solicitacaoId, rascunhoId: rascunho.id });
          if (!r.ok || !r.dado) { setErro(r.ok ? "Conferência indisponível." : r.erro); return; }
          setValidade(mensagemConferenciaAcerto({ ...r.dado, preferenciaFusoExibicao }));
        } catch { setErro("Não foi possível conferir as origens atuais."); }
      }); }}>Conferir se o rascunho continua atual</button>
      <MensagemStatus texto={validade} />
    </details>}
    {contextos && <form key={geracao} className="space-y-4" onChange={limparPrevia} onSubmit={(e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget); const s = (nome: string) => String(f.get(nome) ?? "");
      const r = PreviaMensalPedidoEncerramentoSchema.safeParse({ alunoId, solicitacaoId, contratos: contextos.map((c) => ({ matriculaId: c.matriculaId, condicoesId: c.condicoes?.id ?? "",
        parcelas: c.cobrancas.filter((p) => p.tipo === "MENSALIDADE").map((p) => ({ cobrancaId: p.id, versao: p.versao, valorBase: s(`${p.id}:base`).replace(",", "."), descontoValido: s(`${p.id}:desconto`).replace(",", "."), evidenciaCondicoes: s(`${p.id}:evidencia`) })),
        outrasCobrancas: c.cobrancas.filter((p) => p.tipo !== "MENSALIDADE").map((p) => ({ cobrancaId: p.id, versao: p.versao, valorDevidoProposto: s(`${p.id}:devido`).replace(",", "."), motivo: s(`${p.id}:motivo`), evidenciaContratual: s(`${p.id}:contrato`) })),
        multa: c.condicoes?.regras.multa.tipo === "SEM_PREVISAO" ? { tipo: "SEM_PREVISAO" } : { tipo: "APLICAR", evidenciaAplicabilidade: s(`${c.matriculaId}:multa`), ...(s(`${c.matriculaId}:vencimentoMulta`) ? { vencimento: s(`${c.matriculaId}:vencimentoMulta`) } : {}), ...(c.condicoes?.regras.multa.tipo === "PERCENTUAL" ? { baseCalculo: s(`${c.matriculaId}:baseMulta`).replace(",", ".") } : {}),
          ...(excecoes[c.matriculaId] ? { excecao: { tipo: excecoes[c.matriculaId], motivo: s(`${c.matriculaId}:motivoExcecao`), ...(excecoes[c.matriculaId] === "ALTERAR" ? { valorProposto: s(`${c.matriculaId}:valorExcecao`).replace(",", ".") } : {}) } } : {}),
        },
      })) });
      if (!r.success) { setErro(r.error.issues[0]?.message ?? "Confira os campos."); return; }
      void iniciar(async () => { setErro(null); setEntrada(null); setPrevia(null);
        try { const p = await preverComponenteMensalEncerramento(r.data); if (!p.ok) { setErro(p.erro); return; } setEntrada(r.data); setPrevia(p.dado); }
        catch { setErro("Não foi possível calcular a prévia."); }
      });
    }}><fieldset disabled={ocupado} className="space-y-4">
      {contextos.map((c) => <div key={c.matriculaId} className="space-y-2 rounded border p-3">
        <h4 className="font-medium">{identificacaoContrato(matriculas.find((m) => m.id === c.matriculaId)?.codigo, c.matriculaId)} · {c.moeda}</h4>
        {c.pendencias.map((p) => <p className="text-amber-800" key={p}>{p}</p>)}
        {c.condicoes && <p>Condições versão {c.condicoes.versao}: dia do encerramento {c.condicoes.regras.diaEncerramento === "INCLUIR" ? "incluído" : "excluído"}; desconto {c.condicoes.regras.metodoDesconto === "ANTES_DO_PROPORCIONAL" ? "antes" : "depois"} do proporcional. {c.condicoes.regras.condicoesDescontos}</p>}
        {c.cobrancas.map((p) => <div key={p.id} className="space-y-2 border-t pt-2">
          <p>{p.tipo === "MENSALIDADE" ? "Mensalidade" : p.tipo === "HORA_PARTICULAR" ? "Particulares por hora" : "Outra cobrança"} {p.id}: referência {p.valorOriginal}, negociado {p.valorNegociado}, recebido em dinheiro {p.valorRecebido ?? "não registrado"}, liquidado por crédito {p.valorLiquidadoCredito ?? "0.00"}.
            {p.tipo === "MENSALIDADE" && <> Cobertura: {p.coberturaInicio ?? "pendente"} a {p.coberturaFim ?? "pendente"}.</>}</p>
          {p.origemFaturamentoHoras && <p>Origem: fechamento aprovado com {p.origemFaturamentoHoras.itens.length} encontro(s) faturado(s). O valor original permanece no histórico; qualquer redução proposta depende da aprovação do acerto.</p>}
          {p.conferencias.map((msg) => <p key={msg} className="text-amber-800">{msg}</p>)}
          {p.tipo === "MENSALIDADE" ? <div className="grid gap-2 md:grid-cols-3">
            <label className="grid gap-1">Base conferida<input name={`${p.id}:base`} inputMode="decimal" required className={estilo} /></label>
            <label className="grid gap-1">Desconto válido no encerramento<input name={`${p.id}:desconto`} inputMode="decimal" required className={estilo} /></label>
            <label className="grid gap-1">Evidência das condições<textarea name={`${p.id}:evidencia`} required minLength={5} maxLength={2000} className={estilo} /></label>
          </div> : <div className="grid gap-2 md:grid-cols-3">
            <label className="grid gap-1">Valor devido proposto no encerramento<input name={`${p.id}:devido`} defaultValue={p.valorNegociado} inputMode="decimal" required className={estilo} /></label>
            <label className="grid gap-1">Motivo do tratamento da cobrança<textarea name={`${p.id}:motivo`} required minLength={5} maxLength={2000} className={estilo} /></label>
            <label className="grid gap-1">Evidência contratual da cobrança<textarea name={`${p.id}:contrato`} required minLength={5} maxLength={2000} className={estilo} /></label>
          </div>}
        </div>)}
        {c.ajustes.length > 0 && <details><summary>Ajustes anteriores</summary>{c.ajustes.map((a) => <p key={a.id}>{a.tipo}: {formatarMoeda(a.valorDe, a.moeda)} para {formatarMoeda(a.valorPara, a.moeda)}. {a.motivo}</p>)}</details>}
        <CompensacoesEncerramento compensacoes={c.compensacoes} />
        {c.condicoes?.regras.multa.tipo === "SEM_PREVISAO" ? <p>Sem previsão de multa: {c.condicoes.regras.multa.motivo}</p> : c.condicoes && <div className="space-y-2">
          <p>Cláusula {c.condicoes.regras.multa.clausulaId}: {c.condicoes.regras.multa.condicoesAplicacao}. {c.condicoes.regras.multa.tipo === "VALOR_FIXO" ? `Valor fixo: ${formatarMoeda(c.condicoes.regras.multa.valor, c.moeda)}` : `${c.condicoes.regras.multa.percentual}% sobre ${c.condicoes.regras.multa.descricaoBase}`}</p>
          <label className="grid gap-1">Vencimento proposto da multa<input type="date" name={`${c.matriculaId}:vencimentoMulta`} className={estilo} /></label><p>Obrigatório para aprovar multa com valor a cobrar. Dispensa integral não emite cobrança.</p><label className="grid gap-1">Evidência de aplicabilidade da multa<textarea name={`${c.matriculaId}:multa`} required minLength={5} maxLength={2000} className={estilo} /></label>
          {c.condicoes.regras.multa.tipo === "PERCENTUAL" && <label className="grid gap-1">Valor conferido da base percentual<input name={`${c.matriculaId}:baseMulta`} required inputMode="decimal" className={estilo} /></label>}
          <label className="grid gap-1">Tratamento proposto da multa<select value={excecoes[c.matriculaId] ?? ""} onChange={(e) => setExcecoes((atual) => ({ ...atual, [c.matriculaId]: e.target.value }))} className={estilo}><option value="">Manter previsão contratual</option><option value="DISPENSAR">Propor dispensa</option><option value="ALTERAR">Propor outro valor</option></select></label>
          {excecoes[c.matriculaId] && <><p>A exceção será registrada como proposta e dependerá de autorização independente.</p><label className="grid gap-1">Justificativa da exceção<textarea name={`${c.matriculaId}:motivoExcecao`} required minLength={5} maxLength={2000} className={estilo} /></label>{excecoes[c.matriculaId] === "ALTERAR" && <label className="grid gap-1">Valor de multa proposto<input name={`${c.matriculaId}:valorExcecao`} required inputMode="decimal" className={estilo} /></label>}</>}
        </div>}
      </div>)}
      <button className={estilo}>Calcular componente mensal</button>
    </fieldset></form>}
    {previa != null && <div className="space-y-3"><Resumo snapshot={previa} /><ImpactosAcademicosAcerto snapshot={previa} /><OutrasCobrancasResumo snapshot={previa} />
      <label className="grid gap-1">Motivo desta versão<textarea value={motivo} onChange={(e) => { setMotivo(e.target.value); chave.current = ""; }} disabled={ocupado} minLength={5} maxLength={2000} className={estilo} /></label>
      <button disabled={ocupado || !entrada || motivo.trim().length < 5} className={estilo} onClick={() => { if (!entrada) return; void iniciar(async () => {
        setErro(null); chave.current ||= crypto.randomUUID();
        try {
          const r = await salvarRascunhoAcertoEncerramento({ ...entrada, motivo, chaveIdempotencia: chave.current, versaoAnterior: rascunho?.versao ?? 0 });
          if (!r.ok || !r.dado) { setErro(r.ok ? "Resposta incompleta." : r.erro); return; }
          const salvo = await consultarRascunhoAcertoEncerramento({ alunoId, solicitacaoId, versao: r.dado.versao });
          if (!salvo.ok) { setErro(salvo.erro); return; }
          setRascunho(salvo.dado ?? null); setValidade(null); limparPrevia(); setAviso(`Rascunho versão ${r.dado.versao} salvo. Acerto ainda não aprovado nem efetivado.`);
          router.refresh();
        } catch { setErro("Resultado incerto. Repita sem alterar a conferência para recuperar o mesmo rascunho."); }
      }); }}>Salvar rascunho financeiro</button>
    </div>}
  </section>;
}
