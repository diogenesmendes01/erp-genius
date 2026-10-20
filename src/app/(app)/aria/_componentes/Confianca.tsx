"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { ConfigAria } from "@/server/aria/config-schema";
import { definirSupervisao } from "@/server/aria/acoes";
import { CONTROLE } from "./Campos";
import type { RascunhoAberto } from "@/server/aria/versoes";
import { Salvar } from "./Salvar";

type Props = {
  config: ConfigAria;
  baseVersaoId: string | null;
  rascunho: RascunhoAberto;
  podeEditar: boolean;
  /** `editarConfianca`: expiração das sugestões e afrouxar as faixas (só Administrador). */
  podeEditarExpiracao: boolean;
  supervisao: boolean;
  podeLigarSupervisao: boolean;
  podeDesligarSupervisao: boolean;
};

const HORA_MS = 3_600_000;
const SEM_FIM = new Date("9999-12-31T00:00:00Z");
const EXPIRACOES = [30, 60, 120, 240] as const;
const faixa = (de: number, ate: number) => Array.from({ length: (ate - de) / 5 + 1 }, (_, i) => de + i * 5);

export function Confianca({ config, baseVersaoId, rascunho, podeEditar, podeEditarExpiracao, supervisao, podeLigarSupervisao, podeDesligarSupervisao }: Props) {
  const router = useRouter();
  // Idempotente por natureza (#166): este executor só define a supervisão (estado-alvo `supervisaoAte`),
  // e o servidor não grava nada quando `supervisaoAte` já é o alvo. Para o reenvio cair nesse caso,
  // o `ate` é fixado dentro da tentativa (como o `fimDaTentativa` do convite): enquanto a mesma opção
  // não tiver dado certo, repetir o clique manda o mesmo valor.
  const acao = useAcaoCliente({ idempotente: true });
  const ateDaTentativa = useRef<{ horas: number; ate: Date } | null>(null);
  const [c, setC] = useState<ConfigAria>(config);
  const k = c.confianca;
  const alterado = JSON.stringify(c) !== JSON.stringify(config);
  const setK = (parte: Partial<ConfigAria["confianca"]>) => setC((x) => ({ ...x, confianca: { ...x.confianca, ...parte } }));
  const ro = !podeEditar;

  async function supervisionar(ate: Date | null, ok: string) {
    const d = await acao.executar(() => definirSupervisao({ ate }), ok);
    if (d?.tipo === "ok") {
      ateDaTentativa.current = null;
      router.refresh();
    }
  }

  /** Liga por `horas` a partir de agora, reaproveitando o `ate` da tentativa anterior que não deu certo. */
  function ligarPor(horas: number, ok: string) {
    const anterior = ateDaTentativa.current;
    const ate = anterior && anterior.horas === horas && anterior.ate.getTime() > Date.now() ? anterior.ate : new Date(Date.now() + horas * HORA_MS);
    ateDaTentativa.current = { horas, ate };
    return supervisionar(ate, ok);
  }

  return (
    <section aria-labelledby="titulo-confianca" className="space-y-6">
      <div>
        <h2 id="titulo-confianca" className="text-lg font-semibold text-gray-900">Quando a Aria age sozinha</h2>
        <p className="mt-1 text-sm text-gray-600">Cada ação tem uma confiança de 0 a 100. Abaixo do limite de execução, a ação vira sugestão para uma pessoa aprovar.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo rotulo="Executa sozinha a partir de (%)" dica="De 55 a 100, de 5 em 5.">
          {(campo) => (
            <select {...campo} className={CONTROLE} disabled={ro} value={k.executaAPartirDe} onChange={(e) => { const v = Number(e.target.value); setK({ executaAPartirDe: v, transfereAbaixoDe: Math.min(k.transfereAbaixoDe, v - 5) }); }}>
              {faixa(55, 100).map((n) => <option key={n} value={n} disabled={!podeEditarExpiracao && n < config.confianca.executaAPartirDe}>{n}%</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Transfere para uma pessoa abaixo de (%)" dica="De 0 a 75, de 5 em 5. Sempre pelo menos 5 abaixo do limite de execução.">
          {(campo) => (
            <select {...campo} className={CONTROLE} disabled={ro} value={k.transfereAbaixoDe} onChange={(e) => { const v = Number(e.target.value); setK({ transfereAbaixoDe: v, executaAPartirDe: Math.max(k.executaAPartirDe, v + 5) }); }}>
              {faixa(0, 75).map((n) => <option key={n} value={n} disabled={!podeEditarExpiracao && n < config.confianca.transfereAbaixoDe}>{n}%</option>)}
            </select>
          )}
        </Campo>
      </div>
      {!podeEditarExpiracao && <p className="text-sm text-gray-600">Você pode aumentar as faixas; só um Admin pode diminuí-las.</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo rotulo="Sugestões sem resposta expiram depois de">
          {(campo) => (
            <select {...campo} className={CONTROLE} disabled={ro || !podeEditarExpiracao} value={k.expiracaoSugestaoMin} onChange={(e) => setK({ expiracaoSugestaoMin: Number(e.target.value) as (typeof EXPIRACOES)[number] })}>
              {EXPIRACOES.map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutos` : m === 60 ? "1 hora" : `${m / 60} horas`}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Quando expirar">
          {(campo) => (
            <select {...campo} className={CONTROLE} disabled={ro || !podeEditarExpiracao} value={k.acaoExpiracao} onChange={(e) => setK({ acaoExpiracao: e.target.value as ConfigAria["confianca"]["acaoExpiracao"] })}>
              <option value="HANDOFF">Transferir para uma pessoa</option>
              <option value="DESCARTAR">Descartar a sugestão</option>
            </select>
          )}
        </Campo>
      </div>
      {podeEditar && <Salvar montar={() => c} baseVersaoId={baseVersaoId} rascunho={rascunho} alterado={alterado} />}

      <div className="rounded-md border border-border-soft p-3">
        <h3 className="text-base font-semibold text-gray-900">Modo supervisão</h3>
        <p className="mt-1 text-sm text-gray-600">Todas as ações que mudam o CRM passam a pedir aprovação, qualquer que seja a confiança. Bom para a primeira semana ou depois de mudar as instruções. Vale na hora, sem publicar.</p>
        <p className="mt-2 text-sm font-medium text-gray-800">{supervisao ? "Supervisão ligada." : "Supervisão desligada."}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {podeLigarSupervisao && (
            <>
              <Botao variante="secundario" ocupado={acao.ocupado} onClick={() => ligarPor(24, "Supervisão ligada por 24 horas.")}>Ligar por 24 horas</Botao>
              <Botao variante="secundario" ocupado={acao.ocupado} onClick={() => ligarPor(168, "Supervisão ligada por 7 dias.")}>Ligar por 7 dias</Botao>
              <Botao variante="secundario" ocupado={acao.ocupado} onClick={() => supervisionar(SEM_FIM, "Supervisão ligada até ser desligada.")}>Ligar até eu desligar</Botao>
            </>
          )}
          {podeDesligarSupervisao && supervisao && (
            <Botao ocupado={acao.ocupado} onClick={() => supervisionar(null, "Supervisão desligada.")}>Desligar supervisão</Botao>
          )}
        </div>
        <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-3" />
      </div>
    </section>
  );
}
