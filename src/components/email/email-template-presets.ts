// Pre-made email templates for quick start

export interface EmailTemplatePreset {
  id: string;
  name: string;
  description: string;
  category: string;
  subject: string;
  body_html: string;
  thumbnail?: string;
}

export const EMAIL_TEMPLATE_PRESETS: EmailTemplatePreset[] = [
  // BOAS-VINDAS
  {
    id: "welcome-basic",
    name: "Boas-vindas Básico",
    description: "Template simples de boas-vindas para novos clientes",
    category: "general",
    subject: "Bem-vindo(a) à nossa família, {nome}! 🎉",
    body_html: `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 30px 0;">
    <h1 style="color: #2563eb; margin: 0; font-size: 28px;">Bem-vindo(a), {nome}! 🎉</h1>
  </div>
  
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 30px; color: white; text-align: center; margin-bottom: 30px;">
    <h2 style="margin: 0 0 15px 0; font-size: 24px;">Estamos muito felizes em ter você conosco!</h2>
    <p style="margin: 0; opacity: 0.9; font-size: 16px;">Sua jornada de sucesso começa agora.</p>
  </div>
  
  <div style="padding: 20px 0;">
    <p style="font-size: 16px; line-height: 1.6; color: #374151;">
      Olá <strong>{nome}</strong>,
    </p>
    <p style="font-size: 16px; line-height: 1.6; color: #374151;">
      É com grande alegria que te damos as boas-vindas! Você acaba de dar o primeiro passo para transformar seus resultados.
    </p>
    <p style="font-size: 16px; line-height: 1.6; color: #374151;">
      A partir de agora, você terá acesso a todas as ferramentas e recursos que preparamos especialmente para você.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px 0;">
    <a href="#" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
      Acessar Agora →
    </a>
  </div>
  
  <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
    <p>Precisa de ajuda? Responda este email que teremos prazer em atendê-lo.</p>
    <p style="margin-top: 15px;">Com carinho,<br><strong>Equipe {empresa}</strong></p>
  </div>
</div>
    `.trim(),
  },
  {
    id: "welcome-premium",
    name: "Boas-vindas Premium",
    description: "Template elegante com passos de onboarding",
    category: "general",
    subject: "🌟 {nome}, sua conta foi ativada com sucesso!",
    body_html: `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 40px 30px; text-align: center; border-radius: 0 0 30px 30px;">
    <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">Seja Bem-vindo! ✨</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0 0; font-size: 16px;">{nome}, sua conta está pronta para uso</p>
  </div>
  
  <div style="padding: 30px;">
    <!-- Message -->
    <div style="background: white; border-radius: 16px; padding: 30px; margin-bottom: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
      <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 15px 0;">
        Olá <strong>{nome}</strong>,
      </p>
      <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0;">
        Parabéns! Sua conta foi criada com sucesso e você já pode começar a explorar todas as funcionalidades disponíveis.
      </p>
    </div>
    
    <!-- Steps -->
    <div style="background: white; border-radius: 16px; padding: 30px; margin-bottom: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
      <h3 style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px;">📋 Próximos Passos:</h3>
      
      <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
        <div style="background: #2563eb; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; flex-shrink: 0;">1</div>
        <div style="margin-left: 15px;">
          <strong style="color: #1f2937;">Complete seu perfil</strong>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Adicione suas informações para personalizar sua experiência.</p>
        </div>
      </div>
      
      <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
        <div style="background: #2563eb; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; flex-shrink: 0;">2</div>
        <div style="margin-left: 15px;">
          <strong style="color: #1f2937;">Explore os recursos</strong>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Conheça todas as ferramentas disponíveis para você.</p>
        </div>
      </div>
      
      <div style="display: flex; align-items: flex-start;">
        <div style="background: #2563eb; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; flex-shrink: 0;">3</div>
        <div style="margin-left: 15px;">
          <strong style="color: #1f2937;">Entre em contato</strong>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Nossa equipe está pronta para ajudá-lo em qualquer dúvida.</p>
        </div>
      </div>
    </div>
    
    <!-- CTA -->
    <div style="text-align: center; padding: 10px 0;">
      <a href="#" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);">
        Começar Agora 🚀
      </a>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="padding: 20px 30px 30px; text-align: center;">
    <p style="color: #6b7280; font-size: 14px; margin: 0;">
      Atenciosamente,<br><strong>{empresa}</strong>
    </p>
  </div>
</div>
    `.trim(),
  },
  
  // VENDAS DE CURSOS
  {
    id: "course-launch",
    name: "Lançamento de Curso",
    description: "Template para divulgar um novo curso",
    category: "campaign",
    subject: "🎓 {nome}, chegou o curso que você esperava!",
    body_html: `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: white;">
  <!-- Hero -->
  <div style="background: linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #0ea5e9 100%); padding: 50px 30px; text-align: center;">
    <span style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">🔥 Novidade</span>
    <h1 style="margin: 20px 0 10px; font-size: 36px; font-weight: 800; line-height: 1.2;">Curso Completo de<br>Marketing Digital</h1>
    <p style="margin: 0; opacity: 0.9; font-size: 18px;">Do zero ao avançado em 8 semanas</p>
  </div>
  
  <div style="padding: 40px 30px;">
    <p style="font-size: 18px; line-height: 1.7; color: #e2e8f0; margin: 0 0 25px 0;">
      Olá <strong>{nome}</strong>,
    </p>
    <p style="font-size: 16px; line-height: 1.7; color: #cbd5e1; margin: 0 0 30px 0;">
      Você pediu, e nós atendemos! Finalmente lançamos o curso mais completo de Marketing Digital do mercado.
    </p>
    
    <!-- Features -->
    <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; margin-bottom: 30px;">
      <h3 style="margin: 0 0 20px 0; font-size: 20px; color: white;">O que você vai aprender:</h3>
      <div style="margin-bottom: 12px; display: flex; align-items: center;">
        <span style="color: #22c55e; margin-right: 10px;">✓</span>
        <span style="color: #e2e8f0;">Estratégias de Tráfego Pago e Orgânico</span>
      </div>
      <div style="margin-bottom: 12px; display: flex; align-items: center;">
        <span style="color: #22c55e; margin-right: 10px;">✓</span>
        <span style="color: #e2e8f0;">Copywriting que converte</span>
      </div>
      <div style="margin-bottom: 12px; display: flex; align-items: center;">
        <span style="color: #22c55e; margin-right: 10px;">✓</span>
        <span style="color: #e2e8f0;">Automação de Marketing</span>
      </div>
      <div style="margin-bottom: 12px; display: flex; align-items: center;">
        <span style="color: #22c55e; margin-right: 10px;">✓</span>
        <span style="color: #e2e8f0;">Análise de Métricas e ROI</span>
      </div>
      <div style="display: flex; align-items: center;">
        <span style="color: #22c55e; margin-right: 10px;">✓</span>
        <span style="color: #e2e8f0;">+50 horas de conteúdo prático</span>
      </div>
    </div>
    
    <!-- Pricing -->
    <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
      <p style="margin: 0 0 5px 0; font-size: 14px; opacity: 0.9; text-decoration: line-through;">De R$ 997,00</p>
      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">OFERTA DE LANÇAMENTO</p>
      <p style="margin: 0; font-size: 48px; font-weight: 800;">R$ 497<span style="font-size: 20px;">,00</span></p>
      <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">ou 12x de R$ 49,70</p>
    </div>
    
    <!-- CTA -->
    <div style="text-align: center;">
      <a href="#" style="display: inline-block; background: white; color: #0f172a; padding: 18px 50px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 18px;">
        QUERO ME INSCREVER →
      </a>
      <p style="margin: 15px 0 0 0; font-size: 13px; color: #94a3b8;">⚡ Vagas limitadas - Oferta válida até {data}</p>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="background: rgba(255,255,255,0.05); padding: 25px 30px; text-align: center;">
    <p style="margin: 0; font-size: 13px; color: #94a3b8;">
      Você recebeu este email porque se inscreveu em nossa lista.<br>
      <a href="#" style="color: #60a5fa;">Cancelar inscrição</a>
    </p>
  </div>
</div>
    `.trim(),
  },
  {
    id: "course-reminder",
    name: "Lembrete de Curso",
    description: "Template de lembrete para quem não finalizou a compra",
    category: "campaign",
    subject: "⏰ {nome}, sua vaga ainda está reservada!",
    body_html: `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
    <p style="margin: 0; color: #92400e; font-weight: 600;">⏰ Sua vaga ainda está reservada por mais 24 horas!</p>
  </div>
  
  <p style="font-size: 18px; line-height: 1.6; color: #374151;">
    Olá <strong>{nome}</strong>,
  </p>
  
  <p style="font-size: 16px; line-height: 1.7; color: #4b5563;">
    Percebi que você demonstrou interesse no nosso curso, mas ainda não finalizou sua inscrição.
  </p>
  
  <p style="font-size: 16px; line-height: 1.7; color: #4b5563;">
    Entendo que tomar uma decisão importante exige reflexão. Por isso, separei algumas informações que podem te ajudar:
  </p>
  
  <div style="background: #f8fafc; border-radius: 12px; padding: 25px; margin: 25px 0;">
    <h3 style="margin: 0 0 15px 0; color: #1f2937;">💡 Por que nossos alunos nos escolhem:</h3>
    <ul style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.8;">
      <li>Metodologia prática com resultados comprovados</li>
      <li>Suporte individual para tirar todas as dúvidas</li>
      <li>Comunidade ativa de mais de 5.000 alunos</li>
      <li>Garantia de 7 dias - sem perguntas</li>
    </ul>
  </div>
  
  <p style="font-size: 16px; line-height: 1.7; color: #4b5563;">
    <strong>Dúvidas?</strong> Responda este email e terei prazer em ajudá-lo pessoalmente.
  </p>
  
  <div style="text-align: center; padding: 25px 0;">
    <a href="#" style="display: inline-block; background: #2563eb; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
      Garantir Minha Vaga →
    </a>
  </div>
  
  <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; text-align: center; color: #9ca3af; font-size: 14px;">
    <p>Abraços,<br><strong>Equipe {empresa}</strong></p>
  </div>
</div>
    `.trim(),
  },
  
  // E-BOOK
  {
    id: "ebook-delivery",
    name: "Entrega de E-book",
    description: "Template para entregar e-book após cadastro",
    category: "general",
    subject: "📚 {nome}, seu e-book está pronto para download!",
    body_html: `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px 30px; text-align: center; border-radius: 0 0 30px 30px;">
    <span style="font-size: 60px;">📚</span>
    <h1 style="color: white; margin: 15px 0 0 0; font-size: 28px;">Seu E-book Chegou!</h1>
  </div>
  
  <div style="padding: 30px;">
    <p style="font-size: 18px; line-height: 1.6; color: #374151;">
      Olá <strong>{nome}</strong>,
    </p>
    
    <p style="font-size: 16px; line-height: 1.7; color: #4b5563;">
      Obrigado por baixar nosso e-book! Preparamos este material com muito carinho para ajudá-lo em sua jornada.
    </p>
    
    <!-- Book Card -->
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 25px; margin: 25px 0; text-align: center;">
      <div style="background: white; width: 120px; height: 160px; margin: 0 auto 20px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 48px;">📖</span>
      </div>
      <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 20px;">Guia Completo de Sucesso</h3>
      <p style="margin: 0; color: #b45309; font-size: 14px;">PDF • 45 páginas • Ilustrado</p>
    </div>
    
    <div style="text-align: center; padding: 10px 0;">
      <a href="#" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 18px 50px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 18px; box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);">
        ⬇️ BAIXAR E-BOOK
      </a>
    </div>
    
    <div style="background: #f8fafc; border-radius: 12px; padding: 25px; margin-top: 30px;">
      <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">📌 Dicas para aproveitar ao máximo:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.8; font-size: 14px;">
        <li>Reserve um momento tranquilo para a leitura</li>
        <li>Faça anotações dos pontos mais importantes</li>
        <li>Aplique uma dica por dia na sua rotina</li>
        <li>Compartilhe com amigos que também podem se beneficiar</li>
      </ul>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="background: #f8fafc; padding: 25px 30px; text-align: center; border-radius: 30px 30px 0 0;">
    <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px;">
      Gostou do conteúdo? Temos mais materiais incríveis esperando por você!
    </p>
    <a href="#" style="color: #f97316; font-weight: 600; text-decoration: none;">Ver mais materiais →</a>
    <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 13px;">
      Com carinho,<br><strong>Equipe {empresa}</strong>
    </p>
  </div>
</div>
    `.trim(),
  },
  {
    id: "ebook-promotion",
    name: "Promoção de E-book",
    description: "Template para promover um e-book pago",
    category: "campaign",
    subject: "🎁 {nome}, e-book GRATUITO por tempo limitado!",
    body_html: `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
  <!-- Urgency Banner -->
  <div style="background: #dc2626; color: white; text-align: center; padding: 12px; font-weight: 600;">
    ⏱️ OFERTA ENCERRA EM 48 HORAS
  </div>
  
  <!-- Hero -->
  <div style="background: linear-gradient(180deg, #1e1b4b 0%, #312e81 100%); padding: 50px 30px; text-align: center;">
    <span style="background: #fbbf24; color: #1e1b4b; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700;">EXCLUSIVO</span>
    <h1 style="color: white; margin: 20px 0 15px; font-size: 32px; line-height: 1.3;">O E-book Que Vai<br>Transformar Seus Resultados</h1>
    <p style="color: #a5b4fc; margin: 0; font-size: 16px;">De R$ 97 por <strong style="color: #fbbf24; font-size: 24px;">GRÁTIS</strong></p>
  </div>
  
  <div style="padding: 35px 30px; background: white;">
    <p style="font-size: 17px; line-height: 1.6; color: #374151;">
      {nome}, temos uma surpresa especial para você!
    </p>
    
    <p style="font-size: 16px; line-height: 1.7; color: #4b5563;">
      Por apenas <strong>48 horas</strong>, estamos liberando gratuitamente nosso e-book mais vendido - que normalmente custa R$ 97.
    </p>
    
    <!-- What's inside -->
    <div style="margin: 30px 0;">
      <h3 style="color: #1f2937; margin: 0 0 15px 0;">📖 O que você vai encontrar:</h3>
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px;">
        <div style="margin-bottom: 10px;">✅ <strong>Capítulo 1:</strong> Fundamentos essenciais</div>
        <div style="margin-bottom: 10px;">✅ <strong>Capítulo 2:</strong> Estratégias comprovadas</div>
        <div style="margin-bottom: 10px;">✅ <strong>Capítulo 3:</strong> Cases de sucesso</div>
        <div style="margin-bottom: 10px;">✅ <strong>Capítulo 4:</strong> Plano de ação passo a passo</div>
        <div>✅ <strong>Bônus:</strong> Planilhas e templates exclusivos</div>
      </div>
    </div>
    
    <div style="text-align: center; padding: 20px 0;">
      <a href="#" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 18px 50px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 18px;">
        QUERO MEU E-BOOK GRÁTIS →
      </a>
      <p style="margin: 15px 0 0 0; font-size: 13px; color: #9ca3af;">Sem pegadinhas. Sem cartão de crédito.</p>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="background: #f3f4f6; padding: 25px 30px; text-align: center;">
    <p style="margin: 0; font-size: 13px; color: #6b7280;">
      Você recebeu este email porque se inscreveu em nossa lista.<br>
      <a href="#" style="color: #7c3aed;">Cancelar inscrição</a>
    </p>
  </div>
</div>
    `.trim(),
  },
  
  // CRM / FOLLOW-UP
  {
    id: "crm-followup",
    name: "Follow-up Comercial",
    description: "Template para follow-up de negociação",
    category: "crm",
    subject: "Re: Nossa conversa sobre {deal_title}",
    body_html: `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="font-size: 16px; line-height: 1.7; color: #374151;">
    Olá {nome},
  </p>
  
  <p style="font-size: 16px; line-height: 1.7; color: #4b5563;">
    Espero que esteja tudo bem com você!
  </p>
  
  <p style="font-size: 16px; line-height: 1.7; color: #4b5563;">
    Gostaria de retomar nossa conversa sobre <strong>{deal_title}</strong>. Na última vez que conversamos, você mencionou que estava avaliando as opções disponíveis.
  </p>
  
  <p style="font-size: 16px; line-height: 1.7; color: #4b5563;">
    Tive algumas ideias que podem se encaixar ainda melhor nas suas necessidades. Podemos agendar uma rápida conversa esta semana?
  </p>
  
  <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
    <p style="margin: 0; color: #1e40af; font-size: 15px;">
      💡 <strong>Lembrete:</strong> O valor discutido foi de <strong>{valor}</strong> e a proposta ainda está válida.
    </p>
  </div>
  
  <p style="font-size: 16px; line-height: 1.7; color: #4b5563;">
    Fico no aguardo do seu retorno!
  </p>
  
  <p style="font-size: 16px; line-height: 1.7; color: #374151; margin-top: 30px;">
    Abraços,<br>
    <strong>Equipe {empresa}</strong>
  </p>
  
  <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 15px;">
    <p style="margin: 0; font-size: 13px; color: #9ca3af;">
      📞 {telefone} | ✉️ Responda este email
    </p>
  </div>
</div>
    `.trim(),
  },
  {
    id: "crm-proposal",
    name: "Envio de Proposta",
    description: "Template para enviar proposta comercial",
    category: "crm",
    subject: "📋 {nome}, sua proposta personalizada está pronta",
    body_html: `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 35px 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 26px;">Proposta Comercial</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">{deal_title}</p>
  </div>
  
  <div style="padding: 30px; background: #f8fafc;">
    <div style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
      <p style="font-size: 17px; line-height: 1.6; color: #374151; margin: 0 0 20px 0;">
        Olá <strong>{nome}</strong>,
      </p>
      
      <p style="font-size: 16px; line-height: 1.7; color: #4b5563; margin: 0 0 25px 0;">
        Conforme conversamos, segue abaixo a proposta personalizada para atender às suas necessidades.
      </p>
      
      <!-- Proposal Box -->
      <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <span style="color: #166534; font-weight: 600;">Investimento:</span>
          <span style="color: #166534; font-size: 28px; font-weight: 800;">{valor}</span>
        </div>
        <div style="border-top: 1px dashed #86efac; padding-top: 15px;">
          <p style="margin: 0; color: #166534; font-size: 14px;">
            ✓ Condições especiais válidas até {data}<br>
            ✓ Pagamento facilitado disponível<br>
            ✓ Suporte prioritário incluso
          </p>
        </div>
      </div>
      
      <p style="font-size: 16px; line-height: 1.7; color: #4b5563; margin: 0 0 25px 0;">
        Estou à disposição para esclarecer qualquer dúvida. Podemos agendar uma call para finalizar os detalhes?
      </p>
      
      <div style="text-align: center;">
        <a href="#" style="display: inline-block; background: #059669; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-right: 10px;">
          ✓ Aceitar Proposta
        </a>
        <a href="#" style="display: inline-block; background: white; color: #059669; border: 2px solid #059669; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Agendar Conversa
        </a>
      </div>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; color: #6b7280; font-size: 14px;">
      Atenciosamente,<br><strong>{empresa}</strong>
    </p>
  </div>
</div>
    `.trim(),
  },
];