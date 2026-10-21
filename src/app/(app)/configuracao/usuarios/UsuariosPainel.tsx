"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Papel } from "@prisma/client";
import { IconPlus } from "@tabler/icons-react";
import { PAPEL_LABEL } from "@/lib/labels";
import { definirUsuarioAtivo } from "@/server/acesso/acoes";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { UsuarioFormulario, type UsuarioParaEditar } from "./UsuarioFormulario";
import { botaoClasses } from "@/components/Botao";

export interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  papeis: Papel[];
  ativo: boolean;
  limiteDescontoPct: number | null;
  limiteDescontoTaxaPct: number | null;
  limiteDescontoMensalidadePct: number | null;
  permissoes: string[];
  gerenteComercialId: string | null;
  ultimoAcesso: string | null; // ISO ou null
}

function formatarAcesso(iso: string | null, preferenciaFusoExibicao: string | null): string {
  if (!iso) return "nunca";
  const instante = formatarInstanteExibicao(iso, preferenciaFusoExibicao, "UTC");
  return `${instante.texto} (horário exibido em ${instante.fuso}; origem UTC)`;
}

export function UsuariosPainel({ usuarios, preferenciaFusoExibicao = null }: { usuarios: UsuarioRow[]; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  // Ativar/desativar manda o estado-alvo (B4, #175 C2): repetir depois de uma falha de rede, ou confirmar com a
  // tela velha o que um colega já aplicou, não desfaz nada — o servidor trata o mesmo estado como no-op.
  const acao = useAcaoCliente({ idempotente: true });
  // O erro aparece na linha do usuário cujo botão disparou a ação, não no topo da lista.
  const [alvo, setAlvo] = useState<string | null>(null);
  const [form, setForm] = useState<"none" | "novo" | { editar: UsuarioParaEditar }>("none");

  async function ativar(id: string) {
    setAlvo(id);
    const desfecho = await acao.executar(() => definirUsuarioAtivo(id, true), "Usuário ativado.");
    if (desfecho?.tipo === "ok") router.refresh();
  }

  // Desativar tira a pessoa do sistema na hora (docs/42 L2413): o botão só abre a confirmação, que nomeia a
  // pessoa; a action roda no ConfirmarAcao, que mostra a falha dentro dele. Ativar continua direto.
  const [desativando, setDesativando] = useState<UsuarioRow | null>(null);
  function pedirDesativacao(u: UsuarioRow) {
    setAlvo(u.id);
    acao.limpar();
    setDesativando(u);
  }
  function desativado(u: UsuarioRow) {
    setDesativando(null);
    setAlvo(u.id);
    acao.setSucesso("Usuário desativado.");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">Papéis, equipes, alçadas e permissões específicas.</p>
        {form === "none" && (
          <button
            onClick={() => setForm("novo")}
            className={botaoClasses({ tamanho: "lg" })}
          >
            <IconPlus className="h-4 w-4" /> Novo usuário
          </button>
        )}
      </div>

      {form !== "none" && (
        <div className="mb-6">
          <UsuarioFormulario
            usuario={typeof form === "object" ? form.editar : undefined}
            gerentes={usuarios.filter((u) => u.ativo && u.papeis.includes(Papel.GERENTE_COMERCIAL))}
            onClose={() => setForm("none")}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-100 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Usuário</th>
              <th className="px-4 py-2 font-medium">Papéis</th>
              <th className="px-4 py-2 font-medium">Taxa / mensalidade</th>
              <th className="px-4 py-2 font-medium">Último acesso</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{u.nome}</div>
                  <span className="text-xs text-gray-400">{u.email}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {u.papeis.map((p) => PAPEL_LABEL[p]).join(", ")}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {u.limiteDescontoTaxaPct ?? 0}% / {u.limiteDescontoMensalidadePct ?? 0}%
                </td>
                <td className="px-4 py-3 text-gray-500">{formatarAcesso(u.ultimoAcesso, preferenciaFusoExibicao)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs font-medium " +
                      (u.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")
                    }
                  >
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() =>
                        setForm({
                          editar: {
                            id: u.id,
                            nome: u.nome,
                            email: u.email,
                            papeis: u.papeis,
                            limiteDescontoPct: u.limiteDescontoPct,
                            limiteDescontoTaxaPct: u.limiteDescontoTaxaPct,
                            limiteDescontoMensalidadePct: u.limiteDescontoMensalidadePct,
                            permissoes: u.permissoes,
                            gerenteComercialId: u.gerenteComercialId,
                          },
                        })
                      }
                      className={botaoClasses({ variante: "fantasma", tamanho: "sm" })}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => (u.ativo ? pedirDesativacao(u) : ativar(u.id))}
                      disabled={acao.ocupado || desativando !== null}
                      className={botaoClasses({ variante: u.ativo ? "perigo" : "fantasma", tamanho: "sm" })}
                    >
                      {u.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                  <FeedbackAcao erro={alvo === u.id ? acao.erro : null} sucesso={alvo === u.id ? acao.sucesso : undefined} className="mt-2" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {desativando && (
        <ConfirmarAcao
          titulo={`Desativar o acesso de ${desativando.nome}?`}
          confirmacao="desativação do acesso"
          idempotente
          acao={() => definirUsuarioAtivo(desativando.id, false)}
          aoConcluir={() => desativado(desativando)}
          aoCancelar={() => setDesativando(null)}
        >
          <p>{desativando.nome} ({desativando.email}) perde o acesso ao sistema na hora.</p>
          {desativando.papeis.length > 0 && <p>Papéis que deixam de valer: {desativando.papeis.map((p) => PAPEL_LABEL[p]).join(", ")}.</p>}
          <p>O cadastro e o histórico ficam guardados; para devolver o acesso, use &quot;Ativar&quot; nesta lista.</p>
        </ConfirmarAcao>
      )}
    </div>
  );
}
