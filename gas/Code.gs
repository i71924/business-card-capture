const HEADERS = [
  'id',
  'created_at',
  'name',
  'company',
  'title',
  'phone',
  'email',
  'address',
  'website',
  'tags',
  'notes',
  'image_file_id',
  'image_url',
  'raw_json'
];

const FIELD_KEYS = ['name', 'company', 'title', 'phone', 'email', 'address', 'website', 'tags', 'notes'];

function doGet(e) {
  return routeRequest_('GET', e);
}

function doPost(e) {
  return routeRequest_('POST', e);
}

function doOptions(e) {
  return buildResponse_(e, { ok: true, message: 'preflight' });
}

function routeRequest_(method, e) {
  try {
    const path = getPath_(e);

    if (!path) {
      return buildResponse_(e, {
        ok: false,
        error: 'Missing path. Use ?path=add|search|get|update'
      });
    }

    var result;
    if (method === 'POST' && path === 'add') {
      result = handleAdd_(e);
    } else if (method === 'GET' && path === 'search') {
      result = handleSearch_(e);
    } else if (method === 'GET' && path === 'get') {
      result = handleGet_(e);
    } else if (method === 'POST' && path === 'update') {
      result = handleUpdate_(e);
    } else {
      result = { ok: false, error: 'Unsupported method/path' };
    }

    return buildResponse_(e, result);
  } catch (error) {
    return buildResponse_(e, {
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function handleAdd_(e) {
  const body = parseJsonBody_(e);
  assertAuthorized_(e, body);

  const imageBase64 = String(body.imageBase64 || '');
  const filename = sanitizeFilename_(String(body.filename || 'card.jpg'));

  if (!imageBase64) {
    throw new Error('imageBase64 is required');
  }

  const file = saveBase64Image_(imageBase64, filename);

  let fields = emptyFields_();
  let rawJson = '';
  try {
    const extracted = extractBusinessCardFieldsWithRaw_(file.getBlob());
    fields = normalizeFields_(extracted.fields);
    rawJson = extracted.rawJson;
  } catch (error) {
    fields = emptyFields_();
    rawJson = JSON.stringify({
      error: error && error.message ? error.message : String(error)
    });
  }

  const id = Utilities.getUuid();
  const createdAt = new Date().toISOString();
  const imageFileId = file.getId();
  const imageUrl = 'https://drive.google.com/file/d/' + imageFileId + '/view';

  const row = [
    id,
    createdAt,
    fields.name,
    fields.company,
    fields.title,
    fields.phone,
    fields.email,
    fields.address,
    fields.website,
    '',
    '',
    imageFileId,
    imageUrl,
    rawJson
  ];

  const sheet = getSheet_();
  sheet.appendRow(row);

  return {
    ok: true,
    id: id,
    fields: {
      name: fields.name,
      company: fields.company,
      title: fields.title,
      phone: fields.phone,
      email: fields.email,
      address: fields.address,
      website: fields.website,
      tags: '',
      notes: ''
    }
  };
}

function handleSearch_(e) {
  assertAuthorized_(e, {});

  const p = (e && e.parameter) || {};
  const q = normalizeLower_(p.q);
  const company = normalizeLower_(p.company);
  const tag = normalizeLower_(p.tag);
  const fromDate = parseDateInput_(p.from);
  const toDate = parseDateInput_(p.to, true);
  const sort = String(p.sort || 'newest');

  let items = readAllCards_();

  if (q) {
    items = items.filter(function (item) {
      const target = [
        item.name,
        item.company,
        item.title,
        item.phone,
        item.email,
        item.address,
        item.website,
        item.tags,
        item.notes
      ]
        .join(' ')
        .toLowerCase();
      return target.indexOf(q) !== -1;
    });
  }

  if (company) {
    items = items.filter(function (item) {
      return String(item.company || '').toLowerCase().indexOf(company) !== -1;
    });
  }

  if (tag) {
    items = items.filter(function (item) {
      return String(item.tags || '').toLowerCase().indexOf(tag) !== -1;
    });
  }

  if (fromDate) {
    items = items.filter(function (item) {
      const created = new Date(item.created_at).getTime();
      return !isNaN(created) && created >= fromDate.getTime();
    });
  }

  if (toDate) {
    items = items.filter(function (item) {
      const created = new Date(item.created_at).getTime();
      return !isNaN(created) && created <= toDate.getTime();
    });
  }

  items.sort(function (a, b) {
    if (sort === 'company') {
      const aCompany = String(a.company || '').toLowerCase();
      const bCompany = String(b.company || '').toLowerCase();
      if (aCompany < bCompany) return -1;
      if (aCompany > bCompany) return 1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return {
    ok: true,
    items: items
  };
}

function handleGet_(e) {
  assertAuthorized_(e, {});
  const id = String((e && e.parameter && e.parameter.id) || '');
  if (!id) {
    throw new Error('id is required');
  }

  const rows = readAllCards_();
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i].id === id) {
      return {
        ok: true,
        item: rows[i]
      };
    }
  }

  throw new Error('Card not found');
}

function handleUpdate_(e) {
  const body = parseJsonBody_(e);
  assertAuthorized_(e, body);

  const id = String(body.id || '');
  if (!id) {
    throw new Error('id is required');
  }

  const incomingFields = body.fields || {};

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    throw new Error('Sheet is empty');
  }

  const headerIndex = getHeaderIndex_(values[0]);

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    if (String(row[headerIndex.id] || '') === id) {
      FIELD_KEYS.forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(incomingFields, key)) {
          row[headerIndex[key]] = String(incomingFields[key] || '');
        }
      });
      const updated = row.slice(0, HEADERS.length);
      while (updated.length < HEADERS.length) {
        updated.push('');
      }
      sheet.getRange(rowIndex + 1, 1, 1, HEADERS.length).setValues([updated]);
      return { ok: true };
    }
  }

  throw new Error('Card not found');
}

function parseJsonBody_(e) {
  const payloadFromParameter = e && e.parameter && e.parameter.payload ? e.parameter.payload : '';
  if (payloadFromParameter) {
    try {
      return JSON.parse(payloadFromParameter);
    } catch (error) {
      throw new Error('Invalid payload JSON');
    }
  }

  const body = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

function assertAuthorized_(e, body) {
  const expected = getRequiredProperty_('API_TOKEN');
  const received = getRequestToken_(e, body);
  if (!received || received !== expected) {
    throw new Error('Unauthorized');
  }
}

function getRequestToken_(e, body) {
  const candidateKeys = ['x-api-token', 'X-API-TOKEN', 'x_api_token', 'api_token'];
  const containers = [
    e && e.headers,
    e && e.postData && e.postData.headers,
    e && e.parameter,
    e && e.parameters,
    body
  ];

  for (var i = 0; i < containers.length; i += 1) {
    const container = containers[i];
    if (!container) {
      continue;
    }

    for (var j = 0; j < candidateKeys.length; j += 1) {
      const key = candidateKeys[j];
      if (Object.prototype.hasOwnProperty.call(container, key)) {
        const value = container[key];
        if (Array.isArray(value)) {
          return String(value[0] || '');
        }
        return String(value || '');
      }
    }
  }

  return '';
}

function getPath_(e) {
  const fromParameter = String((e && e.parameter && e.parameter.path) || '').trim();
  if (fromParameter) {
    return fromParameter.replace(/^\/+/, '').toLowerCase();
  }

  const pathInfo = String((e && e.pathInfo) || '').trim();
  return pathInfo.replace(/^\/+/, '').toLowerCase();
}

function getSheet_() {
  const sheetId = getRequiredProperty_('SHEET_ID');
  const tabName = getProperty_('SHEET_TAB', 'cards');

  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values.length) {
    sheet.appendRow(HEADERS);
    return sheet;
  }

  const header = values[0].map(function (v) {
    return String(v || '');
  });

  if (header.join(',') !== HEADERS.join(',')) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  return sheet;
}

function getHeaderIndex_(headerRow) {
  const map = {};
  for (var i = 0; i < HEADERS.length; i += 1) {
    map[HEADERS[i]] = i;
  }

  for (var j = 0; j < headerRow.length; j += 1) {
    const key = String(headerRow[j] || '');
    if (map[key] !== undefined) {
      map[key] = j;
    }
  }

  return map;
}

function readAllCards_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  const headerIndex = getHeaderIndex_(values[0]);
  const items = [];
  for (var i = 1; i < values.length; i += 1) {
    const row = values[i];
    items.push({
      id: String(row[headerIndex.id] || ''),
      created_at: toIsoString_(row[headerIndex.created_at]),
      name: String(row[headerIndex.name] || ''),
      company: String(row[headerIndex.company] || ''),
      title: String(row[headerIndex.title] || ''),
      phone: String(row[headerIndex.phone] || ''),
      email: String(row[headerIndex.email] || ''),
      address: String(row[headerIndex.address] || ''),
      website: String(row[headerIndex.website] || ''),
      tags: String(row[headerIndex.tags] || ''),
      notes: String(row[headerIndex.notes] || ''),
      image_file_id: String(row[headerIndex.image_file_id] || ''),
      image_url: String(row[headerIndex.image_url] || ''),
      raw_json: String(row[headerIndex.raw_json] || '')
    });
  }

  return items;
}

function saveBase64Image_(imageBase64, filename) {
  const folderId = getRequiredProperty_('DRIVE_FOLDER_ID');
  const folder = DriveApp.getFolderById(folderId);

  const bytes = Utilities.base64Decode(imageBase64);
  const blob = Utilities.newBlob(bytes, 'image/jpeg', filename);
  return folder.createFile(blob);
}

function sanitizeFilename_(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'card.jpg';
}

function emptyFields_() {
  return {
    name: '',
    company: '',
    title: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    tags: '',
    notes: ''
  };
}

function normalizeFields_(fields) {
  const base = emptyFields_();
  FIELD_KEYS.forEach(function (key) {
    const value = fields && fields[key] !== undefined ? fields[key] : '';
    base[key] = String(value || '');
  });
  return base;
}

function toIsoString_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }

  const str = String(value || '');
  if (!str) {
    return '';
  }

  const timestamp = new Date(str).getTime();
  if (!isNaN(timestamp)) {
    return new Date(timestamp).toISOString();
  }

  return str;
}

function parseDateInput_(input, isEndOfDay) {
  const raw = String(input || '');
  if (!raw) {
    return null;
  }

  const date = new Date(raw + 'T00:00:00Z');
  if (isNaN(date.getTime())) {
    return null;
  }

  if (isEndOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

function normalizeLower_(value) {
  return String(value || '').trim().toLowerCase();
}

function getRequiredProperty_(key) {
  const value = getProperty_(key, '');
  if (!value) {
    throw new Error('Missing Script Property: ' + key);
  }
  return value;
}

function getProperty_(key, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return value;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function buildResponse_(e, payload) {
  const transport = String((e && e.parameter && e.parameter.transport) || '').toLowerCase();
  if (transport === 'postmessage') {
    return postMessageResponse_(e, payload);
  }
  return jsonResponse_(payload);
}

function postMessageResponse_(e, payload) {
  const callbackId = String((e && e.parameter && e.parameter.callback_id) || '');
  const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
  const safeCallbackId = JSON.stringify(callbackId);

  const html =
    '<!doctype html><html><body><script>' +
    '(function(){' +
    'var msg={__gas_bridge:true,callbackId:' +
    safeCallbackId +
    ',payload:' +
    safePayload +
    '};' +
    'try{if(window.parent){window.parent.postMessage(msg,\"*\");}}catch(e){}' +
    'try{if(window.opener){window.opener.postMessage(msg,\"*\");}}catch(e){}' +
    'document.body.textContent=\"ok\";' +
    '})();' +
    '</script></body></html>';

  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(
    HtmlService.XFrameOptionsMode.ALLOWALL
  );
}
