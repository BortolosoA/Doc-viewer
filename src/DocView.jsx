import ReactMarkdown from "react-markdown";

function DocView({ content }) {
  return (
    <article className="doc">
      <ReactMarkdown>{content}</ReactMarkdown>
    </article>
  );
}

export default DocView;
