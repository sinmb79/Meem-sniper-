export function shortenAddress(address?: string, head = 4, tail = 4): string {
  if (!address) {
    return "-";
  }
  if (address.length <= head + tail) {
    return address;
  }
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

export function formatSol(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(4)} SOL`;
}

export function formatPercent(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return "-";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatUsd(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return "-";
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(4)}`;
}

export function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
