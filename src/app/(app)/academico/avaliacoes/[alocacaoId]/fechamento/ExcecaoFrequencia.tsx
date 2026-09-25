"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirExcecaoFrequencia, proporExcecaoFrequencia } from "@/server/avaliacoes/excecao-frequencia";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";

type PropostaExcecao = {
  id: string;
  versao: number;
  autorId: string;
  fonteHash: string;
  motivo: string;
  evidencias: string;
  decisao: { id: string; aprovada: boolean; decisorId: string; motivo: string } | null;
};

type Frequencia = {
  atendeMinimo: boolean | null;
  fonteHash: string;
  pendencias: unknown[];
  pendenciasHistoricas: unknown[];
};

export function ExcecaoFrequencia({
  alocacaoId,
  usuarioId,
  frequencia,
  proposta,
}: {
  alocacaoId: string;
  usuarioId: string;
  frequencia: Frequencia;
  proposta: PropostaExcecao | null;
}) {
  const router = useRouter();
  const chave = useRef<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const frequenciaAbaixo = frequencia.atendeMinimo === false;
  const temPendencias = frequencia.pendencias.length > 0 || frequencia.pendenciasHistoricas.length > 0;
  const propostaObsoleta = !!proposta && proposta.fonteHash !== frequencia.fonteHash;
  const podePropor = frequenciaAbaixo && !temPendencias && (!proposta || propostaObsoleta || proposta.decisao?.aprovada === false);
  const podeDecidir = !!proposta && !proposta.decisao && proposta.autorId !== usuarioId;

  function propor(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);
    if (!chave.current) chave.current = crypto.randomUUID();
    setErro(""); setMensagem("");
    iniciar(async () => {
      try {
        const resposta = await proporExcecaoFrequencia({
          alocacaoId,
          fonteHash: frequencia.fonteHash,
          versaoEsperada: proposta?.versao ?? 0,
          motivo: String(dados.get("motivo") ?? ""),
          evidencias: String(dados.get("evidencias") ?? ""),
          chaveIdempotencia: chave.current!,
        });
        if (!resposta.ok) {
          setErro(resposta.erro);
          return;
        }
        chave.current = null;
        formulario.reset();
        setMensagem("Proposta registrada para decisão independente. A frequência real e as notas não foram alteradas.");
        router.refresh();
      } catch {
        setErro(MSG_RESULTADO_INCERTO);
      }
    });
  }

  function decidir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!proposta) return;
    const dados = new FormData(evento.currentTarget);
    setErro(""); setMensagem("");
    iniciar(async () => {
      try {
        const resposta = await decidirExcecaoFrequencia({
          propostaId: proposta.id,
          fonteHash: proposta.fonteHash,
          aprovada: dados.get("decisao") === "APROVAR",
          motivo: String(dados.get("motivoDecisao") ?? ""),
        });
        if (!resposta.ok) {
          setErro(resposta.erro);
          return;
        }
        setMensagem("Decisão registrada. Atualizando a revisão para conferir os efeitos atuais.");
        router.refresh();
      } catch {
        setErro(MSG_DECISAO_INCERTA);
      }
    });
  }

  if (frequencia.atendeMinimo !== false && !proposta) return null;

  return <section className="space-y-3 rounded border p-4" aria-label="Exceção específica de frequência">
    <h2 className="text-lg font-medium">Exceção específica de frequência</h2>
    <p className="text-sm text-gray-700">A exceção preserva a frequência real e seus registros. Ela não cria presenças, não muda faltas e não concede nem substitui notas.</p>

    {!frequenciaAbaixo && proposta?.decisao?.aprovada && <p role="status">A frequência atual já não está abaixo do mínimo. A autorização permanece no histórico, mas a revisão usa o estado atual.</p>}
    {frequenciaAbaixo && temPendencias && <p role="status" className="text-amber-700">Há chamadas ou registros históricos de frequência a conferir. Regularize-os antes de propor uma exceção.</p>}

    {proposta && <section className="space-y-1 rounded border bg-gray-50 p-3 text-sm">
      <h3 className="font-medium">Proposta registrada · versão {proposta.versao}</h3>
      <p>Motivo: {proposta.motivo}</p>
      <p>Evidências: {proposta.evidencias}</p>
      <MensagemStatus texto={propostaObsoleta ? "A frequência ou o contexto conferido mudou desde esta proposta. Esta autorização histórica não se aplica à revisão atual; uma nova proposta usa a fonte atual." : null} className="text-amber-700" />
      {!proposta.decisao && (proposta.autorId === usuarioId
        ? <p role="status">Aguarda decisão de outra pessoa autorizada. Quem propôs não pode decidir.</p>
        : <p role="status">Aguarda decisão independente.</p>)}
      {proposta.decisao && <p role="status">{proposta.decisao.aprovada ? propostaObsoleta ? "Autorização histórica, sem efeito na revisão atual" : "Autorização aprovada" : "Proposta rejeitada"}: {proposta.decisao.motivo}</p>}
    </section>}

    {podePropor && <form className="space-y-3" onSubmit={propor}>
      <h3 className="font-medium">Encaminhar para decisão independente</h3>
      <p className="text-sm">Use somente quando a frequência real está abaixo do mínimo e não há chamada ou histórico pendente.</p>
      <label className="block text-sm">Motivo da proposta
        <CampoTexto name="motivo" required minLength={5} maxLength={3000} disabled={ocupado} className="mt-1 block min-h-24 w-full rounded border p-2" />
      </label>
      <label className="block text-sm">Evidências
        <CampoTexto name="evidencias" required minLength={5} maxLength={4000} disabled={ocupado} className="mt-1 block min-h-24 w-full rounded border p-2" />
      </label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required disabled={ocupado} />
        <span>Reconheço que a proposta não altera a frequência real nem dispensa os mínimos de nota.</span>
      </label>
      <button type="submit" disabled={ocupado} className={botaoClasses({ tamanho: "lg" })}>{ocupado ? "Registrando…" : proposta ? "Registrar nova proposta" : "Registrar proposta"}</button>
    </form>}

    {podeDecidir && proposta && <form className="space-y-3" onSubmit={decidir}>
      <h3 className="font-medium">Registrar decisão independente</h3>
      <p className="text-sm">A ação confere novamente a autoria, a frequência e o contexto acadêmico antes de decidir. {propostaObsoleta ? "Como a fonte mudou, esta proposta só pode ser rejeitada; a aprovação exige uma nova proposta." : ""}</p>
      <label className="block text-sm">Decisão
        <select name="decisao" required defaultValue="" disabled={ocupado} className="mt-1 block rounded border p-2">
          <option value="" disabled>Selecione</option>
          <option value="APROVAR" disabled={propostaObsoleta}>Autorizar exceção de frequência</option>
          <option value="REJEITAR">Rejeitar proposta</option>
        </select>
      </label>
      <label className="block text-sm">Motivo da decisão
        <CampoTexto name="motivoDecisao" required minLength={5} maxLength={3000} disabled={ocupado} className="mt-1 block min-h-24 w-full rounded border p-2" />
      </label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required disabled={ocupado} />
        <span>Conferi a frequência real, as evidências e a independência desta decisão.</span>
      </label>
      <button type="submit" disabled={ocupado} className={botaoClasses({ tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar decisão"}</button>
    </form>}

    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    <MensagemStatus texto={mensagem} className="text-sm" />
  </section>;
}
