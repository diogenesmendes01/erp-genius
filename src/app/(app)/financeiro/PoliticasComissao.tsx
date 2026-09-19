"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publicarPoliticaComissao } from "@/server/financeiro/acoes";
import type { configuracaoComissoes } from "@/server/financeiro/consultas";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

export function PoliticasComissao({ dados, preferenciaFusoExibicao = null }: { dados: NonNullable<Awaited<ReturnType<typeof configuracaoComissoes>>>; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter(); const [erro, setErro] = useState(""); const [salvando, setSalvando] = useState(false);
  const [tipo, setTipo] = useState<"PERCENTUAL" | "VALOR_FIXO">("PERCENTUAL");
  async function publicar(form: FormData) {
    setErro(""); setSalvando(true);
    const paisId = String(form.get("paisId"));
    const valor = Number(form.get("valor"));
    const r = await publicarPoliticaComissao({ paisId, produtoId: String(form.get("produtoId")), tipo,
      moeda: dados.paises.find((p) => p.id === paisId)?.moedaLocal ?? "",
      percentual: tipo === "PERCENTUAL" ? valor : null, valorFixo: tipo === "VALOR_FIXO" ? valor : null,
      vigenteEm: form.get("vigencia") ? new Date(String(form.get("vigencia"))) : new Date(),
    });
    setSalvando(false); if (!r.ok) setErro(r.erro); else router.refresh();
  }
  return <section className="space-y-4">
    <h2 className="text-lg font-medium">Políticas de comissão</h2>
    <p className="text-sm text-gray-600">Uma regra por oferta e moeda. Percentual usa a taxa de matrícula; valor fixo gera uma comissão por matrícula. Nova versão preserva comissões existentes.</p>
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    <form action={publicar} className="flex flex-wrap items-end gap-3 rounded border p-3 text-sm">
      <label>País<select required name="paisId" className="block rounded border p-2"><option value="">Selecione</option>{dados.paises.map((p) => <option key={p.id} value={p.id}>{p.nome} · {p.moedaLocal}</option>)}</select></label>
      <label>Oferta<select required name="produtoId" className="block rounded border p-2"><option value="">Selecione</option>{dados.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label>Tipo<select className="block rounded border p-2" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}><option value="PERCENTUAL">Percentual da taxa</option><option value="VALOR_FIXO">Valor fixo na moeda do país</option></select></label>
      <label>{tipo === "PERCENTUAL" ? "Percentual" : "Valor"}<input required name="valor" type="number" min="0" max={tipo === "PERCENTUAL" ? "100" : undefined} step="0.01" className="block w-28 rounded border p-2" /></label>
      <label>Vigência (vazio = agora)<input name="vigencia" type="datetime-local" className="block rounded border p-2" /></label>
      <button disabled={salvando} className="rounded bg-brand-600 px-3 py-2 text-white disabled:opacity-50">Publicar nova versão</button>
    </form>
    <ul className="divide-y rounded border text-sm">{dados.politicas.map((p) => {
      const inicio = formatarInstanteExibicao(p.vigenteEm, preferenciaFusoExibicao, "UTC");
      const fim = p.encerraEm ? formatarInstanteExibicao(p.encerraEm, preferenciaFusoExibicao, "UTC") : null;
      return <li key={p.id} className="p-3">
        {dados.paises.find((x) => x.id === p.paisId)?.nome ?? p.paisId} · {dados.produtos.find((x) => x.id === p.produtoId)?.nome ?? p.produtoId} · v{p.versao} · {p.tipo === "VALOR_FIXO" ? formatarMoeda(p.valorFixo ?? 0, p.moeda) : `${p.percentual}% da taxa`} · vigência contratual desde {inicio.texto} (horário exibido em {inicio.fuso}; instante ISO){fim && ` até ${fim.texto} (horário exibido em ${fim.fuso}; instante ISO)`}
      </li>;
    })}</ul>
  </section>;
}
