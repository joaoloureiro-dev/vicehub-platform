--[[
    ViceHub — o lado do servidor.

    Bate à porta da plataforma de minuto a minuto a dizer que está de pé
    e com quantas pessoas dentro. É o que faz o "online" do diretório
    passar de uma marca que alguém liga à mão para um facto que expira
    sozinho.

    Configuração, no server.cfg:

        set vicehub_key "vh_<prefixo>_<segredo>"
        set vicehub_url "https://vicehub.example/api/v1"   # opcional

    A chave sai do ecrã do servidor no ViceHub, e aparece **uma vez**.
    Guarda-a no server.cfg e não em lado nenhum público: quem a tiver
    pode dizer mentiras sobre este servidor.
]]

--- De quanto em quanto tempo se reporta.
--
-- A plataforma considera um servidor online durante cinco minutos
-- depois do último sinal. Sessenta segundos deixam falhar quatro
-- seguidos sem que o servidor desapareça do diretório por causa de um
-- soluço na rede.
local INTERVALO_MS = 60 * 1000

--- Quanto se espera depois de uma falha, e até onde isso cresce.
--
-- Insistir de segundo a segundo contra uma plataforma em baixo não a
-- levanta mais depressa — só enche os logs de toda a gente. O tempo
-- duplica a cada falha até um teto, e volta ao normal ao primeiro
-- sucesso.
local RECUO_INICIAL_MS = 5 * 1000
local RECUO_MAXIMO_MS = 5 * 60 * 1000

local URL_POR_OMISSAO = 'https://vicehub.gg/api/v1'

--- Estado de quem está a falhar, para não repetir o mesmo aviso.
local recuoAtual = 0
local ultimoErro = nil

local function config(nome, porOmissao)
    local valor = GetConvar(nome, porOmissao or '')

    if valor == '' then
        return nil
    end

    return valor
end

--- Quantas pessoas estão dentro, neste momento.
local function jogadoresOnline()
    return #GetPlayers()
end

--[[
    Diz o que correu mal — uma vez por tipo de falha.

    Um servidor mal configurado ficaria a escrever a mesma linha de
    minuto a minuto durante dias. Repetir o aviso só quando ele muda
    mantém o log legível sem esconder o problema.
]]
local function avisar(mensagem)
    if ultimoErro == mensagem then
        return
    end

    ultimoErro = mensagem
    print(('[ViceHub] %s'):format(mensagem))
end

local function acertou()
    if ultimoErro ~= nil then
        print('[ViceHub] A reportar outra vez.')
    end

    ultimoErro = nil
    recuoAtual = 0
end

local function falhou(mensagem)
    avisar(mensagem)

    if recuoAtual == 0 then
        recuoAtual = RECUO_INICIAL_MS
    else
        recuoAtual = math.min(recuoAtual * 2, RECUO_MAXIMO_MS)
    end
end

--[[
    Manda um sinal.

    O corpo leva apenas a contagem: **o identificador do servidor não
    vai aqui**. Quem o decide é a chave, do lado da plataforma — se
    viesse no corpo, uma chave podia reportar pelo servidor de outra
    pessoa.
]]
local function reportar(url, chave)
    local corpo = json.encode({ playersOnline = jogadoresOnline() })

    PerformHttpRequest(
        url .. '/ingest/heartbeat',
        function(estado, _texto, _cabecalhos)
            if estado == 200 then
                acertou()
            elseif estado == 401 then
                falhou(
                    'A chave foi recusada. Confirma o vicehub_key no server.cfg — se a revogaste, cria outra no ecrã do servidor.'
                )
            elseif estado == 0 then
                falhou('Não foi possível falar com o ViceHub. A tentar mais tarde.')
            else
                falhou(('O ViceHub respondeu %d. A tentar mais tarde.'):format(estado))
            end
        end,
        'POST',
        corpo,
        {
            ['Content-Type'] = 'application/json',
            ['Authorization'] = 'Bearer ' .. chave,
        }
    )
end

--[[
    Confirma, ao arrancar, que a chave é do servidor que se pensa.

    Sem isto, uma chave colada do servidor errado passava despercebida
    até alguém reparar que o outro servidor estava sempre online.
]]
local function apresentar(url, chave)
    PerformHttpRequest(
        url .. '/ingest/me',
        function(estado, texto, _cabecalhos)
            if estado ~= 200 then
                return
            end

            local ok, corpo = pcall(json.decode, texto)

            if ok and corpo and corpo.name then
                print(('[ViceHub] Ligado como "%s".'):format(corpo.name))
            end
        end,
        'GET',
        '',
        { ['Authorization'] = 'Bearer ' .. chave }
    )
end

CreateThread(function()
    local chave = config('vicehub_key')
    local url = config('vicehub_url', URL_POR_OMISSAO)

    --[[
        Sem chave não se tenta nada. Um recurso que fica a bater à porta
        sem credenciais enche os logs de 401 e não reporta na mesma —
        mais vale dizer uma vez o que falta e ficar quieto.
    ]]
    if chave == nil then
        print(
            '[ViceHub] Sem vicehub_key no server.cfg. Cria uma chave no ecrã do teu servidor no ViceHub e põe-na lá.'
        )
        return
    end

    -- Barras a mais no fim dariam um endereço com "//ingest".
    url = url:gsub('/+$', '')

    apresentar(url, chave)

    while true do
        reportar(url, chave)

        Wait(INTERVALO_MS + recuoAtual)
    end
end)
