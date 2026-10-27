"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { botaoClasses } from "@/components/Botao";

export type Maioridade = "MAIOR" | "MENOR";

export function hrefMaioridade(maioridade: Maioridade | null) {
  return maioridade ? `?maioridade=${maioridade}` : "?";
}

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
