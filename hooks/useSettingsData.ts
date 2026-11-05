
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch settings data")
  return res.json()
})

export function useSettingsData(enabled = true) {
  const { data, error, mutate, isLoading } = useSWR(enabled ? "/api/settings" : null, fetcher, { revalidateOnFocus: false })
  return { data, error, mutate, isLoading }
}
