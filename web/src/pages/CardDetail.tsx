import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import FieldsEditor from '../components/FieldsEditor';
import { getCard, updateCard } from '../lib/api';
import { EMPTY_FIELDS, type CardFields } from '../types';

function CardDetailPage() {
  const { id = '' } = useParams();
  const [fields, setFields] = useState<CardFields>(EMPTY_FIELDS);
  const [createdAt, setCreatedAt] = useState('');
  const [imageFileId, setImageFileId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const driveLink = useMemo(
    () => (imageFileId ? `https://drive.google.com/file/d/${imageFileId}/view` : ''),
    [imageFileId]
  );

  useEffect(() => {
    if (!id) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      setSaved(false);

      try {
        const result = await getCard(id);
        if (!result.ok) {
          throw new Error('讀取失敗');
        }

        setFields({
          ...EMPTY_FIELDS,
          ...result.item
        });
        setCreatedAt(result.item.created_at);
        setImageFileId(result.item.image_file_id || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : '讀取失敗');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const handleSave = async () => {
    if (!id) {
      return;
    }

    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const result = await updateCard(id, fields);
      if (!result.ok) {
        throw new Error('儲存失敗');
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return <p className="error">缺少卡片 ID</p>;
  }

  return (
    <section className="panel">
      <h2>名片詳細</h2>
      <p className="hint">ID：{id}</p>
      {createdAt && <p className="hint">建立時間：{new Date(createdAt).toLocaleString()}</p>}

      {loading ? (
        <p className="hint">載入中...</p>
      ) : (
        <>
          <div className="info-box">
            <p>圖片檔案 ID：{imageFileId || '-'}</p>
            {driveLink && (
              <a href={driveLink} target="_blank" rel="noreferrer">
                在 Drive 開啟
              </a>
            )}
          </div>

          <FieldsEditor fields={fields} onChange={setFields} showExtended />

          <div className="button-row">
            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {saved && <p className="success">已儲存</p>}
    </section>
  );
}

export default CardDetailPage;
