"use client";

import { useState } from "react";
import type { AcaoAgenteIATipo, EtapaLead } from "@prisma/client";
import { Aviso } from "@/components/Aviso";
import { Botao } from "@/components/Botao";
import { ACAO_AGENTE_IA_LABEL, ETAPA_LABEL } from "@/lib/labels";
import { ACOES_MATRIZ, ETAPAS_ARIA, PREDEFINICOES, type ConfigAria, type Matriz, type ModoAcao } from "@/server/aria/config-schema";
import type { RascunhoAberto } from "@/server/aria/versoes";
import { Salvar } from "./Salvar";

type Props = {
  config: ConfigAria;
  baseVersaoId: string | null;
  rascunho: RascunhoAberto;
  /** Só quem tem `editarMatriz` (Administrador). */
  podeEditar: boolean;
};

const PROXIMO: Record<ModoAcao, ModoAcao> = { EXECUTA: "SUGERE", SUGERE: "NAO_FAZ", NAO_FAZ: "EXECUTA" };
const TEXTO: Record<ModoAcao, string> = { EXECUTA: "Executa", SUGERE: "Sugere", NAO_FAZ: "Não faz" };
const SIMBOLO: Record<ModoAcao, string> = { EXECUTA: "●", SUGERE: "◐", NAO_FAZ: "○" };
const COR: Record<ModoAcao, string> = {
  EXECUTA: "bg-green-100 text-green-700",
  SUGERE: "bg-amber-100 text-amber-800",
  NAO_FAZ: "bg-gray-100 text-gray-600",
};
// Ações com decisão própria (handoff e triagem de setor) ficam fora da matriz.
const modoDe = (m: Matriz, etapa: EtapaLead, acao: AcaoAgenteIATipo): ModoAcao => m[etapa]?.[acao] ?? "NAO_FAZ";

export function Permissoes({ config, baseVersaoId, rascunho, podeEditar }: Props) {
  const [matriz, setMatriz] = useState<Matriz>(config.matriz);
  const alterado = JSON.stringify(matriz) !== JSON.stringify(config.matriz);

  function ciclar(etapa: EtapaLead, acao: AcaoAgenteIATipo) {
    setMatriz((m) => ({ ...m, [etapa]: { ...m[etapa], [acao]: PROXIMO[modoDe(m, etapa, acao)] } }));
  }

  return (
    <section aria-labelledby="titulo-permissoes">
      <h2 id="titulo-permissoes" className="text-lg font-semibold text-gray-900">O que a Aria pode fazer em cada etapa</h2>
      {podeEditar ? (
        <p className="mt-1 text-sm text-gray-600">Clique numa célula para alternar entre executa, sugere e não faz. Mesmo com “Executa”, a Aria só age sozinha quando a confiança passa do limite da aba Confiança.</p>
      ) : (
        <Aviso tom="info" className="mt-2">Só um Admin altera o que a Aria pode fazer. Você vê a matriz atual, sem editar.</Aviso>
      )}

      {podeEditar && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">Partir de um modelo:</span>
          <Botao variante="secundario" tamanho="sm" onClick={() => setMatriz(structuredClone(PREDEFINICOES.SUPERVISAO))}>Supervisão</Botao>
          <Botao variante="secundario" tamanho="sm" onClick={() => setMatriz(structuredClone(PREDEFINICOES.EQUILIBRADO))}>Equilibrado</Botao>
          <Botao variante="secundario" tamanho="sm" onClick={() => setMatriz(structuredClone(PREDEFINICOES.AUTONOMO))}>Autônomo</Botao>
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-3 text-xs text-gray-700" aria-label="Legenda">
        {(Object.keys(TEXTO) as ModoAcao[]).map((m) => (
          <li key={m} className={`rounded-full px-2 py-0.5 ${COR[m]}`}>{SIMBOLO[m]} {TEXTO[m]}</li>
        ))}
      </ul>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border-soft">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium text-gray-800">Etapa</th>
              {ACOES_MATRIZ.map((a) => (
                <th key={a} scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-800">{ACAO_AGENTE_IA_LABEL[a]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ETAPAS_ARIA.map((etapa) => (
              <tr key={etapa} className="border-t border-border-soft">
                <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-2 text-left font-medium text-gray-800">{ETAPA_LABEL[etapa]}</th>
                {ACOES_MATRIZ.map((acao) => {
                  const modo = modoDe(matriz, etapa, acao);
                  const nome = `${ETAPA_LABEL[etapa]}, ${ACAO_AGENTE_IA_LABEL[acao]}: ${TEXTO[modo]}`;
                  return (
                    <td key={acao} className="px-1 py-1">
                      {podeEditar ? (
                        <Botao
                          variante="fantasma"
                          tamanho="sm"
                          data-acao="ciclar-celula"
                          data-etapa={etapa}
                          data-tipo={acao}
                          data-modo={modo}
                          aria-label={nome}
                          className={`w-full whitespace-nowrap ${COR[modo]}`}
                          onClick={() => ciclar(etapa, acao)}
                        >
                          {SIMBOLO[modo]} {TEXTO[modo]}
                        </Botao>
                      ) : (
                        <span data-etapa={etapa} data-tipo={acao} data-modo={modo} className={`inline-block w-full whitespace-nowrap rounded-full px-3 py-1 text-xs ${COR[modo]}`}>
                          {SIMBOLO[modo]} {TEXTO[modo]}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {podeEditar && <Salvar montar={() => ({ ...config, matriz })} baseVersaoId={baseVersaoId} rascunho={rascunho} alterado={alterado} />}
    </section>
  );
}
