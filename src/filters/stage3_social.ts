import path from "node:path";
import { execFileSync } from "node:child_process";
import type { StageResult, TokenMarketSnapshot } from "../types";
import type { FilterDependencies } from "./types";
import { fetchJson } from "../utils/http";

interface SocialTweet {
  user?: string;
  followers?: number;
  text?: string;
  created?: string;
}

interface TwitterApiIoResponse {
  tweets?: Array<{
    text?: string;
    user?: {
      name?: string;
      followers_count?: number;
      created_at?: string;
    };
  }>;
}

function getScriptPath(): string {
  return path.resolve(process.cwd(), "src", "filters", "scripts", "twitter_search.py");
}

function runTwikitSearch(ticker: string): SocialTweet[] {
  try {
    const output = execFileSync("python", [getScriptPath(), ticker], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return JSON.parse(output) as SocialTweet[];
  } catch {
    return [];
  }
}

async function runTwitterApiIoSearch(ticker: string, apiKey: string): Promise<SocialTweet[]> {
  const response = await fetchJson<TwitterApiIoResponse>(
    `https://api.twitterapi.io/v1/search?query=%24${encodeURIComponent(ticker)}&type=Latest`,
    {
      headers: {
        "x-api-key": apiKey
      }
    }
  );

  return (
    response.tweets?.map((tweet) => ({
      user: tweet.user?.name,
      followers: tweet.user?.followers_count,
      text: tweet.text,
      created: tweet.user?.created_at
    })) ?? []
  );
}

export async function runStage3Social(
  deps: FilterDependencies,
  market?: TokenMarketSnapshot
): Promise<StageResult> {
  const symbol = market?.symbol;
  const details: Record<string, unknown> = {};
  const reasons: string[] = [];
  let score = 0;

  const socials = market?.socials ?? [];
  const websites = market?.websites ?? [];

  if (socials.some((item) => item.platform.toLowerCase().includes("twitter"))) {
    score += 15;
  }
  if (socials.some((item) => item.platform.toLowerCase().includes("telegram"))) {
    score += 10;
  }
  if (websites.length > 0) {
    score += 10;
  }
  if (socials.length === 0 && websites.length === 0) {
    score -= 20;
    reasons.push("No social or website links found.");
  }

  let tweets: SocialTweet[] = [];
  if (symbol) {
    tweets = runTwikitSearch(symbol);
    if (tweets.length === 0 && deps.config.external.twitterApiIoKey) {
      tweets = await runTwitterApiIoSearch(symbol, deps.config.external.twitterApiIoKey);
    }
  }

  const uniqueUsers = new Set(tweets.map((tweet) => tweet.user).filter(Boolean)).size;
  const suspiciousUsers = tweets.filter((tweet) => {
    const followers = tweet.followers ?? 0;
    return followers < 10;
  }).length;
  const highFollowerMentions = tweets.filter((tweet) => (tweet.followers ?? 0) >= 10_000).length;

  details.mentions = tweets.length;
  details.uniqueUsers = uniqueUsers;
  details.suspiciousUsers = suspiciousUsers;
  details.highFollowerMentions = highFollowerMentions;
  details.socials = socials;
  details.websites = websites;

  if (tweets.length >= 5) {
    score += 25;
  }
  if (uniqueUsers >= 3) {
    score += 15;
  }
  if (highFollowerMentions > 0) {
    score += 20;
  }
  if (tweets.length > 0 && suspiciousUsers / tweets.length > 0.5) {
    score -= 20;
    reasons.push("Social mentions look bot-heavy.");
  }

  const passed = score >= deps.config.filters.minSocialScore;
  if (passed && reasons.length === 0) {
    reasons.push("Social proof is acceptable.");
  } else if (!passed && reasons.length === 0) {
    reasons.push("Not enough organic social proof.");
  }

  return {
    stage: "stage3_social",
    passed,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    details
  };
}
