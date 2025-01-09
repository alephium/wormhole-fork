export const supportedLanguages = ["en", "id", "el", "de", "vi", "pt"] as const;

export type Language = (typeof supportedLanguages)[number];

export const languageOptions: Array<{ label: string; value: Language }> = [
  { label: "English", value: "en" },
  { label: "Bahasa Indonesia", value: "id" },
  { label: "Deutsch", value: "de" },
  { label: "Ελληνικά", value: "el" },
  { label: "Português", value: "pt" },
  { label: "Tiếng Việt", value: "vi" },
];
