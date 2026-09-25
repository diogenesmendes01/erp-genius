"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { consultarVinculosLegados, vincularAlocacaoLegada } from "@/server/matricula/vinculo-legado";
import { useOperacao } from "./useOperacao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";

type Vinculos = NonNullable<Extract<Awaited<ReturnType<typeof consultarVinculosLegados>>, { ok: true }>["dado"]>;
export function VinculosLegados({ alunoId }: { alunoId: string }) {
  const router = useRouter();
  const [vinculos, setVinculos] = useState<Vinculos | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useOperacao();
  function consultar() {
    iniciar(async () => {
      setErro(null); setAviso(null);
      try {
        const r = await consultarVinculosLegados(alunoId);
        if (!r.ok) { setErro(r.erro); return; }
        setVinculos(r.dado ?? []); setEscolhas({}); setMotivos({});
      } catch { setErro("Não foi possível consultar os vínculos. Tente novamente."); }
    });
  }
  function vincular(alocacaoId: string) {
    iniciar(async () => {
      setErro(null); setAviso(null);
      try {
        const r = await vincularAlocacaoLegada({ alocacaoId, matriculaId: escolhas[alocacaoId], motivo: motivos[alocacaoId] });
        if (!r.ok) { setErro(r.erro); return; }
        setVinculos((v) => v?.filter((a) => a.alocacaoId !== alocacaoId) ?? null);
        setAviso("Vínculo registrado. Confira novamente os impactos das propostas pendentes."); router.refresh();
      } catch { setErro("Resultado não confirmado. Consulte os vínculos antes de repetir a conferência."); }
    });
  }
  return <section className="space-y-3 rounded border p-4" aria-busy={ocupado}>
    <h2 className="text-lg font-medium">Conferir vínculos antigos com turmas</h2>
    <p className="text-sm">Identifique o contrato que já corresponde a cada vínculo. Confira os registros da escola antes de confirmar; esta operação preserva a turma e as datas.</p>
    <button type="button" disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={consultar}>Consultar vínculos sem matrícula</button>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}<MensagemStatus texto={aviso} />
    {vinculos?.length === 0 && <p>Nenhum vínculo ativo sem matrícula identificado.</p>}
    {vinculos?.map((v) => <fieldset key={v.alocacaoId} disabled={ocupado} className="space-y-2 border-t pt-3">
      <legend className="font-medium">{v.turma}</legend>
      {v.contratos.length === 0 ? <p>Não há contrato ativo compatível. Confira o cadastro contratual antes de associar.</p> : <>
        <label className="block text-sm">Matrícula correspondente<select className="ml-2 rounded border p-2" value={escolhas[v.alocacaoId] ?? ""} onChange={(e) => setEscolhas((a) => ({ ...a, [v.alocacaoId]: e.target.value }))}><option value="">Selecione após conferir</option>{v.contratos.map((m) => <option key={m.id} value={m.id}>{m.codigo ?? "Sem código"} · {m.nome}</option>)}</select></label>
        <label className="block text-sm">Motivo e referência da conferência<textarea className="mt-1 block w-full rounded border p-2" maxLength={2000} value={motivos[v.alocacaoId] ?? ""} onChange={(e) => setMotivos((a) => ({ ...a, [v.alocacaoId]: e.target.value }))} /></label>
        <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={!escolhas[v.alocacaoId] || (motivos[v.alocacaoId] ?? "").trim().length < 5} onClick={() => vincular(v.alocacaoId)}>Confirmar vínculo conferido</button>
      </>}
    </fieldset>)}
  </section>;
}
