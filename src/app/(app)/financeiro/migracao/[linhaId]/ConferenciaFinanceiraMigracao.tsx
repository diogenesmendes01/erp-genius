"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rotuloVencimento, type VencimentoVisivel } from "@/lib/vencimento-civil";
import { decidirConciliacaoFinanceiraMigracao, proporConciliacaoFinanceiraMigracao } from "@/server/migracao/conciliacao-financeira";
import { camposComplementoFinanceiro, dataHistoricaComOffset, montarComplementoEstruturado } from "./formulario-conciliacao-financeira";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarMoeda } from "@/lib/dinheiro";
import { FORMA_PAGAMENTO_LABEL, STATUS_COBRANCA_LABEL, rotular } from "@/lib/labels";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";

export type ModalidadeFinanceira = "PENDENCIA" | "BAIXAR" | "VINCULAR_RECEBIMENTO";
export const formasPagamento = ["TRANSFERENCIA", "GREENPAY", "DINHEIRO", "CARTAO"] as const;

type Cobranca = { id: string; codigo: string | null; status: string; tipo: string; moeda: string; valorNegociado: string; valorRecebido: string | null; saldo: string | null; vencimento: VencimentoVisivel; versao: number };
type Recebimento = { destinacoes?: { id: string; cobrancaId: string | null; valor: string }[]; id: string; cobrancaId: string | null; valor: string; moeda: string; forma: string; dataPagamento: string; chaveIdempotencia: string; hashDados: string | null; autorId: string };
type Pagador = { id: string; versao: number; tipo: string; dados: unknown; motivo: string; criadaEm: string; preparador: { nome: string | null } };
type Proposta = { id: string; versao: number; modalidade: string; valor: string | null; moeda: string | null; dataPagamento: string | null; forma: string | null; status: string; evidencia: unknown; complemento: unknown; snapshot: unknown; estadoHash: string; motivoDecisao: string | null; decididoEm: string | null; aplicadaEm: string | null; criadoEm: string; preparadorId: string; podeDecidir: boolean; preparador: { nome: string | null }; decisor: { nome: string | null } | null; cobranca: { codigo: string | null; moeda: string; status: string }; pagador: { versao: number; tipo: string }; recebimentoExistente: { id: string; dataPagamento: string } | null; aplicacao: { recebimentoId: string | null; aplicadaEm: string; aplicadaPor: { nome: string | null } } | null };
export type DadosConciliacaoFinanceira = { pendenciaRegistrada?: boolean; resolucao?: { recebimentoId: string; aplicadaEm: string } | null; linha: { id: string; linhaOrigem: string; dadosOrigem: unknown; entradaHash: string; lote: { origem: string; chaveLote: string }; mapa: { matriculaId: string; codigo: string | null; status: string; aluno: string } | null }; cobrancas: Cobranca[]; recebimentos: Recebimento[]; pagadores: Pagador[]; propostas: Proposta[]; podeDecidir: boolean };

type CampoComplemento = "tipo" | "valor" | "moeda" | "situacao" | "dataPagamento" | "forma" | "pagadorId";
type DetalheComplemento = { motivo: string; evidencia: string };
const camposComplemento: readonly CampoComplemento[] = ["tipo", "valor", "moeda", "situacao", "dataPagamento", "forma", "pagadorId"];
const detalhesVazios = (): Record<CampoComplemento, DetalheComplemento> => Object.fromEntries(camposComplemento.map((campo) => [campo, { motivo: "", evidencia: "" }])) as Record<CampoComplemento, DetalheComplemento>;
type Formulario = { modalidade: ModalidadeFinanceira; cobrancaId: string; pagadorId: string; recebimentoExistenteId: string; valor: string; moeda: string; dataLocal: string; offset: string; forma: string; evidenciaValor: string; evidenciaMoeda: string; evidenciaData: string; evidenciaForma: string; evidenciaComprovante: string; detalhes: Record<CampoComplemento, DetalheComplemento> };
const inicial: Formulario = { modalidade: "PENDENCIA", cobrancaId: "", pagadorId: "", recebimentoExistenteId: "", valor: "", moeda: "", dataLocal: "", offset: "", forma: "", evidenciaValor: "", evidenciaMoeda: "", evidenciaData: "", evidenciaForma: "", evidenciaComprovante: "", detalhes: detalhesVazios() };

export function montarEvidenciasFinanceiras(formulario: Formulario) {
  const evidencia = Object.fromEntries(Object.entries({ valor: formulario.evidenciaValor.trim(), moeda: formulario.evidenciaMoeda.trim(), dataPagamento: formulario.evidenciaData.trim(), forma: formulario.evidenciaForma.trim(), comprovante: formulario.evidenciaComprovante.trim() }).filter(([, valor]) => valor));
  if (Object.keys(evidencia).length === 0) throw new Error("Informe ao menos uma evidência.");
  return { evidencia };
}

function fonteFinanceira(dados: unknown, campo: CampoComplemento) {
  const financeiro = dados && typeof dados === "object" ? (dados as { financeiro?: unknown }).financeiro : null;
  if (!financeiro || typeof financeiro !== "object") return "não informado";
  const valor = (financeiro as Record<string, unknown>)[campo];
  return typeof valor === "string" || typeof valor === "number" ? String(valor) : "não informado";
}
function propostaValida(formulario: Formulario) {
  if (!formulario.cobrancaId || !formulario.pagadorId) return "Selecione a cobrança e o pagador conferidos.";
  if (formulario.modalidade === "PENDENCIA") return formulario.evidenciaComprovante.trim() ? null : "Explique a pendência com a evidência do comprovante ou da ausência dele.";
  if (!/^\d+(\.\d{1,2})?$/.test(formulario.valor)) return "Informe o valor com até duas casas decimais.";
  if (!/^[A-Z]{3}$/.test(formulario.moeda)) return "Informe a moeda com três letras maiúsculas.";
  if (!dataHistoricaComOffset(formulario.dataLocal, formulario.offset)) return "Informe data e hora históricas com deslocamento UTC explícito.";
  if (!formasPagamento.includes(formulario.forma as (typeof formasPagamento)[number])) return "Selecione a forma de pagamento.";
  if (!formulario.evidenciaValor.trim() || !formulario.evidenciaMoeda.trim() || !formulario.evidenciaData.trim() || !formulario.evidenciaForma.trim()) return "Registre a evidência de valor, moeda, data e forma.";
  if (formulario.modalidade === "VINCULAR_RECEBIMENTO" && !formulario.recebimentoExistenteId) return "Selecione o recebimento ERP já existente.";
  return null;
}

function identificarPagador(pagador: Pagador) {
  const dados = pagador.dados && typeof pagador.dados === "object" ? pagador.dados as Record<string, unknown> : {};
  const nome = typeof dados.nome === "string" && dados.nome.trim() ? dados.nome : "Nome não informado";
  return `${nome} · versão ${pagador.versao} · ${pagador.tipo}`;
}

export function ConferenciaFinanceiraMigracao({ dados, preferenciaFusoExibicao = null }: { dados: DadosConciliacaoFinanceira; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  const instanteAdministrativo = (valor: string) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  const enviando = useRef(false);
  const chave = useRef<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(() => ({ ...inicial, modalidade: dados.pendenciaRegistrada ? "BAIXAR" : "PENDENCIA" }));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const cobranca = dados.cobrancas.find((item) => item.id === formulario.cobrancaId) ?? null;
  const recebimentos = dados.recebimentos.filter((item) => item.destinacoes ? item.destinacoes.some(destino => destino.cobrancaId === formulario.cobrancaId) : item.cobrancaId === formulario.cobrancaId);

  function mudar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    chave.current = null;
    setErro(null); setSucesso(null);
    setFormulario((anterior) => ({ ...anterior, [campo]: valor, ...(campo === "cobrancaId" ? { recebimentoExistenteId: "", moeda: dados.cobrancas.find((item) => item.id === valor)?.moeda ?? anterior.moeda } : {}) }));
  }
  function mudarDetalhe(campo: CampoComplemento, parte: keyof DetalheComplemento, valor: string) {
    chave.current = null; setErro(null); setSucesso(null);
    setFormulario((anterior) => ({ ...anterior, detalhes: { ...anterior.detalhes, [campo]: { ...anterior.detalhes[campo], [parte]: valor } } }));
  }  async function propor() {
    if (enviando.current) return;
    const problema = propostaValida(formulario);
    if (problema) { setErro(problema); return; }
    enviando.current = true; chave.current ??= crypto.randomUUID(); setOcupado(true); setErro(null); setSucesso(null);
    try {
      const dataPagamento = formulario.modalidade === "PENDENCIA" ? undefined : dataHistoricaComOffset(formulario.dataLocal, formulario.offset)!;
      const evidencias = montarEvidenciasFinanceiras(formulario);
      const complemento = formulario.modalidade === "PENDENCIA" ? undefined : montarComplementoEstruturado(formulario.detalhes, { tipo: cobranca?.tipo ?? "", valor: formulario.valor, moeda: formulario.moeda, situacao: "PAGAMENTO_COMPROVADO", dataPagamento: dataPagamento!, forma: formulario.forma, pagadorId: formulario.pagadorId });
      const resposta = await proporConciliacaoFinanceiraMigracao({
        linhaId: dados.linha.id, matriculaId: dados.linha.mapa!.matriculaId, cobrancaId: formulario.cobrancaId, pagadorId: formulario.pagadorId,
        modalidade: formulario.modalidade, valor: formulario.modalidade === "PENDENCIA" ? undefined : formulario.valor,
        moeda: formulario.modalidade === "PENDENCIA" ? undefined : formulario.moeda, dataPagamento,
        forma: formulario.modalidade === "PENDENCIA" ? undefined : formulario.forma,
        recebimentoExistenteId: formulario.modalidade === "VINCULAR_RECEBIMENTO" ? formulario.recebimentoExistenteId : undefined,
        ...evidencias, complemento, chaveIdempotencia: chave.current,
      });
      if (!resposta.ok || !resposta.dado) { setErro(resposta.ok ? "A proposta não retornou confirmação." : resposta.erro); return; }
      setSucesso(resposta.dado.repetida ? "Esta proposta já havia sido registrada." : "Proposta registrada para decisão independente.");
      router.refresh();
    } catch (erro) { setErro(erro instanceof Error ? erro.message : MSG_RESULTADO_INCERTO); } finally { enviando.current = false; setOcupado(false); }
  }

  if (!dados.linha.mapa) return <section className="rounded border border-amber-200 bg-amber-50 p-4 text-sm"><h2 className="font-medium">Conciliação financeira migrada</h2><p role="alert">Esta linha ainda não possui vínculo de migração com uma matrícula. A conciliação não pode ser preparada.</p></section>;
  return <section className="space-y-5"><header><h1 className="text-xl font-medium">Conciliação financeira migrada</h1><p className="text-sm text-gray-600">Linha {dados.linha.linhaOrigem} · origem {dados.linha.lote.origem} · contrato {dados.linha.mapa.codigo ?? "sem código"} de {dados.linha.mapa.aluno}.</p></header>
    <details className="rounded border p-3"><summary className="cursor-pointer font-medium">Fonte e destino conferidos</summary><p className="mt-2 text-sm">Lote {dados.linha.lote.chaveLote} · situação atual {dados.linha.mapa.status}.</p><pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(dados.linha.dadosOrigem, null, 2)}</pre></details>
    {dados.resolucao ? <p role="status" className="rounded border border-green-200 bg-green-50 p-4">Origem conciliada com recebimento em {instanteAdministrativo(dados.resolucao.aplicadaEm)}. Eventual pendência anterior permanece no histórico e está resolvida.</p> : <section className="space-y-3 rounded border p-4"><h2 className="font-medium">{dados.pendenciaRegistrada ? "Resolver pendência com recebimento comprovado" : "Preparar proposta"}</h2><p className="text-sm text-gray-600">A seleção usa apenas cobranças, recebimentos e pagadores deste contrato. Uma pendência não cria recebimento.</p>
      <fieldset disabled={ocupado} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label>Cobrança<select aria-label="Cobrança" className="mt-1 block w-full rounded border p-2" value={formulario.cobrancaId} onChange={(e) => mudar("cobrancaId", e.target.value)}><option value="">Selecione</option>{dados.cobrancas.map((item) => <option key={item.id} value={item.id}>{item.codigo ?? "Cobrança sem código"} · {rotular(STATUS_COBRANCA_LABEL, item.status)} · saldo {item.saldo != null ? formatarMoeda(item.saldo, item.moeda) : "—"} · {rotuloVencimento(item.vencimento)}</option>)}</select></label><label>Pagador conferido<select aria-label="Pagador conferido" className="mt-1 block w-full rounded border p-2" value={formulario.pagadorId} onChange={(e) => mudar("pagadorId", e.target.value)}><option value="">Selecione</option>{dados.pagadores.map((item) => <option key={item.id} value={item.id}>{identificarPagador(item)} · preparado por {item.preparador.nome ?? "autoria indisponível"}</option>)}</select></label><label>Tratamento<select aria-label="Tratamento" className="mt-1 block w-full rounded border p-2" value={formulario.modalidade} onChange={(e) => mudar("modalidade", e.target.value as ModalidadeFinanceira)}><option value="PENDENCIA" disabled={dados.pendenciaRegistrada}>Registrar pendência</option><option value="BAIXAR">Baixar recebimento histórico</option><option value="VINCULAR_RECEBIMENTO">Vincular recebimento ERP existente</option></select></label>{cobranca && <p className="self-end text-sm">Moeda da cobrança: <strong>{cobranca.moeda}</strong> · {rotuloVencimento(cobranca.vencimento)}</p>}</div>
      {formulario.modalidade !== "PENDENCIA" && <div className="grid gap-3 rounded bg-gray-50 p-3 sm:grid-cols-2"><label>Valor<input aria-label="Valor" inputMode="decimal" className="mt-1 block w-full rounded border p-2" value={formulario.valor} onChange={(e) => mudar("valor", e.target.value)} /></label><label>Moeda<input aria-label="Moeda" maxLength={3} className="mt-1 block w-full rounded border p-2 uppercase" value={formulario.moeda} onChange={(e) => mudar("moeda", e.target.value.toUpperCase())} /></label><label>Data e hora históricas<input aria-label="Data e hora históricas" type="datetime-local" className="mt-1 block w-full rounded border p-2" value={formulario.dataLocal} onChange={(e) => mudar("dataLocal", e.target.value)} /></label><label>Deslocamento UTC explícito<input aria-label="Deslocamento UTC explícito" placeholder="-03:00" className="mt-1 block w-full rounded border p-2" value={formulario.offset} onChange={(e) => mudar("offset", e.target.value)} /></label><label>Forma<select aria-label="Forma de pagamento" className="mt-1 block w-full rounded border p-2" value={formulario.forma} onChange={(e) => mudar("forma", e.target.value)}><option value="">Selecione</option>{formasPagamento.map((forma) => <option key={forma} value={forma}>{rotular(FORMA_PAGAMENTO_LABEL, forma)}</option>)}</select></label>{formulario.modalidade === "VINCULAR_RECEBIMENTO" && <label>Recebimento ERP<select aria-label="Recebimento ERP" className="mt-1 block w-full rounded border p-2" value={formulario.recebimentoExistenteId} onChange={(e) => mudar("recebimentoExistenteId", e.target.value)}><option value="">Selecione</option>{recebimentos.map((item) => <option key={item.id} value={item.id}>{formatarMoeda(item.destinacoes?.find(destino => destino.cobrancaId === formulario.cobrancaId)?.valor ?? item.valor, item.moeda)} nesta cobrança · recebimento total {formatarMoeda(item.valor, item.moeda)} · {rotular(FORMA_PAGAMENTO_LABEL, item.forma)} · {new Date(item.dataPagamento).toLocaleString("pt-BR")}</option>)}</select></label>}</div>}
      <fieldset className="grid gap-3 rounded border p-3 sm:grid-cols-2"><legend className="px-1">Evidências por campo</legend>{([ ["evidenciaValor", "Valor"], ["evidenciaMoeda", "Moeda"], ["evidenciaData", "Data"], ["evidenciaForma", "Forma"], ["evidenciaComprovante", "Comprovante ou ausência"] ] as const).map(([campo, rotulo]) => <label key={campo}>{rotulo}<CampoTexto aria-label={`Evidência: ${rotulo}`} className="mt-1 block w-full rounded border p-2" value={formulario[campo]} onChange={(e) => mudar(campo, e.target.value)} /></label>)}</fieldset>
      {formulario.modalidade !== "PENDENCIA" && <fieldset className="space-y-3 rounded border border-amber-200 bg-amber-50 p-3"><legend className="px-1">Complemento estruturado por campo</legend>{camposComplementoFinanceiro.map((campo) => <div key={campo} className="grid gap-2 sm:grid-cols-3"><p className="text-xs"><strong>{campo}</strong><br/>Fonte: {fonteFinanceira(dados.linha.dadosOrigem, campo)}<br/>Proposto: {campo === "tipo" ? (cobranca?.tipo ?? "") : campo === "situacao" ? "PAGAMENTO_COMPROVADO" : campo === "dataPagamento" ? (dataHistoricaComOffset(formulario.dataLocal, formulario.offset) ?? "") : campo === "pagadorId" ? (dados.pagadores.find((pagador) => pagador.id === formulario.pagadorId) ? `${identificarPagador(dados.pagadores.find((pagador) => pagador.id === formulario.pagadorId)!)} · registro ${formulario.pagadorId}` : "") : campo === "valor" ? formulario.valor : campo === "moeda" ? formulario.moeda : formulario.forma}</p><label>Motivo<CampoTexto aria-label={`Motivo do complemento: ${campo}`} value={formulario.detalhes[campo].motivo} onChange={(e) => mudarDetalhe(campo, "motivo", e.target.value)} /></label><label>Evidência<CampoTexto aria-label={`Evidência do complemento: ${campo}`} value={formulario.detalhes[campo].evidencia} onChange={(e) => mudarDetalhe(campo, "evidencia", e.target.value)} /></label></div>)}</fieldset>}      <button type="button" disabled={ocupado} className={botaoClasses({ tamanho: "lg" })} onClick={propor}>{ocupado ? "Registrando…" : "Registrar proposta"}</button>{erro && <p role="alert">{erro}</p>}<MensagemStatus texto={sucesso} />
    </fieldset></section>}
    <Historico propostas={dados.propostas} preferenciaFusoExibicao={preferenciaFusoExibicao} />
  </section>;
}

function Historico({ propostas, preferenciaFusoExibicao }: { propostas: Proposta[]; preferenciaFusoExibicao: string | null }) {
  const instanteAdministrativo = (valor: string) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  return <section className="space-y-3"><h2 className="text-lg font-medium">Histórico de propostas e aplicações</h2>{propostas.length === 0 && <EstadoVazio>Nenhuma proposta registrada para esta linha.</EstadoVazio>}{propostas.map((proposta) => <article key={proposta.id} className="rounded border p-3 text-sm"><p><strong>Versão {proposta.versao}</strong> · {proposta.modalidade} · {proposta.status} · preparada por {proposta.preparador.nome ?? "autoria indisponível"} em {instanteAdministrativo(proposta.criadoEm)}.</p><p>Decisão: {proposta.decisor?.nome ?? "aguardando decisor independente"} · {proposta.motivoDecisao ?? "sem motivo"}.</p><details className="mt-2"><summary>Fotografia e evidências</summary><pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify({ evidencia: proposta.evidencia, complemento: proposta.complemento, snapshot: proposta.snapshot }, null, 2)}</pre></details>{proposta.aplicacao && <p className="mt-2 text-green-700">Aplicada por {proposta.aplicacao.aplicadaPor.nome ?? "autoria indisponível"} em {instanteAdministrativo(proposta.aplicacao.aplicadaEm)}.</p>}{proposta.status === "PENDENTE" && proposta.podeDecidir && <DecidirProposta proposta={proposta} podeDecidir={proposta.podeDecidir} />}</article>)}</section>; }

function DecidirProposta({ proposta, podeDecidir }: { proposta: Proposta; podeDecidir: boolean }) { const router=useRouter(), enviando=useRef(false), chave=useRef<string|null>(null), [ocupado,setOcupado]=useState(false), [erro,setErro]=useState<string|null>(null), [sucesso,setSucesso]=useState<string|null>(null); async function decidir(decisao:string,motivo:string){if(enviando.current)return;if(decisao!=="APROVAR"&&decisao!=="REJEITAR"){setErro("Selecione aprovar ou rejeitar.");return}const aprovada=decisao==="APROVAR";if(!podeDecidir){setErro("Você não pode decidir esta proposta.");return}if(motivo.trim().length<10){setErro("Descreva o motivo da decisão com pelo menos 10 caracteres.");return}enviando.current=true;chave.current??=crypto.randomUUID();setOcupado(true);setErro(null);setSucesso(null);try{const r=await decidirConciliacaoFinanceiraMigracao({propostaId:proposta.id,aprovada,motivo,chaveIdempotencia:chave.current});if(!r.ok){setErro(r.erro);return}setSucesso(r.dado?.repetida?"Esta decisão já havia sido registrada.":"Decisão registrada.");router.refresh()}catch{setErro(MSG_DECISAO_INCERTA)}finally{enviando.current=false;setOcupado(false)}} return <form className="mt-3 space-y-2 border-t pt-3" onChange={()=>{chave.current=null;setErro(null);setSucesso(null)}} onSubmit={(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);void decidir(String(f.get("decisao")??""),String(f.get("motivo")??""))}}><p>Uma pessoa diferente da preparadora deve decidir.</p><fieldset disabled={ocupado}><label>Decisão<select name="decisao" aria-label="Decisão" defaultValue=""><option value="">Selecione</option><option value="APROVAR">Aprovar e aplicar</option><option value="REJEITAR">Rejeitar</option></select></label><label className="block">Motivo<CampoTexto name="motivo" aria-label="Motivo da decisão" className="mt-1 block w-full rounded border p-2" minLength={10} required /></label><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "sm" })}>{ocupado?"Registrando…":"Registrar decisão"}</button></fieldset>{erro&&<p role="alert">{erro}</p>}<MensagemStatus texto={sucesso} /></form>; }
