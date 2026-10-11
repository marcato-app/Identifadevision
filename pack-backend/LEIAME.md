# Pack Vitrine Pronta — como ligar o cadastro, o Mercado Pago e a entrega

O site faz o cadastro e mostra as páginas. Quem cobra, confere o pagamento e
manda o link do Canva é um script do Google (Apps Script) ligado a uma planilha
sua. Não precisa instalar nada: tudo é feito pelo navegador, de preferência no
computador.

```
Cliente preenche o cadastro ─► Script salva na planilha e cria a cobrança
        │                                         │
        ▼                                         ▼
  Paga no Mercado Pago ──► Mercado Pago avisa o script ──► script confere,
        │                                                  marca "Pago" e
        ▼                                                  envia o e-mail
  Volta para /pack/obrigado/ ──► página pergunta ao script ──► mostra o botão do Canva
```

O link do Canva **não fica no site**. Ele só aparece depois que o próprio
Mercado Pago confirma um pagamento aprovado deste produto.

---

## Antes de começar, tenha em mãos

1. **Conta no Mercado Pago** (de preferência conta de vendedor/empresa).
2. **Link de modelo do Canva**: no Canva, abra o design do pack →
   **Compartilhar → Mais → "Link de modelo"** → copiar. Não use o link de edição:
   com ele, os clientes mexeriam no seu arquivo original.
3. **Endereço do site** onde a página do pack vai ficar, com `https://`,
   por exemplo `https://www.seusite.com.br/pack/`.

---

## Passo 1 — Criar a planilha e colar o script

1. Abra o [Google Sheets](https://sheets.google.com) e crie uma planilha em
   branco. Dê o nome **Pack — Cadastros**.
2. No menu, clique em **Extensões → Apps Script**.
3. Apague o que estiver escrito e cole **todo** o conteúdo do arquivo
   `pack-backend/Codigo.gs`.
4. Clique no disquete (**Salvar**).

## Passo 2 — Pegar a chave do Mercado Pago

1. Entre em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers/panel/app)
   com a sua conta.
2. **Criar aplicação** → escolha **Pagamentos on-line** → **Checkout Pro**.
3. Na aplicação criada, abra **Credenciais de produção** (pode pedir para ativar).
4. Copie o **Access Token** (começa com `APP_USR-`). **Não mostre essa chave
   para ninguém**: ela dá acesso à sua conta.

> Quer testar sem dinheiro de verdade? Use primeiro as **Credenciais de teste**
> e um usuário de teste. Depois troque pela de produção.

## Passo 3 — Colocar as configurações no script

No Apps Script, clique na engrenagem (**Configurações do projeto**) e desça até
**Propriedades do script → Adicionar propriedade do script**. Adicione:

| Propriedade        | O que colocar                                     | Exemplo |
|--------------------|---------------------------------------------------|---------|
| `MP_ACCESS_TOKEN`  | o Access Token do passo 2                         | `APP_USR-123...` |
| `PRECO`            | o preço cobrado, com **ponto**                    | `37.00` |
| `CANVA_LINK`       | o link de modelo do Canva                         | `https://www.canva.com/design/.../view?utm_content=...&mode=preview` |
| `SITE_URL`         | endereço da página do pack                        | `https://www.seusite.com.br/pack/` |
| `NOME_REMETENTE`   | (opcional) nome que aparece no e-mail             | `Identidade Vision` |
| `EMAIL_RESPOSTA`   | (opcional) e-mail que recebe as respostas         | `contato@seusite.com.br` |
| `DESCRICAO_FATURA` | (opcional) texto na fatura do cartão, até 13 letras | `IDVISION` |

Clique em **Salvar propriedades do script**.

## Passo 4 — Publicar o script

1. Clique em **Implantar → Nova implantação**.
2. Na engrenagem ao lado de "Selecione o tipo", escolha **App da Web**.
3. Preencha:
   - **Executar como:** Eu
   - **Quem pode acessar:** Qualquer pessoa
4. **Implantar** → **Autorizar acesso** → escolha sua conta Google →
   "O Google não verificou este app" → **Avançado** → **Acessar (não seguro)** →
   **Permitir**. (É o seu próprio script; o aviso aparece para qualquer script pessoal.)
5. Copie a **URL do app da Web** (termina em `/exec`).

Volte às **Propriedades do script** e adicione mais uma:

| Propriedade | O que colocar |
|-------------|---------------|
| `API_URL`   | a URL `/exec` que você acabou de copiar |

## Passo 5 — Conferir

1. No Apps Script, no topo, escolha a função **testarConfiguracao** e clique em
   **Executar**.
2. No registro de execução deve aparecer **"Tudo certo. Conta Mercado Pago: ..."**.
   Se aparecer um erro, ele diz o que falta corrigir.
3. A planilha ganha uma aba **Cadastros** com as colunas.

## Passo 6 — Ligar o site

Abra o arquivo `pack/config.js` e preencha:

```js
api: 'https://script.google.com/macros/s/....../exec',   // a URL do passo 4
preco: '37,00',                                          // igual ao PRECO do script
vendedor: 'Seu nome ou razão social',
documento: 'CPF ou CNPJ',
email: 'contato@seusite.com.br',
```

Esses dados também aparecem nos Termos de Uso e na Política de Privacidade.

## Passo 7 — Fazer uma compra de teste

1. Troque temporariamente `PRECO` para `1.00` no script e `preco` para `1,00`
   no `config.js`.
2. Faça o cadastro no site e pague com Pix.
3. Confira: a página de confirmação mostra o botão do Canva, o e-mail chega e a
   linha na planilha fica como **Pago**.
4. Devolva o preço real nos dois lugares e, se quiser, reembolse o teste pelo
   Mercado Pago.

---

## No dia a dia

- **Planilha:** cada cadastro vira uma linha. O status muda sozinho:
  Aguardando pagamento → Pendente → Pago (ou Recusado, Reembolsado, Contestado).
- **Cliente diz que não recebeu o e-mail:** peça para olhar o spam. Se precisar,
  selecione a linha dele na planilha, abra o Apps Script, escolha a função
  **reenviarLinkDaLinhaSelecionada** e clique em **Executar**.
- **Reembolso:** faça pelo painel do Mercado Pago. A linha muda para
  "Reembolsado" sozinha.
- **Limite de e-mails:** uma conta Gmail comum envia até 100 e-mails por dia
  pelo script (Google Workspace: 1.500). Se vender mais que isso por dia,
  use uma conta Workspace.
- **Mudou o código do script?** Use **Implantar → Gerenciar implantações →
  editar (lápis) → Versão: Nova versão → Implantar**. Assim a URL continua a
  mesma e o site não precisa mudar.
- **Mudou o preço?** Altere `PRECO` no script **e** `preco` no `config.js`.
