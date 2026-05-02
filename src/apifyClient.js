import { ApifyClient } from "apify-client";
import dotenv from "dotenv";

dotenv.config();

export const client = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

export async function runActor(actorId, input) {
  const run = await client.actor(actorId).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}
