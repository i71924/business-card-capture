import { useMemo, useState } from 'react';
import FieldsEditor from '../components/FieldsEditor';
import { addCard, updateCard } from '../lib/api';
import { blobToBase64, compressToJpeg } from '../lib/image';
import { EMPTY_FIELDS, type CardFields } from '../types';

function NewCardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardId, setCardId] = useState('');
  const [fields, setFields] = useState<CardFields>(EMPTY_FIELDS);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState('');

  const canRecognize = useMemo(() => Boolean(file) && !loading, [file, loading]);
  const canSave = useMemo(() => Boolean(cardId) && !loading, [cardId, loading]);

  const handleChooseFile = (selectedFile: File | null) => {
    if (!selectedFile) {
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSaved(false);
    setError('');
    setCardId('');
    setStatus('');
    setFields(EMPTY_FIELDS);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleRecognize = async () => {
    if (!file) {
      return;
    }

    setLoading(true);
    setError('');
    setSaved(false);
    setStatus('圖片壓縮中...');

    try {
      const compressedBlob = await compressToJpeg(file, 1500, 0.7);
      setStatus('圖片轉換中...');
      const imageBase64 = await blobToBase64(compressedBlob);
      setStatus('上傳辨識中（等待後端）...');
      const result = await addCard({ imageBase64, filename: file.name || 'card.jpg' });

      if (!result.ok) {
        throw new Error(result.error || '後端回傳失敗');
      }

      setStatus('辨識完成，請確認欄位後按儲存');
      setCardId(result.id);
      setFields({
        ...EMPTY_FIELDS,
        ...result.fields
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳辨識失敗');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!cardId) {
      return;
    }

    setLoading(true);
    setError('');
    setSaved(false);
    setStatus('儲存中...');

    try {
      const result = await updateCard(cardId, fields);
      if (!result.ok) {
        throw new Error(result.error || '儲存失敗');
      }
      setSaved(true);
      setStatus('儲存完成');
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <h2>新增名片</h2>
      <label>
        <span>拍照或上傳</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => handleChooseFile(event.target.files?.[0] ?? null)}
        />
      </label>

      {previewUrl && (
        <div className="preview-wrap">
          <img src={previewUrl} alt="名片預覽" className="preview-image" />
        </div>
      )}

      <div className="button-row">
        <button type="button" onClick={handleRecognize} disabled={!canRecognize}>
          {loading ? '辨識中...' : '上傳辨識'}
        </button>
      </div>

      {cardId && (
        <>
          <p className="hint">記錄 ID：{cardId}</p>
          <FieldsEditor fields={fields} onChange={setFields} />
          <div className="button-row">
            <button type="button" onClick={handleSave} disabled={!canSave}>
              {loading ? '儲存中...' : '儲存'}
            </button>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {saved && <p className="success">已儲存</p>}
      {status && <p className="hint">{status}</p>}
    </section>
  );
}

export default NewCardPage;
