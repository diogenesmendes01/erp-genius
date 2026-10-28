"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { ConfigAria } from "@/server/aria/config-schema";
import { definirSupervisao } from "@/server/aria/acoes";
import { CampoSelect } from "@/components/ui/select";
import type { RascunhoAberto } from "@/server/aria/versoes";
import { Salvar } from "./Salvar";
import { ateParaLigar, tentativaDepoisDo, type TentativaSupervisao } from "./supervisao-tentativa";

type Props = {
  config: ConfigAria;
  baseVersaoId: string | null;
  rascunho: RascunhoAberto;
  podeEditar: boolean;
  podeEditarExpiracao: boolean;
  supervisao: boolean;
  podeLigarSupervisao: boolean;
  podeDesligarSupervisao: boolean;
};

const SEM_FIM = new Date("9999-12-31T00:00:00Z");
const EXPIRACOES = [30, 60, 120, 240] as const;
const faixa = (de: number, ate: number) => Array.from({ length: (ate - de) / 5 + 1 }, (_, i) => de + i * 5);

export function Confianca({ config, baseVersaoId, rascunho, podeEditar, podeEditarExpiracao, supervisao, podeLigarSupervisao, podeDesligarSupervisao }: Props) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: true });
  const ateDaTentativa = useRef<TentativaSupervisao>(null);
  const [c, setC] = useState<ConfigAria>(config);
  const k = c.confianca;
  const alterado = JSON.stringify(c) !== JSON.stringify(config);
  const setK = (parte: Partial<ConfigAria["confianca"]>) => setC((x) => ({ ...x, confianca: { ...x.confianca, ...parte } }));
  const ro = !podeEditar;

  async function supervisionar(ate: Date | null, ok: string) {
    const d = await acao.executar(() => definirSupervisao({ ate }), ok);
    ateDaTentativa.current = tentativaDepoisDo(d, ateDaTentativa.current);
    if (d?.tipo === "ok") router.refresh();
  }

  function ligarPor(horas: number, ok: string) {
    const ate = ateParaLigar(ateDaTentativa.current, horas, Date.now());
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
            <CampoSelect id={campo.id} disabled={ro} value={String(k.executaAPartirDe)} onValueChange={(valor) => { const v = Number(valor); setK({ executaAPartirDe: v, transfereAbaixoDe: Math.min(k.transfereAbaixoDe, v - 5) }); }} opcoes={faixa(55, 100).map((n) => ({ valor: String(n), rotulo: `${n}%`, disabled: !podeEditarExpiracao && n < config.confianca.executaAPartirDe }))} />
          )}
        </Campo>
        <Campo rotulo="Transfere para uma pessoa abaixo de (%)" dica="De 0 a 75, de 5 em 5. Sempre pelo menos 5 abaixo do limite de execução.">
          {(campo) => (
            <CampoSelect id={campo.id} disabled={ro} value={String(k.transfereAbaixoDe)} onValueChange={(valor) => { const v = Number(valor); setK({ transfereAbaixoDe: v, executaAPartirDe: Math.max(k.executaAPartirDe, v + 5) }); }} opcoes={faixa(0, 75).map((n) => ({ valor: String(n), rotulo: `${n}%`, disabled: !podeEditarExpiracao && n < config.confianca.transfereAbaixoDe }))} />
          )}
        </Campo>
      </div>
      {!podeEditarExpiracao && <p className="text-sm text-gray-600">Você pode aumentar as faixas; só um Admin pode diminuí-las.</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo rotulo="Sugestões sem resposta expiram depois de">
          {(campo) => (
            <CampoSelect id={campo.id} disabled={ro || !podeEditarExpiracao} value={String(k.expiracaoSugestaoMin)} onValueChange={(valor) => setK({ expiracaoSugestaoMin: Number(valor) as (typeof EXPIRACOES)[number] })} opcoes={EXPIRACOES.map((m) => ({ valor: String(m), rotulo: m < 60 ? `${m} minutos` : m === 60 ? "1 hora" : `${m / 60} horas` }))} />
          )}
        </Campo>
        <Campo rotulo="Quando expirar">
          {(campo) => (
            <CampoSelect id={campo.id} disabled={ro || !podeEditarExpiracao} value={k.acaoExpiracao} onValueChange={(valor) => setK({ acaoExpiracao: valor as ConfigAria["confianca"]["acaoExpiracao"] })} opcoes={[{ valor: "HANDOFF", rotulo: "Transferir para uma pessoa" }, { valor: "DESCARTAR", rotulo: "Descartar a sugestão" }]} />
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
