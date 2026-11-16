import { useEffect, useRef, useState } from 'react'
import { SALAS } from '../data/salas.js'
import { validarNomeLista } from '../utils/colecoes.js'
import { CHAVE_PREFERENCIAS, lerPreferencias, salvarPreferencias } from '../services/colecoesLocais.js'
import { lerConfiguracao } from '../services/configuracao.js'
import { atualizarListaSupabase, buscarListasSupabase, criarListaSupabase, excluirListaSupabase } from '../services/listasSupabase.js'

const IDS_DAS_SALAS = SALAS.map((sala) => sala.id)

// Obtém o armazenamento ou retorna null se o acesso estiver bloqueado.
function pegarLocalStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// Gerencia listas no Supabase e favoritos neste navegador.
export function useColecoes() {
  const [config] = useState(() => lerConfiguracao(import.meta.env))
  const [leitura] = useState(() => lerPreferencias(pegarLocalStorage(), IDS_DAS_SALAS))
  const [favoritos, setFavoritos] = useState(leitura.prefs.favorites)
  const [listas, setListas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [carregou, setCarregou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState(0)
  // Impede outro envio antes que o React desabilite os controles.
  const gravando = useRef(false)

  useEffect(() => {
    let ativo = true

    // Carrega as listas sem usar os dados locais como alternativa.
    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const recebidas = await buscarListasSupabase(config)
        if (ativo) {
          setListas(recebidas)
          setCarregou(true)
        }
      } catch (falha) {
        if (ativo) {
          setErro(falha.message)
          setCarregou(false)
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()
    return () => { ativo = false }
  }, [config, busca])

  // Grava só os favoritos, preservando as listas locais antigas.
  useEffect(() => {
    if (favoritos === leitura.prefs.favorites) return
    const armazenamento = pegarLocalStorage()
    const anteriores = lerPreferencias(armazenamento, IDS_DAS_SALAS)
    salvarPreferencias(armazenamento, { ...anteriores.prefs, favorites: favoritos })
  }, [favoritos, leitura.prefs.favorites])

  // Sincroniza apenas os favoritos entre abas do navegador.
  useEffect(() => {
    // Lê os favoritos alterados em outra aba.
    const quandoOutraAbaGravar = (evento) => {
      if (evento.key !== CHAVE_PREFERENCIAS && evento.key !== null) return
      const lida = lerPreferencias(pegarLocalStorage(), IDS_DAS_SALAS)
      if (lida.aviso === null) setFavoritos(lida.prefs.favorites)
    }
    window.addEventListener('storage', quandoOutraAbaGravar)
    return () => window.removeEventListener('storage', quandoOutraAbaGravar)
  }, [])

  // Busca novamente as listas compartilhadas.
  const atualizarListas = () => {
    if (!gravando.current && !carregando) setBusca((anterior) => anterior + 1)
  }

  // Confere se a sala está nos favoritos.
  const ehFavorita = (salaId) => favoritos.includes(salaId)

  // Adiciona ou retira o favorito local.
  const alternarFavorito = (salaId) => {
    setFavoritos((atuais) => atuais.includes(salaId)
      ? atuais.filter((id) => id !== salaId)
      : [...atuais, salaId])
  }

  // Libera um único pedido quando as listas já foram carregadas.
  const iniciarGravacao = () => {
    if (gravando.current || carregando || !carregou) return false
    gravando.current = true
    setSalvando(true)
    setErro(null)
    return true
  }

  // Cria uma lista vazia ou já com a sala selecionada.
  const criarLista = async (nome, salaId = null) => {
    const validacao = validarNomeLista({ lists: listas }, nome)
    if (!validacao.ok) return { ok: false, erro: validacao.erro }
    if (!iniciarGravacao()) return { ok: false, erro: 'Aguarde o pedido atual ou atualize as listas.' }
    try {
      const salas = IDS_DAS_SALAS.includes(salaId) ? [salaId] : []
      const criada = await criarListaSupabase(config, validacao.nome, salas)
      setListas((atuais) => [...atuais, criada])
      return { ok: true, erro: null, id: criada.id }
    } catch (falha) {
      setErro(falha.message)
      setCarregou(false)
      return { ok: false, erro: falha.message }
    } finally {
      gravando.current = false
      setSalvando(false)
    }
  }

  // Salva os campos da lista e só depois atualiza a tela.
  const salvarLista = async (listaId, dados) => {
    if (!iniciarGravacao()) return { ok: false, erro: 'Aguarde o pedido atual ou atualize as listas.' }
    try {
      const salva = await atualizarListaSupabase(config, listaId, dados)
      setListas((atuais) => atuais.map((lista) => lista.id === listaId ? salva : lista))
      return { ok: true, erro: null }
    } catch (falha) {
      setErro(falha.message)
      setCarregou(false)
      return { ok: false, erro: falha.message }
    } finally {
      gravando.current = false
      setSalvando(false)
    }
  }

  // Valida o novo nome antes de enviá-lo ao banco.
  const renomearLista = async (listaId, nome) => {
    const validacao = validarNomeLista({ lists: listas }, nome, listaId)
    if (!validacao.ok) return { ok: false, erro: validacao.erro }
    return salvarLista(listaId, { name: validacao.nome })
  }

  // Exclui a lista no banco antes de retirá-la da tela.
  const excluirLista = async (listaId) => {
    if (!iniciarGravacao()) return { ok: false, erro: 'Aguarde o pedido atual ou atualize as listas.' }
    try {
      await excluirListaSupabase(config, listaId)
      setListas((atuais) => atuais.filter((lista) => lista.id !== listaId))
      return { ok: true, erro: null }
    } catch (falha) {
      setErro(falha.message)
      setCarregou(false)
      return { ok: false, erro: falha.message }
    } finally {
      gravando.current = false
      setSalvando(false)
    }
  }

  // Inclui a sala sem repetir seu ID na lista.
  const adicionarSala = async (listaId, salaId) => {
    const lista = listas.find((item) => item.id === listaId)
    if (!lista || !IDS_DAS_SALAS.includes(salaId)) return { ok: false, erro: 'Lista ou sala não encontrada.' }
    const salas = lista.room_ids.includes(salaId) ? lista.room_ids : [...lista.room_ids, salaId]
    return salvarLista(listaId, { room_ids: salas })
  }

  // Retira a sala da lista compartilhada.
  const removerSala = async (listaId, salaId) => {
    const lista = listas.find((item) => item.id === listaId)
    if (!lista) return { ok: false, erro: 'Lista não encontrada.' }
    return salvarLista(listaId, { room_ids: lista.room_ids.filter((id) => id !== salaId) })
  }

  return {
    favoritos, listas, carregando, salvando, erro,
    bloqueado: carregando || salvando || !carregou,
    aviso: leitura.aviso,
    atualizarListas, ehFavorita, alternarFavorito, criarLista,
    renomearLista, excluirLista, adicionarSala, removerSala,
  }
}
