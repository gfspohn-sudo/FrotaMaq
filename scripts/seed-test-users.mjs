import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de executar o seed.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_USERS = [
  { email: 'gerente@frotamaq.com', password: '123456', nome: 'Gestor Demo', perfil: 'gerente' },
  { email: 'mecanico@frotamaq.com', password: '123456', nome: 'Mecânico Demo', perfil: 'mecanico' },
  { email: 'motorista@frotamaq.com', password: '123456', nome: 'Motorista Demo', perfil: 'motorista' },
]

async function findUserByEmail(email) {
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const found = data.users.find(user => user.email === email)
    if (found) return found

    if (data.users.length < perPage) return null
    page += 1
  }
}

async function upsertUsuario(user) {
  await supabase.from('usuarios').upsert({
    id: user.id,
    email: user.email,
    nome: user.nome,
    perfil: user.perfil,
  })
}

async function seed() {
  for (const user of TEST_USERS) {
    const existing = await findUserByEmail(user.email)

    if (existing) {
      await supabase.auth.admin.updateUserById(existing.id, {
        password: user.password,
        email_confirm: true,
        user_metadata: { nome: user.nome, perfil: user.perfil },
      })

      await upsertUsuario({ id: existing.id, ...user })
      console.log(`Atualizado: ${user.email} (${user.perfil})`)
      continue
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { nome: user.nome, perfil: user.perfil },
    })

    if (error) {
      console.error(`Erro ao criar ${user.email}:`, error.message)
      continue
    }

    if (data.user) {
      await upsertUsuario({ id: data.user.id, ...user })
    }

    console.log(`Criado: ${user.email} (${user.perfil})`)
  }

  console.log('\nSeed concluido. Senha padrao: 123456')
}

seed()
