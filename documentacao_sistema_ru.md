# Documentação de Arquitetura e SSI — Sistema RU UNIFESP

Este documento detalha o funcionamento técnico do Sistema de Restaurante Universitário (RU) descentralizado da UNIFESP. Ele descreve a arquitetura do sistema, a aplicação prática dos conceitos de **Identidade Auto-Soberana (SSI)** e as decisões tecnológicas tomadas para a sua construção.

---

## 1. O Triângulo de Confiança da Identidade Auto-Soberana (SSI)

A Identidade Auto-Soberana (SSI) devolve ao indivíduo o controle sobre seus próprios dados e identidade digital. O sistema está estruturado em torno do clássico **Triângulo da Confiança (Trust Triangle)** da SSI, composto por três papéis fundamentais:

```
┌──────────────────┐     Emite VC      ┌──────────────────┐
│  Portal UNIFESP  │ ────────────────► │  Carteira Aluno  │
│    (Issuer)      │                   │    (Holder)      │
│   porta 3000     │                   │   porta 3001     │
└──────────────────┘                   └────────┬─────────┘
        │                                       │
        │ Adiciona créditos                     │ Apresenta QR Code
        ▼                                       ▼
┌──────────────────┐     Verifica VP    ┌──────────────────┐
│   Blockchain     │ ◄──────────────── │  Terminal RU     │
│   (Hardhat)      │   Debita crédito  │   (Verifier)     │
│   porta 8545     │                   │   porta 3002     │
└──────────────────┘                   └──────────────────┘
```

### Papéis no Sistema:
1. **Emissor (Issuer) — Portal UNIFESP**: Autoridade confiável encarregada de validar os dados acadêmicos do aluno no cadastro e emitir uma **Credencial Verificável (VC)** assinada criptograficamente. O Emissor possui seu próprio DID (`did:ethr:sepolia:0x03aa...`).
2. **Portador (Holder) — Carteira do Aluno**: O estudante, que gera seu par de chaves criptográficas e DID localmente na carteira digital e armazena de forma segura a sua credencial universitária. Ele gera **Apresentações Verificáveis (VPs)** temporárias via QR Code para provar quem é sem expor sua chave privada.
3. **Verificador (Verifier) — Terminal RU**: O leitor físico no guichê do RU que lê o QR Code, resolve as chaves criptográficas dos DIDs envolvidos, valida se a credencial foi emitida pela UNIFESP, verifica se ela não foi revogada on-chain e debita os créditos da refeição.

---

## 2. Conceitos de SSI Aplicados

O projeto foi projetado seguindo estritamente as especificações do **W3C** para identidades digitais descentralizadas:

### A. DIDs (Decentralized Identifiers)
* **O que é**: Identificadores únicos globais que dispensam uma autoridade de registro centralizada.
* **Aplicação no Projeto**: Usamos o método `did:ethr` na rede Sepolia/Local. O DID do aluno se assemelha a `did:ethr:sepolia:0x03bB...`. Ele é composto por uma chave pública gerada na carteira do aluno e é usado como o identificador definitivo do estudante nas credenciais e nos contratos inteligentes.

### B. VCs (Verifiable Credentials)
* **O que é**: Uma afirmação digital à prova de adulteração contendo dados estruturados e assinada pelo Emissor.
* **Aplicação no Projeto**: Quando a UNIFESP cadastra o aluno, ela emite uma VC com formato JWT (JSON Web Token), assinada usando o algoritmo `ES256K` da UNIFESP. O payload contém:
  * **Issuer**: O DID da UNIFESP.
  * **CredentialSubject**: O DID do Aluno, Nome completo, RA, Curso e Status.

### C. VPs (Verifiable Presentations)
* **O que é**: Um envelope seguro contendo uma ou mais VCs, assinado pelo próprio Holder usando sua chave privada para comprovar a posse das credenciais (Proof of Possession).
* **Aplicação no Projeto**: Quando o aluno vai passar na catraca do RU, ele digita sua senha e a carteira gera uma VP contendo sua VC universitária. A VP é assinada com a chave privada do aluno e disponibilizada através de um QR Code dinâmico que expira em 2 minutos e é de uso único, prevenindo ataques de replay.

### D. Custódia Descentralizada de Chaves (True Custody)
* **O que é**: O princípio de que apenas o usuário detém o controle sobre suas chaves privadas ("not your keys, not your identity").
* **Aplicação no Projeto**: O Portal UNIFESP não gera chaves para o aluno. O aluno cria suas chaves e seu DID de forma local em sua própria carteira (`holder-agent`) e fornece apenas o DID público para a UNIFESP no momento do cadastro. Isso garante que a UNIFESP nunca consiga gerar uma apresentação ou assinar transações em nome do estudante.

### E. Revogação On-Chain (On-Chain Revocation)
* **O que é**: O mecanismo de invalidar uma credencial de maneira imediata sem depender de servidores centralizados do emissor para consultas constantes.
* **Aplicação no Projeto**: Quando uma credencial precisa ser revogada (por exemplo, se o aluno trancou o curso ou perdeu o celular), a UNIFESP faz o hash do JWT da credencial e envia uma transação para o contrato inteligente `RevocationRegistry.sol`, marcando o hash como revogado (`revoked[hash] = true`). O Terminal do RU consulta este contrato on-chain em tempo real durante a validação do QR Code.

---

## 3. Tecnologias Utilizadas e Justificativa

A seleção tecnológica foi estruturada combinando criptografia de chave pública W3C e imutabilidade de contratos inteligentes:

| Tecnologia | Função no Sistema | Por Que Foi Usada? (Justificativa) |
| :--- | :--- | :--- |
| **Veramo Framework** | Agente de Identidade Descentralizada (KMS, DID Manager, Credential Plugin) | O Veramo é um dos frameworks de SSI mais modulares do ecossistema JavaScript/TypeScript. Ele abstrai toda a complexidade criptográfica necessária para gerar chaves (secp256k1), criar DIDs de diversos métodos (como `did:ethr`), e assinar/verificar VCs e VPs em conformidade com o padrão W3C. |
| **Hardhat** | Blockchain local de desenvolvimento | Fornece um ambiente de teste robusto, seguro e idêntico a uma rede principal Ethereum virtualizada. Permite deploys instantâneos, manipulação do estado da blockchain para testes e simulação realista das contas pré-financiadas (contas signers). |
| **Solidity (Smart Contracts)** | Lógica de negócios de saldos e revogação | Permite descentralizar regras de negócios críticas: <br>• O contrato `CreditoRU` gerencia os saldos de forma pública, auditável e imutável.<br>• O contrato `RevocationRegistry` oferece um repositório distribuído de revogação de alta disponibilidade e resistente a censura. |
| **ethers.js (v6)** | Ponte entre os Servidores Node.js e a Blockchain | É a biblioteca padrão do ecossistema Ethereum para conectar aplicações web a nós Web3. Foi usada para codificar/decodificar chamadas de contratos inteligentes e assinar transações de revogação e consumo de créditos no RU de forma simplificada. |
| **better-sqlite3** | Banco de dados para persistência local | Banco de dados relacional embarcado extremamente veloz e que roda em arquivo único. Perfeito para evitar a complexidade de configurar bancos de dados externos (como Postgres) em um ambiente de demonstração acadêmica, sem abrir mão de consultas SQL robustas. |
| **Express & TypeScript** | Servidores Web de cada agente e tipagem do código | O Express oferece uma infraestrutura de roteamento leve e simples para as interfaces web e APIs. O TypeScript garante segurança em tempo de compilação, permitindo tipar interfaces criptográficas do Veramo e contratos do ethers.js. |
| **ngrok** | Túnel HTTP seguro | Permite que o Terminal RU local receba conexões HTTPS externas. Isso torna possível testar o sistema na prática usando a câmera de um celular físico fora do computador de desenvolvimento para ler o QR Code e liberar a catraca. |

---

## 4. Fluxo Detalhado de Operação do RU

Abaixo está o passo a passo de como a informação flui através dos componentes do sistema durante uma operação típica:

### Fluxo 1: Geração de DID e Cadastro
```
1. Aluno -> Acessa Carteira (/aluno) -> Clica em Gerar DID
   ├── O agente local cria chaves secp256k1 privadas/públicas no banco de dados da carteira
   └── Retorna o DID público: did:ethr:sepolia:0x[EndereçoAluno]

2. Aluno -> Fornece DID ao Administrador da UNIFESP
3. Administrador -> Preenche cadastro no Portal UNIFESP com o DID do Aluno
   └── O Portal UNIFESP assina uma credencial (VC) JWT:
       - Subject ID: did:ethr:sepolia:0x[EndereçoAluno]
       - Assinada por: did:ethr:sepolia:0x[EndereçoUNIFESP]
   └── Os dados acadêmicos e a VC criptografada são armazenados no banco 'database-alunos.sqlite'
```

### Fluxo 2: Recarga de Créditos do RU
```
1. Administrador -> Acessa página de Créditos do Portal
2. Administrador -> Digita o RA e a quantidade de créditos (ex: 15 créditos)
3. Portal UNIFESP -> Executa transação on-chain chamando o smart contract 'CreditoRU'
   └── A transação executa o método 'adicionarCreditos(ra, 15)' assinado pela chave privada da UNIFESP
   └── A blockchain atualiza o saldo do RA imutavelmente
```

### Fluxo 3: Acesso ao Refeitório (Consumo e Validação)
```
1. Aluno -> Faz login na Carteira com RA e Senha
2. Carteira -> Cria uma Verifiable Presentation (VP)
   ├── Insere a VC emitida pela UNIFESP no payload
   ├── Assina a VP com a chave privada do aluno guardada localmente
   └── Renderiza um QR Code contendo uma URL temporária com a VP assinada
   
3. Terminal RU -> Escaneia o QR Code do celular do aluno
4. Terminal RU -> Resolve o DID do Aluno e o DID da UNIFESP
   ├── Valida se a assinatura da VP é de fato do aluno (Proof of Possession)
   ├── Valida se a VC embutida foi mesmo emitida e assinada pelo DID da UNIFESP
   ├── Faz o hash da credencial (Keccak256 do JWT)
   ├── Consulta o contrato 'RevocationRegistry': se constar como revogado -> ACESSO NEGADO
   └── Consulta o contrato 'CreditoRU': se saldo for zero -> ACESSO NEGADO
   
5. Terminal RU -> Executa transação chamando 'consumirCredito(ra)' no smart contract
   └── O contrato debita 1 crédito do RA e emite o evento de consumo
   └── Terminal RU exibe na tela: "✅ Acesso Liberado!"
```
