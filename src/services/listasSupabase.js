import { ehChaveSecreta } from './configuracao.js'

// Monta o endereço da tabela sem repetir o trecho rest/v1.
function enderecoDasListas(url) {
  let base = url.trim()
  while (base.endsWith('/')) base = base.slice(0, -1)
  if (base.endsWith('/rest/v1')) base = base.slice(0, -8)
  return `${base}/rest/v1/listas`
}

// Envia o pedido e confere a resposta da tabela de listas.
async function pedirListas(config, metodo, filtro = '', dados) {
  if (ehChaveSecreta(config.supabaseChave)) {
    throw new Error('Use a chave publicável do Supabase, nunca a chave secreta.')
  }
  if (!config.supabaseUrl || !config.supabaseChave) {
    throw new Error('Configure a URL e a chave publicável do Supabase para usar as listas.')
  }

  const headers = { apikey: config.supabaseChave }
  if (!config.supabaseChave.startsWith('sb_publishable_')) {
    headers.Authorization = `Bearer ${config.supabaseChave}`
  }
  if (metodo !== 'GET') {
    headers['Content-Type'] = 'application/json'
    // A linha devolvida confirma que o banco realmente fez a alteração.
    headers.Prefer = 'return=representation'
  }

  const controlador = new AbortController()
  const tempoLimite = setTimeout(() => controlador.abort(), 15000)
  try {
    const resposta = await fetch(`${enderecoDasListas(config.supabaseUrl)}?${filtro}`, {
      method: metodo,
      headers,
      body: dados === undefined ? undefined : JSON.stringify(dados),
      signal: controlador.signal,
      cache: 'no-store',
    })
    if (!resposta.ok) {
      throw new Error(`Não foi possível acessar as listas (HTTP ${resposta.status}). Atualize e tente novamente.`)
    }
    const linhas = await resposta.json()
    if (!Array.isArray(linhas)) {
      throw new Error('O Supabase devolveu as listas em um formato inesperado.')
    }
    // Mantém o ID como texto, como nas regras e componentes existentes.
    return linhas.map((lista) => ({ ...lista, id: String(lista.id) }))
  } catch (erro) {
    if (erro.name === 'AbortError' || erro instanceof TypeError) {
      throw new Error('Não foi possível confirmar a resposta do Supabase. Confira a conexão e atualize as listas antes de tentar novamente.', { cause: erro })
    }
    throw erro
  } finally {
    clearTimeout(tempoLimite)
  }
}

// Busca as listas compartilhadas na ordem de criação.
export function buscarListasSupabase(config) {
  return pedirListas(config, 'GET', 'select=id,name,room_ids&order=id.asc')
}

// Confere se a operação devolveu a lista alterada.
function conferirLista(linhas) {
  if (linhas.length !== 1) {
    throw new Error('A alteração não foi confirmada. A lista pode ter sido excluída ou estar sem permissão. Atualize as listas.')
  }
  return linhas[0]
}

// Cria a lista com as salas informadas e recebe o ID do banco.
export async function criarListaSupabase(config, nome, salas = []) {
  const linhas = await pedirListas(config, 'POST', 'select=id,name,room_ids', { name: nome, room_ids: salas })
  return conferirLista(linhas)
}

// Atualiza apenas os campos informados da lista escolhida.
export async function atualizarListaSupabase(config, id, dados) {
  const linhas = await pedirListas(config, 'PATCH', `id=eq.${encodeURIComponent(id)}&select=id,name,room_ids`, dados)
  return conferirLista(linhas)
}

// Exclui a lista e confere se o banco devolveu o registro removido.
export async function excluirListaSupabase(config, id) {
  const linhas = await pedirListas(config, 'DELETE', `id=eq.${encodeURIComponent(id)}&select=id,name,room_ids`)
  return conferirLista(linhas)
}
