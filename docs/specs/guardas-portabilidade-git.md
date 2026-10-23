# Portabilidade dos caminhos Git e fontes das guardas

## Contrato — revisão PR380 C3

O índice Git é a autoridade dos caminhos rastreados. A guarda usa git ls-files -z e recusa dois caminhos completos iguais sem distinguir maiúsculas/minúsculas, inclusive nas pastas. Não se limita à árvore materializada: no Windows um dos arquivos pode nem existir separadamente no disco. Nomes diferentes continuam válidos; não há lista de exceções.

O teste adversarial cria um repositório temporário e insere Caixa.tsx/caixa.tsx no índice sem materializar esses arquivos. O cleanup confere o diretório absoluto dentro da base temporária antes de remover apenas essa fixture. O índice do projeto nunca é alterado pelo teste.

.gitattributes exige LF para src/**/*.ts, src/**/*.tsx e .github/workflows/ci.yml, lidos por guardas AST/textuais. Conserva a regra específica da CLI e as regras anteriores de deploy/migrations. Não há renormalização em massa nem alteração do workflow; sua normalização defensiva de CRLF continua intacta.

## Verificação DEV B

Implementação inicial sensível à caixa e atributos antigos: RED887408, três falhas causais/um passe (dois nomes no índice, diretórios e atributos LF). Ajuste mínimo: chave toLowerCase e regras exatas de atributos. GREEN00f568: um arquivo/quatro testes, saída0. O fixture real exerce Git mesmo no Windows.

Recorte composto91114:11arquivos/367testes, TypeScript79557 e lint dirigido e3e9e8 (seis fontes), todos terminais0. Não é suíte global, CI ou homologação do restante da fila. Cliente487 foi gerado pelo integrador; guarda não usa banco/Prisma. Sem deps/lock/schema/SQL/PNG alterados.
