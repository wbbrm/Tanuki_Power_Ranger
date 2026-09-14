import { Message } from "discord.js";
import { getStatus } from "../vox/VoxLog.js";
import { getPlayers } from "../vox/VoxLog.js";
import { getClusterConfig } from "../vox/ClusterConfig.js";

export async function handleStatus(message: Message) {
  const status = getStatus();
  const cluster = getClusterConfig();

  await message.reply(
    `🌍 **Server ${cluster.clusterName ?? 'Unknown'} Status**\n` +
    `🔒 Password: ${cluster.clusterPassword ?? 'Unknown'}\n` +
    `👥 Players: ${getPlayers().length ?? 'Unknown'} / ${cluster.maxPlayers ?? 'Unknown'}\n` +
    `🌦️ Season: ${status.season ?? 'Unknown'}\n` +
    `📅 Day: ${status.day ?? 'Unknown'}\n` +
    `🌙 Phase: ${status.phase ?? 'Unknown'}`
  );
}