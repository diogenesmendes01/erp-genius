"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PerfilNumeroDados } from "@/server/crm-config/perfil-numero";
import { atualizarPerfilNumero, atualizarPrivacidadeNumero, definirTemporariasNumero, uploadIdPorUrl } from "@/server/crm-config/perfil-numero";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";

// Perfil, privacidade e mensagens temporárias de cada número MOTOR (só ADMINISTRADOR).
// O motor é chamado primeiro; se ele recusar, nada é salvo no ERP.

const btn = botaoClasses({ tamanho: "sm" });
const input = "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500";
type Vis = "TODOS" | "CONTATOS" | "NINGUEM";
const VIS: { v: Vis; l: string }[] = [
  { v: "TODOS", l: "Todos" },
  { v: "CONTATOS", l: "Meus contatos" },
  { v: "NINGUEM", l: "Ninguém" },
];
const DURACOES = [
  { s: 0, l: "Desligadas" },
  { s: 86400, l: "24 horas" },
  { s: 604800, l: "7 dias" },
  { s: 7776000, l: "90 dias" },
] as const;
const PRIV_PADRAO = { vistoPorUltimo: "CONTATOS", foto: "CONTATOS", recado: "CONTATOS", grupos: "CONTATOS" } as const;

export function PerfilNumeroPainel({ numeros }: { numeros: PerfilNumeroDados[] }) {
  if (numeros.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold">Perfil, privacidade e mensagens temporárias</h2>
      <p className="mt-1 text-sm text-gray-600">Só o administrador altera. A mudança vai primeiro ao WhatsApp do número; se o motor recusar, nada é salvo aqui.</p>
      {numeros.map((n) => (
        <PainelDoNumero key={n.id} n={n} />
      ))}
    </section>
  );
}

function PainelDoNumero({ n }: { n: PerfilNumeroDados }) {
  const router = useRouter();
  const [nome, setNome] = useState(n.perfilNome ?? "");
  const [recado, setRecado] = useState(n.perfilRecado ?? "");
  const [foto, setFoto] = useState<File | null>(null);
  const [priv, setPriv] = useState(n.privacidade ?? PRIV_PADRAO);
  const [segundos, setSegundos] = useState<number>(n.temporariasSegundos);
  const [confirmacao, setConfirmacao] = useState("");
  const aPerfil = useAcaoCliente({ idempotente: true });
  const aPriv = useAcaoCliente({ idempotente: true });
  const aTemp = useAcaoCliente({ idempotente: true });

  async function salvarPerfil() {
    const d = await aPerfil.executar(async () => {
      let fotoUploadId: string | undefined;
      if (foto) {
        // O motor recusa foto acima de 128 KB: avisa antes de enviar, com a mensagem certa.
        if (foto.size > 128 * 1024) return { ok: false as const, erro: "A foto pode ter no máximo 128 KB. Reduza a imagem e tente de novo." };
        const form = new FormData();
        form.append("file", foto);
        const resp = await fetch("/api/upload", { method: "POST", body: form });
        if (!resp.ok) return { ok: false as const, erro: "Não foi possível enviar a foto (JPEG ou PNG, até 128 KB)." };
        const { url } = (await resp.json()) as { url: string };
        const id = await uploadIdPorUrl(url);
        if (!id.ok || !id.dado) return { ok: false as const, erro: "Arquivo enviado não encontrado." };
        fotoUploadId = id.dado.id;
      }
      return atualizarPerfilNumero({ numeroId: n.id, nome: nome.trim() || undefined, recado, fotoUploadId });
    }, "Perfil salvo.");
    if (d?.tipo === "ok") router.refresh();
  }

  async function salvarPriv() {
    const d = await aPriv.executar(() => atualizarPrivacidadeNumero({ numeroId: n.id, privacidade: priv }), "Privacidade salva.");
    if (d?.tipo === "ok") router.refresh();
  }

  async function salvarTemp() {
    const d = await aTemp.executar(
      () => definirTemporariasNumero({ numeroId: n.id, segundos: segundos as 0 | 86400 | 604800 | 7776000, confirmacao }),
      "Mensagens temporárias salvas.",
    );
    if (d?.tipo === "ok") {
      setConfirmacao("");
      router.refresh();
    }
  }

  const campoVis = (campo: keyof typeof priv, rotulo: string) => (
    <label className="block text-xs text-gray-600">
      {rotulo}
      <select className={input + " mt-1"} value={priv[campo]} onChange={(e) => setPriv({ ...priv, [campo]: e.target.value as Vis })}>
        {VIS.filter((o) => !(campo === "grupos" && o.v === "NINGUEM")).map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-surface p-4">
      <h3 className="text-sm font-medium">
        {n.rotulo} <span className="text-gray-500">{n.telefoneE164}</span>
      </h3>
      {!n.conectado && <p className="mt-1 text-xs text-amber-700">O número não está conectado agora; reconecte para alterar.</p>}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-600">
          Nome do perfil (1 a 25 caracteres)
          <input className={input + " mt-1"} maxLength={25} value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="block text-xs text-gray-600">
          Recado (até 139 caracteres)
          <input className={input + " mt-1"} maxLength={139} value={recado} onChange={(e) => setRecado(e.target.value)} />
        </label>
        <label className="block text-xs text-gray-600 sm:col-span-2">
          Foto (JPEG ou PNG, até 128 KB)
          <input type="file" accept="image/jpeg,image/png" className="mt-1 block text-sm" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" className={btn} disabled={aPerfil.ocupado || !n.conectado} onClick={salvarPerfil}>
          {aPerfil.ocupado ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>
      <FeedbackAcao erro={aPerfil.erro} sucesso={aPerfil.sucesso} className="mt-2" />

      <div className="mt-4 border-t border-gray-100 pt-3">
        <span className="text-sm font-medium">Privacidade</span>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          {campoVis("vistoPorUltimo", "Visto por último")}
          {campoVis("foto", "Foto do perfil")}
          {campoVis("recado", "Recado")}
          {campoVis("grupos", "Adicionar a grupos")}
        </div>
        <p className="mt-2 text-xs text-gray-500">A confirmação de leitura é automática e não é configurável.</p>
        <div className="mt-2 flex justify-end">
          <button type="button" className={btn} disabled={aPriv.ocupado || !n.conectado} onClick={salvarPriv}>
            {aPriv.ocupado ? "Salvando…" : "Salvar privacidade"}
          </button>
        </div>
        <FeedbackAcao erro={aPriv.erro} sucesso={aPriv.sucesso} className="mt-2" />
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3">
        <span className="text-sm font-medium">Mensagens temporárias</span>
        <p className="mt-1 text-xs text-gray-500">
          Desligado preserva histórico e auditoria. Vale para conversas novas; ligar apaga mensagens no aparelho depois do prazo, então exige confirmação.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-gray-600">
            Duração
            <select className={input + " mt-1"} value={segundos} onChange={(e) => setSegundos(Number(e.target.value))}>
              {DURACOES.map((o) => (
                <option key={o.s} value={o.s}>
                  {o.l}
                </option>
              ))}
            </select>
          </label>
          {segundos > 0 && (
            <label className="block text-xs text-gray-600">
              Digite &quot;ativar temporárias&quot; para confirmar
              <input className={input + " mt-1"} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
            </label>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <button type="button" className={btn} disabled={aTemp.ocupado || !n.conectado} onClick={salvarTemp}>
            {aTemp.ocupado ? "Salvando…" : "Salvar temporárias"}
          </button>
        </div>
        <FeedbackAcao erro={aTemp.erro} sucesso={aTemp.sucesso} className="mt-2" />
      </div>
    </div>
  );
}
