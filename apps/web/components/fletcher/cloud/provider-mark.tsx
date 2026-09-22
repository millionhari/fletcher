import { cn } from "@/lib/utils";

/** Small brand marks, drawn inline so nothing is fetched. Recognisable shapes, not exact logos. */
export function ProviderMark({ provider, className }: { provider: "google_drive" | "dropbox" | "box" | "google_docs" | "notion" | "figma" | "youtube" | "vimeo" | "frameio" | "airtable"; className?: string }) {
  const c = cn("shrink-0", className);
  switch (provider) {
    case "google_drive":
      return (
        <svg viewBox="0 0 24 24" className={c} aria-hidden>
          <path fill="#0f9d58" d="M8.2 3h7.6l6.2 10.8H15.8z" />
          <path fill="#4285f4" d="M2 13.8 8.2 3l3.8 6.6-6.2 10.8z" />
          <path fill="#f4b400" d="M2 13.8h20L15.8 20.4H5.8z" />
        </svg>
      );
    case "dropbox":
      return (
        <svg viewBox="0 0 24 24" className={c} aria-hidden>
          <path fill="#0061ff" d="M7 3 2 6.4 7 9.8l5-3.4zM17 3l-5 3.4 5 3.4 5-3.4zM2 13.2l5 3.4 5-3.4-5-3.4zM17 9.8l-5 3.4 5 3.4 5-3.4zM7 17.7l5 3.3 5-3.3-5-3.4z" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 24 24" className={c} aria-hidden>
          <rect x="2" y="2" width="20" height="20" rx="4" fill="#0061d5" />
          <path fill="#fff" d="M7 8v8h1.6v-.9a2.6 2.6 0 0 0 2 .9c1.7 0 3-1.4 3-3.2s-1.3-3.2-3-3.2c-.8 0-1.5.3-2 .9V8zm3.4 3.1c.9 0 1.5.7 1.5 1.7s-.6 1.7-1.5 1.7-1.5-.7-1.5-1.7.6-1.7 1.5-1.7zM14.2 9.7l1.9 2.9-2 3.4h1.9l1.2-2.2 1.2 2.2h1.9l-2-3.4 1.9-2.9h-1.9l-1.1 2-1.1-2z" />
        </svg>
      );
    case "google_docs":
      return (
        <svg viewBox="0 0 24 24" className={c} aria-hidden>
          <path fill="#4285f4" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path fill="#a1c2fa" d="M14 2v6h6z" />
          <path fill="#fff" d="M8 12h8v1.5H8zm0 3h8v1.5H8zm0 3h5v1.5H8z" />
        </svg>
      );
    case "notion":
      return (
        <svg viewBox="0 0 24 24" className={c} aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="3" fill="#fff" stroke="#111" strokeWidth="1.5" />
          <path fill="#111" d="M8 7.5h2.6l4 6.4V7.5H17v9h-2.5l-4-6.4v6.4H8z" />
        </svg>
      );
    case "figma":
      return (
        <svg viewBox="0 0 24 24" className={c} aria-hidden>
          <path fill="#f24e1e" d="M8 2h4v6.5H8a3.25 3.25 0 0 1 0-6.5z" />
          <path fill="#ff7262" d="M12 2h4a3.25 3.25 0 0 1 0 6.5h-4z" />
          <path fill="#1abcfe" d="M12 8.5h4a3.25 3.25 0 1 1-4 3.25z" />
          <path fill="#a259ff" d="M8 8.5h4V15H8a3.25 3.25 0 0 1 0-6.5z" />
          <path fill="#0acf83" d="M8 15h4v3.25A3.25 3.25 0 1 1 8 15z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className={c} aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0000" />
          <path fill="#fff" d="m10 9 5 3-5 3z" />
        </svg>
      );
    case "vimeo":
      return (
        <svg viewBox="0 0 24 24" className={c} aria-hidden>
          <rect x="2" y="2" width="20" height="20" rx="4" fill="#1ab7ea" />
          <path fill="#fff" d="M7 9.5c.7-.6 1.4-1 1.9-1 .8 0 1.2.6 1.4 1.7l.7 3.4c.2.9.5 1.3.8 1.3.6 0 1.6-1.7 2.1-3 .3-.9 0-1.3-.6-1.3-.3 0-.5.1-.8.2.6-1.8 1.6-2.7 2.8-2.7 1 0 1.5.7 1.4 2-.1 1.9-2.1 5.3-3.6 6.7-.9.8-1.6.9-2.2.3-.5-.5-.8-1.5-1.1-3.1L9.5 11c-.2-.9-.4-1.2-.8-1.2-.3 0-.6.2-1 .5z" />
        </svg>
      );
    case "frameio":
      return (
        <svg viewBox="0 0 24 24" className={c} aria-hidden>
          <rect x="2" y="2" width="20" height="20" rx="4" fill="#5b53ff" />
          <path fill="#fff" d="M7 7h10v2.5h-7v2h6V14h-6v3H7z" />
        </svg>
      );
    case "airtable":
      return (
        <svg viewBox="0 0 24 24" className={c} aria-hidden>
          <path fill="#fcb400" d="M11 3.4 3.4 6.5c-.5.2-.5.8 0 1L11 10.6c.6.3 1.4.3 2 0l7.6-3.1c.5-.2.5-.8 0-1L13 3.4c-.6-.3-1.4-.3-2 0z" />
          <path fill="#18bfff" d="M12.7 12.3v7.4c0 .4.4.6.7.5l7.3-2.9c.2-.1.3-.3.3-.5v-7.3c0-.4-.4-.6-.7-.5l-7.3 2.8c-.2.1-.3.3-.3.5z" />
          <path fill="#f82b60" d="M10.6 12.6 3.9 9.2c-.3-.2-.7.1-.7.4v7.2c0 .2.1.4.3.5l6.8 3.4c.3.2.7-.1.7-.4v-7.2c0-.2-.1-.4-.4-.5z" />
        </svg>
      );
  }
}
