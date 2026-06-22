"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { EtapaLead, Segmento, Temperatura } from "@prisma/client";
import {
  ETAPA_LABEL,
  SEGMENTO_LABEL,
  TEMPERATURA_LABEL,
  TEMPERATURA_CLS,
} from "@/lib/labels";
import { LeadFormulario } from "./LeadFormulario";

export interface LeadRow {
  id: string;
  codigo: string | null;
  nome: string;
  telefoneE164: string | null;
  segmento: Segmento;
  temperatura: Temperatura;
  etapa: EtapaLead;
  b2b: boolean;
  pais: { nome: string } | null;
  vendedor: { nome: string } | null;
}

const selCls =
  "rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500";

export function LeadsLista({
  leads,
  paises,
  vendedores,
  podeAtribuir,
}: {
  leads: LeadRow[];
  paises: { id: string; nome: string }[];
  vendedores: { id: string; nome: string }[];
  podeAtribuir: boolean;
}) {
  const [novo, setNovo] = useState(false);
  const [fEtapa, setEtapa] = useState("");
  const [fSeg, setSeg] = useState("");
  const [fTemp, setTemp] = useState("");
  const [fTipo, setTipo] = useState("");

  const filtrados = useMemo(
    () =>
      leads.filter(
        (l) =>
          (!fEtapa || l.etapa === fEtapa) &&
          (!fSeg || l.segmento === fSeg) &&
          (!fTemp || l.temperatura === fTemp) &&
          (!fTipo || (fTipo === "b2b" ? l.b2b : !l.b2b)),
      ),
    [leads, fEtapa, fSeg, fTemp, fTipo],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-medium">Leads</h1>
        {!novo && (
          <button
            onClick={() => setNovo(true)}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <IconPlus className="h-4 w-4" /> Novo lead
          </button>
        )}
      </div>

      {novo && (
        <div className="mb-6">
          <LeadFormulario
            paises={paises}
            vendedores={vendedores}
            podeAtribuir={podeAtribuir}
            onClose={() => setNovo(false)}
          />
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <select value={fTipo} onChange={(e) => setTipo(e.target.value)} className={selCls}>
          <option value="">PF e B2B</option>
          <option value="pf">Pessoa Física</option>
          <option value="b2b">Empresa (B2B)</option>
        </select>
        <select value={fEtapa} onChange={(e) => setEtapa(e.target.value)} className={selCls}>
          <option value="">Todas as etapas</option>
          {Object.values(EtapaLead).map((e) => (
            <option key={e} value={e}>
              {ETAPA_LABEL[e]}
            </option>
          ))}
        </select>
        <select value={fSeg} onChange={(e) => setSeg(e.target.value)} className={selCls}>
          <option value="">Todos os segmentos</option>
          {Object.values(Segmento).map((s) => (
            <option key={s} value={s}>
              {SEGMENTO_LABEL[s]}
            </option>
          ))}
        </select>
        <select value={fTemp} onChange={(e) => setTemp(e.target.value)} className={selCls}>
          <option value="">Toda temperatura</option>
          {Object.values(Temperatura).map((t) => (
            <option key={t} value={t}>
              {TEMPERATURA_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Lead</th>
              <th className="px-4 py-2 font-medium">Segmento</th>
              <th className="px-4 py-2 font-medium">Etapa</th>
              <th className="px-4 py-2 font-medium">Temp.</th>
              <th className="px-4 py-2 font-medium">País</th>
              <th className="px-4 py-2 font-medium">Dono</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                  Nenhum lead.
                </td>
              </tr>
            ) : (
              filtrados.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium text-brand-700 hover:underline">
                      {l.nome}
                    </Link>
                    <div className="text-xs text-gray-400">
                      {l.codigo}
                      {l.b2b && " · B2B"}
                      {l.telefoneE164 && ` · ${l.telefoneE164}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{SEGMENTO_LABEL[l.segmento]}</td>
                  <td className="px-4 py-3 text-gray-600">{ETAPA_LABEL[l.etapa]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " + TEMPERATURA_CLS[l.temperatura]
                      }
                    >
                      {TEMPERATURA_LABEL[l.temperatura]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.pais?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{l.vendedor?.nome ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
