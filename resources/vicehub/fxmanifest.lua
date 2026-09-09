fx_version 'cerulean'
game 'gta5'

name 'vicehub'
description 'Reporta o servidor ao ViceHub: se está de pé, e com quantas pessoas dentro.'
author 'ViceHub'
version '0.1.0'

--[[
    Só do lado do servidor, e de propósito.

    A chave é um segredo do servidor. Um script de cliente é código que
    corre na máquina de quem joga, e tudo o que lá esteja é legível por
    quem quiser — pôr a chave desse lado seria entregá-la a toda a gente
    que entrasse.
]]
server_script 'server.lua'
