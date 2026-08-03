function Sidebar({ pages, activePage, onSelect }) {
  return (
    <aside className="sidebar">
      <nav aria-label="Páginas da documentação">
        <ul className="sidebar-list">
          {pages.map((page) => (
            <li key={page.id}>
              <button
                type="button"
                className={`sidebar-link ${activePage === page.id ? "active" : ""}`}
                onClick={() => onSelect(page.id)}
                aria-current={activePage === page.id ? "page" : undefined}
              >
                {page.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
