"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TipoCobranca, OrigemNivel, Genero, Escolaridade } from "@prisma/client";
import { GENERO_LABEL, ESCOLARIDADE_LABEL } from "@/lib/labels";
import { formatarMoeda, parseMoeda, formatarMoedaParaCampo } from "@/lib/dinheiro";
import { PAISES_ISO } from "@/lib/paises-iso";
import { criarMatricula } from "@/server/matricula/acoes";
import { solicitarAberturaTurma } from "@/server/turmas/acoes";
import { CampoMoeda } from "@/components/CampoMoeda";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Números já parseados dos três campos de dinheiro do passo 2 — validarPasso2 devolve
 *  isto (ou um erro), montarInput só aceita isto, nunca o texto cru de novo. */
interface ValoresMonetariosPasso2 {
  taxa: number;
  mensalidade: number;
  certificado: number;
}

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
  // criarMatricula não recebe chave de idempotência (server/matricula/acoes.ts:622-633): repetir pode
  // criar aluno e contrato em dobro — conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  // Solicitar abertura só grava um evento, sem chave (server/turmas/acoes.ts:74-93): repetir duplica o pedido.
  const abertura = useAcaoCliente({ idempotente: false });
  // Depois do sucesso a tela navega; o botão segue travado até sair, para não criar a matrícula de novo.
  const [navegando, setNavegando] = useState(false);
  const salvando = acao.ocupado || navegando;
  // Wizard: passo 1 = informações do aluno · passo 2 = curso, alocação e contrato.
  const [passo, setPasso] = useState<1 | 2>(1);

  async function pedirAbertura() {
    await abertura.executar(() => solicitarAberturaTurma({ produtoId, nivelId: nivelInicialId || undefined }), "Solicitação enviada ao Gerente Pedagógico.");
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
  const taxaManual = !!refTaxa && taxaValor !== "" && parseMoeda(taxaValor) !== refTaxa.valor;
  const mensManual = !!refMens && mensalidadeValor !== "" && parseMoeda(mensalidadeValor) !== refMens.valor;

  function prefillPrecos(pid: string, prodId: string) {
    const taxa = precoRefDe(pid, prodId, TipoCobranca.MATRICULA);
    const mens = precoRefDe(pid, prodId, TipoCobranca.MENSALIDADE);
    const moedaDoPais = paises.find((p) => p.id === pid)?.moedaLocal;
    // formatarMoedaParaCampo (não String cru): pré-preenche já no formato que o campo
    // exibe depois do blur — vírgula, casas certas pra moeda — em vez do ponto do JS.
    if (taxa) setTaxa(formatarMoedaParaCampo(taxa.valor, moedaDoPais));
    if (mens) setMens(formatarMoedaParaCampo(mens.valor, moedaDoPais));
  }

  // País dirige documento/telefone/moeda — ao trocar, reseta o tipo de documento se não
  // pertencer ao novo país (doc 04).
  function aoTrocarPais(novoPaisId: string) {
    setPaisId(novoPaisId);
    const np = paises.find((p) => p.id === novoPaisId);
    if (np && !np.tiposDocumento.some((t) => t.id === tipoDocumentoId)) setTipoDoc("");
    prefillPrecos(novoPaisId, produtoId);
  }

  function montarInput(referencia: "MES_CIVIL" | "CICLO_MATRICULA", valores: ValoresMonetariosPasso2) {
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
      taxaValor: valores.taxa,
      mensalidadeValor: valores.mensalidade,
      certificadoValor: valores.certificado,
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

  // Nunca ?? 0 nos três valores monetários: texto inválido viraria taxa/mensalidade/
  // certificado GRATUITOS registrados na matrícula, silencioso. Parseia UMA VEZ aqui e
  // devolve os números prontos — montarInput não reparseia (e não tem fallback ?? 0
  // interno pra ninguém reusar por engano sem validar antes).
  function validarPasso2(): { erro: string } | ValoresMonetariosPasso2 {
    const taxa = parseMoeda(taxaValor);
    if (taxa === null) return { erro: "Informe a taxa de matrícula, com no máximo duas casas decimais." };
    const mensalidade = parseMoeda(mensalidadeValor);
    if (mensalidade === null) return { erro: "Informe a mensalidade, com no máximo duas casas decimais." };
    const certificado = certificadoValor === "" ? 0 : parseMoeda(certificadoValor);
    if (certificado === null) return { erro: "Informe o valor do certificado, com no máximo duas casas decimais." };
    return { taxa, mensalidade, certificado };
  }

  function irParaPasso(p: 1 | 2) {
    if (p === 2) {
      const e = validarPasso1();
      if (e) {
        acao.setErro(e);
        return;
      }
    }
    acao.limpar();
    setPasso(p);
  }

  async function salvar() {
    acao.limpar();
    if (!referenciaCobertura || !inicioCobertura || !primeiroVencimento) {
      acao.setErro("Informe a referência contratual, o início da cobertura e o primeiro vencimento.");
      return;
    }
    const passo2 = validarPasso2();
    if ("erro" in passo2) {
      acao.setErro(passo2.erro);
      return;
    }
    const res = await acao.executar(() => criarMatricula(montarInput(referenciaCobertura, passo2)));
    if (res?.tipo !== "ok") return;
    setNavegando(true);
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

      {/* Passo 1 — Informações do aluno */}
      {passo === 1 && (
        <>
          {/* Identificação */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Identificação</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <Campo id="matricula-nome" label="Nome" obrig>
                {(id) => <input id={id} aria-required="true" className={inputCls} value={primeiroNome} onChange={(e) => setPrimeiroNome(e.target.value)} />}
              </Campo>
              <Campo id="matricula-sobrenome" label="Sobrenome(s)" obrig>
                {(id) => <input id={id} aria-required="true" className={inputCls} value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} />}
              </Campo>
              <Campo id="matricula-nome-preferido" label="Nome preferido">
                {(id) => <input id={id} className={inputCls} value={nomePreferido} onChange={(e) => setNomePreferido(e.target.value)} />}
              </Campo>
              <Campo id="matricula-nascimento" label="Data de nascimento" obrig>
                {(id) => <input id={id} aria-required="true" type="date" className={inputCls} value={nascimento} onChange={(e) => setNasc(e.target.value)} />}
              </Campo>
              <Campo id="matricula-genero" label="Gênero" obrig>
                {(id) => (
                  <select id={id} aria-required="true" className={inputCls} value={genero} onChange={(e) => setGenero(e.target.value as Genero | "")}>
                    <option value="">—</option>
                    {Object.values(Genero).map((g) => (
                      <option key={g} value={g}>{GENERO_LABEL[g]}</option>
                    ))}
                  </select>
                )}
              </Campo>
            </div>
          </section>

          {/* Documentação (país dirige) */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-1 text-sm font-medium">Documentação</h2>
            <p className="mb-4 text-xs text-gray-400">O país dirige os tipos de documento e a validação. Documento inválido avisa, mas não bloqueia (doc 04).</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <Campo id="matricula-pais" label="País" obrig>
                {(id) => (
                  <select id={id} aria-required="true" className={inputCls} value={alunoPaisId} onChange={(e) => aoTrocarPais(e.target.value)}>
                    {paises.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo id="matricula-tipo-documento" label="Tipo de documento" obrig>
                {(id) => (
                  <select id={id} aria-required="true" className={inputCls} value={tipoDocumentoId} onChange={(e) => setTipoDoc(e.target.value)}>
                    <option value="">—</option>
                    {tiposDocDoPais.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo id="matricula-documento" label="Número do documento" obrig>
                {(id) => <input id={id} aria-required="true" className={inputCls} value={documento} onChange={(e) => setDoc(e.target.value)} />}
              </Campo>
              <Campo id="matricula-pais-emissor" label="País emissor">
                {(id) => <SelectISO id={id} value={documentoPaisEmissor} onChange={setDocEmissor} comVazio />}
              </Campo>
              <Campo id="matricula-nacionalidade" label="Nacionalidade" obrig>
                {(id) => <SelectISO id={id} obrig value={nacionalidade} onChange={setNacionalidade} comVazio />}
              </Campo>
              <Campo id="matricula-segunda-nacionalidade" label="Segunda nacionalidade">
                {(id) => <SelectISO id={id} value={segundaNacionalidade} onChange={setSegNacionalidade} comVazio />}
              </Campo>
            </div>
          </section>

          {/* Contato */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Contato</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <Campo id="matricula-email" label="E-mail" obrig>
                {(id) => <input id={id} aria-required="true" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Campo>
              <Campo id="matricula-telefone" label="Telefone principal" obrig>
                {(id) => <input id={id} aria-required="true" className={inputCls} value={telefone} onChange={(e) => setTel(e.target.value)} placeholder="+506..." />}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <Campo id="matricula-pais-residencia" label="País de residência" obrig>
                {(id) => <SelectISO id={id} obrig value={paisResidencia} onChange={setPaisResidencia} comVazio />}
              </Campo>
              <Campo id="matricula-cep" label="CEP / Código postal">
                {(id) => <input id={id} className={inputCls} value={cep} onChange={(e) => setCep(e.target.value)} />}
              </Campo>
              <Campo id="matricula-regiao" label="Região / Estado / Província">
                {(id) => <input id={id} className={inputCls} value={regiao} onChange={(e) => setRegiao(e.target.value)} />}
              </Campo>
              <Campo id="matricula-cidade" label="Cidade">
                {(id) => <input id={id} className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} />}
              </Campo>
              <Campo id="matricula-bairro" label="Bairro / Distrito">
                {(id) => <input id={id} className={inputCls} value={bairro} onChange={(e) => setBairro(e.target.value)} />}
              </Campo>
              <Campo id="matricula-rua" label="Rua">
                {(id) => <input id={id} className={inputCls} value={rua} onChange={(e) => setRua(e.target.value)} />}
              </Campo>
              <Campo id="matricula-numero" label="Número">
                {(id) => <input id={id} className={inputCls} value={numero} onChange={(e) => setNumero(e.target.value)} />}
              </Campo>
              <Campo id="matricula-complemento" label="Complemento">
                {(id) => <input id={id} className={inputCls} value={complemento} onChange={(e) => setComplemento(e.target.value)} />}
              </Campo>
            </div>
          </section>

          {/* Acadêmico */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Acadêmico</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <Campo id="matricula-escolaridade" label="Escolaridade">
                {(id) => (
                  <select id={id} className={inputCls} value={escolaridade} onChange={(e) => setEscolaridade(e.target.value as Escolaridade | "")}>
                    <option value="">—</option>
                    {Object.values(Escolaridade).map((e) => (
                      <option key={e} value={e}>{ESCOLARIDADE_LABEL[e]}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo id="matricula-idioma-nativo" label="Idioma nativo">
                {(id) => <input id={id} className={inputCls} value={idiomaNativo} onChange={(e) => setIdiomaNativo(e.target.value)} placeholder="Ex.: Espanhol" />}
              </Campo>
            </div>
          </section>

          {/* Operacional */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Operacional</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <Campo id="matricula-fuso" label="Fuso horário">
                {(id) => <input id={id} className={inputCls} value={fuso} onChange={(e) => setFuso(e.target.value)} placeholder="Ex.: America/Costa_Rica" />}
              </Campo>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-medium text-gray-600">Contato de emergência</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
                <input aria-label="Nome do contato de emergência" className={inputCls} placeholder="Nome" value={emergenciaNome} onChange={(e) => setEmergNome(e.target.value)} />
                <input aria-label="Parentesco do contato de emergência" className={inputCls} placeholder="Parentesco" value={emergenciaParentesco} onChange={(e) => setEmergParentesco(e.target.value)} />
                <input aria-label="Telefone do contato de emergência" className={inputCls} placeholder="Telefone" value={emergenciaTelefone} onChange={(e) => setEmergTel(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <label htmlFor="matricula-observacoes" className="mb-1 block text-xs text-gray-600">Observações</label>
              <textarea id="matricula-observacoes" className={inputCls} rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </section>

          {/* Responsável financeiro (pagador) */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 id="matricula-pagador-titulo" className="mb-4 text-sm font-medium">Responsável financeiro (pagador)</h2>
            <select aria-labelledby="matricula-pagador-titulo" className={inputCls + " mb-2 md:w-1/3"} value={pagador} onChange={(e) => setPagador(e.target.value as typeof pagador)}>
              <option value="ALUNO">O próprio aluno (Adulto)</option>
              <option value="RESPONSAVEL">Responsável (Kids/Teens)</option>
              <option value="EMPRESA">Empresa (B2B)</option>
            </select>
            {pagador !== "ALUNO" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-4">
                <input aria-label={pagador === "EMPRESA" ? "Nome da empresa pagadora" : "Nome do responsável financeiro"} className={inputCls} placeholder={pagador === "EMPRESA" ? "Nome da empresa" : "Nome do responsável"} value={respNome} onChange={(e) => setRespNome(e.target.value)} />
                {pagador === "RESPONSAVEL" && (
                  <input aria-label="Parentesco do responsável financeiro" className={inputCls} placeholder="Parentesco" value={respParentesco} onChange={(e) => setRespParentesco(e.target.value)} />
                )}
                <input aria-label="Telefone do responsável financeiro" className={inputCls} placeholder="Telefone" value={respTelefone} onChange={(e) => setRespTelefone(e.target.value)} />
                <input aria-label="E-mail do responsável financeiro" className={inputCls} placeholder="E-mail" value={respEmail} onChange={(e) => setRespEmail(e.target.value)} />
              </div>
            )}
          </section>

          {/* Validação do passo 1 (também pelo Stepper): junto do botão que avança. */}
          <FeedbackAcao erro={acao.erro} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => irParaPasso(2)}
              className={botaoClasses({ tamanho: "lg" })}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="matricula-produto" className="mb-1 block text-xs text-gray-600">Produto</label>
                <select
                  id="matricula-produto"
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
                <label htmlFor="matricula-turma" className="mb-1 block text-xs text-gray-600">Turma (Aberta com vaga)</label>
                <select id="matricula-turma" className={inputCls} value={turmaId} onChange={(e) => setTurma(e.target.value)}>
                  <option value="">Sem alocação / lista de espera</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                {!turmaId && (
                  <button type="button" onClick={pedirAbertura} disabled={abertura.ocupado} className="mt-1 text-xs text-brand-700 hover:underline">
                    Sem turma compatível? Solicitar abertura ao Gerente Pedagógico
                  </button>
                )}
                <FeedbackAcao erro={abertura.erro} sucesso={abertura.sucesso} className="mt-1" />
              </div>
              <div>
                <label htmlFor="matricula-nivel-inicial" className="mb-1 block text-xs text-gray-600">Nível inicial</label>
                <select id="matricula-nivel-inicial" className={inputCls} value={nivelInicialId} onChange={(e) => setNivel(e.target.value)}>
                  <option value="">—</option>
                  {niveis.map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="matricula-origem-nivel" className="mb-1 block text-xs text-gray-600">Origem do nível</label>
                <select id="matricula-origem-nivel" className={inputCls} value={origemNivel} onChange={(e) => setOrigem(e.target.value as OrigemNivel)}>
                  <option value={OrigemNivel.MANUAL}>Manual</option>
                  <option value={OrigemNivel.AVALIACAO}>Avaliação</option>
                </select>
              </div>
              {origemNivel === OrigemNivel.AVALIACAO && (
                <div>
                  <label htmlFor="matricula-data-avaliacao" className="mb-1 block text-xs text-gray-600">Data da avaliação</label>
                  <input id="matricula-data-avaliacao" type="date" className={inputCls} value={dataAvaliacaoNivel} onChange={(e) => setDataAval(e.target.value)} />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <label htmlFor="matricula-taxa" className="mb-1 block text-xs text-gray-600">Taxa de matrícula</label>
                <CampoMoeda id="matricula-taxa" value={taxaValor} onChange={setTaxa} moeda={moeda} className={inputCls} />
                <PrecoTag refValor={refTaxa?.valor} moeda={moeda} manual={taxaManual} />
              </div>
              <div>
                <label htmlFor="matricula-mensalidade" className="mb-1 block text-xs text-gray-600">Mensalidade</label>
                <CampoMoeda id="matricula-mensalidade" value={mensalidadeValor} onChange={setMens} moeda={moeda} className={inputCls} />
                <PrecoTag refValor={refMens?.valor} moeda={moeda} manual={mensManual} />
              </div>
              <div>
                <label htmlFor="matricula-dia-vencimento" className="mb-1 block text-xs text-gray-600">Dia de vencimento</label>
                <select id="matricula-dia-vencimento" className={inputCls} value={diaVencimento} onChange={(e) => setDia(Number(e.target.value))}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>Dia {d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="matricula-meses-plano" className="mb-1 block text-xs text-gray-600">Meses do plano</label>
                <input id="matricula-meses-plano" type="number" className={inputCls} value={mesesPlano} onChange={(e) => setMeses(Number(e.target.value))} />
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
                <p className="mb-1 block text-xs text-gray-600">Comissão da matrícula</p>
                <p className="text-sm text-gray-600">Calculada pela política vigente da oferta: percentual da taxa ou valor fixo. A administração configura as versões no Financeiro.</p>
              </div>
              <div>
                <label htmlFor="matricula-certificado" className="mb-1 block text-xs text-gray-600">Certificado (só Costa Rica)</label>
                <CampoMoeda id="matricula-certificado" value={certificadoValor} onChange={setCert} moeda={moeda} className={inputCls} placeholder="0" />
              </div>
            </div>
            {semTabela && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <label htmlFor="matricula-justificativa-sem-preco" className="mb-1 block text-xs text-gray-600">
                  Justificativa da exceção (sem tabela de preço) <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="matricula-justificativa-sem-preco"
                  aria-required="true"
                  className={inputCls}
                  rows={2}
                  value={justificativaSemPreco}
                  onChange={(e) => setJustSemPreco(e.target.value)}
                  placeholder="Ex.: país/produto ainda sem matriz de preços; valor aprovado pelo gerente."
                />
              </div>
            )}
            <p className="mt-3 text-sm text-gray-600">
              Taxa de matrícula: <strong>{formatarMoeda(parseMoeda(taxaValor) ?? 0, moeda)}</strong>. Mensalidade: {formatarMoeda(parseMoeda(mensalidadeValor) ?? 0, moeda)}.
            </p>
          </section>

          <FeedbackAcao erro={acao.erro} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => irParaPasso(1)}
              disabled={salvando}
              className={botaoClasses({ variante: "secundario", tamanho: "lg" })}
            >
              ← Voltar
            </button>
            <div className="ml-auto flex gap-2">
              {podeCriar && (
                <button
                  onClick={() => salvar()}
                  disabled={salvando}
                  className={botaoClasses({ variante: "secundario", tamanho: "lg" })}
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
function Campo({ id, label, obrig, children }: { id: string; label: string; obrig?: boolean; children: (id: string) => ReactNode }) {
  // O mesmo id vai para o htmlFor do rótulo e é repassado ao campo filho (render prop).
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-gray-600">
        {label}
        {obrig && <span className="text-red-500"> *</span>}
      </label>
      {children(id)}
    </div>
  );
}

/** Select de país ISO 3166 (nacionalidade, residência, país emissor). */
function SelectISO({
  id,
  obrig,
  value,
  onChange,
  comVazio,
}: {
  id: string;
  obrig?: boolean;
  value: string;
  onChange: (v: string) => void;
  comVazio?: boolean;
}) {
  return (
    <select id={id} aria-required={obrig ? true : undefined} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
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
