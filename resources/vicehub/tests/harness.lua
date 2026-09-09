--[[
    Um FiveM de mentira, só com o que o recurso usa.

    Existe porque a alternativa era não verificar nada: o recurso só
    corre dentro do jogo, e o que aqui se quer provar — o que vai no
    corpo, o que acontece quando a plataforma recusa a chave, quanto se
    espera antes de tentar outra vez — não precisa de jogo nenhum.

    Os pedidos ficam guardados em `pedidos` para o teste os ler, e as
    respostas saem de uma fila que o teste enche.
]]

local M = {}

M.pedidos = {}
M.respostas = {}
M.logs = {}
M.convars = {}
M.jogadores = {}
M.esperas = {}

--- O relógio não passa: cada Wait fica registado e devolve o controlo.
local aCorrer = nil
local voltas = 0
local voltasMaximas = 0

function M.reset()
    M.pedidos = {}
    M.respostas = {}
    M.logs = {}
    M.convars = {}
    M.jogadores = {}
    M.esperas = {}
    voltas = 0
end

_G.GetConvar = function(nome, porOmissao)
    return M.convars[nome] or porOmissao
end

_G.GetPlayers = function()
    return M.jogadores
end

--- O print verdadeiro, para o teste poder escrever o que encontrou.
M.escrever = print

_G.print = function(mensagem)
    table.insert(M.logs, mensagem)
end

_G.json = {
    encode = function(tabela)
        --[[
            Chega para o que o recurso manda: uma tabela rasa de
            números e cadeias. Um codificador a sério aqui seria
            código de teste a testar-se a si próprio.
        ]]
        local partes = {}

        for chave, valor in pairs(tabela) do
            local escrito

            if type(valor) == 'number' then
                escrito = tostring(valor)
            else
                escrito = ('"%s"'):format(tostring(valor))
            end

            table.insert(partes, ('"%s":%s'):format(chave, escrito))
        end

        return '{' .. table.concat(partes, ',') .. '}'
    end,
    decode = function(texto)
        --- Só se usa para ler o nome do servidor no /ingest/me.
        local nome = texto:match('"name"%s*:%s*"([^"]*)"')

        return { name = nome }
    end,
}

_G.PerformHttpRequest = function(url, callback, metodo, corpo, cabecalhos)
    table.insert(M.pedidos, {
        url = url,
        metodo = metodo,
        corpo = corpo,
        cabecalhos = cabecalhos,
    })

    local resposta = table.remove(M.respostas, 1) or { estado = 200, texto = '{}' }

    callback(resposta.estado, resposta.texto or '', {})
end

--- O ciclo do recurso é infinito; o teste diz quantas voltas quer.
_G.Wait = function(ms)
    table.insert(M.esperas, ms)

    voltas = voltas + 1

    if voltas >= voltasMaximas then
        error('__paragem__', 0)
    end
end

_G.CreateThread = function(fn)
    aCorrer = fn
end

--- Corre o recurso até ter dado `quantas` voltas ao ciclo.
function M.correr(quantas)
    voltas = 0
    voltasMaximas = quantas

    dofile(M.caminhoDoRecurso)

    if aCorrer then
        local ok, erro = pcall(aCorrer)

        if not ok and not tostring(erro):find('__paragem__') then
            error(erro)
        end
    end
end

return M
