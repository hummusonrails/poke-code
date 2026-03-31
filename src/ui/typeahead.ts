export interface CommandHint {
  name: string;
  description: string;
}

export function matchCommands(input: string, commands: CommandHint[]): CommandHint[] {
  if (!input.startsWith("/")) return [];
  const prefix = input.slice(1).toLowerCase();
  return commands.filter((cmd) => cmd.name.toLowerCase().startsWith(prefix));
}
