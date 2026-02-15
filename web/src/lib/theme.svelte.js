import { browser } from "$app/environment";

let theme = $state("system");

export function getTheme() {
  return theme;
}

/** @param {string} newTheme */
export function setTheme(newTheme) {
  theme = newTheme;
  if (browser) {
    localStorage.setItem("theme", newTheme);
    updateDocumentClass();
  }
}

export function initTheme() {
  if (browser) {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) {
      theme = storedTheme;
    } else {
      theme = "system";
    }
    updateDocumentClass();

    // Listen for system changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (theme === "system") updateDocumentClass();
    });
  }
}

function updateDocumentClass() {
  if (!browser) return;

  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
