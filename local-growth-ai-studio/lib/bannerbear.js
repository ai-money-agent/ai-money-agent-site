const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function imageFileUrl(image) {
  const files = image?.files || {};
  const url = files.png || files.jpg || files.webp || files.avif || image?.image_url || image?.image_url_full || '';
  if (typeof url !== 'string' || !url.startsWith('https://')) return '';
  return url;
}

export async function uploadBannerbearAsset({ apiKey, bytes, mimeType }) {
  if (!apiKey) throw Object.assign(new Error('Bannerbear API key is missing.'), { status: 503 });
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 5 * 1024 * 1024) {
    throw Object.assign(new Error('Product photo must be smaller than 5 MB.'), { status: 413 });
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw Object.assign(new Error('Use a JPG, PNG or WebP product photo.'), { status: 415 });
  }
  let response;
  let asset;
  try {
    response = await fetch('https://api.bannerbear.com/v5/assets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': mimeType },
      body: bytes,
      signal: AbortSignal.timeout(30000)
    });
    asset = await readJson(response);
  } catch {
    throw Object.assign(new Error('Could not upload the product photo to Bannerbear.'), { status: 502 });
  }
  if (!response.ok || !asset.uid || typeof asset.url !== 'string' || !asset.url.startsWith('https://cdn.bannerbear.com/')) {
    throw Object.assign(new Error('Bannerbear could not store the product photo. Check the API key permissions.'), { status: 502 });
  }
  return { uid: asset.uid, url: asset.url };
}

export async function generateBannerbearImage({ apiKey, templateUid, modifications }) {
  if (!apiKey || !templateUid) {
    throw Object.assign(new Error('Bannerbear is not configured. Add the server API key and template UID first.'), { status: 503 });
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  let response;
  let image;
  try {
    response = await fetch('https://api.bannerbear.com/v5/images', {
      method: 'POST',
      headers,
      body: JSON.stringify({ template: templateUid, modifications: { objects: modifications }, formats: ['png'] }),
      signal: AbortSignal.timeout(45000)
    });
    image = await readJson(response);
  } catch {
    throw Object.assign(new Error('Could not reach Bannerbear. Try again later.'), { status: 502 });
  }

  if (!response.ok) {
    const status = response.status === 401 || response.status === 403 ? 502 : response.status === 429 ? 429 : 502;
    throw Object.assign(new Error(status === 429 ? 'Bannerbear is busy. Wait a moment and try again.' : 'Bannerbear could not create the design. Check the API key and template configuration.'), { status });
  }

  if (!image.uid && !imageFileUrl(image)) {
    throw Object.assign(new Error('Bannerbear returned an incomplete design response.'), { status: 502 });
  }

  for (let attempt = 0; !imageFileUrl(image) && image.uid && attempt < 12; attempt += 1) {
    if (image.status === 'failed') {
      throw Object.assign(new Error('Bannerbear could not render this design. Check the template layers.'), { status: 502 });
    }
    await wait(1500);
    try {
      response = await fetch(`https://api.bannerbear.com/v5/images/${encodeURIComponent(image.uid)}`, {
        headers,
        signal: AbortSignal.timeout(10000)
      });
      image = await readJson(response);
      if (!response.ok) {
        throw Object.assign(new Error('Could not retrieve the generated design from Bannerbear.'), { status: 502 });
      }
    } catch (error) {
      if (error.status) throw error;
      throw Object.assign(new Error('Could not retrieve the generated design from Bannerbear.'), { status: 502 });
    }
  }

  const url = imageFileUrl(image);
  if (!url) {
    throw Object.assign(new Error('Bannerbear is still rendering the design. Please try again in a minute.'), { status: 504 });
  }
  return { uid: image.uid || null, imageUrl: url, status: image.status || 'completed' };
}
