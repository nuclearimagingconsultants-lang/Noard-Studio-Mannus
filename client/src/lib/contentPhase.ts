export function contentPhase(
  hasContent: boolean,
  isLoading: boolean,
  hasError: boolean
) {
  if (hasContent) return "ready";
  if (isLoading) return "loading";
  if (hasError) return "error";
  return "empty";
}
