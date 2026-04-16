import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Escapes characters that are reserved in HTML for Telegram's HTML parse_mode.
 * We want to keep <b>, <i>, <a>, <code>, <pre> if the AI outputs them,
 * so we only escape characters that aren't part of those allowed tags.
 * A simpler approach is to escape EVERYTHING and let the AI NOT use tags,
 * OR use a regex to only escape characters outside of valid tags.
 *
 * For now, we'll provide a robust generic escape for when we want pure text.
 */
export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Robustly find the text content in a Gemini API response.
 * Handles cases where 'thought' or other parts appear before the text.
 */
export function extractGeminiText(resJson: any): string | null {
  const candidate = resJson.candidates?.[0];
  if (!candidate?.content?.parts) return null;
  
  // Find the first part that has a 'text' property
  const textPart = candidate.content.parts.find((p: any) => p.text !== undefined);
  return textPart?.text || null;
}

