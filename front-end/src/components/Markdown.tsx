import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders assistant messages as markdown with styling tuned to sit inside
 * our chat bubbles (both the dark brand bubble and the light assistant bubble).
 */
export default function Markdown({
  children,
  variant = 'light',
}: {
  children: string;
  variant?: 'light' | 'dark';
}) {
  const isDark = variant === 'dark';
  const linkCls = isDark
    ? 'underline decoration-white/50 underline-offset-2 hover:decoration-white'
    : 'text-brand-600 underline decoration-brand-500/40 underline-offset-2 hover:decoration-brand-600';
  const codeInline = isDark
    ? 'rounded bg-white/15 px-1 py-0.5 font-mono text-[0.85em]'
    : 'rounded bg-brand-900/5 px-1 py-0.5 font-mono text-[0.85em] text-brand-800';
  const codeBlock = isDark
    ? 'my-2 overflow-x-auto rounded-lg bg-black/25 px-3 py-2 font-mono text-[12.5px] leading-relaxed'
    : 'my-2 overflow-x-auto rounded-lg bg-brand-900/5 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-brand-900';
  const hrCls = isDark ? 'my-3 border-white/25' : 'my-3 border-mist-200';
  const quoteCls = isDark
    ? 'my-2 border-l-2 border-white/40 pl-3 italic opacity-90'
    : 'my-2 border-l-2 border-brand-500/40 pl-3 italic text-brand-700';

  return (
    <div className="markdown space-y-2 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="leading-relaxed whitespace-pre-wrap">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="ml-5 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="ml-5 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => (
            <h3 className="mt-2 text-base font-semibold">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="mt-2 text-base font-semibold">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="mt-2 text-sm font-semibold">{children}</h4>
          ),
          h4: ({ children }) => (
            <h4 className="mt-2 text-sm font-semibold">{children}</h4>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className={linkCls}>
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className={quoteCls}>{children}</blockquote>
          ),
          hr: () => <hr className={hrCls} />,
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className ?? '');
            if (isBlock) {
              return (
                <pre className={codeBlock}>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            }
            return (
              <code className={codeInline} {...props}>
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-current/20 px-2 py-1 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-current/10 px-2 py-1 align-top">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
