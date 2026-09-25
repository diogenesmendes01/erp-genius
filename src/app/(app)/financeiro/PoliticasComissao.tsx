"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publicarPoliticaComissao } from "@/server/financeiro/acoes";
import type { configuracaoComissoes } from "@/server/financeiro/consultas";
import { formatarMoeda, parseMoeda } from "@/lib/dinheiro";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { CampoMoeda } from "@/components/CampoMoeda";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";

export function PoliticasComissao({ dados, preferenciaFusoExibicao = null }: { dados: NonNullable<Awaited<ReturnType<typeof configuracaoComissoes>>>; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  // Publicar sem chave de idempotência (server/financeiro/acoes.ts:170): repetir cria outra versão
  // da política — conferir a lista antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  const [tipo, setTipo] = useState<"PERCENTUAL" | "VALOR_FIXO">("PERCENTUAL");
  // Precisa virar estado (não FormData) pra CampoMoeda, que só existe no ramo VALOR_FIXO —
  // e pra resolver a moeda do país selecionado, também precisa virar estado.
  const [paisId, setPaisId] = useState("");
  const [percentual, setPercentual] = useState("");
  const [valorFixo, setValorFixo] = useState("");
  const moedaSelecionada = dados.paises.find((p) => p.id === paisId)?.moedaLocal ?? "";
  async function publicar(form: FormData) {
    // Percentual usa Number (não é dinheiro, é 0–100); valor fixo usa parseMoeda — "1.234"
    // digitado não pode virar 1234 por acidente (ver docs/42-auditoria-frontend-ux.md,
    // ganho rápido 13).
    const valor = tipo === "PERCENTUAL" ? Number(percentual) : parseMoeda(valorFixo);
    if (valor === null || !Number.isFinite(valor)) {
      acao.setErro(tipo === "PERCENTUAL" ? "Informe um percentual válido." : "Informe um valor válido, com no máximo duas casas decimais.");
      return;
    }
    const d = await acao.executar(() => publicarPoliticaComissao({ paisId, produtoId: String(form.get("produtoId")), tipo,
      moeda: moedaSelecionada,
      percentual: tipo === "PERCENTUAL" ? valor : null, valorFixo: tipo === "VALOR_FIXO" ? valor : null,
      vigenteEm: form.get("vigencia") ? new Date(String(form.get("vigencia"))) : new Date(),
    }));
    if (d?.tipo === "ok") { router.refresh(); setPercentual(""); setValorFixo(""); }
  }
  return <section className="space-y-4">
    <h2 className="text-lg font-medium">Políticas de comissão</h2>
    <p className="text-sm text-gray-600">Uma regra por oferta e moeda. Percentual usa a taxa de matrícula; valor fixo gera uma comissão por matrícula. Nova versão preserva comissões existentes.</p>
    <form action={publicar} className="flex flex-wrap items-end gap-3 rounded border p-3 text-sm">
      <label>País<select required name="paisId" value={paisId} onChange={(e) => setPaisId(e.target.value)} className="block rounded border p-2"><option value="">Selecione</option>{dados.paises.map((p) => <option key={p.id} value={p.id}>{p.nome} · {p.moedaLocal}</option>)}</select></label>
      <label>Oferta<select required name="produtoId" className="block rounded border p-2"><option value="">Selecione</option>{dados.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label>Tipo<select className="block rounded border p-2" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}><option value="PERCENTUAL">Percentual da taxa</option><option value="VALOR_FIXO">Valor fixo na moeda do país</option></select></label>
      {tipo === "PERCENTUAL" ? (
        <label>Percentual<input required type="number" min="0" max="100" step="0.01" value={percentual} onChange={(e) => setPercentual(e.target.value)} className="block w-28 rounded border p-2" /></label>
      ) : (
        <label>Valor<CampoMoeda required value={valorFixo} onChange={setValorFixo} moeda={moedaSelecionada} className="block w-28 rounded border p-2" /></label>
      )}
      <label>Vigência (vazio = agora)<input name="vigencia" type="datetime-local" className="block rounded border p-2" /></label>
      <button disabled={acao.ocupado} className={botaoClasses({ tamanho: "lg" })}>Publicar nova versão</button>
    </form>
    <FeedbackAcao erro={acao.erro} />
    <ul className="divide-y rounded border text-sm">{dados.politicas.map((p) => {
      const inicio = formatarInstanteExibicao(p.vigenteEm, preferenciaFusoExibicao, "UTC");
      const fim = p.encerraEm ? formatarInstanteExibicao(p.encerraEm, preferenciaFusoExibicao, "UTC") : null;
      return <li key={p.id} className="p-3">
        {dados.paises.find((x) => x.id === p.paisId)?.nome ?? p.paisId} · {dados.produtos.find((x) => x.id === p.produtoId)?.nome ?? p.produtoId} · v{p.versao} · {p.tipo === "VALOR_FIXO" ? (p.valorFixo != null ? formatarMoeda(p.valorFixo, p.moeda) : "valor não informado") : `${p.percentual}% da taxa`} · vigência desde {inicio.texto} (horário exibido em {inicio.fuso}){fim && ` até ${fim.texto} (horário exibido em ${fim.fuso})`}
      </li>;
    })}</ul>
  </section>;
}
