"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarAulaDiario } from "@/server/diario/acoes";
import { salvarDiarioParticular } from "@/server/diario/particular";

type Dados = { encontroId: string; turmaId: string | null; ocorridaEm: string; diarioId: string | null; conteudo: string; estadoAnterior: string | null;
  alunos: { alunoId: string; nomeAluno: string; presente: boolean | null; observacao: string | null; podeEditar: boolean; podeClassificar: boolean; participacao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO" | null }[] };
export function ChamadaEncontro({ dados }: { dados: Dados }) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [ocupado, iniciar] = useTransition();
  return <form className="space-y-4" onSubmit={(event) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    iniciar(async () => {
      setErro("");
      setSalvo(false);
      try {
        const entrada = { aulaId: dados.diarioId ?? undefined, estadoAnterior: dados.estadoAnterior ?? undefined, encontroId: dados.encontroId, ocorridaEm: dados.ocorridaEm,
          conteudo: String(f.get("conteudo")), registros: dados.alunos.map((a) => ({ alunoId: a.alunoId,
            presente: !a.podeEditar ? a.presente : f.get(a.alunoId) === "presente" ? true : ["ausente", "impedido"].includes(String(f.get(a.alunoId))) ? false : null,
            participacao: !a.podeEditar ? a.participacao ?? undefined : !a.podeClassificar ? undefined : f.get(a.alunoId) === "presente" ? "PRESENTE" as const : f.get(a.alunoId) === "ausente" ? "FALTA" as const : f.get(a.alunoId) === "impedido" ? "IMPEDIDO_POR_RESTRICAO" as const : undefined,
            observacao: a.podeEditar ? String(f.get(`obs-${a.alunoId}`) ?? "") : a.observacao ?? undefined })) };
        const resultado = dados.turmaId ? await salvarAulaDiario({ ...entrada, turmaId: dados.turmaId }) : await salvarDiarioParticular(entrada);
        if (!resultado.ok) { setErro(resultado.erro); return; }
        setSalvo(true); router.refresh();
      } catch { setErro("Não foi possível confirmar o lançamento. Atualize a página para conferir antes de tentar novamente."); }
    });
  }}>
    <fieldset disabled={ocupado} className="space-y-4">
      <label className="block">Conteúdo ministrado<textarea name="conteudo" defaultValue={dados.conteudo} required maxLength={10000} className="mt-1 block w-full rounded border p-2" /></label>
      {dados.alunos.map((a) => <div key={a.alunoId} className="space-y-2 rounded border p-3"><label className="flex flex-wrap items-center justify-between gap-2">{a.nomeAluno}
        <select name={a.alunoId} disabled={!a.podeEditar} defaultValue={a.participacao === "IMPEDIDO_POR_RESTRICAO" ? "impedido" : a.presente === true ? "presente" : a.presente === false ? "ausente" : "pendente"} className="rounded border p-2"><option value="pendente">Não informado</option><option value="presente">Presente</option><option value="ausente">Falta</option>{(a.podeClassificar || a.participacao === "IMPEDIDO_POR_RESTRICAO") && <option value="impedido">Impedido por restrição</option>}</select>
      </label><label className="block text-sm">Observação de {a.nomeAluno}<textarea name={`obs-${a.alunoId}`} defaultValue={a.observacao ?? ""} disabled={!a.podeEditar} maxLength={2000} className="mt-1 block w-full rounded border p-2" /></label>
        {!a.podeEditar && <p className="text-sm text-gray-500">Registro histórico em leitura.</p>}
      </div>)}
      <p className="text-sm text-gray-500">Salvar a chamada não conclui a aula. A gravação ou a exceção aprovada ainda precisa ser conferida.</p>
      <button disabled={ocupado} className="rounded bg-brand-solid px-4 py-2 text-white disabled:opacity-50" type="submit">{ocupado ? "Salvando…" : dados.diarioId ? "Salvar lançamento pendente" : "Registrar diário"}</button>
    </fieldset>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
    {salvo && <p role="status" className="text-green-700">Lançamento salvo.</p>}
  </form>;
}
