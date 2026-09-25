"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOperacao } from "./useOperacao";
import { solicitarEncerramentoMatriculas } from "@/server/matricula/encerramento-solicitacao";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

export function NovoEncerramento({ alunoId, contratos, hoje }: {
  alunoId: string; contratos: { id: string; nome: string }[]; hoje: string | null;
}) {
  const router = useRouter();
  const [data, setData] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useOperacao();
  const chave = useRef("");
  const estilo = "mt-1 block w-full rounded border p-2";
  return <section className="space-y-3 rounded border p-4">
    <h2 className="text-lg font-medium">Solicitar encerramento</h2>
    <p className="text-sm">Registre o pedido do aluno e selecione os contratos correspondentes. O Financeiro ainda deverá preparar o acerto para aprovação independente antes da efetivação.</p>
    {!hoje && <p>Configure o fuso institucional para registrar o pedido.</p>}
    <form onChange={() => { chave.current = ""; setAviso(null); }} onSubmit={(e) => {
      e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
      if (!DataCivilSchema.safeParse(data).success) { setErro("Informe uma data de encerramento completa e válida."); return; }
      if (!f.getAll("matricula").length) { setErro("Selecione ao menos uma matrícula para o pedido."); return; }
      void iniciar(async () => {
        setErro(null); setAviso(null); chave.current ||= crypto.randomUUID();
        const retroativa = !!hoje && data < hoje;
        try {
          const r = await solicitarEncerramentoMatriculas({ alunoId, matriculaIds: f.getAll("matricula").map(String), dataSolicitada: data,
            motivo: String(f.get("motivo")), evidenciaPedido: String(f.get("evidencia")), chaveIdempotencia: chave.current,
            ...(retroativa ? { motivoRetroatividade: String(f.get("motivoRetro")), evidenciaRetroatividade: String(f.get("evidenciaRetro")) } : {}),
          });
          if (!r.ok) { setErro(r.erro); return; }
          setAviso("Pedido registrado e aguardando acerto. As matrículas continuam com sua situação atual.");
          form.reset(); setData(""); chave.current = ""; router.refresh();
        } catch { setErro(MSG_RESULTADO_INCERTO); }
      });
    }}>
      <fieldset disabled={ocupado || !hoje || !contratos.length} className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Contratos ativos ou pausados</legend>
        {contratos.map((m) => <label className="flex gap-2 text-sm" key={m.id}><input type="checkbox" name="matricula" value={m.id} />{m.nome}</label>)}
        {!contratos.length && <p>Nenhum contrato disponível.</p>}
        <label className="block text-sm">Data de encerramento solicitada<input type="date" required className={estilo} value={data} onChange={(e) => setData(e.target.value)} /></label>
        <label className="block text-sm">Motivo do pedido<CampoTexto name="motivo" required minLength={5} maxLength={2000} className={estilo} /></label>
        <label className="block text-sm">Referência da evidência do pedido do aluno<CampoTexto name="evidencia" required minLength={5} maxLength={2000} className={estilo} placeholder="Identifique a mensagem, atendimento ou documento que comprova o pedido." /></label>
        {hoje && data && data < hoje && <div className="space-y-2 rounded bg-amber-50 p-3">
          <p className="text-sm">A retroatividade dependerá de aprovação explícita no acerto.</p>
          <label className="block text-sm">Motivo da retroatividade<CampoTexto name="motivoRetro" required minLength={5} maxLength={2000} className={estilo} /></label>
          <label className="block text-sm">Evidência para a data anterior<CampoTexto name="evidenciaRetro" required minLength={5} maxLength={2000} className={estilo} /></label>
        </div>}
        <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar pedido de encerramento</button>
      </fieldset>
    </form>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
    <MensagemStatus texto={aviso} className="text-green-700" />
  </section>;
}
