"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consultarOcorrenciasParticular, registrarOcorrenciaParticular } from "@/server/matricula/ocorrencia-particular";
import { instanteDaGrade } from "@/server/agenda/grade";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarOcorrenciasParticular>>, { ok: true }>["dado"]>;
const nomes: Record<string, string> = { REALIZADA: "Aula realizada", FALTA_ALUNO: "Aluno faltou", CANCELAMENTO_ALUNO: "Cancelada pelo aluno", CANCELAMENTO_ESCOLA: "Cancelada pela escola" };
export function OcorrenciaParticular({ dados, fusoExibicao }: { dados: Dados; fusoExibicao: string }) {
  const router = useRouter(), [ocupado, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const chave = useRef({ entrada: "", valor: "" });
  const formato = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fusoExibicao });
  return <section className="space-y-3 rounded border p-4">
    <h2 className="text-lg font-medium">Ocorrência da particular</h2>
    <p>Informe o que aconteceu. O Financeiro fará a conferência; este registro não substitui a chamada nem conclui o diário.</p>
    {(dados.podeInformarAula || dados.podeInformarCancelamento) ? <form className="space-y-3" onSubmit={event => {
      event.preventDefault(); const f = new FormData(event.currentTarget);
      iniciar(async () => {
        setMensagem("");
        try {
          const tipo = String(f.get("tipo")) as Parameters<typeof registrarOcorrenciaParticular>[0]["tipo"];
          const comunicadoEm = dados.podeInformarCancelamento ? instanteDaGrade(String(f.get("data")), String(f.get("hora")), dados.fuso).toISOString() : undefined;
          const entrada = { encontroId: dados.encontroId, versaoAnterior: dados.versaoAtual, tipo, comunicadoEm, evidencia: String(f.get("evidencia")) };
          const serializada = JSON.stringify(entrada);
          if (chave.current.entrada !== serializada) chave.current = { entrada: serializada, valor: crypto.randomUUID() };
          const r = await registrarOcorrenciaParticular({ ...entrada, chaveIdempotencia: chave.current.valor });
          if (!r.ok) { setMensagem(r.erro); return; }
          setMensagem("Informe registrado. A conferência financeira permanece separada."); router.refresh();
        } catch (erro) { setMensagem(erro instanceof Error ? erro.message : MSG_RESULTADO_INCERTO); }
      });
    }}>
      <label className="block">Ocorrência<select name="tipo" required disabled={ocupado} className="ml-2 rounded border p-2">
        {(dados.podeInformarCancelamento ? [dados.origemCancelamento === "ALUNO" ? "CANCELAMENTO_ALUNO" : "CANCELAMENTO_ESCOLA"] : ["REALIZADA", "FALTA_ALUNO"]).map(t => <option key={t} value={t}>{nomes[t]}</option>)}
      </select></label>
      {dados.podeInformarCancelamento && <fieldset className="space-y-2"><legend>Quando o cancelamento foi comunicado? Horário de {dados.fuso}</legend>
        <label className="block">Data<input type="date" name="data" required disabled={ocupado} className="ml-2 rounded border p-2" /></label>
        <label className="block">Hora<input type="time" name="hora" required disabled={ocupado} className="ml-2 rounded border p-2" /></label>
      </fieldset>}
      <label className="block">Evidência ou motivo da atualização<CampoTexto name="evidencia" required minLength={5} maxLength={2000} disabled={ocupado} className="block w-full rounded border p-2" /></label>
      <button type="submit" disabled={ocupado} className={botaoClasses({ tamanho: "lg" })}>{ocupado ? "Registrando…" : dados.versaoAtual ? "Registrar nova versão" : "Registrar ocorrência"}</button>
    </form> : <p>{dados.conferidaFinanceiramente ? "Informe conferido pelo Financeiro. Alterações exigem revisão dos efeitos financeiros." : "O informe fica disponível após o término da aula ou a aprovação do cancelamento."}</p>}
    <MensagemStatus texto={mensagem} />
    <h3 className="font-medium">Histórico de informes</h3>
    {!dados.historico.length && <p>Nenhum informe registrado.</p>}
    {dados.historico.map(o => <article key={o.id} className="rounded border p-3">
      <p>Versão {o.versao} · {nomes[o.tipo] ?? o.tipo} · {o.autor.nome}</p>
      <p>Registrado em {formato.format(new Date(o.criadoEm))} (exibido em {fusoExibicao}; origem {dados.fuso}).</p>
      {o.comunicadoEm && <p>Comunicação em {formato.format(new Date(o.comunicadoEm))}.</p>}
      <p className="whitespace-pre-wrap">{o.evidencia}</p>
    </article>)}
  </section>;
}
