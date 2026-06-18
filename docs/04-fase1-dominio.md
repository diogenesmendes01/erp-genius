# Fase 1 — Domínio: Alunos, Matrículas e Preços

> Resultado do brainstorm. Reflete a realidade real da Genius (operação multi-país
> na América Latina), não um modelo escolar genérico. É a base do módulo.

## Princípio central: o país é a espinha dorsal

A Genius opera em vários países. Quase tudo no cadastro **deriva do país do aluno**,
em vez de ser campo livre. A partir do país, o sistema sabe:

- Quais **tipos de documento** aceitar e validar (CPF, DNI, CURP, passaporte…).
- O **formato e DDI do telefone** (guardado em padrão internacional E.164 — necessário também pro WhatsApp).
- A **moeda local** (que pode ser o próprio dólar em países dolarizados).
- O **fuso horário** (pra disparar mensagens na hora certa) e o **idioma**.

Isso resolve a dor original: hoje documento, telefone e moeda divergem de aluno
para aluno. Parte dessa divergência é **legítima** (países diferentes) e deve ser
preservada de forma estruturada; outra parte é **bagunça de digitação** e é
eliminada ao tornar o cadastro guiado pelo país.

## Regras e validação por país

Validação multi-país não é uma coisa só — são **três camadas** com naturezas diferentes:

### 1. Configuração do país (dado — o admin edita)
Coisas estruturais e simples de descrever, que mudam por mercado: tipos de documento
aceitos, campos obrigatórios, moeda, DDI, idioma. **Não é hardcoded** — senão cada país
novo viraria pedido pro programador. É exatamente o **checklist de prontidão** para
ativar um mercado.

### 2. Validadores nomeados (código — reutilizável)
Alguns documentos **não são um formato, são um algoritmo** (dígito verificador): CPF
(módulo 11), CURP (México), cédula (Costa Rica), DNI (Argentina), RUT… Isso não cabe num
campo de texto. Cada tipo de documento aponta para um **validador nomeado**
(`cpf`, `curp`, `cedula_cr`, `dni_ar`, `email`, `telefone_e164`). Os comuns já vêm prontos;
documento novo/exótico = o dev adiciona **um** validador e ele fica disponível pra sempre.

> Resumo: a config do país é **dado** (admin mexe); o "como validar" cada documento é **código**.

### 3. Política de rigor — o que bloqueia e o que só avisa (CONFIRMADO)
- **Telefone e e-mail: bloqueia.** Telefone tem que estar em formato internacional válido
  (E.164), senão o **WhatsApp não envia** — rigor é a favor da automação.
- **Documento: avisa, mas deixa salvar**, marcado como **"não validado"**. Razões:
  (a) existem exceções legítimas (passaporte, doc de outro país); (b) a **base atual será
  importada** e está divergente — validação que bloqueia impediria migrar os próprios alunos.
- Princípio: a meta nunca foi **rejeitar** a divergência, foi **estruturar** ela.

## Moeda

- A moeda da cobrança é uma **decisão da matrícula**, não do aluno: **moeda local do país OU dólar**.
- O país sugere a moeda local como padrão; o dólar é sempre a alternativa.
- Em países dolarizados (Panamá, El Salvador, Equador), "local" já é o dólar — não há escolha.
- A moeda acompanha a **matrícula/contrato**, então o histórico por ano fica fiel
  (um ano em colón, outro em dólar, se for o caso).

## Preço: fixo por estudo de mercado

- O preço é **fixo e não flutua com o câmbio**. É definido por **estudo de mercado, por país**.
- Exemplos reais (mensalidade):
  - Costa Rica: **₡25.000** (colones)
  - Panamá: **US$50**
  - El Salvador: **US$30**
- Os números provam que é mercado, não conversão: ₡25.000 ≈ US$48, mas El Salvador
  é US$30 — mesma região do dólar, preço bem diferente.
- Existe uma **tabela de preços de referência**, versionada (cada novo estudo gera
  uma nova versão), que serve de ponto de partida — não de valor final.

## Catálogo de produtos

- A Genius tem **vários produtos/planos** com valores diferentes.
- **A disponibilidade do produto varia por país** — não é só o preço.
  - Ex.: o **certificado profissional existe SÓ na Costa Rica**.
- Cada produto define, por país: se é oferecido, em qual moeda e qual valor de referência.

## Ciclo de vida do país (entrar/sair de um mercado)

Ligar/desligar um país é como a Genius **entra ou sai de um mercado** — não é um
liga/desliga seco, é um ciclo de vida:

| Estado | Aceita aluno novo? | Contratos existentes | Uso |
|---|---|---|---|
| **Rascunho** | Não | — | Mercado em configuração |
| **Ativo** | Sim | Normais | Operando |
| **Pausado** | **Não** | **Seguem normais** (cobrança, acadêmico) | Fechou a entrada, mantém a casa |
| **Encerrado** | Não | (a definir) | Saída definitiva do mercado |

**Regra confirmada:** ao pausar um país, **não entra aluno novo**, mas os alunos
já matriculados continuam normalmente. "Desabilitar" é sempre **soft-disable** —
nunca apaga dados nem quebra contratos ativos.

### Dois níveis de liga/desliga (não confundir)

- **Nível país** (chave grossa): liga/desliga o mercado inteiro.
- **Nível produto-no-país** (chave fina): o país está ativo, mas um produto
  específico pode estar ligado ou desligado ali (é assim que o certificado fica
  só na Costa Rica, ou "Panamá ativo, mas plano premium ainda não").

### Checklist de prontidão (pra poder ativar)

Um país só pode ir para **Ativo** quando tiver o mínimo configurado: moeda
definida, tipos de documento e pelo menos **um produto com preço**. Isso evita
"país ativo pela metade".

## Tipos de cobrança (linhas do contrato)

| Cobrança | Quando | Observações |
|---|---|---|
| **Taxa de matrícula** | Uma vez, no ato | Valor de referência por país; **negociável** |
| **Mensalidade** | Recorrente | **Negociável** (ver abaixo) |
| **Certificado profissional** | Opcional, se o aluno quiser | Valor **fixo, não negociável**; em colones; **só Costa Rica** |

## Matrícula = contrato composto

Uma matrícula não é "uma mensalidade". É um **contrato** que reúne várias linhas
de cobrança (taxa de matrícula + mensalidade + certificado opcional), cada uma na
moeda do país. O Financeiro apenas **soma as linhas** daquele contrato.

## Negociação de preço + histórico

- O valor de referência é o ponto de partida; o **valor real é negociado por aluno**.
- O valor negociado é **fotografado na matrícula** no ato — reajustar a tabela no
  futuro **não** altera contratos já fechados ("sempre mantém o preço negociado").
- Pode ser alterado numa **nova negociação**, mas **nunca sobrescrevendo**: cada
  mudança vira um registro no **histórico de negociações** (data, valor antigo,
  valor novo, motivo, quem fez). Garante auditoria e rastreabilidade.
- **Linhas negociáveis: mensalidade e taxa de matrícula.** O **certificado profissional
  não é negociável** (valor firme).
- **A negociação nasce no comercial:** o vendedor negocia matrícula + mensalidade no
  atendimento (WhatsApp) e esses valores **fluem para a matrícula** — não são digitados
  na secretaria. Conecta a Fase 1 ↔ Fase 4 (vendas).
- **Quem altera a tabela de referência / estudos de mercado: somente o administrador.**
- Oportunidade (a decidir): estruturar a negociação como **referência − desconto/motivo**
  em vez de número solto, pra medir "quanto de desconto a Genius deu" e dar limites ao vendedor.

## Câmbio: só no relatório, nunca na cobrança

- A cobrança **nunca** precisa saber a cotação do dólar — cada moeda é independente.
- O câmbio aparece **apenas** na consolidação gerencial ("quanto faturamos na
  América Latina toda?"), convertendo tudo para uma moeda-base (dólar) só para leitura.

## Modelo de dados (entidades principais)

```
Pais            (id, nome, codigoISO, moedaLocal, ddi, fuso, idioma, status)  # rascunho/ativo/pausado/encerrado
TipoDocumento   (id, paisId, nome, regraValidacao)        # CPF, DNI, CURP, passaporte...
Aluno           (id, nome, nascimento, paisId, ... )
DocumentoAluno  (id, alunoId, tipoDocumentoId, valor)
Responsavel     (id, nome, parentesco, telefoneE164, email)
AlunoResponsavel(alunoId, responsavelId, papel)            # pedagógico / financeiro

Produto         (id, nome, tipo)                           # curso, plano, certificado...
ProdutoPais     (id, produtoId, paisId, moeda, oferecido)  # disponibilidade por país
PrecoReferencia (id, produtoPaisId, tipoCobranca, valor, versaoEstudo, vigenteDesde)

Matricula       (id, alunoId, produtoId, paisId, moeda, status, dataInicio)
LinhaCobranca   (id, matriculaId, tipoCobranca, valorNegociado, recorrencia)
NegociacaoLog   (id, linhaCobrancaId, valorAntigo, valorNovo, motivo, usuarioId, data)

Usuario         (id, nome, email, senhaHash)               # papéis em UsuarioPapel — ver doc 07
```

## Decisões resolvidas (brainstorm)

- ✅ Negociável: **mensalidade + taxa de matrícula**; certificado **não** é negociável.
- ✅ **Certificado profissional:** valor **fixo e não negociável**, em colones, só Costa Rica.
- ✅ **Taxa de matrícula:** tem um **valor de referência fixo** (por país) e **é negociável**.
- ✅ Negociação **nasce no comercial** (vendedor) e flui pra matrícula.
- ✅ Tabela de referência / estudos de mercado: **só o administrador** altera.
- ✅ Validação de documento: **avisa, não bloqueia** (salva marcado como "não validado");
  telefone/e-mail bloqueiam.

## Em aberto (a confirmar)

- Com que frequência os estudos de mercado atualizam a tabela? (cadência)
- Taxa de matrícula: o valor de referência é único por país (assumido) ou pode mudar por produto? (a revisitar se necessário)
