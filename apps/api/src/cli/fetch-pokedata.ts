import { PokeDataSource } from "../sources/pokedata/index.js";

const source = new PokeDataSource();

try {
  const result = await source.fetchEvents();

  console.log(
    JSON.stringify(
      {
        source: source.name,
        pagesFetched: result.pagesFetched,
        eventCount: result.events.length,
        warnings: result.warnings,
        sample: result.events.slice(0, 5)
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
