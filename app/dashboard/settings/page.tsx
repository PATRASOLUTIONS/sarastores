"use client"

import { useEffect, useState } from "react"
import { Camera, UserRound } from "lucide-react"
import { toast } from "react-hot-toast"
import { useAuth } from "@/contexts/AuthContext"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { apiFetch } from "@/lib/api-client"
import { AccountProfileSchema } from "@/lib/validation"
import { PROFILE_AVATARS, defaultProfileAvatar } from "@/lib/profile-avatars"
import styles from "@/components/account/account-forms.module.css"

export default function SettingsPage() {
  const { user, updateProfile } = useAuth()
  const [draft, setDraft] = useState({ name: "", phone: "", avatar: "" })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const lock = useSubmitLock()
  useEffect(() => {
    if (user) setDraft({ name: user.name || "", phone: user.phone || "", avatar: user.avatar || defaultProfileAvatar(user.id) })
  }, [user?.id, user?.name, user?.phone, user?.avatar])

  const upload = async (file?: File) => {
    if (!file || !lock.acquire()) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("photo", file)
      const response = await apiFetch("/api/account/photo", { method: "POST", body: form })
      const data = await response.json()
      if (!response.ok || typeof data.avatar !== "string") throw new Error(data.error || "Photo upload failed")
      setDraft(current => ({ ...current, avatar: data.avatar }))
      toast.success("Photo ready. Save your profile to keep it.")
    } catch (error) {
      console.error("[Profile] Photo upload failed:", error)
      toast.error(error instanceof Error ? error.message : "Photo upload failed")
    } finally { setUploading(false); lock.release() }
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!lock.acquire()) return
    const parsed = AccountProfileSchema.safeParse(draft)
    if (!parsed.success) { lock.release(); toast.error(parsed.error.issues[0].message); return }
    setSaving(true)
    try { await updateProfile(parsed.data) }
    finally { setSaving(false); lock.release() }
  }
  if (!user) return <p role="status">Loading your profile...</p>
  return <section className={styles.panel}>
    <header><UserRound size={24} /><div><h1>Profile Settings</h1><p>Your details and the photo shown in your account.</p></div></header>
    <form onSubmit={save}>
      <fieldset disabled={saving || uploading}>
        <div className={styles.photo}>
          <img src={draft.avatar || defaultProfileAvatar(user.id)} alt="Your profile photo" />
          <div><label className={styles.upload}><Camera size={17} />{uploading ? "Processing photo..." : "Upload Photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile photo"
              onChange={event => { void upload(event.target.files?.[0]); event.target.value = "" }} /></label>
            <p>JPEG, PNG or WebP, up to 2 MB. Cropped to a square.</p></div>
        </div>
        <div role="group" aria-labelledby="avatar-label"><h2 id="avatar-label">Or choose an avatar</h2>
          <div className={styles.avatars}>{PROFILE_AVATARS.map((avatar, index) => <button type="button" key={avatar}
            aria-label={`Choose avatar ${index + 1}`} aria-pressed={draft.avatar === avatar}
            onClick={() => setDraft(current => ({ ...current, avatar }))}><img src={avatar} alt="" /></button>)}</div>
        </div>
        <div className={styles.fields}>
          <label>Full name<input name="name" required minLength={2} maxLength={100} autoComplete="name" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Login email<input name="email" type="email" value={user.email} readOnly autoComplete="email" /><small>Your login email cannot be changed here.</small></label>
          <label>Phone number<input name="phone" type="tel" autoComplete="tel" maxLength={10} value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} placeholder="10-digit mobile number" /></label>
        </div>
        <button className={styles.primary} type="submit">{saving ? "Saving..." : "Save Profile"}</button>
      </fieldset>
    </form>
  </section>
}
