"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { revogarCobertura } from "@/server/acesso/coberturas";
import { concederCoberturaLocal } from "@/server/acesso/coberturas-local";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { useInicioDoPeriodo } from "@/lib/periodo-form";
import { botaoClasses } from "@/components/Botao";
import { CampoFuso } from "@/components/CampoFuso";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MensagemStatus } from "@/components/MensagemStatus";

type Cobertura = { id: string; titular: string; substituto: string; inicio: string; fim: string; revogada: boolean; motivo: string };

export function CoberturasPainel({
  vendedores,
  coberturas,
  fusoPadrao = "",
  preferenciaFusoExibicao = null,
}: {
  vendedores: { id: string; nome: string }[];
  coberturas: Cobertura[];
  /** Fuso da escola ("" quando não configurado: o campo fica vazio e obrigatório). */
  fusoPadrao?: string;
  preferenciaFusoExibicao?: string | null;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // "Revogar" tira o acesso do substituto à carteira inteira, sem desfazer pela tela: o botão só abre a
  // confirmação com os dois nomes e o período; a action roda no ConfirmarAcao, que mostra a falha.
  const [revogando, setRevogando] = useState<Cobertura | null>(null);
  const periodo = useInicioDoPeriodo();
  const router = useRouter();

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setNota(null);
    setOcupado(true);
    const form = e.currentTarget;
    const dados = new FormData(form);
    try {
      const resultado = await concederCoberturaLocal({
        titularId: String(dados.get("titularId")),
        substitutoId: String(dados.get("substitutoId")),
        inicioLocal: String(dados.get("inicioLocal")),
        fimLocal: String(dados.get("fimLocal")),
        fuso: String(dados.get("fuso")),
        motivo: String(dados.get("motivo")),
      });
      if (!resultado.ok) setErro(resultado.erro);
      else {
        form.reset();
        setNota("Cobertura concedida.");
        router.refresh();
      }
    } catch {
      setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    } finally {
      setOcupado(false);
    }
  }
  function pedirRevogacao(c: Cobertura) {
    setErro(null);
    setNota(null);
    setRevogando(c);
  }
  function revogada(c: Cobertura) {
    setRevogando(null);
    setNota(`Cobertura revogada: ${c.substituto} deixou de atender a carteira de ${c.titular}.`);
    router.refresh();
  }
  const periodoDe = (c: Cobertura) => ({
    inicio: formatarInstanteExibicao(c.inicio, preferenciaFusoExibicao, "UTC"),
    fim: formatarInstanteExibicao(c.fim, preferenciaFusoExibicao, "UTC"),
  });
  const estilo = "min-h-11 rounded-md border border-border-soft bg-surface-raised p-2 text-sm sm:min-h-9";
  return (
    <div className="space-y-5">
      <form onSubmit={salvar} className="grid gap-3 rounded-lg border border-border-soft p-4 md:grid-cols-2" aria-label="Conceder cobertura">
        {([["titularId", "Titular da carteira"], ["substitutoId", "Quem fará a cobertura"]] as const).map(([name, label]) => (
          <label key={name} className="grid gap-1 text-sm">
            {label}
            <select name={name} required className={estilo}>
              <option value="">Selecione</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="grid gap-1 text-sm">
          Início
          <input name="inicioLocal" type="datetime-local" required {...periodo.propsInicio} className={estilo} />
        </label>
        <label className="grid gap-1 text-sm">
          Fim
          <input name="fimLocal" type="datetime-local" required min={periodo.min} className={estilo} />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          Fuso dos horários
          <CampoFuso name="fuso" padrao={fusoPadrao} className={estilo} />
          <span className="text-xs text-gray-500">Informe o fuso em que preencheu início e fim.</span>
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          Motivo
          <input name="motivo" required minLength={5} maxLength={1000} className={estilo} />
        </label>
        <div className="md:col-span-2">
          <button disabled={ocupado} className={botaoClasses({ tamanho: "lg" })}>Conceder cobertura</button>
        </div>
      </form>
      <FeedbackAcao erro={erro} />
      <MensagemStatus texto={nota} className="text-sm text-gray-700" />
      <ul className="space-y-2">
        {coberturas.map((c) => {
          const { inicio, fim } = periodoDe(c);
          return (
            <li key={c.id} className="rounded-lg border border-border-soft p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="font-medium">{c.substituto} atende a carteira de {c.titular}</strong>
                {!c.revogada && (
                  <button disabled={ocupado || revogando !== null} onClick={() => pedirRevogacao(c)} className={botaoClasses({ variante: "perigo", tamanho: "sm" })}>
                    Revogar
                  </button>
                )}
              </div>
              <p>{inicio.texto} até {fim.texto} (horário exibido em {inicio.fuso}; origem UTC){c.revogada ? " · Revogada" : ""}</p>
              <p className="text-gray-500">{c.motivo}</p>
            </li>
          );
        })}
      </ul>
      {!coberturas.length && <EstadoVazio>Nenhuma cobertura cadastrada.</EstadoVazio>}
      {revogando && (
        <ConfirmarAcao
          titulo={`Revogar a cobertura de ${revogando.substituto} sobre a carteira de ${revogando.titular}?`}
          confirmacao="revogação da cobertura"
          idempotente={false}
          acao={() => revogarCobertura(revogando.id)}
          aoConcluir={() => revogada(revogando)}
          aoCancelar={() => setRevogando(null)}
        >
          <p>
            {revogando.substituto} deixa de atender a carteira de {revogando.titular} na hora, mesmo que o período combinado
            ({periodoDe(revogando).inicio.texto} até {periodoDe(revogando).fim.texto}, horário em {periodoDe(revogando).inicio.fuso}) ainda não tenha acabado.
          </p>
          <p>Revogar a cobertura não tem desfazer pela tela.</p>
          <p>Para devolver o acesso, é preciso conceder uma nova cobertura.</p>
        </ConfirmarAcao>
      )}
    </div>
  );
}
