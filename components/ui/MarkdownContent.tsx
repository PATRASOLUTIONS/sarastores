import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownContent({ content }: { content: string }) {
  return <div className="min-w-0 break-words leading-7 text-stone-800 [&_p]:my-3 [&_p]:whitespace-pre-line [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-red-800 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-stone-300 [&_blockquote]:pl-4 [&_blockquote]:text-stone-600 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-stone-100 [&_pre]:p-4 [&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:text-sm [&_hr]:my-6 [&_table]:my-4 [&_table]:w-full [&_th]:border [&_th]:border-stone-300 [&_th]:bg-stone-50 [&_th]:p-2 [&_td]:border [&_td]:border-stone-300 [&_td]:p-2 [&_img]:max-w-full">
    <div className="overflow-x-auto"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{content}</ReactMarkdown></div>
  </div>
}
