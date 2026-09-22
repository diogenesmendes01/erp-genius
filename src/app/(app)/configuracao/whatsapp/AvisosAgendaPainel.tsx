"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfiguracaoAvisosAgendaConfig } from "@/server/whatsapp/consultas";
import { salvarConfiguracaoAvisosAgenda } from "@/server/whatsapp/acoes";

const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm";

export function AvisosAgendaPainel({ config }: { config: ConfiguracaoAvisosAgendaConfig }) {
  const router = useRouter();
  const [numeroAvisosAgendaId, setNumero] = useState(config.numeroAvisosAgendaId ?? "");
  const [templateAvisosAgendaId, setTemplate] = useState(config.templateAvisosAgendaId ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const numeros = config.numeros.filter((n) => n.ativo && n.driver === "META_CLOUD" && !!n.providerRef);
  const templates = config.templates.filter((t) => t.statusMeta === "APROVADO" && t.metaTemplateId && t.categoria === "utility" && t.corpo.includes("{horarios}") && !/\{[^}]+\}/.test(t.corpo.replace(/\{(nome|horarios)\}/g, "")));

  async function salvar() {
    setSalvando(true); setErro(null);
    const r = await salvarConfiguracaoAvisosAgenda({ numeroAvisosAgendaId, templateAvisosAgendaId });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não foi possível salvar a configuração.");
    router.refresh();
  }

  return <section className="rounded-lg border border-gray-200 p-4">
    <h2 className="text-lg font-medium">Avisos de agenda</h2>
    <p className="mt-1 text-sm text-gray-500">Escolha o número institucional e o template Meta. Sem esta configuração, os avisos ficam preparados e não são enviados.</p>
    {erro && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-gray-600">Número institucional de agenda
        <select className={input} value={numeroAvisosAgendaId} onChange={(e) => setNumero(e.target.value)}>
          <option value="">Selecione um número Meta Cloud ativo</option>
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
    <p className="mt-3 text-xs text-gray-500">O template deve conter <code>{"{horarios}"}</code> e pode usar <code>{"{nome}"}</code>. O envio proativo usa somente Meta Cloud; Baileys não é habilitado para este canal.</p>
    <button className="mt-4 rounded-md bg-brand-solid px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" disabled={salvando || !numeroAvisosAgendaId || !templateAvisosAgendaId} onClick={salvar}>{salvando ? "Salvando…" : "Salvar canal de agenda"}</button>
  </section>;
}
