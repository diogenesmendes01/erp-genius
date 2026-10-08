"use client";
import { type FormEvent } from "react";
import { salvarPrazosPortalAluno } from "@/server/portal-aluno/configuracao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";

const campos = {
  prazoSessaoPortalAlunoMinutos: "Duração da sessão",
  prazoConvitePortalAlunoMinutos: "Validade do convite",
  prazoRecuperacaoPortalAlunoMinutos: "Validade do link de recuperação",
  prazoValidacaoEmailPortalAlunoMinutos: "Validade da confirmação do novo e-mail",
};
type Prazos = { [K in keyof typeof campos]: number | null };
export function PrazosPortalFormulario({ valores }: { valores: Prazos }) {
  // Sem chave de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const acao = useAcaoCliente({ idempotente: false });
  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await acao.executar(() => salvarPrazosPortalAluno({
      prazoSessaoPortalAlunoMinutos: Number(form.get("prazoSessaoPortalAlunoMinutos")),
      prazoConvitePortalAlunoMinutos: Number(form.get("prazoConvitePortalAlunoMinutos")),
      prazoRecuperacaoPortalAlunoMinutos: Number(form.get("prazoRecuperacaoPortalAlunoMinutos")),
      prazoValidacaoEmailPortalAlunoMinutos: Number(form.get("prazoValidacaoEmailPortalAlunoMinutos")),
    }), "Prazos salvos para novas sessões e novos links.");
  }
  return <form onSubmit={salvar} className="space-y-3 rounded border p-4">
    <h3 className="font-medium">Acesso do aluno</h3>
    <p className="text-sm">Defina os quatro prazos em minutos. Links e sessões já emitidos conservam a validade registrada.</p>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      {(Object.keys(campos) as (keyof Prazos)[]).map(campo => <label key={campo} className="block text-sm">
        {campos[campo]} (minutos)
        <input className="mt-1 block w-full rounded border p-2" name={campo} type="number" min={1} max={525600} step={1} required defaultValue={valores[campo] ?? ""} />
      </label>)}
      <button className={botaoClasses({ variante: "secundario", tamanho: "md" })} type="submit">{acao.ocupado ? "Salvando…" : "Salvar prazos do portal"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
