export type ThemeName = "dark" | "light" | "dark-daltonized" | "light-daltonized" | "ansi" | "auto";

export interface Theme {
  name: string;
  text: string;
  subtle: string;
  muted: string;
  dim: string;
  inactive: string;
  background: string;
  primary: string;
  primaryLight: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  diffAdded: string;
  diffRemoved: string;
  diffContext: string;
  diffHunk: string;
  toolRunning: string;
  toolSuccess: string;
  toolError: string;
  border: string;
  spinner: string;
  cursor: string;
  prompt: string;
  permissionBorder: string;
  permissionLabel: string;
}

const DARK: Theme = {
  name: "dark",
  text: "#d0dcea",
  subtle: "#a0b4cc",
  muted: "#5a7a9a",
  dim: "#3d5a7a",
  inactive: "#2d3d52",
  background: "#1a2744",
  primary: "#4a7cc9",
  primaryLight: "#7ba4d9",
  success: "#4caf50",
  error: "#e05252",
  warning: "#f5a623",
  info: "#4a7cc9",
  diffAdded: "#4caf50",
  diffRemoved: "#e05252",
  diffContext: "gray",
  diffHunk: "cyan",
  toolRunning: "#f5a623",
  toolSuccess: "#4caf50",
  toolError: "#e05252",
  border: "#3d5a7a",
  spinner: "#f5a623",
  cursor: "gray",
  prompt: "#4a7cc9",
  permissionBorder: "#f5a623",
  permissionLabel: "#f5a623",
};

const LIGHT: Theme = {
  name: "light",
  text: "#1a2744",
  subtle: "#3d5a7a",
  muted: "#5a7a9a",
  dim: "#8a9ab0",
  inactive: "#c0ccd8",
  background: "#f5f7fa",
  primary: "#2d5aa0",
  primaryLight: "#4a7cc9",
  success: "#2e7d32",
  error: "#c62828",
  warning: "#e65100",
  info: "#2d5aa0",
  diffAdded: "#2e7d32",
  diffRemoved: "#c62828",
  diffContext: "gray",
  diffHunk: "cyan",
  toolRunning: "#e65100",
  toolSuccess: "#2e7d32",
  toolError: "#c62828",
  border: "#8a9ab0",
  spinner: "#e65100",
  cursor: "gray",
  prompt: "#2d5aa0",
  permissionBorder: "#e65100",
  permissionLabel: "#e65100",
};

const DARK_DALTONIZED: Theme = {
  ...DARK,
  name: "dark-daltonized",
  success: "#56b4e9",
  error: "#d55e00",
  diffAdded: "#56b4e9",
  diffRemoved: "#d55e00",
  toolSuccess: "#56b4e9",
  toolError: "#d55e00",
};

const LIGHT_DALTONIZED: Theme = {
  ...LIGHT,
  name: "light-daltonized",
  success: "#0072b2",
  error: "#d55e00",
  diffAdded: "#0072b2",
  diffRemoved: "#d55e00",
  toolSuccess: "#0072b2",
  toolError: "#d55e00",
};

const ANSI: Theme = {
  name: "ansi",
  text: "white",
  subtle: "white",
  muted: "gray",
  dim: "gray",
  inactive: "gray",
  background: "black",
  primary: "blue",
  primaryLight: "blueBright",
  success: "green",
  error: "red",
  warning: "yellow",
  info: "blue",
  diffAdded: "green",
  diffRemoved: "red",
  diffContext: "gray",
  diffHunk: "cyan",
  toolRunning: "yellow",
  toolSuccess: "green",
  toolError: "red",
  border: "gray",
  spinner: "yellow",
  cursor: "gray",
  prompt: "blue",
  permissionBorder: "yellow",
  permissionLabel: "yellow",
};

export const THEMES: Record<string, Theme> = {
  dark: DARK,
  light: LIGHT,
  "dark-daltonized": DARK_DALTONIZED,
  "light-daltonized": LIGHT_DALTONIZED,
  ansi: ANSI,
};

export function getTheme(name: ThemeName | string): Theme {
  if (name === "auto") {
    const colorfgbg = process.env.COLORFGBG;
    if (colorfgbg) {
      const bg = parseInt(colorfgbg.split(";").pop() ?? "0", 10);
      return bg > 8 ? LIGHT : DARK;
    }
    return DARK;
  }
  return THEMES[name] ?? DARK;
}

export function resolveThemeColor(colorOrKey: string, theme: Theme): string {
  if (colorOrKey.startsWith("#") || colorOrKey.startsWith("rgb")) return colorOrKey;
  return (theme as unknown as Record<string, string>)[colorOrKey] ?? colorOrKey;
}

export function listThemes(): string[] {
  return Object.keys(THEMES);
}
