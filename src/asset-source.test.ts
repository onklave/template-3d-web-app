import { describe, expect, it } from 'vitest';
import { resolveAssetUrl } from './asset-source';

describe('resolveAssetUrl', () => {
  it('serves from the site root when no content base is configured', () => {
    expect(resolveAssetUrl('models/scene.glb')).toBe('/models/scene.glb');
  });

  it('tolerates a leading slash', () => {
    expect(resolveAssetUrl('/models/scene.glb')).toBe('/models/scene.glb');
  });

  // A caller holding a signed URL from a content release must not have it
  // rewritten — that would strip the signature and 403.
  it('passes absolute URLs through unchanged', () => {
    const signed = 'https://cdn.example.com/o/abc?sig=xyz';
    expect(resolveAssetUrl(signed)).toBe(signed);
  });
});
