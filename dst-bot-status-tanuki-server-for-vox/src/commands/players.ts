import { Message } from "discord.js";
import { getPlayers } from "../vox/VoxLog.js";

export async function handlePlayers(message: Message) {
  const players = getPlayers();

  if (players.length === 0) {
    await message.reply("👥 No player");
    return;
  }

  const playerList = players
    .map(
      (player, index) =>
        `${index + 1}. ${player.name} — ${player.character}`
    )
    .join("\n");

  await message.reply(
    `👥 **Players (${players.length})**\n${playerList}`
  );
}