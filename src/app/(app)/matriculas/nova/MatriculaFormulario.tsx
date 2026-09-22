"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TipoCobranca, OrigemNivel, Genero, Escolaridade } from "@prisma/client";
import { GENERO_LABEL, ESCOLARIDADE_LABEL } from "@/lib/labels";
import { formatarMoeda } from "@/lib/dinheiro";
import { PAISES_ISO } from "@/lib/paises-iso";
import { criarMatricula } from "@/server/matricula/acoes";
import { solicitarAberturaTurma } from "@/server/turmas/acoes";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface PrecoRef {
  paisId: string;
  produtoId: string;
  tipoCobranca: TipoCobranca;
  valor: number;
}

interface PaisOpt {
  id: string;
  nome: string;
  moedaLocal: string;
  codigoISO: string;
  tiposDocumento: { id: string; nome: string }[];
}

/** Divide um nome completo (ex.: vindo do lead) em primeiro nome + sobrenome. */
function dividirNome(completo: string): { primeiro: string; sobrenome: string } {
  const t = completo.trim().split(/\s+/);
  return { primeiro: t[0] ?? "", sobrenome: t.slice(1).join(" ") };
}

export function MatriculaFormulario({
  podeCriar,
  lead,
  paises,
  produtos,
  turmas,
  niveis,
  precos,
}: {
  /**
   * O usuário pode CRIAR matrículas (Vendedor/Gerente Comercial/Admin)? Habilita
   * "Salvar matrícula" (fica AGUARDANDO). O backend revalida (defesa em profundidade).
   */
  podeCriar: boolean;
  lead: { id: string; nome: string; telefoneE164: string | null; paisId: string | null } | null;
  paises: PaisOpt[];
  produtos: { id: string; label: string }[];
  turmas: { id: string; label: string }[];
  niveis: { id: string; label: string }[];
  precos: PrecoRef[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aberturaMsg, setAberturaMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Wizard: passo 1 = informações do aluno · passo 2 = curso, alocação e contrato.
  const [passo, setPasso] = useState<1 | 2>(1);

  async function pedirAbertura() {
    setAberturaMsg(null);
    const r = await solicitarAberturaTurma({ produtoId, nivelId: nivelInicialId || undefined });
    setAberturaMsg(r.ok ? "Solicitação enviada ao Gerente Pedagógico." : r.erro);
  }

  const leadNome = lead ? dividirNome(lead.nome) : null;
  const paisInicial = paises.find((p) => p.id === (lead?.paisId ?? paises[0]?.id));

  // Aluno — Identificação
  const [primeiroNome, setPrimeiroNome] = useState(leadNome?.primeiro ?? "");
  const [sobrenome, setSobrenome] = useState(leadNome?.sobrenome ?? "");
  const [nomePreferido, setNomePreferido] = useState("");
  const [nascimento, setNasc] = useState("");
  const [genero, setGenero] = useState<Genero | "">("");
  // Aluno — Documentação
  const [alunoPaisId, setPaisId] = useState(paisInicial?.id ?? "");
  const [tipoDocumentoId, setTipoDoc] = useState("");
  const [documento, setDoc] = useState("");
  const [documentoPaisEmissor, setDocEmissor] = useState(paisInicial?.codigoISO ?? "");
  const [nacionalidade, setNacionalidade] = useState(paisInicial?.codigoISO ?? "");
  const [segundaNacionalidade, setSegNacionalidade] = useState("");
  // Aluno — Contato
  const [email, setEmail] = useState("");
  const [telefone, setTel] = useState(lead?.telefoneE164 ?? "");
  const [whatsapp, setWhatsapp] = useState(true);
  const [aceitaComunicacoes, setAceitaCom] = useState(true);
  // Aluno — Residência
  const [paisResidencia, setPaisResidencia] = useState(paisInicial?.codigoISO ?? "");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [regiao, setRegiao] = useState("");
  // Aluno — Acadêmico
  const [escolaridade, setEscolaridade] = useState<Escolaridade | "">("");
  const [idiomaNativo, setIdiomaNativo] = useState("");
  // Aluno — Operacional
  const [fuso, setFuso] = useState("");
  const [observacoes, setObservacoes] = useState("");
  // Aluno — Contato de emergência
  const [emergenciaNome, setEmergNome] = useState("");
  const [emergenciaParentesco, setEmergParentesco] = useState("");
  const [emergenciaTelefone, setEmergTel] = useState("");
  // Responsável financeiro (pagador)
  const [pagador, setPagador] = useState<"ALUNO" | "RESPONSAVEL" | "EMPRESA">("ALUNO");
  const [respNome, setRespNome] = useState("");
  const [respParentesco, setRespParentesco] = useState("");
  const [respTelefone, setRespTelefone] = useState("");
  const [respEmail, setRespEmail] = useState("");
  // Curso & contrato (passo 2)
  const [produtoId, setProduto] = useState(produtos[0]?.id ?? "");
  const [turmaId, setTurma] = useState("");
  const [nivelInicialId, setNivel] = useState("");
  const [origemNivel, setOrigem] = useState<OrigemNivel>(OrigemNivel.MANUAL);
  const [dataAvaliacaoNivel, setDataAval] = useState("");
  const [diaVencimento, setDia] = useState(5);
  const [taxaValor, setTaxa] = useState("");
  const [mensalidadeValor, setMens] = useState("");
  const [certificadoValor, setCert] = useState("");
  const [mesesPlano, setMeses] = useState(12);
  const [referenciaCobertura, setReferenciaCobertura] = useState<"" | "MES_CIVIL" | "CICLO_MATRICULA">("");
  const [inicioCobertura, setInicioCobertura] = useState("");
  const [primeiroVencimento, setPrimeiroVencimento] = useState("");
  const [justificativaSemPreco, setJustSemPreco] = useState("");

  const paisSel = paises.find((p) => p.id === alunoPaisId);
  const moeda = paisSel?.moedaLocal ?? "";
  const paisNome = paisSel?.nome ?? "—";
  const tiposDocDoPais = paisSel?.tiposDocumento ?? [];

  function precoRefDe(pid: string, prodId: string, tipo: TipoCobranca) {
    return precos.find((p) => p.paisId === pid && p.produtoId === prodId && p.tipoCobranca === tipo);
  }

  // Sugerido (preço de referência ativo) por linha + ausência da tabela (issue #22).
  const refTaxa = precoRefDe(alunoPaisId, produtoId, TipoCobranca.MATRICULA);
  const refMens = precoRefDe(alunoPaisId, produtoId, TipoCobranca.MENSALIDADE);
  const semTabela = !refTaxa || !refMens;
  const taxaManual = !!refTaxa && taxaValor !== "" && Number(taxaValor) !== refTaxa.valor;
  const mensManual = !!refMens && mensalidadeValor !== "" && Number(mensalidadeValor) !== refMens.valor;

  function prefillPrecos(pid: string, prodId: string) {
    const taxa = precoRefDe(pid, prodId, TipoCobranca.MATRICULA);
    const mens = precoRefDe(pid, prodId, TipoCobranca.MENSALIDADE);
    if (taxa) setTaxa(String(taxa.valor));
    if (mens) setMens(String(mens.valor));
  }

  // País dirige documento/telefone/moeda — ao trocar, reseta o tipo de documento se não
  // pertencer ao novo país (doc 04).
  function aoTrocarPais(novoPaisId: string) {
    setPaisId(novoPaisId);
    const np = paises.find((p) => p.id === novoPaisId);
    if (np && !np.tiposDocumento.some((t) => t.id === tipoDocumentoId)) setTipoDoc("");
    prefillPrecos(novoPaisId, produtoId);
  }

  function montarInput(referencia: "MES_CIVIL" | "CICLO_MATRICULA") {
    return {
      leadId: lead?.id,
      // Identificação
      alunoPrimeiroNome: primeiroNome,
      alunoSobrenome: sobrenome,
      alunoNomePreferido: nomePreferido || undefined,
      alunoNascimento: nascimento,
      alunoGenero: genero as Genero, // garantido não-vazio por validarPasso1; zod rejeita "" no servidor

      // Documentação
      alunoPaisId,
      alunoTipoDocumentoId: tipoDocumentoId,
      alunoDocumento: documento,
      alunoDocumentoPaisEmissor: documentoPaisEmissor || undefined,
      alunoNacionalidade: nacionalidade,
      alunoSegundaNacionalidade: segundaNacionalidade || undefined,
      // Contato
      alunoEmail: email,
      alunoTelefone: telefone,
      alunoWhatsapp: whatsapp,
      alunoAceitaComunicacoes: aceitaComunicacoes,
      // Residência
      alunoPaisResidencia: paisResidencia,
      alunoCep: cep || undefined,
      alunoRua: rua || undefined,
      alunoNumero: numero || undefined,
      alunoComplemento: complemento || undefined,
      alunoBairro: bairro || undefined,
      alunoCidade: cidade || undefined,
      alunoRegiao: regiao || undefined,
      // Acadêmico
      alunoEscolaridade: escolaridade || undefined,
      alunoIdiomaNativo: idiomaNativo || undefined,
      // Operacional
      alunoFuso: fuso || undefined,
      alunoObservacoes: observacoes || undefined,
      // Emergência
      emergenciaNome: emergenciaNome || undefined,
      emergenciaParentesco: emergenciaParentesco || undefined,
      emergenciaTelefone: emergenciaTelefone || undefined,
      // Pagador
      pagador,
      responsavelNome: respNome,
      responsavelParentesco: respParentesco,
      responsavelTelefone: respTelefone,
      responsavelEmail: respEmail,
      // Curso & contrato
      produtoId,
      turmaId: turmaId || undefined,
      nivelInicialId: nivelInicialId || undefined,
      origemNivel,
      dataAvaliacaoNivel,
      diaVencimento,
      taxaValor: taxaValor === "" ? 0 : Number(taxaValor),
      mensalidadeValor: mensalidadeValor === "" ? 0 : Number(mensalidadeValor),
      certificadoValor: certificadoValor === "" ? 0 : Number(certificadoValor),
      mesesPlano,
      cobertura: { referencia, inicio: inicioCobertura },
      primeiroVencimento,
      justificativaSemPreco: justificativaSemPreco || undefined,
    };
  }

  // Validação "inteligente" do passo 1 (essenciais obrigatórios) — espelha o MatriculaSchema
  // (servidor é a fonte da verdade). País dirige o resto.
  function validarPasso1(): string | null {
    if (!primeiroNome.trim()) return "Informe o nome do aluno.";
    if (!sobrenome.trim()) return "Informe o sobrenome.";
    if (!nascimento) return "Informe a data de nascimento.";
    if (!genero) return "Selecione o gênero.";
    if (!alunoPaisId) return "Selecione o país.";
    if (!tipoDocumentoId) return "Selecione o tipo de documento.";
    if (!documento.trim()) return "Informe o número do documento.";
    if (!nacionalidade) return "Selecione a nacionalidade.";
    if (!email.trim()) return "Informe o e-mail.";
    if (!EMAIL_RE.test(email.trim())) return "E-mail inválido.";
    if (!telefone.trim()) return "Informe o telefone.";
    if (!paisResidencia) return "Selecione o país de residência.";
    if (pagador !== "ALUNO" && !respNome.trim()) return "Informe o nome do responsável financeiro.";
    return null;
  }

  function irParaPasso(p: 1 | 2) {
    if (p === 2) {
      const e = validarPasso1();
      if (e) {
        setErro(e);
        return;
      }
    }
    setErro(null);
    setPasso(p);
  }

  async function salvar() {
    setErro(null);
    if (!referenciaCobertura || !inicioCobertura || !primeiroVencimento) {
      setErro("Informe a referência contratual, o início da cobertura e o primeiro vencimento.");
      return;
    }
    setSalvando(true);
    const res = await criarMatricula(montarInput(referenciaCobertura));
    if (!res.ok) {
      setErro(res.erro);
      setSalvando(false);
      return;
    }
    if (res.dado?.aguardaPreco) {
      router.push(`/alunos/${res.dado.alunoId}/financeiro?aprovacao=pendente`);
      router.refresh();
      return;
    }

    router.push(lead ? `/leads/${lead.id}` : "/alunos");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium">Nova matrícula</h1>
      {lead && (
        <p className="-mt-4 text-sm text-gray-500">
          Convertendo o lead <strong>{lead.nome}</strong> — confirme e complete os dados.
        </p>
      )}

      <Stepper passo={passo} onIr={irParaPasso} />

      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {/* Passo 1 — Informações do aluno */}
      {passo === 1 && (
        <>
          {/* Identificação */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Identificação</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Campo label="Nome" obrig>
                <input className={inputCls} value={primeiroNome} onChange={(e) => setPrimeiroNome(e.target.value)} />
              </Campo>
              <Campo label="Sobrenome(s)" obrig>
                <input className={inputCls} value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} />
              </Campo>
              <Campo label="Nome preferido">
                <input className={inputCls} value={nomePreferido} onChange={(e) => setNomePreferido(e.target.value)} />
              </Campo>
              <Campo label="Data de nascimento" obrig>
                <input type="date" className={inputCls} value={nascimento} onChange={(e) => setNasc(e.target.value)} />
              </Campo>
              <Campo label="Gênero" obrig>
                <select className={inputCls} value={genero} onChange={(e) => setGenero(e.target.value as Genero | "")}>
                  <option value="">—</option>
                  {Object.values(Genero).map((g) => (
                    <option key={g} value={g}>{GENERO_LABEL[g]}</option>
                  ))}
                </select>
              </Campo>
            </div>
          </section>

          {/* Documentação (país dirige) */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-1 text-sm font-medium">Documentação</h2>
            <p className="mb-4 text-xs text-gray-400">O país dirige os tipos de documento e a validação. Documento inválido avisa, mas não bloqueia (doc 04).</p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Campo label="País" obrig>
                <select className={inputCls} value={alunoPaisId} onChange={(e) => aoTrocarPais(e.target.value)}>
                  {paises.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Tipo de documento" obrig>
                <select className={inputCls} value={tipoDocumentoId} onChange={(e) => setTipoDoc(e.target.value)}>
                  <option value="">—</option>
                  {tiposDocDoPais.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Número do documento" obrig>
                <input className={inputCls} value={documento} onChange={(e) => setDoc(e.target.value)} />
              </Campo>
              <Campo label="País emissor">
                <SelectISO value={documentoPaisEmissor} onChange={setDocEmissor} comVazio />
              </Campo>
              <Campo label="Nacionalidade" obrig>
                <SelectISO value={nacionalidade} onChange={setNacionalidade} comVazio />
              </Campo>
              <Campo label="Segunda nacionalidade">
                <SelectISO value={segundaNacionalidade} onChange={setSegNacionalidade} comVazio />
              </Campo>
            </div>
          </section>

          {/* Contato */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Contato</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Campo label="E-mail" obrig>
                <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
              </Campo>
              <Campo label="Telefone principal" obrig>
                <input className={inputCls} value={telefone} onChange={(e) => setTel(e.target.value)} placeholder="+506..." />
              </Campo>
              <div className="flex items-end gap-4 pb-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} />
                  É WhatsApp
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={aceitaComunicacoes} onChange={(e) => setAceitaCom(e.target.checked)} />
                  Recebe comunicações
                </label>
              </div>
            </div>
          </section>

          {/* Residência */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Residência</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Campo label="País de residência" obrig>
                <SelectISO value={paisResidencia} onChange={setPaisResidencia} comVazio />
              </Campo>
              <Campo label="CEP / Código postal">
                <input className={inputCls} value={cep} onChange={(e) => setCep(e.target.value)} />
              </Campo>
              <Campo label="Região / Estado / Província">
                <input className={inputCls} value={regiao} onChange={(e) => setRegiao(e.target.value)} />
              </Campo>
              <Campo label="Cidade">
                <input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </Campo>
              <Campo label="Bairro / Distrito">
                <input className={inputCls} value={bairro} onChange={(e) => setBairro(e.target.value)} />
              </Campo>
              <Campo label="Rua">
                <input className={inputCls} value={rua} onChange={(e) => setRua(e.target.value)} />
              </Campo>
              <Campo label="Número">
                <input className={inputCls} value={numero} onChange={(e) => setNumero(e.target.value)} />
              </Campo>
              <Campo label="Complemento">
                <input className={inputCls} value={complemento} onChange={(e) => setComplemento(e.target.value)} />
              </Campo>
            </div>
          </section>

          {/* Acadêmico */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Acadêmico</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Campo label="Escolaridade">
                <select className={inputCls} value={escolaridade} onChange={(e) => setEscolaridade(e.target.value as Escolaridade | "")}>
                  <option value="">—</option>
                  {Object.values(Escolaridade).map((e) => (
                    <option key={e} value={e}>{ESCOLARIDADE_LABEL[e]}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Idioma nativo">
                <input className={inputCls} value={idiomaNativo} onChange={(e) => setIdiomaNativo(e.target.value)} placeholder="Ex.: Espanhol" />
              </Campo>
            </div>
          </section>

          {/* Operacional */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Operacional</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Campo label="Fuso horário">
                <input className={inputCls} value={fuso} onChange={(e) => setFuso(e.target.value)} placeholder="Ex.: America/Costa_Rica" />
              </Campo>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-medium text-gray-600">Contato de emergência</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <input className={inputCls} placeholder="Nome" value={emergenciaNome} onChange={(e) => setEmergNome(e.target.value)} />
                <input className={inputCls} placeholder="Parentesco" value={emergenciaParentesco} onChange={(e) => setEmergParentesco(e.target.value)} />
                <input className={inputCls} placeholder="Telefone" value={emergenciaTelefone} onChange={(e) => setEmergTel(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <label className="mb-1 block text-xs text-gray-600">Observações</label>
              <textarea className={inputCls} rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </section>

          {/* Responsável financeiro (pagador) */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Responsável financeiro (pagador)</h2>
            <select className={inputCls + " mb-2 md:w-1/3"} value={pagador} onChange={(e) => setPagador(e.target.value as typeof pagador)}>
              <option value="ALUNO">O próprio aluno (Adulto)</option>
              <option value="RESPONSAVEL">Responsável (Kids/Teens)</option>
              <option value="EMPRESA">Empresa (B2B)</option>
            </select>
            {pagador !== "ALUNO" && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <input className={inputCls} placeholder={pagador === "EMPRESA" ? "Nome da empresa" : "Nome do responsável"} value={respNome} onChange={(e) => setRespNome(e.target.value)} />
                {pagador === "RESPONSAVEL" && (
                  <input className={inputCls} placeholder="Parentesco" value={respParentesco} onChange={(e) => setRespParentesco(e.target.value)} />
                )}
                <input className={inputCls} placeholder="Telefone" value={respTelefone} onChange={(e) => setRespTelefone(e.target.value)} />
                <input className={inputCls} placeholder="E-mail" value={respEmail} onChange={(e) => setRespEmail(e.target.value)} />
              </div>
            )}
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => irParaPasso(2)}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Próximo: curso e contrato →
            </button>
          </div>
        </>
      )}

      {/* Passo 2 — Curso, alocação e contrato */}
      {passo === 2 && (
        <>
          <div className="rounded-lg border border-gray-200 bg-surface px-5 py-3 text-sm text-gray-600">
            Aluno: <strong className="text-gray-900">{[primeiroNome, sobrenome].filter(Boolean).join(" ") || "—"}</strong> · {paisNome}
            <button
              type="button"
              onClick={() => irParaPasso(1)}
              className="ml-2 text-xs text-brand-700 hover:underline"
            >
              editar
            </button>
          </div>

          {/* Curso & alocação */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Curso & alocação</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">Produto</label>
                <select
                  className={inputCls}
                  value={produtoId}
                  onChange={(e) => {
                    setProduto(e.target.value);
                    prefillPrecos(alunoPaisId, e.target.value);
                  }}
                >
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Turma (Aberta com vaga)</label>
                <select className={inputCls} value={turmaId} onChange={(e) => setTurma(e.target.value)}>
                  <option value="">Sem alocação / lista de espera</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                {!turmaId && (
                  <button type="button" onClick={pedirAbertura} className="mt-1 text-xs text-brand-700 hover:underline">
                    Sem turma compatível? Solicitar abertura ao Gerente Pedagógico
                  </button>
                )}
                {aberturaMsg && <p className="mt-1 text-xs text-gray-500">{aberturaMsg}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Nível inicial</label>
                <select className={inputCls} value={nivelInicialId} onChange={(e) => setNivel(e.target.value)}>
                  <option value="">—</option>
                  {niveis.map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Origem do nível</label>
                <select className={inputCls} value={origemNivel} onChange={(e) => setOrigem(e.target.value as OrigemNivel)}>
                  <option value={OrigemNivel.MANUAL}>Manual</option>
                  <option value={OrigemNivel.AVALIACAO}>Avaliação</option>
                </select>
              </div>
              {origemNivel === OrigemNivel.AVALIACAO && (
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Data da avaliação</label>
                  <input type="date" className={inputCls} value={dataAvaliacaoNivel} onChange={(e) => setDataAval(e.target.value)} />
                </div>
              )}
            </div>
          </section>

          {/* Contrato */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-1 text-sm font-medium">Contrato — linhas de cobrança</h2>
            <p className="mb-4 text-xs text-gray-400">Moeda: {moeda || "—"} · valores de referência pré-preenchidos (edite o negociado).</p>
            {semTabela && (
              <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Sem tabela de preço ativa para este país × produto. Os valores abaixo são
                <strong> manuais</strong> (sem referência). Para registrar a matrícula, informe a
                justificativa da exceção (será auditada).
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-gray-600">Taxa de matrícula</label>
                <input type="number" step="0.01" className={inputCls} value={taxaValor} onChange={(e) => setTaxa(e.target.value)} />
                <PrecoTag refValor={refTaxa?.valor} moeda={moeda} manual={taxaManual} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Mensalidade</label>
                <input type="number" step="0.01" className={inputCls} value={mensalidadeValor} onChange={(e) => setMens(e.target.value)} />
                <PrecoTag refValor={refMens?.valor} moeda={moeda} manual={mensManual} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Dia de vencimento</label>
                <select className={inputCls} value={diaVencimento} onChange={(e) => setDia(Number(e.target.value))}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>Dia {d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Meses do plano</label>
                <input type="number" className={inputCls} value={mesesPlano} onChange={(e) => setMeses(Number(e.target.value))} />
              </div>
              <div>
                <label htmlFor="referencia-cobertura" className="mb-1 block text-xs text-gray-600">Cobertura prevista no contrato</label>
                <select id="referencia-cobertura" className={inputCls} value={referenciaCobertura} onChange={(e) => setReferenciaCobertura(e.target.value as typeof referenciaCobertura)}>
                  <option value="">Selecione a regra contratada</option>
                  <option value="MES_CIVIL">Mês civil</option>
                  <option value="CICLO_MATRICULA">Ciclo mensal da matrícula</option>
                </select>
                <p className="text-xs text-gray-600">Se o mês não tiver esse dia, vence no último dia do mês. A referência é mantida nos meses seguintes.</p>
              </div>
              <div>
                <label htmlFor="primeiro-vencimento" className="mb-1 block text-xs text-gray-600">Vencimento da primeira mensalidade</label>
                <input id="primeiro-vencimento" type="date" className={inputCls} value={primeiroVencimento} onChange={(e) => setPrimeiroVencimento(e.target.value)} />
                <p className="text-xs text-gray-600">Informe a data acordada. As seguintes usam o dia de referência nos próximos meses; a cobertura permanece independente.</p>
              </div>
              <div>
                <label htmlFor="inicio-cobertura" className="mb-1 block text-xs text-gray-600">Início do primeiro período coberto</label>
                <input id="inicio-cobertura" type="date" className={inputCls} value={inicioCobertura} onChange={(e) => setInicioCobertura(e.target.value)} />
                <p className="text-xs text-gray-600">{referenciaCobertura === "MES_CIVIL" ? "Informe o primeiro dia do mês contratado." : "Esta data define a referência dos ciclos mensais."} A cobertura é independente do vencimento; a mensalidade permanece integral.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Comissão da matrícula</label>
                <p className="text-sm text-gray-600">Calculada pela política vigente da oferta: percentual da taxa ou valor fixo. A administração configura as versões no Financeiro.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Certificado (só Costa Rica)</label>
                <input type="number" step="0.01" className={inputCls} value={certificadoValor} onChange={(e) => setCert(e.target.value)} placeholder="0" />
              </div>
            </div>
            {semTabela && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <label className="mb-1 block text-xs text-gray-600">
                  Justificativa da exceção (sem tabela de preço) <span className="text-red-500">*</span>
                </label>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={justificativaSemPreco}
                  onChange={(e) => setJustSemPreco(e.target.value)}
                  placeholder="Ex.: país/produto ainda sem matriz de preços; valor aprovado pelo gerente."
                />
              </div>
            )}
            <p className="mt-3 text-sm text-gray-600">
              Taxa de matrícula: <strong>{formatarMoeda(Number(taxaValor || 0), moeda)}</strong>. Mensalidade: {formatarMoeda(Number(mensalidadeValor || 0), moeda)}.
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => irParaPasso(1)}
              disabled={salvando}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              ← Voltar
            </button>
            <div className="ml-auto flex gap-2">
              {podeCriar && (
                <button
                  onClick={() => salvar()}
                  disabled={salvando}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {salvando ? "Processando…" : "Salvar matrícula"}
                </button>
              )}

            </div>
          </div>
          <p className="text-xs text-gray-500">
            A matrícula será criada como <strong>Aguardando</strong>. Para concluir, a secretaria
            confirma o aceite do contrato e o Financeiro confirma a taxa. A configuração da escola
            pode exigir também o pagamento da primeira mensalidade.
          </p>
        </>
      )}
    </div>
  );
}

/** Campo com label e marcador de obrigatório. */
function Campo({ label, obrig, children }: { label: string; obrig?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-600">
        {label}
        {obrig && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

/** Select de país ISO 3166 (nacionalidade, residência, país emissor). */
function SelectISO({
  value,
  onChange,
  comVazio,
}: {
  value: string;
  onChange: (v: string) => void;
  comVazio?: boolean;
}) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {comVazio && <option value="">—</option>}
      {PAISES_ISO.map((p) => (
        <option key={p.codigo} value={p.codigo}>{p.nome}</option>
      ))}
    </select>
  );
}

/** Etiqueta da linha de cobrança: diferencia preço sugerido × manual × sem tabela (issue #22). */
function PrecoTag({ refValor, moeda, manual }: { refValor?: number; moeda: string; manual: boolean }) {
  if (refValor === undefined) {
    return <p className="mt-1 text-xs text-amber-700">Sem tabela — valor manual</p>;
  }
  if (manual) {
    return (
      <p className="mt-1 text-xs text-amber-700">
        Manual (sugerido: {formatarMoeda(refValor, moeda)})
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-gray-400">
      Sugerido: {formatarMoeda(refValor, moeda)}
    </p>
  );
}

/** Stepper do wizard (2 passos). O passo concluído/clicável volta livremente; avançar valida o passo 1. */
function Stepper({ passo, onIr }: { passo: 1 | 2; onIr: (p: 1 | 2) => void }) {
  const passos = [
    { n: 1 as const, label: "Informações do aluno" },
    { n: 2 as const, label: "Curso, alocação e contrato" },
  ];
  return (
    <div className="flex items-center gap-3">
      {passos.map((s, i) => {
        const ativo = passo === s.n;
        const concluido = passo > s.n;
        return (
          <div key={s.n} className="flex items-center gap-3">
            <button type="button" onClick={() => onIr(s.n)} className="flex items-center gap-2">
              <span
                className={
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium " +
                  (ativo || concluido ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500")
                }
              >
                {concluido ? "✓" : s.n}
              </span>
              <span className={"text-sm " + (ativo ? "font-medium text-gray-900" : "text-gray-500")}>
                {s.label}
              </span>
            </button>
            {i < passos.length - 1 && <span className="h-px w-8 bg-gray-200" />}
          </div>
        );
      })}
    </div>
  );
}
