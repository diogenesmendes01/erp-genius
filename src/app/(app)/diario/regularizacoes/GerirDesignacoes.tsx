"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { consultarDesignacoesAula } from "@/server/diario/regularizacao-consultas";
import { designarRegularizacaoAula, revogarRegularizacaoAula } from "@/server/diario/regularizacao-designacao";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";

type DadosDesignacoes = {
  podeGerir: boolean;
  responsaveis: Array<{ id: string; nome: string }>;
  historico: Array<{
    id: string;
    responsavel: string;
    designador: string;
    motivo: string;
    criadaEm: string;
    revogacao: { motivo: string; revogador: string; criadaEm: string } | null;
  }>;
};

export function GerirDesignacoes({ encontroId, somenteLeitura = false, fusoExibicao = "UTC" }: { encontroId: string; somenteLeitura?: boolean; fusoExibicao?: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<DadosDesignacoes | null>(null);
  const [responsavelId, setResponsavelId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [motivosRevogacao, setMotivosRevogacao] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await consultarDesignacoesAula({ encontroId });
      if (!resultado.ok || !resultado.dado) {
        setErro(resultado.ok ? "Não foi possível carregar as designações." : resultado.erro);
        return;
      }
      setDados(resultado.dado);
    } catch {
      setErro("Não foi possível carregar as designações. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  function alternar() {
    const proximo = !aberto;
    setAberto(proximo);
    if (proximo && !dados && !carregando) void carregar();
  }

  async function designar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (somenteLeitura || !dados?.podeGerir || !responsavelId || motivo.trim().length < 5 || motivo.trim().length > 2000) return;
    setOcupado(true);
    setErro(null);
    try {
      const entrada = JSON.stringify({ encontroId, responsavelId, motivo: motivo.trim() });
      if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
      const resultado = await designarRegularizacaoAula({ encontroId, responsavelId, motivo: motivo.trim(), chaveIdempotencia: tentativa.current.chave });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setResponsavelId("");
      tentativa.current = null;
      setMotivo("");
      await carregar();
      router.refresh();
    } catch {
      setErro(MSG_RESULTADO_INCERTO);
    } finally {
      setOcupado(false);
    }
  }

  async function revogar(designacaoId: string) {
    const motivoRevogacao = motivosRevogacao[designacaoId]?.trim() ?? "";
    if (somenteLeitura || !dados?.podeGerir || motivoRevogacao.length < 5 || motivoRevogacao.length > 2000) return;
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await revogarRegularizacaoAula({ designacaoId, motivo: motivoRevogacao });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setMotivosRevogacao((anterior) => ({ ...anterior, [designacaoId]: "" }));
      await carregar();
      router.refresh();
    } catch {
      setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    } finally {
      setOcupado(false);
    }
  }

  return <section className="rounded border bg-[var(--surface)] p-4">
    <button type="button" className={botaoClasses({ variante: "fantasma", tamanho: "sm" })} onClick={alternar} aria-expanded={aberto}>
      {aberto ? "Fechar designações" : somenteLeitura ? "Ver designações" : "Gerir designações"}
    </button>
    {aberto && <div className="mt-4 space-y-4">
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      {carregando && <p className="text-sm text-gray-600">Carregando responsáveis e histórico…</p>}
      <button type="button" className={botaoClasses({ variante: "fantasma", tamanho: "sm" })} disabled={ocupado || carregando} onClick={() => void carregar()}>Atualizar responsáveis e histórico</button>
      {dados && <>
        {!somenteLeitura && dados.podeGerir && dados.historico.some(h => !h.revogacao) && <p className="text-sm">Revogue a designação vigente antes de atribuir outro responsável.</p>}
        {!somenteLeitura && dados.podeGerir && <form onSubmit={designar} className="space-y-3 border-t pt-4">
          <h3 className="font-medium">Designar responsável</h3>
          <label className="block text-sm">Responsável
            <select className="mt-1 block w-full rounded border p-2" value={responsavelId} onChange={(evento) => setResponsavelId(evento.target.value)} disabled={ocupado} required>
              <option value="">Selecione uma pessoa</option>
              {dados.responsaveis.map((responsavel) => <option key={responsavel.id} value={responsavel.id}>{responsavel.nome}</option>)}
            </select>
          </label>
          <label className="block text-sm">Motivo
            <CampoTexto className="mt-1 block w-full rounded border p-2" value={motivo} onChange={(evento) => setMotivo(evento.target.value)} minLength={5} maxLength={2000} disabled={ocupado} required />
          </label>
          <button className={botaoClasses({ tamanho: "lg" })} disabled={ocupado || carregando || dados.historico.some(h => !h.revogacao) || !responsavelId || motivo.trim().length < 5 || motivo.trim().length > 2000}>Designar</button>
        </form>}
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-medium">Histórico</h3>
          {!dados.historico.length && <EstadoVazio>Nenhuma designação registrada.</EstadoVazio>}
          {dados.historico.map((designacao) => <article key={designacao.id} className="space-y-2 rounded border p-3 text-sm">
            <p><strong>{designacao.responsavel}</strong> · designado por {designacao.designador}</p>
            <p>{designacao.motivo}</p>
            <p className="text-gray-600">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fusoExibicao }).format(new Date(designacao.criadaEm))} ({fusoExibicao})</p>
            {designacao.revogacao ? <p className="text-gray-700">Revogada por {designacao.revogacao.revogador}: {designacao.revogacao.motivo} ({new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fusoExibicao }).format(new Date(designacao.revogacao.criadaEm))})</p> : somenteLeitura || !dados.podeGerir ? <p className="text-gray-700">Registro preservado; regularização encerrada.</p> : <div className="space-y-2 border-t pt-2">
              <label className="block">Motivo da revogação
                <CampoTexto className="mt-1 block w-full rounded border p-2" value={motivosRevogacao[designacao.id] ?? ""} onChange={(evento) => setMotivosRevogacao((anterior) => ({ ...anterior, [designacao.id]: evento.target.value }))} minLength={5} maxLength={2000} disabled={ocupado} />
              </label>
              <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado || (motivosRevogacao[designacao.id]?.trim().length ?? 0) < 5} onClick={() => void revogar(designacao.id)}>Revogar designação</button>
            </div>}
          </article>)}
        </div>
      </>}
    </div>}
  </section>;
}
