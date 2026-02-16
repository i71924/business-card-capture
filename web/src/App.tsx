import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import NewCardPage from './pages/NewCard';
import CardsPage from './pages/Cards';
import CardDetailPage from './pages/CardDetail';
import { useLiffAuth } from './lib/useLiffAuth';

function App() {
  const location = useLocation();
  const liff = useLiffAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>名片記錄 MVP</h1>
        <nav>
          <Link className={location.pathname.startsWith('/new') ? 'active' : ''} to="/new">
            New
          </Link>
          <Link className={location.pathname.startsWith('/cards') ? 'active' : ''} to="/cards">
            Cards
          </Link>
        </nav>
      </header>

      {!liff.ready && <p className="hint">LIFF 初始化中...</p>}

      {liff.ready && liff.enabled && (
        <div className="liff-status">
          <p>
            LINE 狀態：
            {liff.displayName
              ? `已登入（${liff.displayName}）`
              : liff.error
                ? `初始化失敗（${liff.error}）`
                : '已登入'}
          </p>
          {!liff.inClient && liff.liffId && (
            <a href={`https://liff.line.me/${liff.liffId}`} target="_blank" rel="noreferrer">
              建議改用 LINE App 開啟
            </a>
          )}
        </div>
      )}

      {liff.ready && !liff.enabled && (
        <div className="liff-status">
          <p>目前未設定 `VITE_LIFF_ID`，將以一般網頁模式運行。</p>
        </div>
      )}

      <main className="page-body">
        <Routes>
          <Route path="/" element={<Navigate to="/new" replace />} />
          <Route path="/new" element={<NewCardPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/:id" element={<CardDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
