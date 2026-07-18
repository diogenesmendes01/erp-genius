"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfigComercialView } from "@/server/comercial/consultas";
import { salvarConfigComercial } from "@/server/comercial/acoes";

// COMERCIAL — C1 (doc 27): auto-lead + saudação automática. Toggles INDEPENDENTES, ambos
// nascem desligados (regra de ouro: toda automação nasce desligada). A saudação é a única
// mensagem automática que o robô manda ao lead nesta fase — texto fixo, nunca IA.

const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

export function ComercialPainel({ config }: { config: ConfigComercialView }) {
  const router = useRouter();
  const [autoLeadAtivo, setAutoLead] = useState(config.autoLeadAtivo);
  const [saudacaoAtiva, setSaudacao] = useState(config.saudacaoAtiva);
  const [saudacaoTexto, setTexto] = useState(config.saudacaoTexto);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  async function salvar() {
    setOcupado(true);
    setErro(null);
    setNota(null);
    const r = await salvarConfigComercial({ autoLeadAtivo, saudacaoAtiva, saudacaoTexto });
    setOcupado(false);
    if (!r.ok) return setErro(r.erro ?? "Erro ao salvar.");
    setNota("Configuração comercial salva.");
    router.refresh();
  }

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-medium">Comercial — captura e saudação</h2>
        <p className="mt-1 text-sm text-gray-500">
          Automação do 1º contato pelo número de vendas. Tudo começa desligado; ligue quando o piloto validar.
        </p>
      </div>

      {erro && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {nota && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{nota}</p>}

      <div className="space-y-4 rounded-lg border border-gray-200 bg-surface p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand-600"
            checked={autoLeadAtivo}
            onChange={(e) => setAutoLead(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium">Criar lead automaticamente</span>
            <span className="block text-gray-500">
              No 1º inbound de um número de vendas, cria um lead (com a origem do anúncio, quando houver). Telefone que
              já é aluno, responsável ou lead só é vinculado — nunca duplica.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand-600"
            checked={saudacaoAtiva}
            onChange={(e) => setSaudacao(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium">Enviar saudação automática</span>
            <span className="block text-gray-500">
              Responde o 1º inbound em segundos, fora da janela de horário. Texto fixo (a IA não fala com o lead nesta fase).
            </span>
          </span>
        </label>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Texto da saudação</label>
          <textarea
            className={inputCls}
            rows={3}
            value={saudacaoTexto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={!saudacaoAtiva}
            placeholder="Olá! Recebemos sua mensagem e já retornamos. 😊"
          />
        </div>

        <button className={btnPri} disabled={ocupado} onClick={salvar}>
          {ocupado ? "Salvando…" : "Salvar configuração comercial"}
        </button>
      </div>
    </section>
  );
}
