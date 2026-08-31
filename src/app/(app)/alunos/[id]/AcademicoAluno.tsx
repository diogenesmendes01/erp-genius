"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarAcessoPortal, registrarTesteNivel } from "@/server/academico/acoes";

// FASE 3 — bloco ACADÊMICO da ficha do aluno: teste de nível (registro auditável que
// alimenta o nível inicial da matrícula), certificados emitidos e acesso ao PORTAL.

const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60";
const inputCls = "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

export function AcademicoAluno({
  alunoId,
  niveis,
  testes,
  certificados,
  temAcessoPortal,
  podeEditar,
}: {
  alunoId: string;
  niveis: { id: string; label: string }[];
  testes: { id: string; nivel: string; pontuacao: number | null; dataISO: string }[];
  certificados: { nivel: string; codigoValidacao: string; emitidoEmISO: string }[];
  temAcessoPortal: boolean;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [nivelId, setNivelId] = useState("");
  const [pontuacao, setPontuacao] = useState("");

  const [portalAberto, setPortalAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function run(p: Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    setOcupado(true);
    setErro(null);
    setNota(null);
    const r = await p;
    setOcupado(false);
    if (!r.ok) return setErro(r.erro ?? "Erro.");
    setNota(sucesso);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="mb-3 font-medium">Acadêmico</h2>
      {erro && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {nota && <p className="mb-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{nota}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-medium text-gray-700">Testes de nível</h3>
          {testes.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum teste registrado.</p>
          ) : (
            <ul className="space-y-1 text-sm text-gray-700">
              {testes.map((t) => (
                <li key={t.id}>
                  {t.nivel}
                  {t.pontuacao !== null ? ` · ${t.pontuacao} pts` : ""} ·{" "}
                  <span className="text-gray-400">{new Date(t.dataISO).toLocaleDateString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
          {podeEditar && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select className={inputCls} value={nivelId} onChange={(e) => setNivelId(e.target.value)}>
                <option value="">Nível resultante…</option>
                {niveis.map((n) => (
                  <option key={n.id} value={n.id}>{n.label}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                className={inputCls + " w-24"}
                placeholder="Pts"
                value={pontuacao}
                onChange={(e) => setPontuacao(e.target.value)}
              />
              <button
                className={btnSec}
                disabled={ocupado || !nivelId}
                onClick={() =>
                  run(
                    registrarTesteNivel({
                      alunoId,
                      nivelId,
                      pontuacao: pontuacao ? Number(pontuacao) : undefined,
                    }),
                    "Teste de nível registrado.",
                  )
                }
              >
                Registrar teste
              </button>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-1 text-sm font-medium text-gray-700">Certificados</h3>
          {certificados.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum certificado emitido.</p>
          ) : (
            <ul className="space-y-1 text-sm text-gray-700">
              {certificados.map((c) => (
                <li key={c.codigoValidacao}>
                  {c.nivel} · código <span className="font-mono text-xs">{c.codigoValidacao}</span> ·{" "}
                  <span className="text-gray-400">{new Date(c.emitidoEmISO).toLocaleDateString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-1 mt-4 text-sm font-medium text-gray-700">Portal do aluno</h3>
          {temAcessoPortal ? (
            <p className="text-sm text-green-700">Acesso ao portal ativo. ✅</p>
          ) : podeEditar ? (
            <div>
              {!portalAberto ? (
                <button className={btnSec} onClick={() => setPortalAberto(true)}>Criar acesso ao portal</button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className={inputCls + " w-56"}
                    placeholder="E-mail de login"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    type="password"
                    className={inputCls + " w-40"}
                    placeholder="Senha (mín. 8)"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <button
                    className={btnPri}
                    disabled={ocupado || !email || senha.length < 8}
                    onClick={() =>
                      run(criarAcessoPortal({ alunoId, email, senha }), "Acesso ao portal criado.")
                    }
                  >
                    Criar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sem acesso ao portal.</p>
          )}
        </div>
      </div>
    </section>
  );
}
