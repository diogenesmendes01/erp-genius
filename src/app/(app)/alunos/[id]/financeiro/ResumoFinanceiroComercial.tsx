"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TipoAjuste, Vigencia } from "@prisma/client";
import { formatarMoeda, parseMoeda, formatarMoedaParaCampo } from "@/lib/dinheiro";
import { ajustarCobranca } from "@/server/ajustes/acoes";
import type { obterResumoComercialFinanceiro } from "@/server/ajustes/consultas";
import { CampoMoeda } from "@/components/CampoMoeda";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { STATUS_COMISSAO_LABEL, rotular } from "@/lib/labels";
import { botaoClasses } from "@/components/Botao";

export function ResumoFinanceiroComercial({ dados }: { dados: NonNullable<Awaited<ReturnType<typeof obterResumoComercialFinanceiro>>> }) {
  return <div className="space-y-4"><h1 className="text-2xl font-medium">Acompanhamento comercial · {dados.aluno.primeiroNome} {dados.aluno.sobrenome}</h1>
    <Link className="text-sm text-brand-700 underline" href="/comissoes">Consultar histórico de comissões</Link>
    {dados.matriculas.map((m) => <section key={m.id} className="space-y-3 rounded border p-4 text-sm">
      {m.precoAguardandoAprovacao && <p className="rounded bg-amber-50 p-3 text-amber-800">Os valores propostos foram encaminhados para aprovação independente. Os preços de referência permanecem vigentes até a decisão, e a ativação aguarda essa análise.</p>}
      <h2 className="font-medium">{m.codigo} · {m.produto}</h2><p>Pagamento inicial: {m.pagamentoInicialConfirmado ? "confirmado" : "aguardando confirmação"}</p>
      {m.precos.map((p) => <LinhaAjustePreco key={p.id} preco={p} moeda={m.moeda} />)}
      {m.comissoes.map((c) => <p key={c.id}>Comissão: {formatarMoeda(c.valor, c.moeda)} · {c.tipo === "VALOR_FIXO" ? "valor fixo" : `${c.percentual}% da taxa`} · {rotular(STATUS_COMISSAO_LABEL, c.status)}</p>)}
    </section>)}
  </div>;
}

type Matricula = NonNullable<Awaited<ReturnType<typeof obterResumoComercialFinanceiro>>>["matriculas"][number];
type Preco = Matricula["precos"][number];

/** Linha isolada pra poder ter estado local do campo de valor (CampoMoeda é controlado) —
 *  o form continua enviando via FormData normalmente, `name="valor"` participa do submit
 *  igual a um input não controlado. */
function LinhaAjustePreco({ preco, moeda }: { preco: Preco; moeda: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(formatarMoedaParaCampo(preco.valor, moeda));
  // Estado por linha: o resultado aparece logo abaixo do botão clicado, não no topo da página.
  // ajustarCobranca não tem chave de idempotência — falha de rede manda conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  async function ajustar(form: FormData) {
    // parseMoeda (não Number): "1.234" digitado não pode virar 1234 por acidente. E nunca
    // ?? 0: texto inválido viraria "novo valor: zero" registrado, silencioso.
    const valorPara = parseMoeda(String(form.get("valor")));
    if (valorPara === null) {
      acao.setErro("Informe o novo valor, com no máximo duas casas decimais.");
      return;
    }
    const desfecho = await acao.executar(() => ajustarCobranca({ cobrancaId: String(form.get("cobrancaId")), valorPara, tipo: TipoAjuste.DESCONTO,
      vigencia: form.get("futuras") ? Vigencia.PROXIMOS_MESES : Vigencia.ESTA_COBRANCA, motivo: String(form.get("motivo")) }),
    (dado) => dado?.aprovacao ? "Pedido encaminhado para aprovação independente." : "Preço ajustado dentro da alçada.");
    if (desfecho?.tipo === "ok") router.refresh();
  }
  return (
    <div className="space-y-2">
    <form action={ajustar} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="cobrancaId" value={preco.id} />
      <span>{preco.tipo === "MATRICULA" ? "Taxa" : "Mensalidade"}: {formatarMoeda(preco.valor, moeda)} · referência {formatarMoeda(preco.referencia, moeda)}</span>
      <CampoMoeda required name="valor" ariaLabel="Novo valor" moeda={moeda} value={valor} onChange={setValor} className="w-28 rounded border p-1.5" />
      <input required name="motivo" aria-label="Motivo do ajuste" placeholder="Motivo do ajuste" minLength={5} className="rounded border p-1.5" />
      {preco.tipo === "MENSALIDADE" && <label><input type="checkbox" name="futuras" /> Mensalidades futuras</label>}
      <button disabled={acao.ocupado} className={botaoClasses({ variante: "secundario" })}>{acao.ocupado ? "Enviando…" : "Solicitar desconto"}</button>
    </form>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    </div>
  );
}
