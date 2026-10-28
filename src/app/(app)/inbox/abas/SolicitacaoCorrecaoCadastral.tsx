"use client";

import { useState, type FormEvent } from "react";
import { Botao } from "@/components/Botao";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Combobox } from "@/components/ui/combobox";
import { garantirEstilo } from "@/app/(app)/inbox/garantir-estilo";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { solicitarCorrecaoCadastro } from "@/server/secretaria/acoes";

const CAMPOS = [
  { valor: "primeiroNome", rotulo: "Primeiro nome" },
  { valor: "sobrenome", rotulo: "Sobrenome" },
  { valor: "nomePreferido", rotulo: "Nome preferido" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "telefoneE164", rotulo: "Telefone com DDI" },
  { valor: "documentos", rotulo: "Documento (descreva a correção)" },
] as const;

type Campo = (typeof CAMPOS)[number]["valor"];

export function SolicitacaoCorrecaoCadastral({ matriculaId }: { matriculaId: string }) {
  garantirEstilo();
  const acao = useAcaoCliente({ idempotente: false });
  const [campo, setCampo] = useState<Campo>("primeiroNome");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (acao.ocupado || motivo.trim().length < 5) return;
    const r = await acao.executar(
      () => solicitarCorrecaoCadastro({ matriculaId, campo, valorProposto: valor, motivo: motivo.trim() }),
      "Correção cadastral solicitada.",
    );
    if (r?.tipo === "ok") {
      setValor("");
      setMotivo("");
    }
  }

  return (
    <Collapsible className="rounded-xl border border-gray-200 bg-surface">
      <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-highlight">
        Solicitar correção cadastral
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form onSubmit={(evento) => void enviar(evento)} className="grid gap-2 border-t border-gray-200 p-3.5">
          <label className="grid gap-1 text-sm text-gray-700">
            Campo
            <Combobox aria-label="Campo da correção" value={campo} onValueChange={(proximo) => setCampo(proximo as Campo)} opcoes={CAMPOS} />
          </label>
          <label className="grid gap-1 text-sm text-gray-700">
            Valor proposto / descrição
            <input className={CONTROLE_CAMPO} maxLength={500} value={valor} disabled={acao.ocupado} onChange={(evento) => setValor(evento.target.value)} />
          </label>
          <label className="grid gap-1 text-sm text-gray-700">
            Motivo
            <input className={CONTROLE_CAMPO} required minLength={5} maxLength={2000} value={motivo} disabled={acao.ocupado} onChange={(evento) => setMotivo(evento.target.value)} />
          </label>
          <div>
            <Botao type="submit" variante="secundario" tamanho="sm" disabled={acao.ocupado || motivo.trim().length < 5}>Solicitar correção</Botao>
          </div>
          <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
