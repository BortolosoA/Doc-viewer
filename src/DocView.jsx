import { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Heading } from "lucide-react";

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Heading components passed to ReactMarkdown — assign deterministic IDs
function H1({ children, ...props }) {
  const text = typeof children?.[0] === "string" ? children[0] : "";
  return <h1 id={slugify(text)} {...props}>{children}</h1>;
}
function H2({ children, ...props }) {
  const text = typeof children?.[0] === "string" ? children[0] : "";
  return <h2 id={slugify(text)} {...props}>{children}</h2>;
}
function H3({ children, ...props }) {
  const text = typeof children?.[0] === "string" ? children[0] : "";
  return <h3 id={slugify(text)} {...props}>{children}</h3>;
}
function H4({ children, ...props }) {
  const text = typeof children?.[0] === "string" ? children[0] : "";
  return <h4 id={slugify(text)} {...props}>{children}</h4>;
}
function H5({ children, ...props }) {
  const text = typeof children?.[0] === "string" ? children[0] : "";
  return <h5 id={slugify(text)} {...props}>{children}</h5>;
}
function H6({ children, ...props }) {
  const text = typeof children?.[0] === "string" ? children[0] : "";
  return <h6 id={slugify(text)} {...props}>{children}</h6>;
}

const markdownComponents = { h1: H1, h2: H2, h3: H3, h4: H4, h5: H5, h6: H6 };

function parseHeadingEl(el) {
  const raw = el.textContent?.trim() || "";
  const level = parseInt(el.tagName[1], 10);
  const id = el.id || slugify(raw);
  const text = raw;
  return { level, text, id };
}

function DocView({ content, onBack }) {
  const contentRef = useRef(null);
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState("");

  // After every markdown render, scan the DOM for heading elements
  // Only include # (h1) and ## (h2) in the TOC.
  useEffect(() => {
    if (!contentRef.current) return;
    const nodes = contentRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
    if (nodes.length > 0) {
      const all = Array.from(nodes).map(parseHeadingEl);
      setHeadings(all.filter((h) => h.level <= 2));
    } else {
      setHeadings([]);
    }
  }, [content]);

  // IntersectionObserver to highlight the current section in the TOC
  useEffect(() => {
    if (!contentRef.current || headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let topVisible = null;
        let topY = Infinity;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            if (rect.top >= -20 && rect.top < topY) {
              topY = rect.top;
              topVisible = entry.target.id;
            }
          }
        }
        if (topVisible) setActiveId(topVisible);
      },
      { rootMargin: "-56px 0px -60% 0px", threshold: 0 }
    );

    headings.forEach(({ id }) => {
      const el = contentRef.current?.querySelector(`[id="${id}"]`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [content, headings]);

  const scrollToHeading = useCallback((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 56 - 8;
    window.scrollTo({ top: y, behavior: "smooth" });
    setActiveId(id);
  }, []);

  return (
    <div className="viewer">
      <button type="button" className="viewer-back" onClick={onBack}>
        <ArrowLeft size={20} />
      </button>

      <nav className="viewer-toc" aria-label="Índice do documento">
        <div className="toc-title">
          <Heading size={15} />
          Índice
        </div>
        {headings.length === 0 ? (
          <p className="toc-empty">Sem seções.</p>
        ) : (
          headings.map((heading) => (
            <button
              key={heading.id}
              type="button"
              className={`toc-item toc-item--l${heading.level} ${activeId === heading.id ? "toc-item--active" : ""}`}
              onClick={() => scrollToHeading(heading.id)}
            >
              {heading.text}
            </button>
          ))
        )}
      </nav>

      <main className="viewer-content" ref={contentRef}>
        <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
      </main>
    </div>
  );
}

export default DocView;