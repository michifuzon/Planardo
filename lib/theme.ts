export function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem("planardo-theme") === "light" ? "light" : "dark";
}

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("light", theme === "light");
  localStorage.setItem("planardo-theme", theme);
}
