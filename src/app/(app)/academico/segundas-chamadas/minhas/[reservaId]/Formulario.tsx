"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { realizarSegundaChamadaLocal } from "@/server/avaliacoes/segunda-chamada-docente-local";
import { salvarNotaOriginalSegundaChamada } from "@/server/avaliacoes/segunda-chamada-realizacao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { CampoFuso } from "@/components/CampoFuso";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";

type Habilidade = "FALA" | "COMPREENSAO_ORAL" | "LEITURA" | "ESCRITA";
const nomes: Record<Habilidade, string> = { FALA: "Fala", COMPREENSAO_ORAL: "Compreensão oral", LEITURA: "Leitura", ESCRITA: "Escrita" };

export function FormularioRealizacao({ reservaId, fusoInstitucional }: { reservaId: string; fusoInstitucional: string | null }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");

  return <form className="space-y-3 rounded border p-4" onSubmit={async evento => {
    evento.preventDefault();
    if (ocupado) return;
    const dados = new FormData(evento.currentTarget);
    setOcupado(true);
    setMensagem("");
    try {
      const resultado = await realizarSegundaChamadaLocal({ reservaId, dataHora: String(dados.get("dataHora") ?? ""), fuso: String(dados.get("fuso") ?? ""), evidencia: String(dados.get("evidencia") ?? "") });
      if (resultado.ok) router.refresh(); else setMensagem(resultado.erro);
    } catch {
      setMensagem(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    } finally {
      setOcupado(false);
    }
  }}>
    <h2 className="text-xl font-medium">Registrar realização</h2>
    <fieldset disabled={ocupado} className="space-y-3">
      <label className="block" htmlFor="data-hora">Data e horário da realização<input id="data-hora" name="dataHora" type="datetime-local" step="0.001" required className="block rounded border p-2" /></label>
      <label className="block" htmlFor="fuso">Fuso da realização<CampoFuso id="fuso" padrao={fusoInstitucional ?? ""} className="block rounded border p-2" /></label>
      <p>Informe o fuso explicitamente. A data efetiva deve pertencer ao encontro; histórico e autorização aplicável são conferidos ao enviar. Horários ambíguos ou inexistentes precisam de correção.</p>
      <label className="block" htmlFor="evidencia">Evidência da realização<CampoTexto id="evidencia" name="evidencia" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label>
      <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar realização"}</button>
    </fieldset>
    {mensagem && <p role="alert">{mensagem}</p>}
  </form>;
}

export function FormularioNota({ realizacaoId, alocacaoId, codigoAvaliacao, realizadaEm, escala, habilidades, versaoEsperada, regularizacao, preferenciaFusoExibicao = null }: { realizacaoId: string; alocacaoId: string; codigoAvaliacao: string; realizadaEm: string; escala: { minimo: string; maximo: string }; habilidades: string[]; versaoEsperada: number; regularizacao: boolean; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  const habilidadesValidas = habilidades as Habilidade[];
  const dataDoFato = formatarInstanteExibicao(realizadaEm, preferenciaFusoExibicao, "UTC");

  return <form className="space-y-3 rounded border p-4" onSubmit={async evento => {
    evento.preventDefault();
    if (ocupado) return;
    const dados = new FormData(evento.currentTarget);
    const notas = habilidadesValidas.map(habilidade => ({ habilidade, nota: String(dados.get(`nota-${habilidade}`) ?? "").trim().replace(",", ".") || null, comentarioAluno: String(dados.get(`comentario-${habilidade}`) ?? "") }));
    const motivoRegularizacao = String(dados.get("motivoRegularizacao") ?? ""), evidenciasRegularizacao = String(dados.get("evidenciasRegularizacao") ?? "");
    const entrada = JSON.stringify({ realizacaoId, alocacaoId, codigoAvaliacao, realizadaEm, notas, versaoEsperada, regularizacao, motivoRegularizacao, evidenciasRegularizacao });
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current!.chave;
    setOcupado(true);
    setMensagem("");
    try {
      const resultado = await salvarNotaOriginalSegundaChamada({ realizacaoId, lancamento: { alocacaoId, codigoAvaliacao, realizadaEm, notas, submetida: true, versaoEsperada, chaveIdempotencia, ...(regularizacao ? { motivoRegularizacao, evidenciasRegularizacao } : {}) } });
      if (resultado.ok) router.refresh(); else setMensagem(resultado.erro);
    } catch {
      setMensagem(MSG_RESULTADO_INCERTO);
    } finally {
      setOcupado(false);
    }
  }}>
    <h2 className="text-xl font-medium">Submeter nota original</h2>
    <p>Data do fato: {dataDoFato.texto} ({dataDoFato.fuso}; origem UTC), preservada da realização. Escala: {escala.minimo} a {escala.maximo}.</p>
    <fieldset disabled={ocupado} className="space-y-3">
      {regularizacao && <><p>Você está regularizando a nota de uma realização registrada por outro professor. Informe a justificativa e as evidências da conferência.</p><label className="block" htmlFor="motivo-regularizacao">Motivo da regularização<CampoTexto id="motivo-regularizacao" name="motivoRegularizacao" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label><label className="block" htmlFor="evidencias-regularizacao">Evidências da regularização<CampoTexto id="evidencias-regularizacao" name="evidenciasRegularizacao" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" /></label></>}
      {habilidadesValidas.map(habilidade => <div key={habilidade} className="space-y-2 rounded border p-3"><label className="block" htmlFor={`nota-${habilidade}`}>Nota de {nomes[habilidade]}<input id={`nota-${habilidade}`} name={`nota-${habilidade}`} inputMode="decimal" required className="block rounded border p-2" /></label><label className="block" htmlFor={`comentario-${habilidade}`}>Comentário para o aluno<CampoTexto id={`comentario-${habilidade}`} name={`comentario-${habilidade}`} maxLength={2000} className="block w-full rounded border p-2" /></label></div>)}
      <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Submetendo…" : "Submeter nota para conferência"}</button>
    </fieldset>
    {mensagem && <p role="alert">{mensagem}</p>}
  </form>;
}
