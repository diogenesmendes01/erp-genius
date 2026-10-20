"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfiguracaoAvisosAgendaConfig } from "@/server/whatsapp/consultas";
import { salvarConfiguracaoAvisosAgenda } from "@/server/whatsapp/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";

const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm";

export function AvisosAgendaPainel({ config }: { config: ConfiguracaoAvisosAgendaConfig }) {
  const router = useRouter();
  const [numeroAvisosAgendaId, setNumero] = useState(config.numeroAvisosAgendaId ?? "");
  const [templateAvisosAgendaId, setTemplate] = useState(config.templateAvisosAgendaId ?? "");
  // salvarConfiguracaoAvisosAgenda não recebe chave de idempotência: resultado incerto manda conferir.
  // Idempotente por natureza (#166): número e template dos avisos vão por upsert na configuração única da escola.
  const acao = useAcaoCliente({ idempotente: true });
  const numeros = config.numeros.filter((n) => n.ativo && n.driver === "MOTOR");
  const templates = config.templates.filter((t) => t.corpo.includes("{horarios}") && !/\{[^}]+\}/.test(t.corpo.replace(/\{(nome|horarios)\}/g, "")));

  async function salvar() {
    const d = await acao.executar(() => salvarConfiguracaoAvisosAgenda({ numeroAvisosAgendaId, templateAvisosAgendaId }));
    if (d?.tipo === "ok") router.refresh();
  }

  return <section className="rounded-lg border border-gray-200 p-4">
    <h2 className="text-lg font-medium">Avisos de agenda</h2>
    <p className="mt-1 text-sm text-gray-500">Escolha o número institucional do motor WhatsApp e o template do aviso. Sem esta configuração, os avisos ficam preparados e não são enviados.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-gray-600">Número institucional de agenda
        <select className={input} value={numeroAvisosAgendaId} onChange={(e) => setNumero(e.target.value)}>
          <option value="">Selecione um número ativo do motor</option>
          {numeros.map((n) => <option key={n.id} value={n.id}>{n.rotulo} · {n.providerRef}</option>)}
        </select>
      </label>
      <label className="text-xs text-gray-600">Template utility aprovado
        <select className={input} value={templateAvisosAgendaId} onChange={(e) => setTemplate(e.target.value)}>
          <option value="">Selecione um template</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.nome} · {t.idioma}</option>)}
        </select>
      </label>
    </div>
    <p className="mt-3 text-xs text-gray-500">O template deve conter <code>{"{horarios}"}</code> e pode usar <code>{"{nome}"}</code>. O envio proativo sai pelo motor WhatsApp; números Baileys legados não são habilitados para este canal.</p>
    <button className={`${botaoClasses({ tamanho: "md" })} mt-4`} disabled={acao.ocupado || !numeroAvisosAgendaId || !templateAvisosAgendaId} onClick={salvar}>{acao.ocupado ? "Salvando…" : "Salvar canal de agenda"}</button>
    <FeedbackAcao erro={acao.erro} className="mt-3" />
  </section>;
}
