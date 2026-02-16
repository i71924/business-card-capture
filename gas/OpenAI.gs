const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4.1-mini';

function extractBusinessCardFields(imageBlob) {
  return extractBusinessCardFieldsWithRaw_(imageBlob).fields;
}

function extractBusinessCardFieldsWithRaw_(imageBlob) {
  const apiKey = getRequiredProperty_('OPENAI_API_KEY');
  const contentType = imageBlob.getContentType() || 'image/jpeg';
  const imageBase64 = Utilities.base64Encode(imageBlob.getBytes());
  const dataUrl = 'data:' + contentType + ';base64,' + imageBase64;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      company: { type: 'string' },
      title: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      address: { type: 'string' },
      website: { type: 'string' }
    },
    required: ['name', 'company', 'title', 'phone', 'email', 'address', 'website']
  };

  const payload = {
    model: OPENAI_MODEL,
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'business_card_fields',
        strict: true,
        schema: schema
      }
    },
    messages: [
      {
        role: 'system',
        content:
          'You extract text from business card images. Return strict JSON only. Use empty string when unknown. Never add extra keys.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Extract fields from this business card image. Output JSON with keys exactly: name, company, title, phone, email, address, website. Use empty string for uncertain values.'
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl
            }
          }
        ]
      }
    ]
  };

  const response = UrlFetchApp.fetch(OPENAI_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + apiKey
    }
  });

  const status = response.getResponseCode();
  const rawBody = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error('OpenAI API error: ' + status + ' ' + rawBody);
  }

  const parsed = JSON.parse(rawBody);
  const message =
    parsed &&
    parsed.choices &&
    parsed.choices[0] &&
    parsed.choices[0].message &&
    parsed.choices[0].message.content;

  const text = extractTextContent_(message);
  const fields = normalizeVisionJson_(text);

  return {
    fields: normalizeFields_(fields),
    rawJson: rawBody
  };
}

function extractTextContent_(messageContent) {
  if (typeof messageContent === 'string') {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    var texts = [];
    for (var i = 0; i < messageContent.length; i += 1) {
      var block = messageContent[i];
      if (block && typeof block.text === 'string') {
        texts.push(block.text);
      }
    }
    return texts.join('\n').trim();
  }

  return '';
}

function normalizeVisionJson_(text) {
  if (!text) {
    throw new Error('Empty model response');
  }

  var normalized = String(text).trim();
  normalized = normalized.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();

  var parsed = JSON.parse(normalized);
  return {
    name: String(parsed.name || ''),
    company: String(parsed.company || ''),
    title: String(parsed.title || ''),
    phone: String(parsed.phone || ''),
    email: String(parsed.email || ''),
    address: String(parsed.address || ''),
    website: String(parsed.website || '')
  };
}
