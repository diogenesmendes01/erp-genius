"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirPrecoPreparacao } from "@/server/matricula/preparacao-preco";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { botaoClasses } from "@/components/Botao";
export function DecidirPreco({ preparacaoId, podeAprovar }: { preparacaoId: string; podeAprovar: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState(""); const [erro, setErro] = useState(""); const [ocupado, iniciar] = useTransition();
  function decidir(aprovar: boolean) {
    iniciar(async () => {
      try {
        const r = await decidirPrecoPreparacao({ preparacaoId, aprovar, motivo });
        if (!r.ok) { setErro(r.erro); return; }
        router.refresh();
      } catch { setErro(MSG_DECISAO_INCERTA); }
    });
  }
  return <section className="space-y-3 rounded border p-4"><h3 className="font-medium">Decidir exceção de preço</h3>
    <p>A decisão trata dos valores propostos acima. Cadastro, contrato, pagamentos e ativação conservam suas próprias conferências.</p>
    <label className="block">Motivo da decisão<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={2000} disabled={ocupado} className="block w-full rounded border p-2" /></label>
    <div className="flex gap-3"><button disabled={ocupado || !podeAprovar || motivo.trim().length < 5} onClick={() => decidir(true)} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Aprovar exceção de preço</button><button disabled={ocupado || motivo.trim().length < 5} onClick={() => decidir(false)} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Rejeitar exceção</button></div>
    {erro && <p role="alert">{erro}</p>}
  </section>;
}
