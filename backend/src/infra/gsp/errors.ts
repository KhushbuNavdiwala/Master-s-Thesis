export class GspError extends Error {
  constructor(
    message: string,
    public details: { url: string; status?: number; body?: string }
  ) {
    super(message);
    this.name = "GspError";
  }
}
