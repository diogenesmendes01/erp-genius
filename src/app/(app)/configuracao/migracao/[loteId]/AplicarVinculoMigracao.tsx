"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { aplicarVinculoMigracao } from "@/server/migracao/aplicar-vinculo";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import {
  ensaioVigenteMaisRecente,
  montarPayloadAplicarVinculo,
  validarFormularioVinculo,
  type EnsaioVinculoExibido,
  type FatoFormularioVinculo,
  type FormularioVinculo,
} from "./formulario-aplicar-vinculo";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";

type Props = {
  linhaId: string;
  entradaHash: string;
  origem: string;
  dadosOrigem: unknown;
  produtoDestino: string | null;
  turmaDestino: string | null;
  statusDestino: string | null;
  ensaios: EnsaioVinculoExibido[];
  preferenciaFusoExibicao?: string | null;
};

const formularioInicial: FormularioVinculo = {
  fusoReferencia: "", inicioAlocacao: "", fimAlocacao: "", semanticaFim: "",
  diaVencimento: "", mesesPlano: "", evidenciaContrato: "", evidenciaPagamento: "",
  motivoComplemento: "", evidenciaComplemento: "",
  fatos: [{ tipo: "ATIVACAO", data: "", evidencia: "" }],
};

export function AplicarVinculoMigracao(props: Props) {
  const router = useRouter();
  const enviando = useRef(false);
  const [ensaioId, setEnsaioId] = useState("");
  const [formulario, setFormulario] = useState<FormularioVinculo>(formularioInicial);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const ensaioPermitido = ensaioVigenteMaisRecente(props.ensaios, props.entradaHash);
  const exibicaoEnsaio = ensaioPermitido ? formatarInstanteExibicao(ensaioPermitido.criadoEm, props.preferenciaFusoExibicao, "UTC") : null;
  const ensaio = ensaioPermitido?.id === ensaioId ? ensaioPermitido : null;
  const destinosCompletos = !!props.produtoDestino && !!props.turmaDestino && !!props.statusDestino;

  function atualizar<K extends keyof FormularioVinculo>(campo: K, valor: FormularioVinculo[K]) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }
  function atualizarFato(indice: number, alteracao: Partial<FatoFormularioVinculo>) {
    atualizar("fatos", formulario.fatos.map((fato, atual) => atual === indice ? { ...fato, ...alteracao } : fato));
  }
  async function aplicar() {
    if (enviando.current || !ensaio || !destinosCompletos) return;
    const erros = validarFormularioVinculo(formulario, props.dadosOrigem, props.statusDestino);
    if (erros.length) { setSucesso(null); setErro(erros[0]); return; }
    enviando.current = true;
    setOcupado(true); setErro(null); setSucesso(null);
    try {
      const resposta = await aplicarVinculoMigracao(montarPayloadAplicarVinculo({
        linhaId: props.linhaId, entradaHash: props.entradaHash, ensaio, formulario,
      }));
      if (!resposta.ok || !resposta.dado) {
        setErro(resposta.ok ? "A aplicação não retornou confirmação." : resposta.erro);
        return;
      }
      setSucesso(resposta.dado.repetida ? "Esta aplicação já havia sido registrada." : "Aplicação do vínculo concluída.");
      router.refresh();
    } catch {
      setErro("Não foi possível aplicar o vínculo.");
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }

  return <section className="mt-3 space-y-3 rounded border border-green-200 bg-green-50 p-3 text-xs">
    <div><strong>Aplicar vínculo migrado</strong><p>Usa o ensaio vigente da fotografia conferida; não gera cobrança, pagamento ou aceite.</p></div>
    <details><summary>Fonte e destino conferidos</summary><pre className="mt-2 overflow-auto rounded bg-surface p-2">{JSON.stringify(props.dadosOrigem, null, 2)}</pre><p>Origem: {props.origem} · Produto: {props.produtoDestino ?? "ausente"} · Turma: {props.turmaDestino ?? "ausente"} · Situação: {props.statusDestino ?? "ausente"}</p></details>
    <label>Ensaio vigente pronto<select className="ml-2 rounded border p-1" value={ensaioId} onChange={(event) => setEnsaioId(event.target.value)}><option value="">Selecione</option>{ensaioPermitido && exibicaoEnsaio && <option value={ensaioPermitido.id}>{exibicaoEnsaio.texto} (horário exibido em {exibicaoEnsaio.fuso}; origem UTC) · {ensaioPermitido.ensaiadoPor.nome}</option>}</select></label>
    {!ensaioPermitido && <p className="text-amber-800">Nenhum ensaio vigente pronto para esta fotografia.</p>}
    {!destinosCompletos && <p className="text-amber-800">Revise as correspondências de produto, turma e situação antes de aplicar.</p>}
    <div className="grid gap-2 sm:grid-cols-2">
      <label>Fuso IANA<input aria-label="Fuso IANA" className="block rounded border p-1" placeholder="America/Costa_Rica" value={formulario.fusoReferencia} onChange={(event) => atualizar("fusoReferencia", event.target.value)} /></label>
      <label>Início da vigência<input aria-label="Início da vigência" type="date" className="block rounded border p-1" value={formulario.inicioAlocacao} onChange={(event) => atualizar("inicioAlocacao", event.target.value)} /></label>
      <label>Fim da vigência<input aria-label="Fim da vigência" type="date" className="block rounded border p-1" value={formulario.fimAlocacao} onChange={(event) => atualizar("fimAlocacao", event.target.value)} /></label>
      <label>Semântica do fim<select aria-label="Semântica do fim" className="block rounded border p-1" value={formulario.semanticaFim} onChange={(event) => atualizar("semanticaFim", event.target.value as FormularioVinculo["semanticaFim"])}><option value="">Selecione</option><option value="LIMITE_EXCLUSIVO">Limite exclusivo</option><option value="ULTIMO_DIA_COBERTO">Último dia coberto</option></select></label>
      <label>Dia de vencimento<input aria-label="Dia de vencimento" type="number" min="1" max="31" className="block rounded border p-1" value={formulario.diaVencimento} onChange={(event) => atualizar("diaVencimento", event.target.value)} /></label>
      <label>Meses do plano<input aria-label="Meses do plano" type="number" min="1" className="block rounded border p-1" value={formulario.mesesPlano} onChange={(event) => atualizar("mesesPlano", event.target.value)} /></label>
      <label>Evidência do contrato<input aria-label="Evidência do contrato" className="block rounded border p-1" value={formulario.evidenciaContrato} onChange={(event) => atualizar("evidenciaContrato", event.target.value)} /></label>
      <label>Evidência do pagamento<input aria-label="Evidência do pagamento" className="block rounded border p-1" value={formulario.evidenciaPagamento} onChange={(event) => atualizar("evidenciaPagamento", event.target.value)} /></label>
      <label>Motivo do complemento de vigência<input aria-label="Motivo do complemento de vigência" className="block rounded border p-1" value={formulario.motivoComplemento} onChange={(event) => atualizar("motivoComplemento", event.target.value)} /></label>
      <label>Evidência do complemento de vigência<input aria-label="Evidência do complemento de vigência" className="block rounded border p-1" value={formulario.evidenciaComplemento} onChange={(event) => atualizar("evidenciaComplemento", event.target.value)} /></label>
    </div>
    <fieldset className="rounded border bg-surface p-2"><legend>Fatos históricos explícitos</legend>{formulario.fatos.map((fato, indice) => <div key={indice} className="mt-2 flex gap-2"><label>Tipo do fato<select aria-label={`Tipo do fato ${indice + 1}`} value={fato.tipo} onChange={(event) => atualizarFato(indice, { tipo: event.target.value as FatoFormularioVinculo["tipo"] })}>{["ATIVACAO", "PAUSA", "ENCERRAMENTO", "CANCELAMENTO"].map((tipo) => <option key={tipo}>{tipo}</option>)}</select></label><label>Data do fato<input aria-label={`Data do fato ${indice + 1}`} type="date" value={fato.data} onChange={(event) => atualizarFato(indice, { data: event.target.value })} /></label><label>Evidência do fato<input aria-label={`Evidência do fato ${indice + 1}`} value={fato.evidencia} onChange={(event) => atualizarFato(indice, { evidencia: event.target.value })} /></label>{formulario.fatos.length > 1 && <button className={botaoClasses({ variante: "secundario" })} type="button" onClick={() => atualizar("fatos", formulario.fatos.filter((_, atual) => atual !== indice))}>Remover</button>}</div>)}<button type="button" className={`${botaoClasses({ variante: "secundario", tamanho: "sm" })} mt-2`} onClick={() => atualizar("fatos", [...formulario.fatos, { tipo: "PAUSA", data: "", evidencia: "" }])}>Adicionar fato</button></fieldset>
    <button type="button" disabled={ocupado || !ensaio || !destinosCompletos} className={botaoClasses({ tamanho: "sm" })} onClick={aplicar}>{ocupado ? "Aplicando…" : "Aplicar vínculo conferido"}</button>
    {erro && <p role="alert">{erro}</p>}
    <MensagemStatus texto={sucesso} />
  </section>;
}
