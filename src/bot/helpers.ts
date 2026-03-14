import type { SafeSniperContext } from "./types";

export function getUserId(ctx: SafeSniperContext): string | undefined {
  return ctx.from ? String(ctx.from.id) : undefined;
}

export function isAllowedUser(ctx: SafeSniperContext, allowedUserIds: string[]): boolean {
  if (allowedUserIds.length === 0) {
    return true;
  }

  const userId = getUserId(ctx);
  return Boolean(userId && allowedUserIds.includes(userId));
}

export function isSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

export async function replyOrEdit(ctx: SafeSniperContext, text: string, extra?: any): Promise<void> {
  try {
    if ("callbackQuery" in ctx.update) {
      await ctx.editMessageText(text, extra);
      return;
    }
  } catch {
    // Fall through to regular reply when message editing is unavailable.
  }

  await ctx.reply(text, extra);
}
