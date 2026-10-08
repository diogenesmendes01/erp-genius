"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { botaoClasses } from "@/components/Botao";

export type Maioridade = "MAIOR" | "MENOR";

/** Endereço da tela para a classificação escolhida (o histórico volta ao início: os papéis exigidos mudam). */
export function hrefMaioridade(maioridade: Maioridade | null) {
  return maioridade ? `?maioridade=${maioridade}` : "?";
}

/**
 * Classificação de maioridade conferida (docs/43 §6 item 3; docs/42 L629). Era um <form method="get"> com
 * botão que recarregava a página, e o formulário de participantes tinha a maioridade no `key`: trocar a
 * classificação apagava nome, e-mail, documento, critério, representação e evidência de cada signatário.
 * Agora a troca é client-side (router.replace, sem rolar a tela) e o formulário — sem key — continua montado
 * com o que foi digitado; só os papéis exigidos se atualizam.
 */
export function SeletorMaioridade({ maioridade }: { maioridade: Maioridade | null }) {
  const router = useRouter();
  const [escolha, setEscolha] = useState<string>(maioridade ?? "");
  const nova: Maioridade | null = escolha === "MAIOR" || escolha === "MENOR" ? escolha : null;
  return <div className="flex flex-wrap items-end gap-3">
    <label>Classificação de maioridade conferida<select name="maioridade" value={escolha} onChange={(e) => setEscolha(e.target.value)} className="block rounded border p-2"><option value="">Ainda não conferida / não exigida pelas regras</option><option value="MAIOR">Maior de idade</option><option value="MENOR">Menor de idade</option></select></label>
    <button type="button" disabled={nova === maioridade} onClick={() => router.replace(hrefMaioridade(nova), { scroll: false })} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Atualizar papéis exigidos</button>
    <p className="text-sm">Atualizar os papéis não apaga o que já foi preenchido na conferência abaixo.</p>
  </div>;
}
