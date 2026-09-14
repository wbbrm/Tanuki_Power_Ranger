import fs from "node:fs";

const CLUSTER_FILE = process.env.CLUSTER_PATH ?? '';

export interface ClusterConfig {
  maxPlayers: number;
  gameMode: string;
  clusterName: string;
  clusterPassword: string;
}

export function getClusterConfig(): ClusterConfig {
  const content = fs.readFileSync(CLUSTER_FILE, "utf8");

  const lines = content.split(/\r?\n/);
  const values: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      !trimmed ||
      trimmed.startsWith(";") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("[")
    ) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    values[key] = value;
  }

  return {
    maxPlayers: Number(values.max_players),
    gameMode: values.game_mode ?? "unknown",
    clusterName: values.cluster_name ?? "unknown",
    clusterPassword: values.cluster_password ?? "unknown",
  };
}