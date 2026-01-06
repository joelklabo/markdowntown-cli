export async function fetchThroughProxy(url: string): Promise<Response> {
  return fetch(`/api/engine/fetch?url=${encodeURIComponent(url)}`);
}

export function getProxyUrl(url: string): string {
  return `/api/engine/fetch?url=${encodeURIComponent(url)}`;
}
