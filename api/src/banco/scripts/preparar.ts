import { gerarHash } from '../../comum/autenticacao.js'
import { env } from '../../config/ambiente.js'
import { bancoPronto, fecharBanco, ID_CONFIGURACAO, prisma } from '../conexao.js'

/**
 * Deixa um banco recém-criado pronto para uso — e nada além disso.
 *
 * Não inventa produto, cliente nem pedido. O catálogo é cadastrado pelo dono
 * no painel, e os pedidos aparecem quando alguém comprar. Um número no painel
 * é sempre um número real.
 *
 * O que entra aqui é só o que o sistema não consegue começar sem:
 *
 *   • as categorias, porque o formulário de produto exige escolher uma;
 *   • os acessos da equipe, porque sem usuário ninguém entra;
 *   • a linha de configuração da loja, com os valores padrão que o dono
 *     ajusta na aba Configurações.
 *
 * Roda mais de uma vez sem duplicar nada.
 */

/** A divisão do catálogo. Não é dado de exemplo: é a taxonomia da loja. */
const CATEGORIAS = ['Frutas', 'Verduras', 'Legumes', 'Temperos', 'Mercearia'] as const

async function principal() {
  await bancoPronto()

  // ── Configuração da loja ─────────────────────────────────────
  // Sem campos: os padrões do schema já são as regras do negócio (pedido
  // mínimo R$ 30, entrega R$ 8, grátis acima de R$ 99). O dono muda no painel.
  await prisma.configuracoes.upsert({
    where: { id: ID_CONFIGURACAO },
    update: {},
    create: { id: ID_CONFIGURACAO },
  })

  // ── Categorias ───────────────────────────────────────────────
  for (const [ordem, nome] of CATEGORIAS.entries()) {
    await prisma.categoria.upsert({ where: { nome }, update: { ordem }, create: { nome, ordem } })
  }

  // ── Acessos da equipe ────────────────────────────────────────
  // A senha vem do .env. Rodar de novo atualiza a senha de quem já existe,
  // que é como se troca a senha do dono sem mexer no banco na mão.
  const equipe = [
    { nome: 'Dono da loja', email: env.DONO_EMAIL, senha: env.DONO_SENHA, papel: 'dono' as const },
    {
      nome: 'Motorista',
      email: env.MOTORISTA_EMAIL,
      senha: env.MOTORISTA_SENHA,
      papel: 'motorista' as const,
    },
  ]

  for (const pessoa of equipe) {
    const senhaHash = await gerarHash(pessoa.senha)
    await prisma.usuarioEquipe.upsert({
      where: { email: pessoa.email },
      update: { senhaHash, ativo: true },
      create: { nome: pessoa.nome, email: pessoa.email, senhaHash, papel: pessoa.papel },
    })
  }

  const produtos = await prisma.produto.count()

  console.log('\nBanco pronto para uso.')
  console.log(`  ${CATEGORIAS.length} categorias · 2 acessos da equipe · configuração da loja criada`)
  console.log(`  ${produtos} produtos cadastrados`)

  if (produtos === 0) {
    console.log('\n  A loja abre vazia — é o esperado.')
    console.log('  Entre como dono e cadastre o catálogo em Painel → Configurações.')
  }

  console.log(`\nEntrar como dono:      ${env.DONO_EMAIL} / ${env.DONO_SENHA}`)
  console.log(`Entrar como motorista: ${env.MOTORISTA_EMAIL} / ${env.MOTORISTA_SENHA}\n`)
}

principal()
  .then(() => fecharBanco())
  .then(() => process.exit(0))
  .catch(async (erro) => {
    console.error('Falha ao preparar o banco:', erro)
    await fecharBanco().catch(() => {})
    process.exit(1)
  })
