import 'dotenv/config'

import {
    Client,
    GatewayIntentBits,
} from 'discord.js'

import { DST } from './dst.js'

const token =
    process.env.DISCORD_TOKEN

if (!token) {

    throw new Error(
        'DISCORD_TOKEN is missing from .env',
    )
}

const client =
    new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    })

const dst =
    new DST()

client.once(
    'ready',
    client => {

        console.log(
            '================================',
        )

        console.log(
            `Bot online: ${client.user.tag}`,
        )

        console.log(
            '================================',
        )

        dst.start()
    },
)

client.on(
    'messageCreate',
    async message => {

        if (message.author.bot) {
            return
        }

        if (
            message.content === '!test'
        ) {

            await message.reply(
                '✅ Bot ใหม่ทำงานแล้ว!',
            )

            return
        }

        if (
            message.content === '!status'
        ) {

            try {

                const status =
                    await dst.requestStatus()

                const players =
                    status.players.length > 0
                        ? status.players
                            .map(
                                p =>
                                    `• ${p.name} <${p.character}>`,
                            )
                            .join('\n')
                        : 'ไม่มีผู้เล่น'

                await message.reply(
                    [
                        '🌍 **DST Server Status**',
                        '',
                        `🌦️ Season: ${status.season ?? 'Unknown'}`,
                        `🌙 Phase: ${status.phase ?? 'Unknown'}`,
                        `👥 Players: ${status.players.length}`,
                        '',
                        players,
                    ].join('\n'),
                )

            } catch (error) {

                console.error(
                    '[STATUS ERROR]',
                    error,
                )

                await message.reply(
                    '❌ ไม่สามารถดึงสถานะ DST ได้',
                )
            }

            return
        }
    },
)

client.login(token)