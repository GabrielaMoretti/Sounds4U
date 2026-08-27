export default function PrivacyPolicy() {
  return (
    <div className="page legal-page">
      <h2>Política de Privacidade — Sounds4U</h2>
      <p className="dsp-note">Última atualização: 27 de agosto de 2026</p>

      <p>
        O Sounds4U é um app social de música: você conecta sua conta do Spotify, vê seu histórico
        de escuta, escreve reviews, posta sobre músicas e interage com amigos. Esta página explica
        que dados a gente coleta e o que faz com eles.
      </p>

      <h3>Dados que coletamos</h3>
      <ul>
        <li>
          <strong>Da sua conta Spotify</strong>, quando você conecta (via login OAuth): nome de
          exibição, e-mail, foto de perfil, e seu histórico de músicas tocadas recentemente.
        </li>
        <li>
          <strong>Conteúdo que você cria no app</strong>: reviews, posts do feed, comentários,
          curtidas, pedidos de amizade, mensagens diretas, foto de perfil (se você trocar a
          padrão), bio e links de redes sociais que você adicionar ao seu perfil.
        </li>
      </ul>

      <h3>Como usamos esses dados</h3>
      <p>
        Só para fazer o app funcionar: mostrar seu histórico de escuta, exibir suas reviews e as
        de outras pessoas na página de cada música, montar seu feed com posts de amigos, permitir
        busca de usuários e troca de mensagens entre amigos. Não vendemos nem compartilhamos seus
        dados com terceiros para publicidade.
      </p>

      <h3>Onde os dados ficam armazenados</h3>
      <p>
        Usamos o Supabase (banco de dados e autenticação) e a Vercel (hospedagem) como provedores
        de infraestrutura. O token de acesso à sua conta Spotify fica guardado de forma restrita,
        acessível só pela sua própria conta.
      </p>

      <h3>Visibilidade do conteúdo</h3>
      <p>
        Reviews são públicas para qualquer pessoa logada no app. Posts do feed, curtidas e
        comentários também. Mensagens diretas só podem ser trocadas entre amigos que se aceitaram
        mutuamente, e só aparecem para os dois participantes da conversa.
      </p>

      <h3>Excluir sua conta ou seus dados</h3>
      <p>
        Ainda não existe um botão de autoexclusão de conta no app. Se você quiser remover sua
        conta e todos os dados associados, entre em contato pelo e-mail abaixo que a gente
        processa manualmente.
      </p>

      <h3>Contato</h3>
      <p>
        Dúvidas sobre esta política:{' '}
        <a href="mailto:CONTATO@EXEMPLO.COM">CONTATO@EXEMPLO.COM</a>
      </p>
    </div>
  )
}
