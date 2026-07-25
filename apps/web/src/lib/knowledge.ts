export const MAX_KNOWLEDGE_FILE_BYTES = 500 * 1024; // 500 KB
export const ALLOWED_KNOWLEDGE_EXTENSIONS = [".txt", ".md"];

// How much of each attached source's text gets included in a chat prompt.
// Direct context inclusion, not vector search — see the AI Chat / Knowledge
// Base phase notes in the README for why.
export const MAX_CHARS_PER_SOURCE_IN_PROMPT = 4000;
export const MAX_TOTAL_KNOWLEDGE_CHARS_IN_PROMPT = 12000;

export function isAllowedKnowledgeFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return ALLOWED_KNOWLEDGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
