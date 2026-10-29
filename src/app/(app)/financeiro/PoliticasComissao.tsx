"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publicarPoliticaComissaoLocal } from "@/server/financeiro/politica-comissao-local";
import { fusoDoCampoLocal } from "@/server/operacao/fuso-entrada";
import type { configuracaoComissoes } from "@/server/financeiro/consultas";
import { formatarMoeda, parseMoeda } from "@/lib/dinheiro";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { CampoMoeda } from "@/components/CampoMoeda";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";

import { CampoSelect } from "@/components/ui/select";
import { CampoCombobox } from "@/components/ui/combobox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
export function PoliticasComissao({ dados, preferenciaFusoExibicao = null, fusoEscola }: { dados: NonNullable<Awaited<ReturnType<typeof configuracaoComissoes>>>; preferenciaFusoExibicao?: string | null; fusoEscola: string }) {
  const fusoCampo = fusoDoCampoLocal(preferenciaFusoExibicao, fusoEscola);
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: true });
  const [tipo, setTipo] = useState<"PERCENTUAL" | "VALOR_FIXO">("PERCENTUAL");
  const [paisId, setPaisId] = useState("");
  const [percentual, setPercentual] = useState("");
  const [valorFixo, setValorFixo] = useState("");
  const moedaSelecionada = dados.paises.find((p) => p.id === paisId)?.moedaLocal ?? "";
  async function publicar(form: FormData) {
    const valor = tipo === "PERCENTUAL" ? Number(percentual) : parseMoeda(valorFixo);
    if (valor === null || !Number.isFinite(valor)) {
      acao.setErro(tipo === "PERCENTUAL" ? "Informe um percentual válido." : "Informe um valor válido, com no máximo duas casas decimais.");
      return;
    }
    const d = await acao.executar(() => publicarPoliticaComissaoLocal({ paisId, produtoId: String(form.get("produtoId")), tipo,
      moeda: moedaSelecionada,
      percentual: tipo === "PERCENTUAL" ? valor : null, valorFixo: tipo === "VALOR_FIXO" ? valor : null,
      vigenciaLocal: String(form.get("vigencia") ?? ""), fuso: fusoCampo,
    }));
    if (d?.tipo === "ok") { router.refresh(); setPercentual(""); setValorFixo(""); }
  }
  return <section className="space-y-4">
    <h2 className="text-lg font-medium">Políticas de comissão</h2>
    <p className="text-sm text-gray-600">Uma regra por oferta e moeda. Percentual usa a taxa de matrícula; valor fixo gera uma comissão por matrícula. Nova versão preserva comissões existentes.</p>
    <form action={publicar} className="flex flex-wrap items-end gap-3 rounded border p-3 text-sm">
      <label>País<CampoCombobox name="paisId" value={paisId} onChange={(e) => setPaisId(e.target.value)} className="block rounded border p-2" required vazio={"Selecione"} opcoes={dados.paises.map((p) => ({ valor: String(p.id), rotulo: `${p.nome} · ${p.moedaLocal}` }))} /></label>
      <label>Oferta<CampoCombobox name="produtoId" className="block rounded border p-2" required defaultValue="" vazio={"Selecione"} opcoes={dados.produtos.map((p) => ({ valor: String(p.id), rotulo: p.nome }))} /></label>
      <label>Tipo<CampoSelect value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="block rounded border p-2" opcoes={[{ valor: "PERCENTUAL", rotulo: "Percentual da taxa" }, { valor: "VALOR_FIXO", rotulo: "Valor fixo na moeda do país" }]} /></label>
      {tipo === "PERCENTUAL" ? (
        <label>Percentual<input required type="number" min="0" max="100" step="0.01" value={percentual} onChange={(e) => setPercentual(e.target.value)} className="block w-28 rounded border p-2" /></label>
      ) : (
        <label>Valor<CampoMoeda required value={valorFixo} onChange={setValorFixo} moeda={moedaSelecionada} className="block w-28 rounded border p-2" /></label>
      )}
      <label>Vigência (vazio = agora)<DateTimePicker name="vigencia" fuso={fusoCampo} className="block rounded border p-2" /><span className="block text-xs text-gray-600">Horário em {fusoCampo}.</span></label>
      <button disabled={acao.ocupado} className={botaoClasses({ tamanho: "lg" })}>Publicar nova versão</button>
    </form>
    <FeedbackAcao erro={acao.erro} />
    <ul className="divide-y rounded border text-sm">{dados.politicas.map((p) => {
      const inicio = formatarInstanteExibicao(p.vigenteEm, preferenciaFusoExibicao, fusoEscola);
      const fim = p.encerraEm ? formatarInstanteExibicao(p.encerraEm, preferenciaFusoExibicao, fusoEscola) : null;
      return <li key={p.id} className="p-3">
        {dados.paises.find((x) => x.id === p.paisId)?.nome ?? "País fora da lista"} · {dados.produtos.find((x) => x.id === p.produtoId)?.nome ?? "Produto fora da lista"} · v{p.versao} · {p.tipo === "VALOR_FIXO" ? (p.valorFixo != null ? formatarMoeda(p.valorFixo, p.moeda) : "valor não informado") : `${p.percentual}% da taxa`} · vigência desde {inicio.texto} (horário exibido em {inicio.fuso}){fim && ` até ${fim.texto} (horário exibido em ${fim.fuso})`}
      </li>;
    })}</ul>
  </section>;
}
