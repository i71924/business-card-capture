import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchCards } from '../lib/api';
import type { CardRecord, SearchParams, SortBy } from '../types';

const DEFAULT_SEARCH: SearchParams = {
  q: '',
  company: '',
  tag: '',
  from: '',
  to: '',
  sort: 'newest'
};

function CardsPage() {
  const [filters, setFilters] = useState<SearchParams>(DEFAULT_SEARCH);
  const [items, setItems] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async (nextFilters = filters) => {
    setLoading(true);
    setError('');

    try {
      const result = await searchCards(nextFilters);
      if (!result.ok) {
        throw new Error(result.error || '查詢失敗');
      }
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSearch(DEFAULT_SEARCH);
  }, []);

  return (
    <section className="panel">
      <h2>名片列表</h2>
      <div className="search-grid">
        <label>
          <span>關鍵字 q</span>
          <input
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
        </label>

        <label>
          <span>company</span>
          <input
            value={filters.company}
            onChange={(event) => setFilters((prev) => ({ ...prev, company: event.target.value }))}
          />
        </label>

        <label>
          <span>tag</span>
          <input
            value={filters.tag}
            onChange={(event) => setFilters((prev) => ({ ...prev, tag: event.target.value }))}
          />
        </label>

        <label>
          <span>from</span>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
          />
        </label>

        <label>
          <span>to</span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
          />
        </label>

        <label>
          <span>sort</span>
          <select
            value={filters.sort}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, sort: event.target.value as SortBy }))
            }
          >
            <option value="newest">newest</option>
            <option value="company">company</option>
          </select>
        </label>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => runSearch()} disabled={loading}>
          {loading ? '查詢中...' : '查詢'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="list-wrap">
        {items.map((item) => (
          <Link key={item.id} className="card-row" to={`/cards/${item.id}`}>
            <strong>{item.name || '(未命名)'}</strong>
            <span>{item.company}</span>
            <span>{item.title}</span>
            <span>{new Date(item.created_at).toLocaleString()}</span>
          </Link>
        ))}
        {!items.length && !loading && <p className="hint">目前沒有資料</p>}
      </div>
    </section>
  );
}

export default CardsPage;
