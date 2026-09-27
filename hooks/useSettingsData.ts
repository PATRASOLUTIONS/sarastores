
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch settings data")
  return res.json()
})

export function useSettingsData() {
  const { data, error, mutate, isLoading } = useSWR("/api/settings", fetcher, { revalidateOnFocus: false })
  return { data, error, mutate, isLoading }
}
