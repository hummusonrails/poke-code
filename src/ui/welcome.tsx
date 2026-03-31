import { Box, Text } from "ink";

interface WelcomeProps {
  version: string;
  cwd: string;
  recentSessions: { id: string; lastActiveAt: string; cwd: string }[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "it's late, let's ship";
  if (hour < 12) return "yo, let's build something";
  if (hour < 18) return "yo, what are we working on?";
  return "yo, evening session — let's go";
}

// Poke brand colors (from the app's dark navy theme)
const POKE = {
  navy: "#1a2744",
  blue: "#4a7cc9",
  lightBlue: "#7ba4d9",
  muted: "#5a7a9a",
  dim: "#3d5a7a",
  white: "#d0dcea",
};

const PALM_TREE = [
  "        _  _",
  "      _( \\/ )_",
  "     / _\\  /_ \\",
  "    (  / \\/ \\  )",
  "     \\_\\ /\\_/",
  "       \\/ /",
  "        | |",
  "        | |",
  "        |_|",
];

export function Welcome({ version, cwd, recentSessions }: WelcomeProps) {
  const greeting = getGreeting();
  const shortCwd = cwd.replace(process.env.HOME ?? "", "~");

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Header line */}
      <Box>
        <Text color={POKE.dim}>{"─── "}</Text>
        <Text color={POKE.blue} bold>
          Poke Code
        </Text>
        <Text color={POKE.dim}>
          {" v"}
          {version}
        </Text>
        <Text color={POKE.dim}>{" ───────────────────────────────────────────────"}</Text>
      </Box>

      <Box flexDirection="row" gap={1} marginTop={1}>
        {/* Left panel: branding + greeting */}
        <Box flexDirection="column" borderStyle="round" borderColor={POKE.dim} paddingX={3} paddingY={1} width={38}>
          {/* Palm tree */}
          {PALM_TREE.map((line, i) => (
            <Text key={`palm-${i}`} color={POKE.lightBlue}>
              {line}
            </Text>
          ))}
          <Text> </Text>
          <Text color={POKE.white} bold>
            {" "}
            {greeting}
          </Text>
          <Text> </Text>
          <Text color={POKE.muted}> Powered by Poke</Text>
          <Text color={POKE.muted}> {shortCwd}</Text>
        </Box>

        {/* Right panel: capabilities + tips */}
        <Box flexDirection="column" flexGrow={1}>
          {/* Poke capabilities */}
          <Box flexDirection="column" borderStyle="round" borderColor={POKE.dim} paddingX={2} paddingY={1}>
            <Text color={POKE.blue} bold>
              Tools (local execution)
            </Text>
            <Text color={POKE.white}> read_file Read files with line numbers</Text>
            <Text color={POKE.white}> write_file Create or overwrite files</Text>
            <Text color={POKE.white}> edit_file Inline string replacement</Text>
            <Text color={POKE.white}> bash Execute shell commands</Text>
            <Text color={POKE.white}> glob Find files by pattern</Text>
            <Text color={POKE.white}> grep Search file contents</Text>
            <Text color={POKE.white}> list_dir List directory contents</Text>
          </Box>

          {/* Quick start */}
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={POKE.dim}
            paddingX={2}
            paddingY={1}
            marginTop={0}
          >
            <Text color={POKE.blue} bold>
              Getting started
            </Text>
            <Text color={POKE.muted}> Tools execute locally, results sent to Poke</Text>
            <Text color={POKE.muted}> Type a message to send to Poke</Text>
            <Text color={POKE.muted}> /help show all commands</Text>
            <Text color={POKE.muted}> /apikey update your API key</Text>
          </Box>

          {/* Recent sessions */}
          {recentSessions.length > 0 && (
            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor={POKE.dim}
              paddingX={2}
              paddingY={1}
              marginTop={0}
            >
              <Text color={POKE.blue} bold>
                Recent activity
              </Text>
              {recentSessions.slice(0, 3).map((s) => (
                <Text key={s.id} color={POKE.muted}>
                  {"  "}
                  {s.lastActiveAt.slice(0, 10)} {s.cwd.replace(process.env.HOME ?? "", "~")}
                </Text>
              ))}
              <Text color={POKE.dim}> /resume for more</Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
