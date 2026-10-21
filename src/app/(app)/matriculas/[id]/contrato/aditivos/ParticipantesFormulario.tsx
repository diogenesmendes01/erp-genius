"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { conferirParticipantesAditivo, consultarFormularioParticipantesAditivo } from "@/server/contratos/aditivo-participantes";
import { EvidenciaSeletor, type EvidenciaDisponivel } from "./EvidenciaSeletor";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { rotular } from "@/lib/labels";
import { PAPEIS_MODELO } from "@/app/(app)/configuracao/contratos/labels";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";

type Consulta = Awaited<ReturnType<typeof consultarFormularioParticipantesAditivo>>;
type Formulario = NonNullable<Extract<Consulta, { ok: true }>["dado"]>;
const campo = "mt-1 block w-full rounded border p-2";

export function ParticipantesFormulario({ matriculaId, propostaId }: { matriculaId: string; propostaId: string }) {
  const router = useRouter();
  // Dois grupos de ação: a consulta (só leitura; sem chave) e o registro (chave estável por conteúdo).
  const consulta = useAcaoCliente({ idempotente: false }), registro = useAcaoCliente({ idempotente: true });
  const pendente = consulta.ocupado || registro.ocupado;
  const [maioridade, setMaioridade] = useState<"MAIOR" | "MENOR" | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [evidencias, setEvidencias] = useState<Record<string, EvidenciaDisponivel | null>>({});
  const tentativa = useRef<{ conteudo: string; chave: string } | null>(null);

  async function carregar(paginaDocumentos = 1) {
    registro.limpar();
    const d = await consulta.executar(() => consultarFormularioParticipantesAditivo({ matriculaId, propostaId, maioridade, paginaDocumentos }));
    // Falha de transporte numa consulta: nada foi gravado, basta repetir (mensagem própria, preservada).
    if (d?.tipo === "incerto") { consulta.setErro("Não foi possível consultar os signatários. Tente novamente."); return; }
    if (d?.tipo !== "ok") return;
    if (!d.dado) { consulta.setErro("Não foi possível carregar a conferência."); return; }
    if (formulario && (d.dado.propostaHash !== formulario.propostaHash || d.dado.versaoEsperada !== formulario.versaoEsperada)) {
      consulta.setErro("A conferência mudou durante a consulta. Reabra o formulário para revisar a versão atual."); return;
    }
    setFormulario(d.dado);
  }
  const evidencia = (chave: string, titulo: string) => <EvidenciaSeletor nome={chave} titulo={titulo}
    documentos={formulario?.documentos ?? []} selecionada={evidencias[chave] ?? null}
    onChange={d => setEvidencias(atual => ({ ...atual, [chave]: d }))} disabled={pendente} />;

  return <section className="space-y-4 rounded border p-4">
    <h2 className="text-xl">Conferir signatários do aditivo</h2>
    <p>Confira quem assina este documento conforme o modelo aprovado. Registre a classificação de maioridade segundo a regra aplicável e sua evidência quando necessária.</p>
    <label className="block">Classificação conferida de maioridade
      <select className={campo} disabled={pendente || !!formulario} value={maioridade ?? ""}
        onChange={e => setMaioridade(e.target.value === "MAIOR" ? "MAIOR" : e.target.value === "MENOR" ? "MENOR" : null)}>
        <option value="">Não informada — verificar exigências do modelo</option><option value="MAIOR">Maior</option><option value="MENOR">Menor</option>
      </select>
    </label>
    {!formulario ? <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente} onClick={() => carregar()}>Consultar exigências e participantes</button>
      : <button type="button" className={botaoClasses({ variante: "perigo", tamanho: "lg" })} disabled={pendente} onClick={() => { setFormulario(null); setEvidencias({}); consulta.limpar(); registro.limpar(); }}>Reabrir formulário e descartar preenchimento</button>}
    <FeedbackAcao erro={consulta.erro} />
    {formulario && <>
      <p>Conferência atual: versão {formulario.versaoEsperada}. Este registro produzirá uma nova versão.</p>
      {formulario.plano.pendencias.map(p => <p role="alert" key={p}>{p}</p>)}
      <p>Documentos disponíveis · página {formulario.paginaDocumentos}. A seleção permanece ao mudar de página; a disponibilidade será conferida novamente ao registrar.</p>
      <div className="flex gap-3"><button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente || formulario.paginaDocumentos <= 1} onClick={() => carregar(formulario.paginaDocumentos - 1)}>Documentos anteriores</button><button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente || !formulario.temProxima} onClick={() => carregar(formulario.paginaDocumentos + 1)}>Próximos documentos</button></div>
      {!formulario.documentos.length && (formulario.paginaDocumentos > 1
        ? <EstadoVazio acao={<button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente} onClick={() => carregar(1)}>Ir para a primeira página</button>}>Nenhum documento disponível nesta página. Cadastre as evidências na documentação da matrícula antes de concluir.</EstadoVazio>
        : <EstadoVazio>Nenhum documento disponível. Cadastre as evidências na documentação da matrícula antes de concluir.</EstadoVazio>)}
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); const fd = new FormData(e.currentTarget), texto = (chave: string) => String(fd.get(chave) ?? "").trim();
        const participantes = formulario.participantesSugeridos.map(p => ({ papel: p.papel,
          identidade: p.automatico ? p.identidade! : { nome: texto(`${p.papel}:nome`), email: texto(`${p.papel}:email`), documento: texto(`${p.papel}:documento`) },
          ...(p.automatico ? {} : { representacao: { descricao: texto(`${p.papel}:descricao`), evidenciaDocumentoId: evidencias[p.papel]?.id ?? "" } }),
        }));
        const dados = { matriculaId, propostaId, propostaHashEsperado: formulario.propostaHash, versaoEsperada: formulario.versaoEsperada,
          maioridade: maioridade ? { classificacao: maioridade, criterio: texto("criterio"), evidenciaDocumentoId: evidencias.maioridade?.id ?? "" } : null,
          participantes, identificacoesConferidas: true as const, motivo: texto("motivo") };
        const conteudo = JSON.stringify(dados);
        if (!tentativa.current || tentativa.current.conteudo !== conteudo) tentativa.current = { conteudo, chave: crypto.randomUUID() };
        const chaveIdempotencia = tentativa.current.chave;
        consulta.limpar();
        const d = await registro.executar(() => conferirParticipantesAditivo({ ...dados, chaveIdempotencia }),
          (dado) => `Conferência registrada · versão ${dado?.versao}.`);
        if (d?.tipo !== "ok") return;
        setFormulario(null); setEvidencias({}); tentativa.current = null; router.refresh();
      }}>
        {maioridade && <fieldset className="space-y-3 rounded border p-3" disabled={pendente}><legend>Critério de maioridade</legend>
          <label className="block">Regra e conferência realizadas<CampoTexto className={campo} name="criterio" required minLength={5} maxLength={2000} /></label>
          {evidencia("maioridade", "Documento que sustenta a classificação")}
        </fieldset>}
        {formulario.participantesSugeridos.map(p => <fieldset key={p.papel} className="space-y-3 rounded border p-3" disabled={pendente}>
          <legend>{rotular(PAPEIS_MODELO, p.papel)} · {p.etapa === "CLIENTE" ? "assinatura do cliente" : "assinatura da escola após o cliente"}</legend>
          {p.automatico ? p.identidade ? <dl><dt>Nome</dt><dd>{p.identidade.nome}</dd><dt>E-mail</dt><dd>{p.identidade.email}</dd><dt>Documento</dt><dd>{p.identidade.documento}</dd></dl>
            : <p role="alert">Complete nome, e-mail e documento no cadastro correspondente e reabra a conferência.</p>
            : <><label className="block">Nome completo<input className={campo} name={`${p.papel}:nome`} required maxLength={200} /></label>
              <label className="block">E-mail<input className={campo} type="email" name={`${p.papel}:email`} required maxLength={254} /></label>
              <label className="block">Documento<input className={campo} name={`${p.papel}:documento`} required maxLength={100} /></label>
              <label className="block">Fundamento da representação<CampoTexto className={campo} name={`${p.papel}:descricao`} required minLength={5} maxLength={2000} /></label>
              {evidencia(p.papel, "Evidência da representação")}</>}
        </fieldset>)}
        <label className="block">Motivo da conferência<CampoTexto className={campo} name="motivo" required minLength={5} maxLength={2000} disabled={pendente} /></label>
        <label className="block"><input type="checkbox" required disabled={pendente} /> Conferi as identificações, os papéis e as evidências para este aditivo.</label>
        <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente || formulario.plano.pendencias.length > 0 || formulario.participantesSugeridos.some(p => p.automatico && !p.identidade)}>{pendente ? "Aguarde…" : "Registrar conferência dos signatários"}</button>
      </form>
    </>}
    {/* Logo abaixo do botão de registro (último item do formulário); fora do bloco condicional porque o
        sucesso fecha o formulário e a confirmação precisa continuar visível. */}
    <FeedbackAcao erro={registro.erro} sucesso={registro.sucesso} />
  </section>;
}
