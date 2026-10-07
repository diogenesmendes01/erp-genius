"use client";

import { useState } from "react";
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
import { CampoTexto } from "@/components/CampoTexto";
import { Campo, CONTROLE_INVALIDO, focarPrimeiroComErro, type ErrosDeCampos, type LigacaoCampo } from "@/components/Campo";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 " +
  CONTROLE_INVALIDO;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Números já parseados dos três campos de dinheiro do passo 2 — errosDoPasso2 devolve
 *  isto (ou os erros), montarInput só aceita isto, nunca o texto cru de novo. */
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

/** Campos validados no cliente, na ordem da tela (o foco vai para o primeiro com erro). Os ids são os
 *  do <Campo> de cada um. */
const IDS_PASSO1 = {
  primeiroNome: "matricula-nome",
  sobrenome: "matricula-sobrenome",
  nascimento: "matricula-nascimento",
  genero: "matricula-genero",
  alunoPaisId: "matricula-pais",
  tipoDocumentoId: "matricula-tipo-documento",
  documento: "matricula-documento",
  nacionalidade: "matricula-nacionalidade",
  email: "matricula-email",
  telefone: "matricula-telefone",
  paisResidencia: "matricula-pais-residencia",
  respNome: "matricula-responsavel-nome",
} as const;
type CampoPasso1 = keyof typeof IDS_PASSO1;

/** Valores do passo 1 que a validação confere (os mesmos estados do formulário). */
export type DadosPasso1 = Record<Exclude<CampoPasso1, "respNome">, string> & { respNome: string; pagador: "ALUNO" | "RESPONSAVEL" | "EMPRESA" };

/**
 * Validação "inteligente" do passo 1 (essenciais obrigatórios) — espelha o MatriculaSchema
 * (servidor é a fonte da verdade). País dirige o resto. Todos os erros de uma vez, por campo, na
 * ordem da tela: o operador vê cada campo marcado em vez de descobrir um por clique. Função pura
 * (fora do componente) para o teste conferir cada regra sem simular o clique.
 */
export function errosDoPasso1(d: DadosPasso1): ErrosDeCampos<CampoPasso1> {
  const erros: ErrosDeCampos<CampoPasso1> = {};
  if (!d.primeiroNome.trim()) erros.primeiroNome = "Informe o nome do aluno.";
  if (!d.sobrenome.trim()) erros.sobrenome = "Informe o sobrenome.";
  if (!d.nascimento) erros.nascimento = "Informe a data de nascimento.";
  if (!d.genero) erros.genero = "Selecione o gênero.";
  if (!d.alunoPaisId) erros.alunoPaisId = "Selecione o país.";
  if (!d.tipoDocumentoId) erros.tipoDocumentoId = "Selecione o tipo de documento.";
  if (!d.documento.trim()) erros.documento = "Informe o número do documento.";
  if (!d.nacionalidade) erros.nacionalidade = "Selecione a nacionalidade.";
  if (!d.email.trim()) erros.email = "Informe o e-mail.";
  else if (!EMAIL_RE.test(d.email.trim())) erros.email = "E-mail inválido.";
  if (!d.telefone.trim()) erros.telefone = "Informe o telefone.";
  if (!d.paisResidencia) erros.paisResidencia = "Selecione o país de residência.";
  if (d.pagador !== "ALUNO" && !d.respNome.trim()) {
    erros.respNome = d.pagador === "EMPRESA" ? "Informe o nome da empresa pagadora." : "Informe o nome do responsável financeiro.";
  }
  return erros;
}

const IDS_PASSO2 = {
  taxa: "matricula-taxa",
  mensalidade: "matricula-mensalidade",
  referenciaCobertura: "referencia-cobertura",
  primeiroVencimento: "primeiro-vencimento",
  inicioCobertura: "inicio-cobertura",
  certificado: "matricula-certificado",
} as const;
type CampoPasso2 = keyof typeof IDS_PASSO2;

/** Valores do passo 2 que a validação confere (o texto cru dos campos de dinheiro e as datas). */
export type DadosPasso2 = {
  taxaValor: string;
  mensalidadeValor: string;
  certificadoValor: string;
  referenciaCobertura: "" | "MES_CIVIL" | "CICLO_MATRICULA";
  primeiroVencimento: string;
  inicioCobertura: string;
};

/**
 * Validação do passo 2, por campo e na ordem da tela (taxa, mensalidade, cobertura, primeiro
 * vencimento, início, certificado). Nunca ?? 0 nos três valores monetários: texto inválido viraria
 * taxa/mensalidade/certificado GRATUITOS registrados na matrícula, silencioso. Parseia UMA VEZ aqui e
 * devolve os números prontos só quando os três são válidos — montarInput não reparseia (e não tem
 * fallback ?? 0 interno pra ninguém reusar por engano sem validar antes). Função pura, testada à parte.
 */
export function errosDoPasso2(d: DadosPasso2): { erros: ErrosDeCampos<CampoPasso2>; valores: ValoresMonetariosPasso2 | null } {
  const erros: ErrosDeCampos<CampoPasso2> = {};
  const taxa = parseMoeda(d.taxaValor);
  if (taxa === null) erros.taxa = "Informe a taxa de matrícula, com no máximo duas casas decimais.";
  const mensalidade = parseMoeda(d.mensalidadeValor);
  if (mensalidade === null) erros.mensalidade = "Informe a mensalidade, com no máximo duas casas decimais.";
  if (!d.referenciaCobertura) erros.referenciaCobertura = "Selecione a cobertura prevista no contrato.";
  if (!d.primeiroVencimento) erros.primeiroVencimento = "Informe o vencimento da primeira mensalidade.";
  if (!d.inicioCobertura) erros.inicioCobertura = "Informe o início do primeiro período coberto.";
  const certificado = d.certificadoValor === "" ? 0 : parseMoeda(d.certificadoValor);
  if (certificado === null) erros.certificado = "Informe o valor do certificado, com no máximo duas casas decimais.";
  const valores = taxa !== null && mensalidade !== null && certificado !== null ? { taxa, mensalidade, certificado } : null;
  return { erros, valores };
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
  // Depois da primeira tentativa de avançar/salvar, os erros de cada campo acompanham a digitação
  // (somem quando o campo é corrigido); antes dela nenhum campo é marcado.
  const [tentouPasso1, setTentouPasso1] = useState(false);
  const [tentouPasso2, setTentouPasso2] = useState(false);

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

  const validarPasso1 = () => errosDoPasso1({
    primeiroNome, sobrenome, nascimento, genero, alunoPaisId, tipoDocumentoId, documento, nacionalidade,
    email, telefone, paisResidencia, respNome, pagador,
  });

  const validarPasso2 = () => errosDoPasso2({ taxaValor, mensalidadeValor, certificadoValor, referenciaCobertura, primeiroVencimento, inicioCobertura });

  const errosPasso1: ErrosDeCampos<CampoPasso1> = tentouPasso1 ? validarPasso1() : {};
  const errosPasso2: ErrosDeCampos<CampoPasso2> = tentouPasso2 ? validarPasso2().erros : {};

  function irParaPasso(p: 1 | 2) {
    acao.limpar();
    if (p === 2) {
      // O erro aparece em cada campo (aria-invalid + mensagem) e o foco vai ao primeiro deles.
      setTentouPasso1(true);
      if (focarPrimeiroComErro(validarPasso1(), IDS_PASSO1)) return;
    }
    setPasso(p);
  }

  async function salvar() {
    acao.limpar();
    setTentouPasso2(true);
    const { erros, valores } = validarPasso2();
    if (focarPrimeiroComErro(erros, IDS_PASSO2) || !valores || !referenciaCobertura) return;
    const res = await acao.executar(() => criarMatricula(montarInput(referenciaCobertura, valores)));
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
              <Campo id={IDS_PASSO1.primeiroNome} rotulo="Nome" obrigatorio erro={errosPasso1.primeiroNome}>
                {(campo) => <input {...campo} className={inputCls} value={primeiroNome} onChange={(e) => setPrimeiroNome(e.target.value)} />}
              </Campo>
              <Campo id={IDS_PASSO1.sobrenome} rotulo="Sobrenome(s)" obrigatorio erro={errosPasso1.sobrenome}>
                {(campo) => <input {...campo} className={inputCls} value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} />}
              </Campo>
              <Campo id="matricula-nome-preferido" rotulo="Nome preferido">
                {(campo) => <input {...campo} className={inputCls} value={nomePreferido} onChange={(e) => setNomePreferido(e.target.value)} />}
              </Campo>
              <Campo id={IDS_PASSO1.nascimento} rotulo="Data de nascimento" obrigatorio erro={errosPasso1.nascimento}>
                {(campo) => <input {...campo} type="date" className={inputCls} value={nascimento} onChange={(e) => setNasc(e.target.value)} />}
              </Campo>
              <Campo id={IDS_PASSO1.genero} rotulo="Gênero" obrigatorio erro={errosPasso1.genero}>
                {(campo) => (
                  <select {...campo} className={inputCls} value={genero} onChange={(e) => setGenero(e.target.value as Genero | "")}>
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
              <Campo id={IDS_PASSO1.alunoPaisId} rotulo="País" obrigatorio erro={errosPasso1.alunoPaisId}>
                {(campo) => (
                  <select {...campo} className={inputCls} value={alunoPaisId} onChange={(e) => aoTrocarPais(e.target.value)}>
                    {paises.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo id={IDS_PASSO1.tipoDocumentoId} rotulo="Tipo de documento" obrigatorio erro={errosPasso1.tipoDocumentoId}>
                {(campo) => (
                  <select {...campo} className={inputCls} value={tipoDocumentoId} onChange={(e) => setTipoDoc(e.target.value)}>
                    <option value="">—</option>
                    {tiposDocDoPais.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo id={IDS_PASSO1.documento} rotulo="Número do documento" obrigatorio erro={errosPasso1.documento}>
                {(campo) => <input {...campo} className={inputCls} value={documento} onChange={(e) => setDoc(e.target.value)} />}
              </Campo>
              <Campo id="matricula-pais-emissor" rotulo="País emissor">
                {(campo) => <SelectISO {...campo} value={documentoPaisEmissor} onChange={setDocEmissor} comVazio />}
              </Campo>
              <Campo id={IDS_PASSO1.nacionalidade} rotulo="Nacionalidade" obrigatorio erro={errosPasso1.nacionalidade}>
                {(campo) => <SelectISO {...campo} value={nacionalidade} onChange={setNacionalidade} comVazio />}
              </Campo>
              <Campo id="matricula-segunda-nacionalidade" rotulo="Segunda nacionalidade">
                {(campo) => <SelectISO {...campo} value={segundaNacionalidade} onChange={setSegNacionalidade} comVazio />}
              </Campo>
            </div>
          </section>

          {/* Contato */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Contato</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <Campo id={IDS_PASSO1.email} rotulo="E-mail" obrigatorio erro={errosPasso1.email}>
                {(campo) => <input {...campo} type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Campo>
              <Campo id={IDS_PASSO1.telefone} rotulo="Telefone principal" obrigatorio erro={errosPasso1.telefone}>
                {(campo) => <input {...campo} className={inputCls} value={telefone} onChange={(e) => setTel(e.target.value)} placeholder="+506..." />}
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
              <Campo id={IDS_PASSO1.paisResidencia} rotulo="País de residência" obrigatorio erro={errosPasso1.paisResidencia}>
                {(campo) => <SelectISO {...campo} value={paisResidencia} onChange={setPaisResidencia} comVazio />}
              </Campo>
              <Campo id="matricula-cep" rotulo="CEP / Código postal">
                {(campo) => <input {...campo} className={inputCls} value={cep} onChange={(e) => setCep(e.target.value)} />}
              </Campo>
              <Campo id="matricula-regiao" rotulo="Região / Estado / Província">
                {(campo) => <input {...campo} className={inputCls} value={regiao} onChange={(e) => setRegiao(e.target.value)} />}
              </Campo>
              <Campo id="matricula-cidade" rotulo="Cidade">
                {(campo) => <input {...campo} className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} />}
              </Campo>
              <Campo id="matricula-bairro" rotulo="Bairro / Distrito">
                {(campo) => <input {...campo} className={inputCls} value={bairro} onChange={(e) => setBairro(e.target.value)} />}
              </Campo>
              <Campo id="matricula-rua" rotulo="Rua">
                {(campo) => <input {...campo} className={inputCls} value={rua} onChange={(e) => setRua(e.target.value)} />}
              </Campo>
              <Campo id="matricula-numero" rotulo="Número">
                {(campo) => <input {...campo} className={inputCls} value={numero} onChange={(e) => setNumero(e.target.value)} />}
              </Campo>
              <Campo id="matricula-complemento" rotulo="Complemento">
                {(campo) => <input {...campo} className={inputCls} value={complemento} onChange={(e) => setComplemento(e.target.value)} />}
              </Campo>
            </div>
          </section>

          {/* Acadêmico */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Acadêmico</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <Campo id="matricula-escolaridade" rotulo="Escolaridade">
                {(campo) => (
                  <select {...campo} className={inputCls} value={escolaridade} onChange={(e) => setEscolaridade(e.target.value as Escolaridade | "")}>
                    <option value="">—</option>
                    {Object.values(Escolaridade).map((e) => (
                      <option key={e} value={e}>{ESCOLARIDADE_LABEL[e]}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo id="matricula-idioma-nativo" rotulo="Idioma nativo">
                {(campo) => <input {...campo} className={inputCls} value={idiomaNativo} onChange={(e) => setIdiomaNativo(e.target.value)} placeholder="Ex.: Espanhol" />}
              </Campo>
            </div>
          </section>

          {/* Operacional */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Operacional</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <Campo id="matricula-fuso" rotulo="Fuso horário">
                {(campo) => <input {...campo} className={inputCls} value={fuso} onChange={(e) => setFuso(e.target.value)} placeholder="Ex.: America/Costa_Rica" />}
              </Campo>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <h3 className="mb-2 text-xs font-medium text-gray-600">Contato de emergência</h3>
              {/* Rótulo visível em cada campo: o placeholder era o único nome e sumia ao digitar. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
                <Campo id="matricula-emergencia-nome" rotulo="Nome do contato">
                  {(campo) => <input {...campo} className={inputCls} value={emergenciaNome} onChange={(e) => setEmergNome(e.target.value)} />}
                </Campo>
                <Campo id="matricula-emergencia-parentesco" rotulo="Parentesco">
                  {(campo) => <input {...campo} className={inputCls} value={emergenciaParentesco} onChange={(e) => setEmergParentesco(e.target.value)} />}
                </Campo>
                <Campo id="matricula-emergencia-telefone" rotulo="Telefone">
                  {(campo) => <input {...campo} className={inputCls} value={emergenciaTelefone} onChange={(e) => setEmergTel(e.target.value)} placeholder="+506..." />}
                </Campo>
              </div>
            </div>
            <Campo id="matricula-observacoes" rotulo="Observações" className="mt-4 border-t border-gray-100 pt-4">
              {(campo) => <CampoTexto {...campo} className={inputCls} rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />}
            </Campo>
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
                <Campo id={IDS_PASSO1.respNome} rotulo={pagador === "EMPRESA" ? "Nome da empresa" : "Nome do responsável"} obrigatorio erro={errosPasso1.respNome}>
                  {(campo) => <input {...campo} className={inputCls} value={respNome} onChange={(e) => setRespNome(e.target.value)} />}
                </Campo>
                {pagador === "RESPONSAVEL" && (
                  <Campo id="matricula-responsavel-parentesco" rotulo="Parentesco">
                    {(campo) => <input {...campo} className={inputCls} value={respParentesco} onChange={(e) => setRespParentesco(e.target.value)} />}
                  </Campo>
                )}
                <Campo id="matricula-responsavel-telefone" rotulo="Telefone">
                  {(campo) => <input {...campo} className={inputCls} value={respTelefone} onChange={(e) => setRespTelefone(e.target.value)} placeholder="+506..." />}
                </Campo>
                <Campo id="matricula-responsavel-email" rotulo="E-mail">
                  {(campo) => <input {...campo} type="email" className={inputCls} value={respEmail} onChange={(e) => setRespEmail(e.target.value)} />}
                </Campo>
              </div>
            )}
          </section>

          {/* Erro do servidor junto do botão que avança; os de validação ficam em cada campo (foco no primeiro). */}
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
              className={`${botaoClasses({ variante: "fantasma", tamanho: "sm" })} ml-2`}
            >
              editar
            </button>
          </div>

          {/* Curso & alocação */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-medium">Curso & alocação</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
              <Campo id="matricula-produto" rotulo="Produto">
                {(campo) => (
                  <select
                    {...campo}
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
                )}
              </Campo>
              <div>
                <Campo id="matricula-turma" rotulo="Turma (aberta com vaga)">
                  {(campo) => (
                    <select {...campo} className={inputCls} value={turmaId} onChange={(e) => setTurma(e.target.value)}>
                      <option value="">Sem alocação / lista de espera</option>
                      {turmas.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  )}
                </Campo>
                {!turmaId && (
                  <button type="button" onClick={pedirAbertura} disabled={abertura.ocupado} className={`${botaoClasses({ variante: "fantasma", tamanho: "sm" })} mt-1`}>
                    Sem turma compatível? Solicitar abertura ao Gerente Pedagógico
                  </button>
                )}
                <FeedbackAcao erro={abertura.erro} sucesso={abertura.sucesso} className="mt-1" />
              </div>
              <Campo id="matricula-nivel-inicial" rotulo="Nível inicial">
                {(campo) => (
                  <select {...campo} className={inputCls} value={nivelInicialId} onChange={(e) => setNivel(e.target.value)}>
                    <option value="">—</option>
                    {niveis.map((n) => (
                      <option key={n.id} value={n.id}>{n.label}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo id="matricula-origem-nivel" rotulo="Origem do nível">
                {(campo) => (
                  <select {...campo} className={inputCls} value={origemNivel} onChange={(e) => setOrigem(e.target.value as OrigemNivel)}>
                    <option value={OrigemNivel.MANUAL}>Manual</option>
                    <option value={OrigemNivel.AVALIACAO}>Avaliação</option>
                  </select>
                )}
              </Campo>
              {origemNivel === OrigemNivel.AVALIACAO && (
                <Campo id="matricula-data-avaliacao" rotulo="Data da avaliação">
                  {(campo) => <input {...campo} type="date" className={inputCls} value={dataAvaliacaoNivel} onChange={(e) => setDataAval(e.target.value)} />}
                </Campo>
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
              <Campo id={IDS_PASSO2.taxa} rotulo="Taxa de matrícula" obrigatorio dica={<PrecoTag refValor={refTaxa?.valor} moeda={moeda} manual={taxaManual} />} erro={errosPasso2.taxa}>
                {(campo) => <CampoMoeda {...campo} value={taxaValor} onChange={setTaxa} moeda={moeda} className={inputCls} />}
              </Campo>
              <Campo id={IDS_PASSO2.mensalidade} rotulo="Mensalidade" obrigatorio dica={<PrecoTag refValor={refMens?.valor} moeda={moeda} manual={mensManual} />} erro={errosPasso2.mensalidade}>
                {(campo) => <CampoMoeda {...campo} value={mensalidadeValor} onChange={setMens} moeda={moeda} className={inputCls} />}
              </Campo>
              <Campo id="matricula-dia-vencimento" rotulo="Dia de vencimento">
                {(campo) => (
                  <select {...campo} className={inputCls} value={diaVencimento} onChange={(e) => setDia(Number(e.target.value))}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>Dia {d}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo id="matricula-meses-plano" rotulo="Meses do plano">
                {(campo) => <input {...campo} type="number" className={inputCls} value={mesesPlano} onChange={(e) => setMeses(Number(e.target.value))} />}
              </Campo>
              <Campo
                id={IDS_PASSO2.referenciaCobertura}
                rotulo="Cobertura prevista no contrato"
                obrigatorio
                dica="Se o mês não tiver esse dia, vence no último dia do mês. A referência é mantida nos meses seguintes."
                erro={errosPasso2.referenciaCobertura}
              >
                {(campo) => (
                  <select {...campo} className={inputCls} value={referenciaCobertura} onChange={(e) => setReferenciaCobertura(e.target.value as typeof referenciaCobertura)}>
                    <option value="">Selecione a regra contratada</option>
                    <option value="MES_CIVIL">Mês civil</option>
                    <option value="CICLO_MATRICULA">Ciclo mensal da matrícula</option>
                  </select>
                )}
              </Campo>
              <Campo
                id={IDS_PASSO2.primeiroVencimento}
                rotulo="Vencimento da primeira mensalidade"
                obrigatorio
                dica="Informe a data acordada. As seguintes usam o dia de referência nos próximos meses; a cobertura permanece independente."
                erro={errosPasso2.primeiroVencimento}
              >
                {(campo) => <input {...campo} type="date" className={inputCls} value={primeiroVencimento} onChange={(e) => setPrimeiroVencimento(e.target.value)} />}
              </Campo>
              <Campo
                id={IDS_PASSO2.inicioCobertura}
                rotulo="Início do primeiro período coberto"
                obrigatorio
                dica={`${referenciaCobertura === "MES_CIVIL" ? "Informe o primeiro dia do mês contratado." : "Esta data define a referência dos ciclos mensais."} A cobertura é independente do vencimento; a mensalidade permanece integral.`}
                erro={errosPasso2.inicioCobertura}
              >
                {(campo) => <input {...campo} type="date" className={inputCls} value={inicioCobertura} onChange={(e) => setInicioCobertura(e.target.value)} />}
              </Campo>
              <div>
                <p className="mb-1 block text-xs text-gray-600">Comissão da matrícula</p>
                <p className="text-sm text-gray-600">Calculada pela política vigente da oferta: percentual da taxa ou valor fixo. A administração configura as versões no Financeiro.</p>
              </div>
              <Campo id={IDS_PASSO2.certificado} rotulo="Certificado (só Costa Rica)" erro={errosPasso2.certificado}>
                {(campo) => <CampoMoeda {...campo} value={certificadoValor} onChange={setCert} moeda={moeda} className={inputCls} placeholder="0" />}
              </Campo>
            </div>
            {semTabela && (
              <Campo id="matricula-justificativa-sem-preco" rotulo="Justificativa da exceção (sem tabela de preço)" obrigatorio className="mt-4 border-t border-gray-100 pt-4">
                {(campo) => (
                  <CampoTexto
                    {...campo}
                    className={inputCls}
                    rows={2}
                    value={justificativaSemPreco}
                    onChange={(e) => setJustSemPreco(e.target.value)}
                    placeholder="Ex.: país/produto ainda sem matriz de preços; valor aprovado pelo gerente."
                  />
                )}
              </Campo>
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

/** Select de país ISO 3166 (nacionalidade, residência, país emissor). Recebe as ligações do <Campo>. */
function SelectISO({
  id,
  value,
  onChange,
  comVazio,
  ...ligacao
}: Omit<LigacaoCampo, "id"> & {
  id: string;
  value: string;
  onChange: (v: string) => void;
  comVazio?: boolean;
}) {
  return (
    <select id={id} {...ligacao} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {comVazio && <option value="">—</option>}
      {PAISES_ISO.map((p) => (
        <option key={p.codigo} value={p.codigo}>{p.nome}</option>
      ))}
    </select>
  );
}

/** Etiqueta da linha de cobrança: diferencia preço sugerido × manual × sem tabela (issue #22). Vai como
 *  dica do <Campo> (texto em linha, ligado ao campo por aria-describedby). */
function PrecoTag({ refValor, moeda, manual }: { refValor?: number; moeda: string; manual: boolean }) {
  if (refValor === undefined) {
    return <span className="text-amber-700">Sem tabela — valor manual</span>;
  }
  if (manual) {
    return <span className="text-amber-700">Manual (sugerido: {formatarMoeda(refValor, moeda)})</span>;
  }
  return <>Sugerido: {formatarMoeda(refValor, moeda)}</>;
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
