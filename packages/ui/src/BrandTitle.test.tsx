import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandTitle } from './BrandTitle.js';

describe('BrandTitle', () => {
  it('renders the title and an optional note', () => {
    expect(renderToStaticMarkup(<BrandTitle />)).toBe(
      '<h1 class="stext-brand">SORCERIAN Text</h1>',
    );
    expect(renderToStaticMarkup(<BrandTitle note="v2" />)).toContain('<small> v2</small>');
  });
});
