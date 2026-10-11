/**
 * Pack Vitrine Pronta — cadastro, cobrança no Mercado Pago e entrega do link do Canva.
 *
 * Este arquivo roda no Google Apps Script, ligado à planilha de cadastros
 * (Extensões > Apps Script). O passo a passo está em pack-backend/LEIAME.md.
 *
 * O que ele faz:
 *  1. recebe o cadastro do site (nome, e-mail, telefone, aceite dos termos)
 *     e salva uma linha na aba "Cadastros";
 *  2. cria a cobrança no Mercado Pago, com o preço definido aqui (não no site);
 *  3. recebe o aviso do Mercado Pago quando o pagamento muda de status,
 *     confere o pagamento direto na API e, se aprovado, envia o link do Canva
 *     por e-mail;
 *  4. responde à página de confirmação do site, que só mostra o link do Canva
 *     para um pagamento aprovado deste produto.
 *
 * Configuração (Configurações do projeto > Propriedades do script):
 *  MP_ACCESS_TOKEN   Access Token de produção do Mercado Pago (APP_USR-...)
 *  PRECO             valor cobrado, com ponto: 37.00
 *  CANVA_LINK        link de modelo do Canva entregue ao cliente
 *  SITE_URL          endereço da página do pack, ex.: https://seusite.com.br/pack/
 *  API_URL           URL deste app da Web (termina em /exec)
 *  NOME_PRODUTO      (opcional) nome que aparece no checkout
 *  NOME_REMETENTE    (opcional) nome do remetente do e-mail
 *  EMAIL_RESPOSTA    (opcional) e-mail para onde vão as respostas do cliente
 *  DESCRICAO_FATURA  (opcional) texto na fatura do cartão, até 13 letras
 */

var ABA = 'Cadastros';
var COLUNAS = ['Data do cadastro', 'Pedido', 'Nome', 'E-mail', 'Telefone', 'Aceitou termos em',
  'Versão dos termos', 'Aceita novidades', 'Status', 'ID do pagamento', 'Forma de pagamento',
  'Valor pago', 'Atualizado em', 'Link enviado em'];
var COL = { PEDIDO: 2, NOME: 3, EMAIL: 4, STATUS: 9, PAG_ID: 10, FORMA: 11, VALOR: 12, ATUALIZADO: 13, ENVIADO: 14 };
var STATUS_TEXTO = {
  approved: 'Pago', pending: 'Pagamento pendente', in_process: 'Em análise', authorized: 'Autorizado',
  rejected: 'Recusado', cancelled: 'Cancelado', refunded: 'Reembolsado', charged_back: 'Contestado'
};
var EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------------- entrada ---------------- */

function doGet() {
  return json_({ ok: true, servico: 'pack-vitrine-pronta' });
}

function doPost(e) {
  var corpo = {};
  try { corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { corpo = {}; }
  try {
    if (corpo.acao === 'cadastrar') return json_(cadastrar_(corpo));
    if (corpo.acao === 'verificar') return json_(verificar_(corpo));
    return json_(notificacao_(e, corpo));
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, erro: 'Erro inesperado. Tente de novo em instantes.' });
  }
}

/* ---------------- cadastro + cobrança ---------------- */

function cadastrar_(d) {
  var nome = String(d.nome || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  var email = String(d.email || '').trim().toLowerCase().slice(0, 120);
  var fone = String(d.telefone || '').replace(/\D/g, '');
  if (nome.length < 5 || nome.split(' ').length < 2) return { ok: false, erro: 'Digite seu nome e sobrenome.' };
  if (!EMAIL_OK.test(email)) return { ok: false, erro: 'Digite um e-mail válido.' };
  if (fone.length !== 10 && fone.length !== 11) return { ok: false, erro: 'Digite o telefone com DDD.' };
  if (d.termos !== true) return { ok: false, erro: 'Para continuar, aceite os Termos de Uso e a Política de Privacidade.' };

  var token = cfg_('MP_ACCESS_TOKEN'), preco = preco_(), site = cfg_('SITE_URL');
  if (!token || !preco || !site) return { ok: false, erro: 'O pagamento ainda não foi configurado. Fale com a gente.' };
  if (site.slice(-1) !== '/') site += '/';

  var pedido = Utilities.getUuid();
  var agora = new Date();
  aba_().appendRow([agora, pedido, nome, email, "'" + fone, agora, String(d.versaoTermos || '').slice(0, 20),
    d.contato === true ? 'Sim' : 'Não', 'Aguardando pagamento', '', '', '', agora, '']);

  var partes = nome.split(' ');
  var pref = mp_('post', '/checkout/preferences', {
    items: [{
      id: 'pack-vitrine-pronta',
      title: cfg_('NOME_PRODUTO', 'Pack Vitrine Pronta'),
      description: 'Artes editáveis no Canva (produto digital)',
      category_id: 'others',
      quantity: 1,
      currency_id: 'BRL',
      unit_price: preco
    }],
    payer: {
      name: partes[0],
      surname: partes.slice(1).join(' '),
      email: email,
      phone: { area_code: fone.slice(0, 2), number: fone.slice(2) }
    },
    external_reference: pedido,
    back_urls: {
      success: site + 'obrigado/',
      pending: site + 'obrigado/',
      failure: site + 'cadastro/?erro=pagamento'
    },
    auto_return: 'approved',
    notification_url: urlApi_(),
    statement_descriptor: cfg_('DESCRICAO_FATURA', 'IDVISION').slice(0, 13),
    metadata: { pedido: pedido }
  }, pedido);

  if (!pref.init_point) throw new Error('Mercado Pago não devolveu o link de pagamento: ' + JSON.stringify(pref));
  return { ok: true, url: pref.init_point };
}

/* ---------------- página de confirmação ---------------- */

function verificar_(d) {
  var id = String(d.pagamento || '').replace(/\D/g, '');
  if (!id) return { ok: false, erro: 'Pagamento não informado.' };
  var r = processar_(id);
  if (!r) return { ok: false, erro: 'Não encontramos esse pagamento. Se você já pagou, o link do pack chega no seu e-mail.' };
  var resp = { ok: true, status: r.status };
  if (r.status === 'approved') {
    if (!r.valido) return { ok: false, erro: 'O valor desse pagamento não confere. Fale com a gente pelo e-mail.' };
    resp.canva = cfg_('CANVA_LINK');
    resp.nome = r.nome.split(' ')[0];
  }
  return resp;
}

/* ---------------- aviso do Mercado Pago (webhook) ---------------- */

function notificacao_(e, corpo) {
  var p = (e && e.parameter) || {};
  var tipo = p.type || p.topic || corpo.type || corpo.topic || '';
  var id = p['data.id'] || p.id || (corpo.data && corpo.data.id) || '';
  if (tipo === 'payment' && id) processar_(String(id));
  return { ok: true };
}

/* ---------------- núcleo: confere o pagamento na API e atualiza a planilha ---------------- */

function processar_(idPagamento) {
  var pag;
  try {
    pag = mp_('get', '/v1/payments/' + encodeURIComponent(idPagamento));
  } catch (err) {
    console.warn('Pagamento ' + idPagamento + ' não encontrado: ' + err);
    return null;
  }
  var pedido = pag.external_reference;
  if (!pedido) return null;

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var aba = aba_();
    var linha = acharLinha_(aba, pedido);
    if (!linha) return null;

    var valido = pag.currency_id === 'BRL' && Number(pag.transaction_amount) >= preco_() - 0.01;
    var nome = String(aba.getRange(linha, COL.NOME).getValue());
    var email = String(aba.getRange(linha, COL.EMAIL).getValue());

    aba.getRange(linha, COL.STATUS, 1, 5).setValues([[
      (STATUS_TEXTO[pag.status] || pag.status) + (pag.status === 'approved' && !valido ? ' (valor não confere)' : ''),
      String(pag.id),
      pag.payment_method_id || pag.payment_type_id || '',
      Number(pag.transaction_amount) || '',
      new Date()
    ]]);

    if (pag.status === 'approved' && valido && !aba.getRange(linha, COL.ENVIADO).getValue()) {
      enviarEmail_(nome, email);
      aba.getRange(linha, COL.ENVIADO).setValue(new Date());
    }
    return { status: pag.status, valido: valido, nome: nome };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- e-mail de entrega ---------------- */

function enviarEmail_(nome, email) {
  var link = cfg_('CANVA_LINK');
  if (!link) throw new Error('CANVA_LINK não configurado');
  var primeiro = esc_(nome.split(' ')[0]);
  var html =
    '<div style="background:#09090B;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:520px;margin:0 auto;background:#111114;border:1px solid #26262C;border-radius:20px;padding:32px 28px;color:#F4F4F6">' +
    '<p style="margin:0 0 6px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#A1A1AA">Pack Vitrine Pronta</p>' +
    '<h1 style="margin:0 0 14px;font-size:26px;line-height:1.2">Seu pack chegou, ' + primeiro + '!</h1>' +
    '<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#A1A1AA">Pagamento aprovado. Toque no botão para abrir as artes no Canva. A conta gratuita do Canva serve.</p>' +
    '<p style="margin:0 0 28px"><a href="' + esc_(link) + '" style="display:inline-block;background:#17D9A0;color:#04140F;font-weight:bold;font-size:16px;text-decoration:none;padding:15px 28px;border-radius:999px">Abrir meu pack no Canva</a></p>' +
    '<p style="margin:0 0 8px;font-size:15px;color:#F4F4F6"><b>Como usar</b></p>' +
    '<ol style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.7;color:#A1A1AA">' +
    '<li>Entre no Canva com a sua conta.</li>' +
    '<li>Toque em "Usar modelo": o Canva cria uma cópia só sua.</li>' +
    '<li>Troque "sua logo aqui" pela sua logo e o site pelo seu site ou @.</li>' +
    '<li>Baixe em PNG e poste no feed, nos stories e no status.</li></ol>' +
    '<p style="margin:0;font-size:13px;line-height:1.6;color:#71717A">Guarde este e-mail: é o seu acesso ao pack. Se o botão não abrir, copie este link: ' + esc_(link) + '</p>' +
    '</div></div>';
  var texto = 'Seu pack chegou, ' + nome.split(' ')[0] + '!\n\nAbra as artes no Canva: ' + link +
    '\n\n1. Entre no Canva com a sua conta.\n2. Toque em "Usar modelo".\n3. Troque "sua logo aqui" pela sua logo.\n4. Baixe e publique.\n\nGuarde este e-mail: é o seu acesso ao pack.';
  var opcoes = { to: email, subject: 'Seu Pack Vitrine Pronta chegou', htmlBody: html, body: texto,
    name: cfg_('NOME_REMETENTE', 'Identidade Vision') };
  if (cfg_('EMAIL_RESPOSTA')) opcoes.replyTo = cfg_('EMAIL_RESPOSTA');
  MailApp.sendEmail(opcoes);
}

/* ---------------- ferramentas para você rodar no editor ---------------- */

/** Rode esta função no editor para conferir a configuração antes de vender. */
function testarConfiguracao() {
  var faltando = ['MP_ACCESS_TOKEN', 'PRECO', 'CANVA_LINK', 'SITE_URL', 'API_URL'].filter(function (k) { return !cfg_(k); });
  if (faltando.length) throw new Error('Faltam estas propriedades do script: ' + faltando.join(', '));
  if (!/^https:\/\//.test(cfg_('SITE_URL'))) throw new Error('SITE_URL precisa começar com https://');
  if (!/\/exec$/.test(cfg_('API_URL'))) throw new Error('API_URL precisa ser a URL do app da Web, terminando em /exec');
  var eu = mp_('get', '/users/me');
  aba_();
  console.log('Tudo certo. Conta Mercado Pago: ' + (eu.nickname || eu.id) + ' · Preço: R$ ' + preco_() +
    ' · Cotas de e-mail restantes hoje: ' + MailApp.getRemainingDailyQuota());
}

/** Reenvia o e-mail com o link para a linha selecionada na planilha (use em suporte). */
function reenviarLinkDaLinhaSelecionada() {
  var aba = aba_(), linha = aba.getActiveRange().getRow();
  if (linha < 2) throw new Error('Selecione uma linha de cliente.');
  enviarEmail_(String(aba.getRange(linha, COL.NOME).getValue()), String(aba.getRange(linha, COL.EMAIL).getValue()));
  aba.getRange(linha, COL.ENVIADO).setValue(new Date());
}

/* ---------------- auxiliares ---------------- */

function mp_(metodo, caminho, corpo, idempotencia) {
  var opcoes = {
    method: metodo,
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + cfg_('MP_ACCESS_TOKEN') }
  };
  if (corpo) { opcoes.contentType = 'application/json'; opcoes.payload = JSON.stringify(corpo); }
  if (idempotencia) opcoes.headers['X-Idempotency-Key'] = idempotencia;
  var r = UrlFetchApp.fetch('https://api.mercadopago.com' + caminho, opcoes);
  var codigo = r.getResponseCode(), texto = r.getContentText();
  if (codigo >= 300) throw new Error('Mercado Pago respondeu ' + codigo + ': ' + texto);
  return JSON.parse(texto);
}

function aba_() {
  var planilha = SpreadsheetApp.getActive();
  var aba = planilha.getSheetByName(ABA);
  if (!aba) {
    aba = planilha.insertSheet(ABA);
    aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  return aba;
}

function acharLinha_(aba, pedido) {
  var ultima = aba.getLastRow();
  if (ultima < 2) return 0;
  var achado = aba.getRange(2, COL.PEDIDO, ultima - 1, 1).createTextFinder(pedido).matchEntireCell(true).findNext();
  return achado ? achado.getRow() : 0;
}

function cfg_(chave, padrao) {
  var v = PropertiesService.getScriptProperties().getProperty(chave);
  return v ? String(v).trim() : (padrao || '');
}

function preco_() {
  return Math.round(Number(cfg_('PRECO', '0').replace(',', '.')) * 100) / 100;
}

function urlApi_() {
  return cfg_('API_URL') || ScriptApp.getService().getUrl();
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
