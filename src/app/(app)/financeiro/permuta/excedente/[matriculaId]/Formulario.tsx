"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepararDestinacaoExcedentePermuta, registrarConcordanciaExcedentePermuta, decidirDestinacaoExcedentePermuta } from "@/server/matricula/excedente-permuta-destinacao";
import { proporUsoSaldoServicoPermuta, decidirUsoSaldoServicoPermuta } from "@/server/matricula/saldo-servico-permuta-uso";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { formatarDataCivil } from "@/lib/data-civil";
import { DICA_PONTO_DECIMAL, formatarMoeda, parseMoeda } from "@/lib/dinheiro";

type Origem = { id: string; tipo: string; valor: string };
type Props =
 | { modo: "preparar"; matriculaId: string; cobrancaId: string; moeda: string; origens: Origem[] }
 | { modo: "concordar"; propostaId: string; parte: "ALUNO_OU_RESPONSAVEL" | "ESCOLA" }
 | { modo: "decidir"; propostaId: string }
 | { modo: "usar"; saldoId: string; moeda: string; disponivel: string; cobrancas: { id: string; rotulo: string; saldo: string; vencimento: string }[] }
 | { modo: "decidir-uso"; propostaId: string };

const ORIGEM_LABEL: Record<string, string> = { CAIXA: "Caixa", CREDITO: "Crédito", PERMUTA: "Serviço (permuta)" };
const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();
/** O servidor recebe o valor com ponto decimal; o operador digita com vírgula (o ponto ambíguo é recusado pelo servidor). */
const valor = (form: FormData, campo: string) => { const bruto = texto(form, campo), n = parseMoeda(bruto); return n === null ? bruto : n.toFixed(2); };

/** Q171/Q167C. A chave de idempotência é mantida entre repetições da mesma tentativa; só a recusa conhecida libera corrigir os dados. */
export function ExcedenteFormulario(props: Props) {
 const router = useRouter();
 const acao = useAcaoCliente({ idempotente: true });
 const [concluido, setConcluido] = useState(false);
 const [temTentativa, setTemTentativa] = useState(false);
 const emEnvio = useRef(false);
 const tentativa = useRef<{ entrada: Record<string, unknown>; chave: string } | null>(null);
 const mista = props.modo === "preparar" && props.origens.length > 1;
 return <form className="space-y-3 rounded border p-3" onSubmit={async evento => {
  evento.preventDefault(); if (acao.ocupado || emEnvio.current || concluido) return;
  const form = new FormData(evento.currentTarget);
  if (!tentativa.current) {
   let entrada: Record<string, unknown>;
   if (props.modo === "preparar") {
    const itens = (["SALDO_SERVICOS", "CREDITO_FINANCEIRO"] as const).map(tipo => ({ tipo, valor: valor(form, tipo) })).filter(i => i.valor && Number(i.valor) !== 0);
    const distribuicao = mista ? props.origens.map(o => ({ origemId: o.id, valor: valor(form, `origem-${o.id}`) })).filter(x => x.valor) : undefined;
    entrada = { matriculaId: props.matriculaId, cobrancaId: props.cobrancaId, valorDevidoAcordado: valor(form, "valorDevidoAcordado"), itens, motivo: texto(form, "motivo"), ...(distribuicao ? { distribuicao } : {}) };
   } else if (props.modo === "concordar") {
    entrada = { propostaId: props.propostaId, parte: props.parte, nomeDeclarante: texto(form, "nomeDeclarante"), meio: texto(form, "meio"), evidencia: texto(form, "evidencia") };
   } else if (props.modo === "usar") {
    entrada = { saldoId: props.saldoId, cobrancaId: texto(form, "cobrancaId"), valor: valor(form, "valor"), motivo: texto(form, "motivo") };
   } else entrada = { propostaId: props.propostaId, aprovada: form.get("decisao") === "aprovar", motivo: texto(form, "motivo") };
   tentativa.current = { chave: crypto.randomUUID(), entrada };
  }
  setTemTentativa(true);
  emEnvio.current = true;
  try {
   const { entrada, chave } = tentativa.current;
   const resposta: { podeRevisar?: boolean } = {};
   const d = await acao.executar<unknown>(async () => {
    const r = await (props.modo === "preparar" ? prepararDestinacaoExcedentePermuta({ ...entrada, chaveIdempotencia: chave } as Parameters<typeof prepararDestinacaoExcedentePermuta>[0])
     : props.modo === "concordar" ? registrarConcordanciaExcedentePermuta(entrada as Parameters<typeof registrarConcordanciaExcedentePermuta>[0])
     : props.modo === "usar" ? proporUsoSaldoServicoPermuta({ ...entrada, chaveIdempotencia: chave } as Parameters<typeof proporUsoSaldoServicoPermuta>[0])
     : props.modo === "decidir-uso" ? decidirUsoSaldoServicoPermuta(entrada as Parameters<typeof decidirUsoSaldoServicoPermuta>[0])
     : decidirDestinacaoExcedentePermuta(entrada as Parameters<typeof decidirDestinacaoExcedentePermuta>[0]));
    if (!r.ok) resposta.podeRevisar = r.podeRevisar;
    return r;
   }, "Operação registrada.");
   if (d?.tipo === "ok") { setConcluido(true); router.refresh(); }
   else if (d?.tipo === "erro" && resposta.podeRevisar) { tentativa.current = null; setTemTentativa(false); acao.setErro(d.mensagem + " Corrija os dados antes de tentar novamente."); }
   else if (d?.tipo === "erro") acao.setErro(d.mensagem + " A tentativa foi preservada; confira o histórico antes de iniciar outra operação.");
  } finally { emEnvio.current = false; }
 }}>
 <fieldset disabled={acao.ocupado || temTentativa} className="space-y-2">
 {props.modo === "preparar" && <>
  <label className="block">Obrigação acordada ({props.moeda})<input name="valorDevidoAcordado" required inputMode="decimal" className="ml-2 rounded border p-2" /></label>
  {mista && <fieldset className="space-y-1 rounded border p-2"><legend>Distribuição da redução por origem (a soma é a diferença entre o liquidado e a obrigação acordada)</legend>
   {props.origens.map(o => <label key={o.id} className="block">{ORIGEM_LABEL[o.tipo]} · {formatarMoeda(o.valor, props.moeda)}<input name={`origem-${o.id}`} inputMode="decimal" className="ml-2 rounded border p-2" /></label>)}
  </fieldset>}
  <label className="block">Saldo restrito a serviços ({props.moeda})<input name="SALDO_SERVICOS" inputMode="decimal" className="ml-2 rounded border p-2" /></label>
  <label className="block">Crédito financeiro ({props.moeda})<input name="CREDITO_FINANCEIRO" inputMode="decimal" className="ml-2 rounded border p-2" /></label>
  <p className="text-sm">Os destinos precisam somar exatamente o excedente de serviço apurado. {DICA_PONTO_DECIMAL} Nada muda até a aprovação.</p>
 </>}
 {props.modo === "concordar" && <>
  <label className="block">Nome de quem declarou<input name="nomeDeclarante" required minLength={2} maxLength={200} className="ml-2 rounded border p-2" /></label>
  <label className="block">Meio (presencial, WhatsApp, e-mail…)<input name="meio" required minLength={2} maxLength={100} className="ml-2 rounded border p-2" /></label>
  <label className="block">Evidência (texto; anexo opcional pelo prontuário)<CampoTexto name="evidencia" minLength={5} maxLength={4000} required className="block w-full rounded border p-2" /></label>
 </>}
 {props.modo === "usar" && <>
  <label className="block">Cobrança a abater<select name="cobrancaId" required defaultValue="" className="ml-2 rounded border p-2"><option value="" disabled>Escolha a cobrança</option>{props.cobrancas.map(c => <option key={c.id} value={c.id}>{c.rotulo} · vence {formatarDataCivil(c.vencimento)} · saldo {formatarMoeda(c.saldo, props.moeda)}</option>)}</select></label>
  <label className="block">Valor a abater (disponível {formatarMoeda(props.disponivel, props.moeda)})<input name="valor" required inputMode="decimal" className="ml-2 rounded border p-2" /></label>
  <p className="text-sm">{DICA_PONTO_DECIMAL}</p>
 </>}
 {props.modo !== "concordar" && <label className="block">Motivo<CampoTexto name="motivo" minLength={5} maxLength={2000} required className="block w-full rounded border p-2" /></label>}
 {(props.modo === "decidir" || props.modo === "decidir-uso") && <label className="block">Decisão<select name="decisao" required defaultValue="" className="ml-2 rounded border p-2"><option value="" disabled>Escolha a decisão</option><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label>}
 </fieldset>
 <button disabled={acao.ocupado || concluido} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="submit">{concluido ? "Registrado" : acao.ocupado ? "Processando…" : temTentativa ? "Repetir mesma tentativa" : props.modo === "preparar" ? "Propor destinação" : props.modo === "usar" ? "Propor uso do saldo" : props.modo === "concordar" ? (props.parte === "ESCOLA" ? "Registrar concordância da escola" : "Registrar concordância do aluno/responsável") : "Registrar decisão"}</button>
 <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
 </form>;
}
