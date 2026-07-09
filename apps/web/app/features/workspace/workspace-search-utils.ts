export function searchStatusMessage(resultCount: number, hasNextPage: boolean) {
  if (!resultCount) return "No results";
  if (hasNextPage) return "Showing " + resultCount + "+ results";
  return resultCount + " " + (resultCount === 1 ? "result" : "results");
}
