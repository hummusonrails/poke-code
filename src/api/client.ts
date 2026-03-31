import { ApiError } from "../errors.js";

const POKE_API_URL = "https://poke.com/api/v1/inbound/api-message";

export interface PokeApiResponse {
  success: boolean;
  message: string;
}

export class PokeApiClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API key is required");
    }
    this.apiKey = apiKey;
  }

  async sendMessage(message: string, retries = 3): Promise<PokeApiResponse> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(POKE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message }),
        });

        if (response.ok) {
          return response.json() as Promise<PokeApiResponse>;
        }

        if (response.status === 429 || response.status >= 500) {
          if (attempt < retries - 1) {
            await this.backoff(attempt);
            continue;
          }
        }

        throw new ApiError(`Poke API error: ${response.status} ${response.statusText}`, response.status);
      } catch (err) {
        if (err instanceof ApiError) {
          throw err;
        }
        if (attempt === retries - 1) throw err;
        await this.backoff(attempt);
      }
    }
    throw new Error("Max retries exceeded");
  }

  private backoff(attempt: number): Promise<void> {
    const ms = Math.min(1000 * 2 ** attempt, 10000);
    return new Promise((r) => setTimeout(r, ms));
  }
}
