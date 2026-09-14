import fs from 'node:fs'
import 'dotenv/config'

const LOG_FILE = process.env.LOG_PATH ?? '';

export interface VoxPlayer {
    id: string;
    name: string;
    character: string;
}

export function getPlayers(): VoxPlayer[] {
    const content = fs.readFileSync(LOG_FILE, "utf8");

    const lines = content.split(/\r?\n/);

    // หา c_listallplayers() ล่าสุด
    let commandIndex = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
        if (
            lines[i].includes('RemoteCommandInput: "c_listallplayers()"')
        ) {
            commandIndex = i;
            break;
        }
    }

    if (commandIndex === -1) {
        return [];
    }

    const players: VoxPlayer[] = [];

    // อ่านบรรทัดหลังคำสั่ง
    for (let i = commandIndex + 1; i < lines.length; i++) {
        const line = lines[i];

        const match = line.match(
            /^\[\d{2}:\d{2}:\d{2}\]: \[(\d+)\] \(([^)]+)\) (.+) <([^>]+)>\s*$/
        );

        if (!match) {
            break;
        }

        players.push({
            id: match[2],
            name: match[3],
            character: match[4],
        });
    }

    return players;
}

export interface VoxStatus {
    season: string;
    day: number;
    phase: string;
}

export function getStatus(): VoxStatus {
    const content = fs.readFileSync(LOG_FILE, "utf8");

    const lines = content.split(/\r?\n/);

    let season = "unknown";
    let day = 0;
    let phase = "unknown";

    for (let i = lines.length - 1; i >= 0; i--) {
        const seasonMatch = lines[i].match(
            /^\[\d{2}:\d{2}:\d{2}\]: (autumn|winter|spring|summer) /
        );

        if (seasonMatch) {
            season = seasonMatch[1];
            break;
        }
    }

    for (let i = lines.length - 1; i >= 0; i--) {
        const phaseMatch = lines[i].match(
            /^\[\d{2}:\d{2}:\d{2}\]: Current phase: (day|dusk|night)\s*$/
        );

        if (phaseMatch) {
            phase = phaseMatch[1];
            break;
        }
    }

    for (let i = lines.length - 1; i >= 0; i--) {
        const dayMatch = lines[i].match(
            /^\[\d{2}:\d{2}:\d{2}\]: Current day: (\d+)\s*$/
        );

        if (dayMatch) {
            day = Number(dayMatch[1]);
            break;
        }
    }

    return {
        season,
        day,
        phase,
    };
}

// console.log("Status:", getStatus());