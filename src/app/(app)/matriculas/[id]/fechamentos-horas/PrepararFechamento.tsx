"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { consultarFechamentosHoras } from "@/server/matricula/fechamento-horas-consulta";
import { prepararFechamentoHoras } from "@/server/matricula/fechamento-horas-rascunho";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoFuso } from "@/components/CampoFuso";

/** `fusoInicial`: fuso da escola ou da preferência (fusoInicialDeEntrada); "" deixa o campo vazio e obrigatório. */
export function PrepararFechamento({ alunoId, matriculaId, fusoInicial = "" }: { alunoId: string; matriculaId: string; fusoInicial?: string }) {
  // A conferência é leitura e o rascunho leva chave de idempotência estável: na falha de transporte, reenviar sem alterar confere a mesma operação.
  const router = useRouter(), acao = useAcaoCliente({ idempotente: true });
  const [referencia, setReferencia] = useState(""), [preparado, setPreparado] = useState<Parameters<typeof prepararFechamentoHoras>[0] | null>(null);
  const chave = useRef<{ entrada: string; valor: string } | null>(null);
  const classe = "block w-full rounded border p-2";
  return <form className="space-y-3 rounded border p-4" onChange={() => setPreparado(null)} onSubmit={async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    if (preparado) {
      // Resposta sem o rascunho salvo é falha, não sucesso: a tela volta à conferência.
      const salvo = await acao.executar(async () => {
        const r = await prepararFechamentoHoras(preparado);
        return r.ok && !r.dado ? { ok: false as const, erro: "Resultado indisponível." } : r;
      }, "Rascunho salvo; nenhuma cobrança emitida.");
      if (salvo?.tipo === "erro") setPreparado(null);
      if (salvo?.tipo === "ok" && salvo.dado) {
        router.push(`/matriculas/${matriculaId}/fechamentos-horas?aluno=${encodeURIComponent(alunoId)}&versao=${encodeURIComponent(salvo.dado.id)}`);
        router.refresh(); setPreparado(null);
      }
      return;
    }
    const periodo = { referencia: referencia === "MES_CIVIL" ? { referencia: "MES_CIVIL" as const } : { referencia: "CICLO_MATRICULA" as const, dataReferencia: String(f.get("ancora")) },
      dataNoPeriodo: String(f.get("data")), fuso: String(f.get("fuso")), vencimento: String(f.get("vencimento")), clausula: String(f.get("clausula")) };
    // A conferência devolve o período calculado; o texto dele é o "sucesso" desta etapa (ainda nada foi salvo).
    const consulta = await acao.executar(async () => {
      const r = await consultarFechamentosHoras({ alunoId, matriculaId, periodo });
      return r.ok && (!r.dado?.preparacao || !r.dado.matricula.contratoDocumentoId) ? { ok: false as const, erro: "Contrato ou referência indisponível para preparação." } : r;
    }, dado => dado?.preparacao ? `Período de ${formatarDataCivil(dado.preparacao.periodo.inicio)} a ${formatarDataCivil(dado.preparacao.periodo.fim)}, em ${dado.preparacao.periodo.fuso}. Vencimento: ${formatarDataCivil(dado.preparacao.periodo.vencimento)}. Será criada a versão ${dado.preparacao.versaoAnterior + 1}. Confira antes de salvar.` : null);
    if (consulta?.tipo !== "ok" || !consulta.dado?.preparacao || !consulta.dado.matricula.contratoDocumentoId) return;
    const contexto = consulta.dado.preparacao;
    const entrada = { alunoId, matriculaId, documentoId: consulta.dado.matricula.contratoDocumentoId, periodo,
      versaoAnterior: contexto.versaoAnterior, motivo: String(f.get("motivo")), escolha: f.get("escolha") === "PROPOR_PARCIAL" ? "PROPOR_PARCIAL" as const : "AGUARDAR" as const };
    const serializada = JSON.stringify(entrada);
    if (chave.current?.entrada !== serializada) chave.current = { entrada: serializada, valor: crypto.randomUUID() };
    setPreparado({ ...entrada, chaveIdempotencia: chave.current.valor });
  }}>
    <fieldset disabled={acao.ocupado} className="space-y-3"><legend className="font-medium">Preparar apuração mensal</legend>
      <label className="block">Referência contratual<select className={classe} required value={referencia} onChange={e => setReferencia(e.target.value)}><option value="">Selecione</option><option value="MES_CIVIL">Mês civil</option><option value="CICLO_MATRICULA">Ciclo da matrícula</option></select></label>
      {referencia === "CICLO_MATRICULA" && <label className="block">Data de referência do ciclo<input className={classe} type="date" name="ancora" required /></label>}
      <label className="block">Uma data dentro do período a apurar<input className={classe} type="date" name="data" required /></label>
      <label className="block">Fuso do período<CampoFuso padrao={fusoInicial} className={classe} /></label>
      <label className="block">Vencimento contratado<input className={classe} type="date" name="vencimento" required /></label>
      <label className="block">Cláusula e condições do período<CampoTexto className={classe} name="clausula" minLength={5} maxLength={2000} required /></label>
      <label className="block">Se houver encontros pendentes<select className={classe} name="escolha" required defaultValue=""><option value="">Selecione</option><option value="AGUARDAR">Aguardar conferência</option><option value="PROPOR_PARCIAL">Propor emissão parcial para aprovação</option></select></label>
      <label className="block">Motivo<CampoTexto className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
      <p>Os dados serão confrontados novamente ao salvar. Esta preparação não aprova o contrato nem emite cobrança.</p>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Conferindo…" : preparado ? "Salvar rascunho do período conferido" : "Conferir período e versão"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
