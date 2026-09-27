import useSWR from "swr"

export function useFooterData() {
  const { data, error, mutate, isLoading } = useSWR("/api/footer", async (url) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error("Failed to fetch footer data")
    return res.json()
  }, { refreshInterval: 5000 }) // Poll every 5s for real-time

  return {
    data,
    error,
    mutate,
    isLoading,
  }
}
