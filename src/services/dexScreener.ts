import { fetchJson } from "../utils/http";
import type { TokenMarketSnapshot } from "../types";

interface DexScreenerResponse {
  pairs?: Array<{
    pairAddress?: string;
    url?: string;
    fdv?: number;
    marketCap?: number;
    liquidity?: { usd?: number };
    volume?: { h24?: number };
    priceUsd?: string;
    pairCreatedAt?: number;
    baseToken?: { symbol?: string; name?: string };
    txns?: { h24?: { buys?: number; sells?: number } };
    info?: {
      socials?: Array<{ platform?: string; handle?: string; url?: string }>;
      websites?: Array<{ url?: string }>;
    };
  }>;
}

export class DexScreenerService {
  constructor(private readonly baseUrl: string) {}

  async getTokenMarket(mintAddress: string): Promise<TokenMarketSnapshot | undefined> {
    const data = await fetchJson<DexScreenerResponse>(
      `${this.baseUrl}/latest/dex/tokens/${mintAddress}`
    );
    const pair = data.pairs?.[0];

    if (!pair) {
      return undefined;
    }

    const socials =
      pair.info?.socials
        ?.filter((item) => item.platform && (item.handle || item.url))
        .map((item) => ({
          platform: item.platform ?? "unknown",
          value: item.handle ?? item.url ?? ""
        })) ?? [];

    const websites =
      pair.info?.websites?.map((item) => item.url).filter((url): url is string => Boolean(url)) ?? [];

    return {
      pairAddress: pair.pairAddress,
      dexUrl: pair.url,
      symbol: pair.baseToken?.symbol,
      name: pair.baseToken?.name,
      priceUsd: pair.priceUsd ? Number(pair.priceUsd) : undefined,
      marketCapUsd: pair.marketCap,
      liquidityUsd: pair.liquidity?.usd,
      volume24hUsd: pair.volume?.h24,
      fdvUsd: pair.fdv,
      ageMinutes: pair.pairCreatedAt
        ? Math.max(0, Math.floor((Date.now() - pair.pairCreatedAt) / 60_000))
        : undefined,
      holders: undefined,
      socials,
      websites
    };
  }
}
