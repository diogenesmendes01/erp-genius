"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconQrcode, IconPencil, IconPlus, IconX } from "@tabler/icons-react";
import type { NumeroConfig } from "@/server/whatsapp/consultas";
import { conectarNumeroQr, consultarSessaoNumero, salvarNumeroWhatsApp } from "@/server/whatsapp/acoes";

// TELA DO NÚMERO (doc 26 §Camada 0/E3): cadastro (driver é atributo do NÚMERO — bimotor),
// estado de sessão Baileys e fluxo "conectar via QR" (Evolution). Soft-delete via ativo.

const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50";
const inputCls = "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500";

const SESSAO_BADGE: Record<string, { label: string; cls: string }> = {
  CONECTADO: { label: "conectado", cls: "bg-green-100 text-green-700" },
  AGUARDANDO_QR: { label: "aguardando QR", cls: "bg-amber-100 text-amber-700" },
  CAIU: { label: "sessão caiu", cls: "bg-red-100 text-red-700" },
  DESCONECTADO: { label: "desconectado", cls: "bg-gray-100 text-gray-600" },
};

interface FormNumero {
  id?: string;
  telefoneE164: string;
  rotulo: string;
  driver: "META_CLOUD" | "BAILEYS";
  finalidade: "COBRANCA" | "VENDAS";
  providerRef: string;
  donoId: string;
  ativo: boolean;
}

const FORM_VAZIO: FormNumero = {
  telefoneE164: "",
  rotulo: "",
  driver: "META_CLOUD",
  finalidade: "COBRANCA",
  providerRef: "",
  donoId: "",
  ativo: true,
};

export function NumerosPainel({
  numeros,
  vendedores,
}: {
  numeros: NumeroConfig[];
  vendedores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormNumero | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [qrDe, setQrDe] = useState<NumeroConfig | null>(null);

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    setErro(null);
    const r = await salvarNumeroWhatsApp(form);
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Erro ao salvar.");
    setForm(null);
    setNota("Número salvo.");
    router.refresh();
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Números</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Dois motores atrás da mesma porta: o driver é atributo do número, não do módulo.
          </p>
        </div>
        <button className={btnPri} onClick={() => setForm(FORM_VAZIO)}>
          <span className="flex items-center gap-1">
            <IconPlus className="h-4 w-4" /> Novo número
          </span>
        </button>
      </div>

      {erro && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {nota && <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{nota}</p>}

      {numeros.length === 0 && !form ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          Nenhum número cadastrado — o canal começa aqui.
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
          {numeros.map((n) => {
            const badge = SESSAO_BADGE[n.sessao] ?? SESSAO_BADGE.DESCONECTADO;
            return (
              <div key={n.id} className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{n.rotulo}</span>
                    <span className="text-xs text-gray-500">{n.telefoneE164}</span>
                    {!n.ativo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">inativo</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-600">
                      {n.driver === "META_CLOUD" ? "oficial (Meta Cloud)" : "baileys (Evolution)"}
                    </span>
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700">
                      {n.finalidade === "COBRANCA" ? "cobrança" : "vendas"}
                    </span>
                    {n.driver === "BAILEYS" && (
                      <span className={"rounded-full px-1.5 py-0.5 " + badge.cls}>{badge.label}</span>
                    )}
                    {n.donoNome && <span className="text-gray-500">dono: {n.donoNome}</span>}
                    {n.providerRef && <span className="text-gray-400">ref: {n.providerRef}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {n.driver === "BAILEYS" && n.ativo && (
                    <button className={btnSec} onClick={() => setQrDe(n)}>
                      <span className="flex items-center gap-1">
                        <IconQrcode className="h-3.5 w-3.5" /> Conectar QR
                      </span>
                    </button>
                  )}
                  <button
                    className={btnSec}
                    onClick={() =>
                      setForm({
                        id: n.id,
                        telefoneE164: n.telefoneE164,
                        rotulo: n.rotulo,
                        driver: n.driver as FormNumero["driver"],
                        finalidade: n.finalidade as FormNumero["finalidade"],
                        providerRef: n.providerRef ?? "",
                        donoId: n.donoId ?? "",
                        ativo: n.ativo,
                      })
                    }
                  >
                    <span className="flex items-center gap-1">
                      <IconPencil className="h-3.5 w-3.5" /> Editar
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">{form.id ? "Editar número" : "Novo número"}</span>
            <button className="text-gray-400 hover:text-gray-700" onClick={() => setForm(null)} aria-label="Fechar">
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-gray-600">
              Telefone (E.164)
              <input
                className={inputCls + " mt-1"}
                placeholder="+50688887777"
                value={form.telefoneE164}
                onChange={(e) => setForm({ ...form, telefoneE164: e.target.value })}
              />
            </label>
            <label className="text-xs text-gray-600">
              Rótulo
              <input
                className={inputCls + " mt-1"}
                placeholder="Cobrança · Vendas — Ana"
                value={form.rotulo}
                onChange={(e) => setForm({ ...form, rotulo: e.target.value })}
              />
            </label>
            <label className="text-xs text-gray-600">
              Driver
              <select
                className={inputCls + " mt-1"}
                value={form.driver}
                onChange={(e) => setForm({ ...form, driver: e.target.value as FormNumero["driver"] })}
              >
                <option value="META_CLOUD">Oficial (Meta Cloud API)</option>
                <option value="BAILEYS">Baileys (Evolution, via QR)</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Finalidade
              <select
                className={inputCls + " mt-1"}
                value={form.finalidade}
                onChange={(e) => setForm({ ...form, finalidade: e.target.value as FormNumero["finalidade"] })}
              >
                <option value="COBRANCA">Cobrança</option>
                <option value="VENDAS">Vendas</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              {form.driver === "META_CLOUD" ? "phone_number_id (Meta)" : "Instância Evolution"}
              <input
                className={inputCls + " mt-1"}
                placeholder={form.driver === "META_CLOUD" ? "ex.: 1065534…" : "gerado no conectar, se vazio"}
                value={form.providerRef}
                onChange={(e) => setForm({ ...form, providerRef: e.target.value })}
              />
            </label>
            <label className="text-xs text-gray-600">
              Dono da conversa (vendas)
              <select
                className={inputCls + " mt-1"}
                value={form.donoId}
                onChange={(e) => setForm({ ...form, donoId: e.target.value })}
              >
                <option value="">— sem dono —</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-brand-600"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Número ativo
            </label>
            <button className={btnPri} disabled={salvando} onClick={salvar}>
              {salvando ? "Salvando…" : "Salvar número"}
            </button>
          </div>
        </div>
      )}

      {qrDe && <QrModal numero={qrDe} onClose={() => { setQrDe(null); router.refresh(); }} />}
    </section>
  );
}

// Modal do QR: pede o QR à Evolution e faz poll do estado até conectar (doc 26 §sessão).
function QrModal({ numero, onClose }: { numero: NumeroConfig; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [estado, setEstado] = useState<string>(numero.sessao);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function pedirQr() {
    setCarregando(true);
    setErro(null);
    const r = await conectarNumeroQr(numero.id);
    setCarregando(false);
    if (!r.ok) return setErro(r.erro ?? "Erro ao conectar.");
    setQr(r.dado!.qrBase64);
    setEstado(r.dado!.estado);
    if (r.dado!.erro) setErro(r.dado!.erro);
  }

  useEffect(() => {
    void pedirQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll do estado a cada 5s enquanto o modal está aberto e não conectou.
  useEffect(() => {
    if (estado === "CONECTADO") return;
    const t = setInterval(async () => {
      const r = await consultarSessaoNumero(numero.id);
      if (r.ok) setEstado(r.dado!.sessao);
    }, 5000);
    return () => clearInterval(t);
  }, [estado, numero.id]);

  const badge = SESSAO_BADGE[estado] ?? SESSAO_BADGE.DESCONECTADO;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Conectar {numero.rotulo}</span>
          <button className="text-gray-400 hover:text-gray-700" onClick={onClose} aria-label="Fechar">
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          No celular do número: WhatsApp → aparelhos conectados → conectar aparelho.
        </p>
        <div className="mt-3 flex min-h-64 items-center justify-center rounded-md border border-gray-200 bg-white p-3">
          {estado === "CONECTADO" ? (
            <p className="text-sm text-green-700">Conectado! O número já envia e recebe por aqui.</p>
          ) : qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR de conexão" className="h-56 w-56" />
          ) : (
            <p className="text-sm text-gray-400">{carregando ? "Gerando QR…" : "Sem QR — tente atualizar."}</p>
          )}
        </div>
        {erro && <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{erro}</p>}
        <div className="mt-3 flex items-center justify-between">
          <span className={"rounded-full px-2 py-0.5 text-[11px] " + badge.cls}>{badge.label}</span>
          <button className={btnSec} disabled={carregando || estado === "CONECTADO"} onClick={pedirQr}>
            Atualizar QR
          </button>
        </div>
      </div>
    </div>
  );
}
