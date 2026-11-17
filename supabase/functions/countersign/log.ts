/** Writes one structured JSON log line for a server-side failure. */
export const logError = (event: string, error: unknown): void => {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
};
