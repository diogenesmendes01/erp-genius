"use client";

import { useMemo, useRef, useState } from "react";
import { FormaPagamento } from "@prisma/client";
import { formatarMoeda } from "@/lib/dinheiro";
import { FORMA_PAGAMENTO_LABEL } from "@/lib/labels";
import { registrarRecebimentoDestinado } from "@/server/financeiro/acoes";
import { UploadArquivo } from "@/components/UploadArquivo";
import { rotuloVencimento, type VencimentoVisivel } from "./vencimento";

type Contexto = { matriculaId: string; identificacaoMatricula: string; status: string; aluno: string; moeda: string; cobrancas: { id: string; codigo: string | null; tipo: string; vencimento: VencimentoVisivel; saldo: number }[]; pagadores: { id: string; rotulo: string }[] };
type Linha = { cobrancaId: string; valor: string; evidencia: string };
const input = "mt-1 block w-full rounded border border-gray-300 p-2 text-sm";
function centavos(valor: string) { const normalizado = valor.trim().replace(",", "."); if (!/^\d+(?:\.\d{1,2})?$/.test(normalizado)) return null; const [inteiro, decimal = ""] = normalizado.split("."); return Number(inteiro) * 100 + Number(decimal.padEnd(2, "0")); }

export function RecebimentoDestinadoForm({ contextos }: { contextos: Contexto[] }) {
  const [matriculaId, setMatriculaId] = useState("");
  const contexto = contextos.find((item) => item.matriculaId === matriculaId);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [credito, setCredito] = useState("");
  const [valor, setValor] = useState(""); const [pagadorId, setPagadorId] = useState("");
  const [forma, setForma] = useState<FormaPagamento>(FormaPagamento.DINHEIRO); const [data, setData] = useState("");
  const [evidenciaCredito, setEvidenciaCredito] = useState(""); const [comentario, setComentario] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState(""); const [comprovanteNome, setComprovanteNome] = useState("");
  const chave = useRef(crypto.randomUUID()); const emEnvio = useRef(false); const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState<string | null>(null); const [sucesso, setSucesso] = useState<string | null>(null); const [operacaoIncerta, setOperacaoIncerta] = useState(false);
  const totalCentavos = centavos(valor) ?? 0; const destinadoCentavos = useMemo(() => linhas.reduce((soma, linha) => soma + (centavos(linha.valor) ?? 0), 0) + (centavos(credito) ?? 0), [linhas, credito]);
  const totalDestinado = destinadoCentavos / 100; const total = totalCentavos / 100; const diferencaCentavos = totalCentavos - destinadoCentavos; const diferenca = diferencaCentavos / 100;
  const exigeComprovante = forma === FormaPagamento.TRANSFERENCIA || forma === FormaPagamento.GREENPAY;
  function selecionarContrato(id: string) { setMatriculaId(id); setLinhas([]); setCredito(""); setPagadorId(""); setComprovanteUrl(""); setComprovanteNome(""); setErro(null); setSucesso(null); setOperacaoIncerta(false); }
  function alterarLinha(index: number, campo: keyof Linha, novo: string) { setLinhas((atual) => atual.map((linha, i) => i === index ? { ...linha, [campo]: novo } : linha)); }
  function incluir(cobrancaId: string) { if (!linhas.some((linha) => linha.cobrancaId === cobrancaId)) setLinhas((atual) => [...atual, { cobrancaId, valor: "", evidencia: "" }]); }
  async function confirmar() {
    setErro(null); setSucesso(null);
    if (!contexto) return setErro("Selecione um contrato.");
    if (emEnvio.current) return;
    if (diferencaCentavos !== 0) return setErro("As destinações devem somar exatamente o recebimento.");
    if (!data) return setErro("Informe a data do pagamento.");
    if (exigeComprovante && !comprovanteUrl) return setErro(`Anexe o comprovante para ${FORMA_PAGAMENTO_LABEL[forma]}.`);
    const destinos = [
      ...linhas.map((linha) => ({ tipo: "COBRANCA" as const, cobrancaId: linha.cobrancaId, valor: centavos(linha.valor)! / 100, evidencia: linha.evidencia, chaveIdempotencia: `cobranca:${linha.cobrancaId}` })),
      ...((centavos(credito) ?? 0) > 0 ? [{ tipo: "CREDITO_SEM_DESTINO" as const, valor: centavos(credito)! / 100, evidencia: evidenciaCredito, chaveIdempotencia: "credito-sem-destino" }] : []),
    ];
    emEnvio.current = true; setOcupado(true);
    try { const r = await registrarRecebimentoDestinado({ titularMatriculaId: contexto.matriculaId, pagadorId: pagadorId || null, chaveIdempotencia: chave.current, valorRecebido: total, moeda: contexto.moeda, forma, dataPagamento: new Date(`${data}T12:00:00`).toISOString(), comentario: comentario || null, comprovanteUrl: comprovanteUrl || null, comprovanteNome: comprovanteNome || null, destinos }); if (!r.ok) { setErro(r.erro ?? "Não foi possível registrar o recebimento."); emEnvio.current = false; } else { setOperacaoIncerta(false); setSucesso("Recebimento confirmado."); } } catch { setErro("Não foi possível confirmar o recebimento. Os dados foram preservados para repetir esta mesma operação."); setOperacaoIncerta(true); emEnvio.current = false; } finally { setOcupado(false); }
  }
  function novoLancamento() { chave.current = crypto.randomUUID(); emEnvio.current = false; setMatriculaId(""); setLinhas([]); setCredito(""); setValor(""); setPagadorId(""); setForma(FormaPagamento.DINHEIRO); setData(""); setEvidenciaCredito(""); setComentario(""); setComprovanteUrl(""); setComprovanteNome(""); setErro(null); setSucesso(null); setOperacaoIncerta(false); }
  if (!contextos.length) return <p className="rounded border p-4 text-sm text-gray-600">Não há contratos disponíveis para recebimento.</p>;
  return <div className="space-y-5 rounded-lg border p-5"><fieldset disabled={ocupado || Boolean(sucesso) || operacaoIncerta} className="space-y-5"><label className="block text-sm font-medium">Contrato e moeda<select aria-label="Contrato" className={input} value={matriculaId} onChange={(event) => selecionarContrato(event.target.value)}><option value="">Selecione o contrato</option>{contextos.map((item) => <option key={item.matriculaId} value={item.matriculaId}>{item.aluno} · matrícula {item.identificacaoMatricula} · {item.moeda}{item.status === "AGUARDANDO" ? " · em preparação" : ""}</option>)}</select></label>
    {contexto?.status === "AGUARDANDO" && <p role="status" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">Matrícula em preparação: registre somente cobranças já emitidas ou uma antecipação respaldada pelo acordo e pela evidência. O recebimento não ativa o contrato.</p>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Valor recebido<input aria-label="Valor recebido" className={input} inputMode="decimal" value={valor} onChange={(event) => setValor(event.target.value)} /></label><label className="text-sm font-medium">Data do pagamento<input aria-label="Data do pagamento" required type="date" className={input} value={data} onChange={(event) => setData(event.target.value)} /></label><label className="text-sm font-medium">Forma<select aria-label="Forma" className={input} value={forma} onChange={(event) => setForma(event.target.value as FormaPagamento)}>{Object.values(FormaPagamento).map((item) => <option key={item} value={item}>{FORMA_PAGAMENTO_LABEL[item]}</option>)}</select></label><label className="text-sm font-medium">Pagador<select aria-label="Pagador" className={input} value={pagadorId} onChange={(event) => setPagadorId(event.target.value)}><option value="">Não informado</option>{contexto?.pagadores.map((item) => <option key={item.id} value={item.id}>{item.rotulo}</option>)}</select></label></div>
    <div className="rounded bg-gray-50 p-3"><h2 className="font-medium">Destinações para cobranças</h2>{contexto?.cobrancas.map((cobranca) => { const linha = linhas.find((item) => item.cobrancaId === cobranca.id); return <div key={cobranca.id} className="mt-3 border-t pt-3 text-sm"><div className="flex justify-between gap-3"><span>{cobranca.codigo ?? cobranca.tipo} · {rotuloVencimento(cobranca.vencimento)} · saldo {formatarMoeda(cobranca.saldo, contexto.moeda)}</span>{!linha && <button type="button" className="text-brand-700 underline" onClick={() => incluir(cobranca.id)}>Destinar</button>}</div>{linha && <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr_auto]"><input aria-label={`Valor da cobrança ${cobranca.codigo ?? cobranca.tipo}`} className={input} inputMode="decimal" placeholder="Valor" value={linha.valor} onChange={(event) => alterarLinha(linhas.indexOf(linha), "valor", event.target.value)} /><input aria-label={`Evidência da cobrança ${cobranca.codigo ?? cobranca.tipo}`} className={input} placeholder="Evidência da destinação" value={linha.evidencia} onChange={(event) => alterarLinha(linhas.indexOf(linha), "evidencia", event.target.value)} /><button type="button" className="mt-1 text-red-700 underline" onClick={() => setLinhas((atual) => atual.filter((item) => item.cobrancaId !== cobranca.id))}>Remover</button></div>}</div>; })}</div>
    <div className="rounded border border-amber-200 bg-amber-50 p-3"><h2 className="font-medium">Crédito sem destino</h2><p className="text-xs text-gray-600">Use apenas para a parte já recebida que ainda não pertence a uma cobrança.</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><input aria-label="Valor do crédito sem destino" className={input} inputMode="decimal" placeholder="Valor" value={credito} onChange={(event) => setCredito(event.target.value)} /><input aria-label="Evidência do crédito sem destino" className={input} placeholder="Evidência do crédito" value={evidenciaCredito} onChange={(event) => setEvidenciaCredito(event.target.value)} /></div></div>
    <p className={diferenca === 0 && total > 0 ? "text-sm text-green-700" : "text-sm text-amber-700"}>Recebimento: {formatarMoeda(total, contexto?.moeda ?? "CRC")} · Destinado: {formatarMoeda(totalDestinado, contexto?.moeda ?? "CRC")} · {diferenca === 0 && total > 0 ? "Pronto para confirmar" : `Falta destinar ${formatarMoeda(diferenca, contexto?.moeda ?? "CRC")}`}</p>
    <label className="block text-sm font-medium">Documento / comprovante{exigeComprovante && <span className="text-red-700"> *</span>}<div className="mt-1">{contexto && <UploadArquivo key={contexto.matriculaId} label="Anexar comprovante" matriculaId={contexto.matriculaId} categoriaDocumento="COMPROVANTE" onUpload={(arquivo) => { setComprovanteUrl(arquivo.url); setComprovanteNome(arquivo.nome); }} />}{comprovanteUrl && <p className="text-xs text-green-700">{comprovanteNome || "Documento anexado"}</p>}</div></label><label className="block text-sm font-medium">Observação<input aria-label="Observação" className={input} value={comentario} onChange={(event) => setComentario(event.target.value)} /></label></fieldset>
    {!sucesso && <button type="button" disabled={ocupado || !contexto || total <= 0 || diferencaCentavos !== 0} className="rounded bg-brand-solid px-3 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={confirmar}>{ocupado ? "Registrando…" : operacaoIncerta ? "Tentar novamente" : "Confirmar recebimento"}</button>}{erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}{sucesso && <><p role="status" className="text-sm text-green-700">{sucesso}</p><button type="button" className="rounded border px-3 py-2 text-sm" onClick={novoLancamento}>Novo lançamento</button></>}
  </div>;
}
