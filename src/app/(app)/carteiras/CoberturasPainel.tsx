"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { concederCobertura, revogarCobertura } from "@/server/acesso/coberturas";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { useInicioDoPeriodo } from "@/lib/periodo-form";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MensagemStatus } from "@/components/MensagemStatus";

type Cobertura = { id: string; titular: string; substituto: string; inicio: string; fim: string; revogada: boolean; motivo: string };

export function CoberturasPainel({ vendedores, coberturas, preferenciaFusoExibicao = null }: { vendedores: { id: string; nome: string }[]; coberturas: Cobertura[]; preferenciaFusoExibicao?: string | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // "Revogar" tira o acesso do substituto à carteira inteira, sem desfazer pela tela (docs/42 L2244): o botão
  // só abre a confirmação com os dois nomes e o período; a action roda no ConfirmarAcao, que mostra a falha.
  const [revogando, setRevogando] = useState<Cobertura | null>(null);
  const periodo = useInicioDoPeriodo();
  const router = useRouter();
  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErro(null); setNota(null); setOcupado(true);
    const form = e.currentTarget; const dados = new FormData(form);
    try {
      const resultado = await concederCobertura({ titularId: String(dados.get("titularId")), substitutoId: String(dados.get("substitutoId")), inicio: new Date(String(dados.get("inicio"))).toISOString(), fim: new Date(String(dados.get("fim"))).toISOString(), motivo: String(dados.get("motivo")) });
      if (!resultado.ok) setErro(resultado.erro); else { form.reset(); router.refresh(); }
    } catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); } finally { setOcupado(false); }
  }
  function pedirRevogacao(c: Cobertura) { setErro(null); setNota(null); setRevogando(c); }
  function revogada(c: Cobertura) { setRevogando(null); setNota(`Cobertura revogada: ${c.substituto} deixou de atender a carteira de ${c.titular}.`); router.refresh(); }
  const periodoDe = (c: Cobertura) => {
    const inicio = formatarInstanteExibicao(c.inicio, preferenciaFusoExibicao, "UTC");
    const fim = formatarInstanteExibicao(c.fim, preferenciaFusoExibicao, "UTC");
    return { inicio, fim };
  };
  const estilo = "rounded border border-gray-300 p-2 text-sm";
  return <div className="space-y-5">
    <form onSubmit={salvar} className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
      {([['titularId', 'Titular da carteira'], ['substitutoId', 'Quem fará a cobertura']] as const).map(([name, label]) => <label key={name} className="grid gap-1 text-sm">{label}<select name={name} required className={estilo}><option value="">Selecione</option>{vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>)}
      <label className="grid gap-1 text-sm">Início<input name="inicio" type="datetime-local" required {...periodo.propsInicio} className={estilo} /></label>
      <label className="grid gap-1 text-sm">Fim<input name="fim" type="datetime-local" required min={periodo.min} className={estilo} /></label>
      <label className="grid gap-1 text-sm md:col-span-2">Motivo<input name="motivo" required minLength={5} maxLength={1000} className={estilo} /></label>
      <button disabled={ocupado} className={botaoClasses({ tamanho: "lg" })}>Conceder cobertura</button>
    </form>
    {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
    <MensagemStatus texto={nota} className="text-sm text-gray-700" />
    <ul className="space-y-2">{coberturas.map((c) => { const { inicio, fim } = periodoDe(c); return <li key={c.id} className="rounded border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{c.substituto} atende a carteira de {c.titular}</strong>{!c.revogada && <button disabled={ocupado || revogando !== null} onClick={() => pedirRevogacao(c)} className={botaoClasses({ variante: "perigo", tamanho: "sm" })}>Revogar</button>}</div><p>{inicio.texto} até {fim.texto} (horário exibido em {inicio.fuso}; origem UTC){c.revogada ? " · Revogada" : ""}</p><p className="text-gray-500">{c.motivo}</p></li>; })}</ul>
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
        <p>Não há desfazer pela tela: para devolver o acesso, é preciso conceder uma nova cobertura.</p>
      </ConfirmarAcao>
    )}
  </div>;
}
