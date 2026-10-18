"use client";

import { useState } from "react";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import type { ConfigAria } from "@/server/aria/config-schema";
import { CONTROLE, emLinhas } from "./Campos";
import { Salvar } from "./Salvar";

type Props = { config: ConfigAria; baseVersaoId: string | null; podeEditar: boolean };

const TONS: { valor: ConfigAria["tons"][number]; rotulo: string }[] = [
  { valor: "AMIGAVEL", rotulo: "Amigável" },
  { valor: "PROFISSIONAL", rotulo: "Profissional" },
  { valor: "DIRETO", rotulo: "Direto" },
  { valor: "ENTUSIASMADO", rotulo: "Entusiasmado" },
  { valor: "FORMAL", rotulo: "Formal" },
  { valor: "ACOLHEDOR", rotulo: "Acolhedor" },
];
const TAMANHOS: { valor: ConfigAria["tamanho"]; rotulo: string }[] = [
  { valor: "CURTA", rotulo: "Curtas" },
  { valor: "MEDIA", rotulo: "Médias" },
  { valor: "DETALHADA", rotulo: "Detalhadas" },
];
const LIMITE_INSTRUCOES = 2500;

export function Comportamento({ config, baseVersaoId, podeEditar }: Props) {
  const [c, setC] = useState<ConfigAria>(config);
  const [novo, setNovo] = useState({ fala: "", assim: "", evite: "" });
  const alterado = JSON.stringify(c) !== JSON.stringify(config);
  const set = <K extends keyof ConfigAria>(k: K, v: ConfigAria[K]) => setC((x) => ({ ...x, [k]: v }));
  const setPolitica = (tipo: "MATRICULA" | "MENSALIDADE", campo: "descontoSemAprovacaoPct" | "descontoComAprovacaoPct", v: number) =>
    setC((x) => ({ ...x, politicas: { ...x.politicas, [tipo]: { ...x.politicas[tipo], [campo]: v } } }));
  const alternarTom = (t: (typeof TONS)[number]["valor"]) =>
    set("tons", c.tons.includes(t) ? (c.tons.length > 1 ? c.tons.filter((x) => x !== t) : c.tons) : [...c.tons, t].slice(-2));
  const ro = !podeEditar;

  return (
    <section aria-labelledby="titulo-comportamento" className="space-y-6">
      <h2 id="titulo-comportamento" className="text-lg font-semibold text-gray-900">Como a Aria deve trabalhar</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome" obrigatorio dica="Aparece na primeira mensagem de cada atendimento.">
          {(campo) => <input {...campo} className={CONTROLE} maxLength={40} value={c.nome} readOnly={ro} onChange={(e) => set("nome", e.target.value)} />}
        </Campo>
        <Campo rotulo="Função" obrigatorio>
          {(campo) => <input {...campo} className={CONTROLE} maxLength={80} value={c.funcao} readOnly={ro} onChange={(e) => set("funcao", e.target.value)} />}
        </Campo>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-gray-800">Tom de voz · escolha até 2</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {TONS.map((t) => (
            <label key={t.valor} className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={c.tons.includes(t.valor)} disabled={ro} onChange={() => alternarTom(t.valor)} />
              {t.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-gray-800">Tamanho das respostas</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {TAMANHOS.map((t) => (
            <label key={t.valor} className="flex items-center gap-2 text-sm text-gray-800">
              <input type="radio" name="tamanho" className="h-4 w-4 accent-brand-600" checked={c.tamanho === t.valor} disabled={ro} onChange={() => set("tamanho", t.valor)} />
              {t.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <Campo rotulo="Instruções" dica="Escreva como se explicasse o trabalho a uma pessoa nova no time.">
        {(campo) => <CampoTexto {...campo} className={CONTROLE} rows={8} maxLength={LIMITE_INSTRUCOES} value={c.instrucoes} readOnly={ro} onChange={(e) => set("instrucoes", e.target.value)} />}
      </Campo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo rotulo="O que priorizar" dica="Uma por linha, em ordem. Em caso de dúvida a Aria segue a primeira.">
          {(campo) => <CampoTexto {...campo} className={CONTROLE} rows={5} value={c.prioridades.join("\n")} readOnly={ro} onChange={(e) => set("prioridades", emLinhas(e.target.value).slice(0, 10))} />}
        </Campo>
        <Campo rotulo="Nunca fazer" dica="Uma por linha. Vale em qualquer etapa e com qualquer contato.">
          {(campo) => <CampoTexto {...campo} className={CONTROLE} rows={5} value={c.nuncas.join("\n")} readOnly={ro} onChange={(e) => set("nuncas", emLinhas(e.target.value).slice(0, 20))} />}
        </Campo>
      </div>

      <div>
        <h3 className="text-base font-semibold text-gray-900">Exemplos de resposta</h3>
        <p className="mt-1 text-sm text-gray-600">Mostre como você responderia. A Aria imita o estilo, não copia o texto.</p>
        {c.exemplos.length === 0 ? (
          <EstadoVazio className="mt-2">Nenhum exemplo cadastrado.</EstadoVazio>
        ) : (
          <ul className="mt-2 space-y-2">
            {c.exemplos.map((e, i) => (
              <li key={i} className="rounded-md border border-border-soft p-3 text-sm">
                <p className="text-gray-600">Quando o contato diz: “{e.fala}”</p>
                <p className="mt-1 text-gray-900">Responda: {e.assim}</p>
                {e.evite && <p className="mt-1 text-gray-600">Evite: {e.evite}</p>}
                {podeEditar && (
                  <Botao variante="perigo" tamanho="sm" className="mt-2" aria-label={`Remover o exemplo “${e.fala}”`} onClick={() => set("exemplos", c.exemplos.filter((_, j) => j !== i))}>Remover</Botao>
                )}
              </li>
            ))}
          </ul>
        )}
        {podeEditar && c.exemplos.length < 20 && (
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-md border border-border-soft p-3">
            <Campo rotulo="Quando o contato diz">{(campo) => <input {...campo} className={CONTROLE} maxLength={500} value={novo.fala} onChange={(e) => setNovo({ ...novo, fala: e.target.value })} />}</Campo>
            <Campo rotulo="Responda assim">{(campo) => <CampoTexto {...campo} className={CONTROLE} rows={2} maxLength={1000} value={novo.assim} onChange={(e) => setNovo({ ...novo, assim: e.target.value })} />}</Campo>
            <Campo rotulo="Evite responder assim (opcional)">{(campo) => <CampoTexto {...campo} className={CONTROLE} rows={2} maxLength={1000} value={novo.evite} onChange={(e) => setNovo({ ...novo, evite: e.target.value })} />}</Campo>
            <div>
              <Botao
                variante="secundario"
                disabled={!novo.fala.trim() || !novo.assim.trim()}
                onClick={() => {
                  set("exemplos", [...c.exemplos, { fala: novo.fala.trim(), assim: novo.assim.trim(), ...(novo.evite.trim() ? { evite: novo.evite.trim() } : {}), prioritario: false }]);
                  setNovo({ fala: "", assim: "", evite: "" });
                }}
              >
                Adicionar exemplo
              </Botao>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold text-gray-900">Políticas comerciais</h3>
        <p className="mt-1 text-sm text-gray-600">Limites que a Aria respeita ao negociar. Acima do desconto sem aprovação, o pedido passa por aprovação de um gestor.</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(["MATRICULA", "MENSALIDADE"] as const).map((tipo) => (
            <div key={tipo} className="rounded-md border border-border-soft p-3">
              <p className="text-sm font-medium text-gray-800">{tipo === "MATRICULA" ? "Taxa de matrícula" : "Mensalidade"}</p>
              <div className="mt-2 grid grid-cols-1 gap-3">
                <Campo rotulo="Desconto sem aprovação (%)">
                  {(campo) => <input {...campo} type="number" min={0} max={100} className={CONTROLE} value={c.politicas[tipo].descontoSemAprovacaoPct} readOnly={ro} onChange={(e) => setPolitica(tipo, "descontoSemAprovacaoPct", Number(e.target.value))} />}
                </Campo>
                <Campo rotulo="Desconto com aprovação (%)" erro={c.politicas[tipo].descontoComAprovacaoPct < c.politicas[tipo].descontoSemAprovacaoPct ? "Não pode ser menor que o desconto sem aprovação." : null}>
                  {(campo) => <input {...campo} type="number" min={0} max={100} className={CONTROLE} value={c.politicas[tipo].descontoComAprovacaoPct} readOnly={ro} onChange={(e) => setPolitica(tipo, "descontoComAprovacaoPct", Number(e.target.value))} />}
                </Campo>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo rotulo="Parcelas no máximo">
            {(campo) => <input {...campo} type="number" min={1} max={12} className={CONTROLE} value={c.politicas.parcelasMax} readOnly={ro} onChange={(e) => setC((x) => ({ ...x, politicas: { ...x.politicas, parcelasMax: Number(e.target.value) } }))} />}
          </Campo>
          <Campo rotulo="Validade da proposta (dias)">
            {(campo) => <input {...campo} type="number" min={1} max={30} className={CONTROLE} value={c.politicas.validadePropostaDias} readOnly={ro} onChange={(e) => setC((x) => ({ ...x, politicas: { ...x.politicas, validadePropostaDias: Number(e.target.value) } }))} />}
          </Campo>
        </div>
      </div>

      {podeEditar && <Salvar montar={() => c} baseVersaoId={baseVersaoId} alterado={alterado} />}
    </section>
  );
}
