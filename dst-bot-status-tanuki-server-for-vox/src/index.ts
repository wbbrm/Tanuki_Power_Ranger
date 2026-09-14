
import { Client, GatewayIntentBits } from "discord.js";
import { getPlayers } from "./vox/VoxLog.js";
import { handlePlayers } from "./commands/players.js";
import { handleStatus } from "./commands/status.js";
import { getClusterConfig } from "./vox/ClusterConfig.js";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once("ready", () => {

    console.log(`Bot is online as ${client.user?.tag}`);

    const players = getPlayers();

    // console.log("Players:", players);

    const cluster = getClusterConfig();

    // console.log("Cluster Name:", cluster.clusterName);
    // console.log("Cluster Password:", cluster.clusterPassword);
    // console.log("Game Mode:", cluster.gameMode);
    // console.log("Max Players:", cluster.maxPlayers);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.content === "!players") {
        await handlePlayers(message);
    }

    if (message.content === "!status") {
        await handleStatus(message);
    }
});


const token = process.env.DISCORD_TOKEN;

if (!token) {
    throw new Error("DISCORD_TOKEN is missing in .env");
}

client.login(token);