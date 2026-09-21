"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consultarFechamentosHoras } from "@/server/matricula/fechamento-horas-consulta";
import { prepararFechamentoHoras } from "@/server/matricula/fechamento-horas-rascunho";

export function PrepararFechamento({ alunoId, matriculaId }: { alunoId: string; matriculaId: string }) {
  const router = useRouter(), [ocupado, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const [referencia, setReferencia] = useState(""), [preparado, setPreparado] = useState<Parameters<typeof prepararFechamentoHoras>[0] | null>(null);
  const chave = useRef<{ entrada: string; valor: string } | null>(null);
  const classe = "block w-full rounded border p-2";
  return <form className="space-y-3 rounded border p-4" onChange={() => setPreparado(null)} onSubmit={e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    iniciar(async () => {
      setMensagem("");
      try {
        if (preparado) {
          const salvo = await prepararFechamentoHoras(preparado);
          if (!salvo.ok || !salvo.dado) { setMensagem(salvo.ok ? "Resultado indisponível." : salvo.erro); setPreparado(null); return; }
          router.push(`/matriculas/${matriculaId}/fechamentos-horas?aluno=${encodeURIComponent(alunoId)}&versao=${encodeURIComponent(salvo.dado.id)}`);
          router.refresh(); setPreparado(null); setMensagem("Rascunho salvo; nenhuma cobrança emitida."); return;
        }
        const periodo = { referencia: referencia === "MES_CIVIL" ? { referencia: "MES_CIVIL" as const } : { referencia: "CICLO_MATRICULA" as const, dataReferencia: String(f.get("ancora")) },
          dataNoPeriodo: String(f.get("data")), fuso: String(f.get("fuso")), vencimento: String(f.get("vencimento")), clausula: String(f.get("clausula")) };
        const consulta = await consultarFechamentosHoras({ alunoId, matriculaId, periodo });
        if (!consulta.ok || !consulta.dado?.preparacao || !consulta.dado.matricula.contratoDocumentoId) {
          setMensagem(consulta.ok ? "Contrato ou referência indisponível para preparação." : consulta.erro); return;
        }
        const contexto = consulta.dado.preparacao;
        const entrada = { alunoId, matriculaId, documentoId: consulta.dado.matricula.contratoDocumentoId, periodo,
          versaoAnterior: contexto.versaoAnterior, motivo: String(f.get("motivo")), escolha: f.get("escolha") === "PROPOR_PARCIAL" ? "PROPOR_PARCIAL" as const : "AGUARDAR" as const };
        const serializada = JSON.stringify(entrada);
        if (chave.current?.entrada !== serializada) chave.current = { entrada: serializada, valor: crypto.randomUUID() };
        setPreparado({ ...entrada, chaveIdempotencia: chave.current.valor });
        setMensagem(`Período de ${contexto.periodo.inicio} a ${contexto.periodo.fim}, em ${contexto.periodo.fuso}. Vencimento: ${contexto.periodo.vencimento}. Será criada a versão ${contexto.versaoAnterior + 1}. Confira antes de salvar.`);
      } catch { setMensagem("Não foi possível confirmar o resultado. Consulte o histórico antes de repetir; a mesma entrada conserva sua chave de solicitação."); }
    });
  }}>
    <fieldset disabled={ocupado} className="space-y-3"><legend className="font-semibold">Preparar apuração mensal</legend>
      <label className="block">Referência contratual<select className={classe} required value={referencia} onChange={e => setReferencia(e.target.value)}><option value="">Selecione</option><option value="MES_CIVIL">Mês civil</option><option value="CICLO_MATRICULA">Ciclo da matrícula</option></select></label>
      {referencia === "CICLO_MATRICULA" && <label className="block">Data de referência do ciclo<input className={classe} type="date" name="ancora" required /></label>}
      <label className="block">Uma data dentro do período a apurar<input className={classe} type="date" name="data" required /></label>
      <label className="block">Fuso do período<input className={classe} name="fuso" placeholder="Ex.: America/Sao_Paulo" required /></label>
      <label className="block">Vencimento contratado<input className={classe} type="date" name="vencimento" required /></label>
      <label className="block">Cláusula e condições do período<textarea className={classe} name="clausula" minLength={5} maxLength={2000} required /></label>
      <label className="block">Se houver encontros pendentes<select className={classe} name="escolha" required defaultValue=""><option value="">Selecione</option><option value="AGUARDAR">Aguardar conferência</option><option value="PROPOR_PARCIAL">Propor emissão parcial para aprovação</option></select></label>
      <label className="block">Motivo<textarea className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
      <p>Os dados serão confrontados novamente ao salvar. Esta preparação não aprova o contrato nem emite cobrança.</p>
      <button className="rounded border p-2">{ocupado ? "Conferindo…" : preparado ? "Salvar rascunho do período conferido" : "Conferir período e versão"}</button>
    </fieldset>
    {mensagem && <p role="status">{mensagem}</p>}
  </form>;
}
