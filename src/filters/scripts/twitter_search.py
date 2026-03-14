import asyncio
import json
import os
import sys


async def main() -> None:
    ticker = sys.argv[1] if len(sys.argv) > 1 else ""
    if not ticker:
        print("[]")
        return

    try:
        from twikit import Client
    except Exception:
        print("[]")
        return

    username = os.getenv("TWITTER_USERNAME")
    email = os.getenv("TWITTER_EMAIL")
    password = os.getenv("TWITTER_PASSWORD")

    if not username or not email or not password:
        print("[]")
        return

    client = Client("en-US")

    try:
        await client.login(
            auth_info_1=username,
            auth_info_2=email,
            password=password,
            cookies_file=os.path.join(os.getcwd(), "cookies.json"),
        )
        tweets = await client.search_tweet(f"${ticker}", "Latest")
    except Exception:
        print("[]")
        return

    results = []
    for tweet in tweets[:20]:
        user = getattr(tweet, "user", None)
        results.append(
            {
                "user": getattr(user, "name", None),
                "followers": getattr(user, "followers_count", None),
                "text": getattr(tweet, "text", None),
                "created": str(getattr(tweet, "created_at", "")),
            }
        )

    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
