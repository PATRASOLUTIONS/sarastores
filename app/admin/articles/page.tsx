"use client"

import { useEffect, useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "react-hot-toast"
import RichTextEditor from "@/components/ui/RichTextEditor"
import { apiFetch } from "@/lib/api-client"
import { ARTICLE_CATEGORIES, type Article } from "@/lib/article-types"

const EMPTY_DRAFT = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  category: ARTICLE_CATEGORIES[0] as string,
  tags: "",
  author: "Sara Electronics",
  status: "published" as "draft" | "published",
  seoTitle: "",
  seoDescription: "",
  relatedProductIds: "",
}

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const lock = useSubmitLock()
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT })

  const loadArticles = async () => {
    setLoading(true)
    try {
      const res = await apiFetch("/api/articles?includeDrafts=true")
      const data = await res.json()
      if (data?.success) setArticles(data.articles)
    } catch {
      toast.error("Could not load articles")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArticles()
  }, [])

  const resetForm = () => {
    setEditingSlug(null)
    setDraft({ ...EMPTY_DRAFT })
  }

  const startEdit = (article: Article) => {
    setEditingSlug(article.slug)
    setDraft({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      coverImage: article.coverImage,
      category: article.category,
      tags: article.tags.join(", "),
      author: article.author,
      status: article.status,
      seoTitle: article.seoTitle || "",
      seoDescription: article.seoDescription || "",
      relatedProductIds: article.relatedProductIds.join(", "),
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const splitList = (value: string) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!lock.acquire()) return
    setSaving(true)

    const payload = {
      title: draft.title,
      slug: draft.slug || undefined,
      excerpt: draft.excerpt,
      content: draft.content,
      coverImage: draft.coverImage,
      category: draft.category,
      tags: splitList(draft.tags),
      author: draft.author,
      status: draft.status,
      seoTitle: draft.seoTitle || null,
      seoDescription: draft.seoDescription || null,
      relatedProductIds: splitList(draft.relatedProductIds),
    }

    try {
      const res = await apiFetch(
        editingSlug ? `/api/articles/${encodeURIComponent(editingSlug)}` : "/api/articles",
        { method: editingSlug ? "PUT" : "POST", json: payload },
      )
      const data = await res.json()

      if (!res.ok) {
        toast.error(data?.error || "Could not save the article")
        return
      }

      toast.success(editingSlug ? "Article updated" : "Article published")
      resetForm()
      await loadArticles()
    } catch {
      toast.error("Could not save the article")
    } finally {
      lock.release()
      setSaving(false)
    }
  }

  const handleDelete = async (slug: string) => {
    if (!window.confirm("Delete this article? This cannot be undone.")) return

    try {
      const res = await apiFetch(`/api/articles/${encodeURIComponent(slug)}`, { method: "DELETE" })
      if (!res.ok) {
        toast.error("Could not delete the article")
        return
      }
      toast.success("Article deleted")
      if (editingSlug === slug) resetForm()
      await loadArticles()
    } catch {
      toast.error("Could not delete the article")
    }
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buying guides</h1>
        <p className="mt-1 text-sm text-gray-600">
          Articles published at <code className="rounded bg-gray-100 px-1">/blog</code>. They appear
          on the homepage, in the sitemap and alongside related products.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            {editingSlug ? `Editing: ${editingSlug}` : "New article"}
          </h2>
          {editingSlug && (
            <button type="button" onClick={resetForm} className="text-sm text-gray-600 hover:underline">
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Title *
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Slug (auto from title if blank)
            <input
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="best-55-inch-tvs-under-50000"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Excerpt * (20–400 characters)
          <textarea
            value={draft.excerpt}
            onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
            rows={2}
            required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div>
          <span className="block text-sm font-medium text-gray-700">Content *</span>
          <div className="mt-1">
            <RichTextEditor
              content={draft.content}
              onChange={(html) => setDraft({ ...draft, content: html })}
              placeholder="Write the guide…"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-gray-700">
            Category
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {ARTICLE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Status
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as "draft" | "published" })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Author
            <input
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Cover image URL
            <input
              value={draft.coverImage}
              onChange={(e) => setDraft({ ...draft, coverImage: e.target.value })}
              placeholder="https://…"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Tags (comma separated)
            <input
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              placeholder="tv, 4k, budget"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Related product IDs (comma separated) — shown as a shoppable rail under the article
          <input
            value={draft.relatedProductIds}
            onChange={(e) => setDraft({ ...draft, relatedProductIds: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            SEO title
            <input
              value={draft.seoTitle}
              onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            SEO description
            <input
              value={draft.seoDescription}
              onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {editingSlug ? "Save changes" : "Publish article"}
        </button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 p-4 font-semibold text-gray-900">
          Articles ({articles.length})
        </h2>

        {loading ? (
          <p className="p-4 text-sm text-gray-600">Loading…</p>
        ) : articles.length === 0 ? (
          <p className="p-4 text-sm text-gray-600">No articles yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {articles.map((article) => (
              <li key={article.slug} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{article.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    /blog/{article.slug} · {article.category} ·{" "}
                    <span className={article.status === "draft" ? "text-amber-600" : "text-green-600"}>
                      {article.status}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(article)}
                    aria-label={`Edit ${article.title}`}
                    className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(article.slug)}
                    aria-label={`Delete ${article.title}`}
                    className="rounded-lg border border-gray-300 p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
