--[[
    O recurso, corrido contra um runtime de mentira.

    O que se quer provar é o que só se veria num servidor a sério: o que
    vai no corpo, o que acontece quando a chave é recusada, e que um
    servidor mal configurado não fica a encher o log.
]]

local harness = dofile('resources/vicehub/tests/harness.lua')

--- O recurso escreve no log capturado; o teste escreve no ecrã.
local escrever = harness.escrever

harness.caminhoDoRecurso = 'resources/vicehub/server.lua'

local falhas = 0
local total = 0

local function verificar(nome, condicao, detalhe)
    total = total + 1

    if condicao then
        escrever(('  ok   %s'):format(nome))
    else
        falhas = falhas + 1
        escrever(('  FALHA %s%s'):format(nome, detalhe and (' — ' .. detalhe) or ''))
    end
end

local function comChave()
    harness.reset()
    harness.convars['vicehub_key'] = 'vh_abc123_um-segredo'
    harness.convars['vicehub_url'] = 'http://localhost:3000/api/v1'
end

local function pedidoDeHeartbeat()
    for _, pedido in ipairs(harness.pedidos) do
        if pedido.url:find('/ingest/heartbeat') then
            return pedido
        end
    end

    return nil
end

escrever('o recurso do ViceHub')

--[[ Sem chave, não se tenta nada. ]]
harness.reset()
harness.correr(1)

verificar(
    'sem chave, não faz pedido nenhum',
    #harness.pedidos == 0,
    ('fez %d'):format(#harness.pedidos)
)
verificar(
    'sem chave, diz uma vez o que falta',
    #harness.logs == 1 and harness.logs[1]:find('vicehub_key') ~= nil,
    harness.logs[1]
)

--[[ Com chave: apresenta-se e reporta. ]]
comChave()
harness.jogadores = { 1, 2, 3 }
harness.respostas = {
    { estado = 200, texto = '{"serverId":"s-1","name":"Vice City RP"}' },
    { estado = 200, texto = '{"ok":true}' },
}
harness.correr(1)

local heartbeat = pedidoDeHeartbeat()

verificar('apresenta-se ao arrancar', harness.pedidos[1].url:find('/ingest/me') ~= nil)
verificar(
    'diz o nome do servidor a que se ligou',
    harness.logs[1] and harness.logs[1]:find('Vice City RP') ~= nil,
    harness.logs[1]
)
verificar('reporta por POST', heartbeat ~= nil and heartbeat.metodo == 'POST')
verificar(
    'manda a contagem de quem está dentro',
    heartbeat ~= nil and heartbeat.corpo == '{"playersOnline":3}',
    heartbeat and heartbeat.corpo
)
verificar(
    'manda a chave no cabeçalho',
    heartbeat ~= nil
        and heartbeat.cabecalhos['Authorization'] == 'Bearer vh_abc123_um-segredo'
)

--[[
    O identificador do servidor **não** vai no corpo: quem o decide é a
    chave, do outro lado. Se fosse daqui, uma chave podia reportar pelo
    servidor de outra pessoa.
]]
verificar(
    'não manda identificador de servidor nenhum',
    heartbeat ~= nil and heartbeat.corpo:find('serverId') == nil,
    heartbeat and heartbeat.corpo
)

--[[ Um servidor vazio reporta zero, e não deixa de reportar. ]]
comChave()
harness.jogadores = {}
harness.respostas = { { estado = 200 }, { estado = 200 } }
harness.correr(1)

verificar(
    'um servidor vazio reporta zero',
    pedidoDeHeartbeat().corpo == '{"playersOnline":0}',
    pedidoDeHeartbeat().corpo
)

--[[ A chave recusada tem de dizer o que fazer, e uma vez só. ]]
comChave()
harness.respostas = {
    { estado = 200 },
    { estado = 401 },
    { estado = 401 },
    { estado = 401 },
}
harness.correr(3)

local avisos = 0

for _, linha in ipairs(harness.logs) do
    if linha:find('chave foi recusada') then
        avisos = avisos + 1
    end
end

verificar('a chave recusada diz o que fazer', avisos >= 1)
verificar(
    'e não repete o aviso a cada minuto',
    avisos == 1,
    ('disse %d vezes'):format(avisos)
)

--[[
    Falhar afasta as tentativas, e acertar volta a aproximá-las. Sem
    isto, uma plataforma em baixo levava com um pedido por segundo de
    cada servidor que a usasse.
]]
comChave()
harness.respostas = {
    { estado = 200 },
    { estado = 0 },
    { estado = 0 },
    { estado = 200 },
}
harness.correr(3)

verificar(
    'a primeira falha afasta a tentativa seguinte',
    harness.esperas[1] > harness.esperas[3],
    ('%d depois de falhar, %d depois de acertar'):format(
        harness.esperas[1],
        harness.esperas[3]
    )
)
verificar(
    'e a segunda afasta-a mais',
    harness.esperas[2] > harness.esperas[1],
    ('%d e depois %d'):format(harness.esperas[1], harness.esperas[2])
)
verificar(
    'acertar volta a pôr o ritmo normal',
    harness.esperas[3] == 60000,
    tostring(harness.esperas[3])
)

--[[ Barras a mais no endereço dariam "//ingest". ]]
harness.reset()
harness.convars['vicehub_key'] = 'vh_abc123_um-segredo'
harness.convars['vicehub_url'] = 'http://localhost:3000/api/v1///'
harness.respostas = { { estado = 200 }, { estado = 200 } }
harness.correr(1)

verificar(
    'aguenta barras a mais no endereço',
    pedidoDeHeartbeat().url == 'http://localhost:3000/api/v1/ingest/heartbeat',
    pedidoDeHeartbeat().url
)

escrever(('\n%d verificações, %d falhas'):format(total, falhas))

if falhas > 0 then
    os.exit(1)
end
