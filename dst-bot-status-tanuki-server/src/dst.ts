import fs from 'node:fs'
import 'dotenv/config'
import { spawn } from 'node:child_process'

const SERVER_LOG = process.env.LOG_PATH ?? ''

if (!SERVER_LOG) {
    throw new Error(
        'LOG_PATH is missing from .env',
    )
}

const SEND_SCRIPT = 'send-dst-command.ps1'

const RESPONSE_TIMEOUT = 5000
const RESPONSE_SETTLE = 250

export interface DSTStatus {
    season: string | null
    phase: string | null
    players: {
        id: string
        name: string
        character: string
    }[]
}

interface PendingRequest {
    worldMarker: number
    playerMarker: number

    season: string | null
    phase: string | null
    players: DSTStatus['players']

    worldReceived: boolean

    resolve: (status: DSTStatus) => void
    reject: (error: Error) => void

    timeout: NodeJS.Timeout
    settleTimer?: NodeJS.Timeout
}

export class DST {

    private lastPosition = 0

    private pending: PendingRequest | null = null

    start(): void {

        if (!fs.existsSync(SERVER_LOG)) {

            console.error(
                'DST server_log.txt not found:',
            )

            console.error(SERVER_LOG)

            return
        }

        const stat = fs.statSync(SERVER_LOG)

        // เริ่มอ่านเฉพาะ log ใหม่
        this.lastPosition = stat.size

        console.log('DST log watcher started')
        console.log(`Watching: ${SERVER_LOG}`)

        setInterval(() => {

            this.readNewLog()

        }, 250)
    }

    async requestStatus(): Promise<DSTStatus> {

        if (this.pending) {

            throw new Error(
                'A status request is already running.',
            )
        }

        const processId =
            await this.findOverworldProcess()

        if (!processId) {

            throw new Error(
                'Overworld DST process not found.',
            )
        }

        /*
         * ใช้ตัวเลข marker ที่ไม่ซ้ำกัน
         *
         * ไม่ต้องใช้ string เพราะตัว injector
         * ที่เราทำไว้มีปัญหากับ "
         */

        const requestId =
            Date.now() % 1000000

        const worldMarker =
            900000000 + requestId

        const playerMarker =
            910000000 + requestId

        return new Promise(
            (resolve, reject) => {

                const timeout =
                    setTimeout(() => {

                        if (
                            this.pending?.worldMarker
                            !== worldMarker
                        ) {
                            return
                        }

                        this.pending = null

                        reject(
                            new Error(
                                'DST status response timeout.',
                            ),
                        )

                    }, RESPONSE_TIMEOUT)

                this.pending = {

                    worldMarker,
                    playerMarker,

                    season: null,
                    phase: null,
                    players: [],

                    worldReceived: false,

                    resolve,
                    reject,

                    timeout,
                }

                const command =
                    `print(${worldMarker},TheWorld.state.season,TheWorld.state.phase) for k,v in pairs(TheNet.GetClientTable(TheNet)) do print(${playerMarker},v.userid,v.name,v.prefab) end`

                console.log(
                    '[DST COMMAND]',
                    command,
                )

                this.sendCommand(
                    processId,
                    command,
                ).catch(error => {

                    if (
                        this.pending?.worldMarker
                        !== worldMarker
                    ) {
                        return
                    }

                    clearTimeout(timeout)

                    this.pending = null

                    reject(error)
                })
            },
        )
    }

    private sendCommand(
        processId: number,
        command: string,
    ): Promise<void> {

        return new Promise(
            (resolve, reject) => {

                const child =
                    spawn(
                        'powershell.exe',
                        [
                            '-NoProfile',
                            '-ExecutionPolicy',
                            'Bypass',
                            '-File',
                            SEND_SCRIPT,
                            '-ProcessId',
                            String(processId),
                            '-Command',
                            command,
                        ],
                        {
                            windowsHide: false,
                        },
                    )

                let stdout = ''
                let stderr = ''

                child.stdout.on(
                    'data',
                    data => {

                        stdout +=
                            data.toString()
                    },
                )

                child.stderr.on(
                    'data',
                    data => {

                        stderr +=
                            data.toString()
                    },
                )

                child.on(
                    'error',
                    error => {

                        reject(error)
                    },
                )

                child.on(
                    'close',
                    code => {

                        console.log(
                            '[DST SEND STDOUT]',
                            stdout.trim(),
                        )

                        if (stderr.trim()) {

                            console.error(
                                '[DST SEND STDERR]',
                                stderr.trim(),
                            )
                        }

                        if (code !== 0) {

                            reject(
                                new Error(
                                    stderr ||
                                    `send-dst-command.ps1 exited with code ${code}`,
                                ),
                            )

                            return
                        }

                        resolve()
                    },
                )
            },
        )
    }   

    private findOverworldProcess():
        Promise<number | null> {

        return new Promise(
            (resolve, reject) => {

                const command = `
$p = Get-CimInstance Win32_Process -Filter "name='dontstarve_dedicated_server_nullrenderer.exe'" |
    Where-Object {
        $_.CommandLine -like '*-conf_dir DoNotStarveTogether_EasyConfigOverworld*'
    }

if ($p) {
    $p[0].ProcessId
}
`

                const child =
                    spawn(
                        'powershell.exe',
                        [
                            '-NoProfile',
                            '-Command',
                            command,
                        ],
                        {
                            windowsHide: true,
                        },
                    )

                let stdout = ''
                let stderr = ''

                child.stdout.on(
                    'data',
                    data => {

                        stdout +=
                            data.toString()
                    },
                )

                child.stderr.on(
                    'data',
                    data => {

                        stderr +=
                            data.toString()
                    },
                )

                child.on(
                    'error',
                    error => {

                        reject(error)
                    },
                )

                child.on(
                    'close',
                    code => {

                        if (code !== 0) {

                            reject(
                                new Error(
                                    stderr ||
                                    'Failed to find Overworld process.',
                                ),
                            )

                            return
                        }

                        const match =
                            stdout.match(
                                /\d+/,
                            )

                        if (!match) {

                            resolve(null)

                            return
                        }

                        resolve(
                            Number(match[0]),
                        )
                    },
                )
            },
        )
    }

    private readNewLog(): void {

        if (!fs.existsSync(SERVER_LOG)) {
            return
        }

        const stat =
            fs.statSync(SERVER_LOG)

        /*
         * กรณี server restart
         * แล้ว log file ถูกสร้างใหม่
         */

        if (
            stat.size <
            this.lastPosition
        ) {

            this.lastPosition = 0
        }

        if (
            stat.size ===
            this.lastPosition
        ) {

            return
        }

        const buffer =
            Buffer.alloc(
                stat.size -
                this.lastPosition,
            )

        const fd =
            fs.openSync(
                SERVER_LOG,
                'r',
            )

        try {

            fs.readSync(
                fd,
                buffer,
                0,
                buffer.length,
                this.lastPosition,
            )

        } finally {

            fs.closeSync(fd)
        }

        this.lastPosition =
            stat.size

        const text =
            buffer.toString('utf8')

        console.log('[DST LOG]')
        console.log(text)

        this.parseLog(text)
    }

    private parseLog(text: string): void {

        const lines =
            text.split(/\r?\n/)

        for (const line of lines) {

            this.parseStatusResponse(
                line,
            )
        }
    }

    private parseStatusResponse(
        line: string,
    ): void {

        const pending =
            this.pending

        if (!pending) {
            return
        }

        /*
         * World response
         *
         * ตัวอย่าง:
         *
         * [02:43:22]&#58; 987654321   autumn   day
         */

        const worldMatch =
            line.match(
                /\]:\s*(\d+)\s+(\S+)\s+(\S+)\s*$/,
            )

        if (
            worldMatch &&
            Number(worldMatch[1])
            === pending.worldMarker
        ) {

            pending.season =
                worldMatch[2].toLowerCase()

            pending.phase =
                worldMatch[3].toLowerCase()

            pending.worldReceived =
                true

            console.log(
                '[DST STATUS]',
                pending.season,
                pending.phase,
            )

            this.scheduleComplete()

            return
        }

        /*
         * Player response
         *
         * ตัวอย่าง:
         *
         * [02:46:35]&#58; 987654323 KU_PiNgW6I5 moremore wurt
         */

        const playerMatch =
            line.match(
                /\]:\s*(\d+)\s+(\S+)\s+(.+?)\s*$/,
            )

        if (
            !playerMatch ||
            Number(playerMatch[1])
            !== pending.playerMarker
        ) {
            return
        }

        const userid =
            playerMatch[2]

        const rest =
            playerMatch[3].trim()

        /*
         * DST จะส่ง host มาด้วย:
         *
         * userid [Host]
         *
         * เราไม่เอา record นี้
         */

        if (
            rest === '[Host]'
        ) {
            return
        }

        const parts =
            rest.split(/\s+/)

        if (parts.length < 2) {
            return
        }

        /*
         * prefab อยู่ตัวสุดท้าย
         */

        const character =
            parts.pop()

        if (!character) {
            return
        }

        const name =
            parts.join(' ')

        if (!name) {
            return
        }

        pending.players.push({
            id: userid,
            name,
            character,
        })

        console.log(
            `[DST PLAYER] ${name} <${character}>`,
        )
    }

    private scheduleComplete(): void {

        const pending =
            this.pending

        if (!pending) {
            return
        }

        if (pending.settleTimer) {
            return
        }

        /*
         * รออีกนิดเพื่อให้ player lines
         * เข้ามาครบก่อนตอบ Discord
         */

        pending.settleTimer =
            setTimeout(() => {

                if (
                    this.pending !== pending
                ) {
                    return
                }

                clearTimeout(
                    pending.timeout,
                )

                this.pending = null

                pending.resolve({
                    season:
                        pending.season,

                    phase:
                        pending.phase,

                    players:
                        [...pending.players],
                })

            }, RESPONSE_SETTLE)
    }

    getStatus(): DSTStatus {

        return {
            season: null,
            phase: null,
            players: [],
        }
    }
}