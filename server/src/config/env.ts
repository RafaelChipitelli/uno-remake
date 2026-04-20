const DEFAULT_SERVER_PORT = 3001;
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';

function resolvePort(rawPort: string | undefined): number {
  if (!rawPort) {
    return DEFAULT_SERVER_PORT;
  }

  const parsed = Number(rawPort);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SERVER_PORT;
}

export const SERVER_PORT = resolvePort(process.env.PORT);
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? DEFAULT_CLIENT_ORIGIN;
