import { useState } from 'react'
import Icone from './Icone.jsx'

// Permite incluir ou retirar a sala das listas.
const SeletorListas = ({ sala, listas, onAdicionar, onRemover, onCriar, onFechar, bloqueado, carregando }) => {
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState(null)

  // Cria uma lista e já inclui a sala selecionada.
  const criar = async (evento) => {
    evento.preventDefault()
    setErro(null)
    // A sala vai no mesmo pedido para não deixar uma criação pela metade.
    const resposta = await onCriar(nome, sala.id)
    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }
    setNome('')
    setErro(null)
  }

  // Aguarda a mudança da sala na lista e mostra possíveis erros.
  const alternar = async (lista, marcada) => {
    const resposta = marcada
      ? await onRemover(lista.id, sala.id)
      : await onAdicionar(lista.id, sala.id)
    setErro(resposta.ok ? null : resposta.erro)
  }

  return (
    <div className="rounded-md border border-regua bg-moldura p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-tinta">Listas com a {sala.nome}</p>
        <button
          type="button"
          onClick={onFechar}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-tinta-2 hover:text-tinta"
        >
          <Icone nome="fechar" tamanho={15} />
          Fechar
        </button>
      </div>

      {listas.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {listas.map((lista) => {
            const marcada = lista.room_ids.includes(sala.id)
            return (
              <li key={lista.id}>
                <label
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors duration-150 ${
                    marcada ? 'border-tinta/60 bg-placa-alta text-tinta' : 'border-regua text-tinta-2 hover:border-regua-forte'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    disabled={bloqueado}
                    onChange={() => alternar(lista, marcada)}
                    className="size-4 accent-[var(--color-tinta)]"
                  />
                  {lista.name}
                </label>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-tinta-3">
          {carregando ? 'Carregando listas...' : bloqueado ? 'Atualize as listas na seção Minhas listas para tentar novamente.' : 'Você ainda não tem listas. Crie a primeira e esta sala já entra nela.'}
        </p>
      )}

      <form onSubmit={criar} className="mt-3 flex flex-wrap items-start gap-2">
        <label className="sr-only" htmlFor={`nova-lista-${sala.id}`}>
          Nome da nova lista
        </label>
        <input
          id={`nova-lista-${sala.id}`}
          value={nome}
          disabled={bloqueado}
          onChange={(evento) => setNome(evento.target.value)}
          placeholder="Nova lista, ex.: Grupo de quinta"
          maxLength={60}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `erro-lista-${sala.id}` : undefined}
          className="h-9 min-w-0 flex-1 rounded-md border border-regua bg-noite px-2.5 text-sm text-tinta placeholder:text-tinta-3 focus:border-tinta-2 sm:max-w-64"
        />
        <button
          type="submit"
          disabled={bloqueado}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-regua-forte px-3 text-sm font-medium text-tinta hover:bg-placa-alta"
        >
          <Icone nome="mais" tamanho={15} />
          Criar e adicionar
        </button>
        {erro && (
          <p id={`erro-lista-${sala.id}`} role="alert" className="w-full text-sm text-critico">
            {erro}
          </p>
        )}
      </form>
    </div>
  )
}

export default SeletorListas
