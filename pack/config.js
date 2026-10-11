/* ============================================================
   CONFIGURAÇÃO DO PACK — é o único arquivo que você precisa editar
   ============================================================ */
window.PACK = {
  // Link do checkout da Kiwify (Produtos > seu produto > Links > Checkout).
  checkout: 'https://pay.kiwify.com.br/pctk6bH',

  // Preço exibido na página. O valor cobrado é o configurado na Kiwify;
  // mantenha os dois iguais.
  preco: '37,00',
  precoAntigo: '97,00',            // deixe '' para esconder o "de ... por"
  parcelas: 'ou em até 5x no cartão',
  totalArtes: '40+',

  // Dados de quem vende, usados nos Termos e na Política de Privacidade.
  vendedor: '[NOME OU RAZÃO SOCIAL]',
  documento: '[CPF OU CNPJ]',
  email: '[E-MAIL DE CONTATO]',
  cidade: '[CIDADE/UF]',

  // Versão dos termos registrada junto com o aceite de cada cliente.
  versaoTermos: '2026-10-11'
};

/* preenche os textos marcados com data-cfg="chave" */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-cfg]').forEach(function (el) {
    var v = window.PACK[el.dataset.cfg];
    if (v) el.textContent = v;
  });
});
