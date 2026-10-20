"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { proporLiberacaoHorasRemarcacao, decidirLiberacaoHorasRemarcacao } from "@/server/matricula/liberacao-horas";
import { useOperacao } from "./useOperacao";
import { formatarMoeda } from "@/lib/dinheiro";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { parcelasDiferenca, ROTULO_DESCONTO_CREDITO, ROTULO_REDUCAO_CREDITO, type DiferencaValorCompra } from "@/server/matricula/compra-horas-diferenca";
/** Parcelas da diferença gravada na compra (Q172): desconto de emissão e redução por aditivo. */
type DiferencaCompra = Pick<DiferencaValorCompra, "desconto" | "reducaoAditivo">;
const estilo = "rounded border p-2 text-sm";
/** Moeda registrada na memória de cálculo do crédito (texto vazio se ausente: número formatado sem símbolo). */
const moedaDoCalculo = (calculo: unknown) => {
  const moeda = (calculo as { moeda?: unknown } | null)?.moeda;
  return typeof moeda === "string" ? moeda : "";
};
type Proposta = { id: string; destino: "REMARCACAO" | "CREDITO"; valorCredito: string | null; calculoCredito: unknown; motivo: string; evidenciaEscolhaRemarcacao: string; podeDecidir: boolean; decisao: { aprovada: boolean; motivo: string; credito: { id: string; valorInicial: string; moeda: string } | null } | null };
export function LiberacaoHoras({ alunoId, reservaId, propostas, diferencaCompra, aoSalvar }: { alunoId: string; reservaId: string; propostas: Proposta[]; diferencaCompra: DiferencaCompra; aoSalvar: () => Promise<void> }) {
  const [erro, setErro] = useState(""); const [ocupado, iniciar] = useOperacao(); const chave = useRef("");
  async function executar(operacao: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro("");
    try { const r = await operacao(); if (!r.ok) { setErro(r.erro ?? "Operação não aplicada."); return; } chave.current = ""; await aoSalvar(); }
    catch { setErro(MSG_RESULTADO_INCERTO); }
  }
  return <div className="space-y-2">
    <p>Registre a escolha do aluno entre remarcação e crédito do valor pago. Outra pessoa aprova. Crédito retira essas horas da disponibilidade, preserva o recebimento e não significa devolução de dinheiro.</p>
    {erro && <p role="alert">{erro}</p>}
    {!propostas.some(p => !p.decisao || p.decisao.aprovada) && <form onChange={() => { chave.current = ""; }} onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget); chave.current ||= crypto.randomUUID(); const chaveIdempotencia = chave.current;
      void iniciar(() => executar(() => proporLiberacaoHorasRemarcacao({ reservaId, evidenciaEscolhaRemarcacao: String(f.get("escolha")), motivo: String(f.get("motivo")), chaveIdempotencia, destino: f.get("destino") === "CREDITO" ? "CREDITO" : "REMARCACAO" })));
    }}><fieldset disabled={ocupado} className="space-y-2"><legend>Tratamento escolhido pelo aluno</legend>
      <label className="grid gap-1">Escolha<select name="destino" required defaultValue="" className={estilo}><option value="" disabled>Selecione</option><option value="REMARCACAO">Liberar horas para remarcação</option><option value="CREDITO">Converter horas em crédito do valor pago</option></select></label>
      <label className="grid gap-1">Evidência da escolha do aluno<CampoTexto name="escolha" required minLength={5} maxLength={2000} className={estilo} /></label>
      <label className="grid gap-1">Motivo financeiro<CampoTexto name="motivo" required minLength={5} maxLength={2000} className={estilo} /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Preparar proposta para conferência</button>
    </fieldset></form>}
    {propostas.map(p => <article key={p.id} className="space-y-2 border p-2">
      <p>Destino: {p.destino === "CREDITO" ? "Crédito financeiro" : "Remarcação"}</p>
      <p>{p.evidenciaEscolhaRemarcacao}</p><p>{p.motivo}</p><p>{p.decisao ? p.decisao.aprovada ? p.destino === "CREDITO" ? "Horas convertidas em crédito" : "Horas liberadas" : "Proposta rejeitada" : "Aguardando decisão financeira independente"}</p>
      {p.destino === "CREDITO" && <><p>Valor proposto: {p.valorCredito != null ? formatarMoeda(p.valorCredito, moedaDoCalculo(p.calculoCredito)) : "—"}. Usa o valor pago original e a proporção dos minutos, com arredondamento acumulado da compra.</p><MemoriaCredito calculo={p.calculoCredito} diferencaCompra={diferencaCompra} /></>}
      {p.decisao?.credito && <p>Crédito original apurado: {formatarMoeda(p.decisao.credito.valorInicial, p.decisao.credito.moeda)}. <Link className="underline" href={`/alunos/${alunoId}/creditos/${p.decisao.credito.id}`}>Consultar saldo e utilização do crédito</Link>. Devolução ainda não disponível.</p>}
      {p.decisao && <p>{p.decisao.motivo}</p>}
      {p.podeDecidir && <form onSubmit={e => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        void iniciar(() => executar(() => decidirLiberacaoHorasRemarcacao({ propostaId: p.id, aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")) })));
      }}><fieldset disabled={ocupado} className="space-y-2">
        <label className="grid gap-1">Decisão<select name="decisao" required defaultValue="" className={estilo}><option value="" disabled>Selecione</option><option value="aprovar">{p.destino === "CREDITO" ? "Aprovar conversão em crédito" : "Aprovar liberação para remarcação"}</option><option value="rejeitar">Rejeitar proposta</option></select></label>
        <label className="grid gap-1">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={2000} className={estilo} /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Confirmar decisão</button>
      </fieldset></form>}
    </article>)}
  </div>;
}

/** Q172: `descontoOriginal` do cálculo gravado é exibido nas parcelas da compra (desconto de emissão e redução por aditivo). */
export function MemoriaCredito({ calculo, diferencaCompra }: { calculo: unknown; diferencaCompra: DiferencaCompra }) {
  if (!calculo || typeof calculo !== "object" || Array.isArray(calculo)) return <p>Memória de cálculo indisponível; confira a proposta.</p>;
  const valores = calculo as Record<string, unknown>, parcelas = parcelasDiferenca(diferencaCompra);
  const linha = (campo: string, rotulo: string): [string, string, unknown] => [campo, rotulo, valores[campo]];
  const campos: [string, string, unknown][] = [linha("moeda", "Moeda"), linha("valorPagoOriginal", "Valor pago na compra"),
    // Sem redução por aditivo, o desconto exibido segue o valor gravado no cálculo, como antes da Q172.
    ...(parcelas.desconto ? [parcelas.reducao ? ["descontoOriginal", ROTULO_DESCONTO_CREDITO, diferencaCompra.desconto] as [string, string, unknown] : linha("descontoOriginal", ROTULO_DESCONTO_CREDITO)] : []),
    ...(parcelas.reducao ? [["reducaoAditivo", ROTULO_REDUCAO_CREDITO, diferencaCompra.reducaoAditivo] as [string, string, unknown]] : []),
    linha("minutosComprados", "Minutos comprados"), linha("minutosConvertidos", "Minutos desta conversão"), linha("minutosAnteriores", "Minutos convertidos anteriormente"),
    linha("valorAnterior", "Créditos anteriores da compra"), linha("valorAcumulado", "Valor acumulado após esta conversão"), linha("valorCredito", "Crédito desta proposta")];
  return <details><summary>Memória de cálculo</summary><dl className="space-y-1 text-sm">{campos.map(([campo, rotulo, valor]) => <div key={campo}><dt className="font-medium">{rotulo}</dt><dd>{String(valor ?? "Não informado")}</dd></div>)}</dl></details>;
}
