/* Integra Escolar — Contato da Escola / Ajuda
   Página estática (sem dependência da API). Os dados de contato abaixo
   são um EXEMPLO — troque pelos dados reais da sua instituição. */

const CONTATO_ESCOLA = {
  telefone: { label: 'Telefone', valor: '(81) 995139963', href: 'tel:+558195139963' },
  whatsapp: { label: 'WhatsApp', valor: '(81) 995139963', href: 'https://wa.me/558195139963' },
  email:    { label: 'E-mail',   valor: 'integraescola08@gmail.com', href: 'mailto:integraescola08@gmail.com' },
  horario:  { label: 'Atendimento', valor: 'Segunda a sexta, 7h às 17h' },
  endereco: { label: 'Endereço', valor: ' R. Ver. João Avelino Sobrinho - Cidade Alta, Caruaru - PE, 55031-470' },
};

const ICONES = {
  telefone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  email:    '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  endereco: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  horario:  '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
};

const FAQ = [
  {
    pergunta: 'Como envio um atestado médico?',
    resposta: 'Na Tela Inicial, toque em "Enviar Atestado", selecione o estudante, escolha o tipo de declaração e anexe o arquivo (PDF, JPG ou PNG). Sua solicitação será analisada pela gestão da escola.'
  },
  {
    pergunta: 'Como funciona a liberação antecipada do estudante?',
    resposta: 'Toque em "Liberar Estudante", selecione o estudante, informe a data, o horário de saída e o motivo. A gestão da escola precisa aprovar antes da saída ser confirmada na portaria.'
  },
  {
    pergunta: 'Quanto tempo demora para minha solicitação ser analisada?',
    resposta: 'O prazo pode variar conforme a demanda da escola. Você pode acompanhar o status (pendente, aprovado ou rejeitado) a qualquer momento no menu "Histórico".'
  },
  {
    pergunta: 'Como acompanho o status das minhas solicitações?',
    resposta: 'Todas as suas solicitações de atestado e liberação ficam registradas no menu "Histórico", com o status atualizado e, quando houver, a resposta da gestão.'
  },
  {
    pergunta: 'Esqueci minha senha, o que eu faço?',
    resposta: 'Entre em contato diretamente com a secretaria da escola pelos canais ao lado — a redefinição de senha é feita pela equipe da gestão.'
  },
];

function montarContatos() {
  const el = document.getElementById('contatos');
  el.innerHTML = Object.entries(CONTATO_ESCOLA).map(([chave, item]) => `
    <div class="contato-item">
      <div class="contato-icone">
        <svg viewBox="0 0 24 24">${ICONES[chave] || ''}</svg>
      </div>
      <div>
        <div class="contato-label">${item.label}</div>
        <div class="contato-valor">${item.href ? `<a href="${item.href}" target="_blank" rel="noopener">${item.valor}</a>` : item.valor}</div>
      </div>
    </div>
  `).join('');
}

function montarFaq() {
  const el = document.getElementById('faq');
  el.innerHTML = FAQ.map((item, i) => `
    <div class="faq-item" id="faq-${i}">
      <button class="faq-pergunta" onclick="alternarFaq(${i})">
        <span>${item.pergunta}</span>
        <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-resposta"><p>${item.resposta}</p></div>
    </div>
  `).join('');
}

function alternarFaq(i) {
  document.getElementById(`faq-${i}`).classList.toggle('aberto');
}

montarContatos();
montarFaq();
