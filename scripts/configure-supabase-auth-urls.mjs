/**
 * Atualiza Site URL e Redirect URLs no projeto Supabase (Management API).
 *
 * Requer no .env:
 *   VITE_SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_ACCESS_TOKEN=<Personal Access Token com auth_config_write>
 *
 * Uso: npm run configure:supabase-auth
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim()

const LOCAL_REDIRECTS = ['http://localhost:5173', 'http://localhost:5173/**']

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname
    const ref = host.split('.')[0]
    if (!ref || ref === 'localhost') return null
    return ref
  } catch {
    return null
  }
}

async function mergeUriAllowList(projectRef, token) {
  const getRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!getRes.ok) {
    const body = await getRes.text()
    throw new Error(`GET auth config falhou (${getRes.status}): ${body}`)
  }

  const current = await getRes.json()
  const existing = (current.uri_allow_list ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const merged = [...new Set([...existing, ...LOCAL_REDIRECTS])]
  return merged.join(',')
}

async function main() {
  if (!supabaseUrl || !accessToken) {
    console.error(
      'Defina VITE_SUPABASE_URL e SUPABASE_ACCESS_TOKEN no .env (token: https://supabase.com/dashboard/account/tokens).',
    )
    process.exit(1)
  }

  const projectRef = projectRefFromUrl(supabaseUrl)
  if (!projectRef) {
    console.error('VITE_SUPABASE_URL inválida:', supabaseUrl)
    process.exit(1)
  }

  const uri_allow_list = await mergeUriAllowList(projectRef, accessToken)

  const patchRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site_url: 'http://localhost:5173',
      uri_allow_list,
    }),
  })

  if (!patchRes.ok) {
    const body = await patchRes.text()
    console.error(`PATCH auth config falhou (${patchRes.status}):`, body)
    process.exit(1)
  }

  console.log('Auth config atualizado para o projeto', projectRef)
  console.log('  site_url: http://localhost:5173')
  console.log('  uri_allow_list:', uri_allow_list)
  console.log(
    '\nNota: CORS da API REST do Supabase é gerenciado pelo projeto; redirect URLs afetam OAuth/magic link.',
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
