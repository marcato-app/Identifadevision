/* ============================================================
   CONFIGURAÇÃO DO PACK — é o único arquivo que você precisa editar
   ============================================================ */
window.PACK = {
  // URL do Apps Script publicado como app da Web (termina em /exec).
  // Veja o passo a passo em pack-backend/LEIAME.md
  api: '',

  // Preço exibido nas páginas. O valor cobrado de verdade fica no
  // Apps Script (propriedade PRECO); mantenha os dois iguais.
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
