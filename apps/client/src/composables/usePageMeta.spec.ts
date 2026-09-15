import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_OG_IMAGE, toCanonicalUrl, usePageMeta } from './usePageMeta';
import { PUBLIC_ROUTES } from '../content/public-routes';

function readMeta(attribute: 'name' | 'property', key: string): string | null {
  return (
    document.head
      .querySelector(`meta[${attribute}="${key}"]`)
      ?.getAttribute('content') ?? null
  );
}

describe('usePageMeta', () => {
  afterEach(() => {
    document.title = '';
    document.head
      .querySelectorAll('meta[name], meta[property], link[rel="canonical"]')
      .forEach((element) => element.remove());
  });

  it('should build absolute canonical urls', () => {
    expect(toCanonicalUrl('/')).toBe('https://cgpagrahambell.cl/');
    expect(toCanonicalUrl('/nosotros')).toBe(
      'https://cgpagrahambell.cl/nosotros',
    );
  });

  it('should set the document title of the requested route', () => {
    usePageMeta('About');

    const about = PUBLIC_ROUTES.find((route) => route.name === 'About');
    expect(document.title).toBe(about?.title);
  });

  it('should set the description, canonical and social tags', () => {
    usePageMeta('Transparency');

    const transparency = PUBLIC_ROUTES.find(
      (route) => route.name === 'Transparency',
    );

    expect(readMeta('name', 'description')).toBe(transparency?.description);
    expect(readMeta('property', 'og:url')).toBe(
      'https://cgpagrahambell.cl/transparencia',
    );
    expect(readMeta('property', 'og:image')).toBe(DEFAULT_OG_IMAGE);
    expect(readMeta('name', 'twitter:card')).toBe('summary_large_image');
    expect(
      document.head
        .querySelector('link[rel="canonical"]')
        ?.getAttribute('href'),
    ).toBe('https://cgpagrahambell.cl/transparencia');
  });

  it('should reuse the existing tags when navigating between routes', () => {
    usePageMeta('Home');
    usePageMeta('Contact');

    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(
      1,
    );
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(readMeta('property', 'og:url')).toBe('https://cgpagrahambell.cl/contacto');
  });

  it('should leave the document untouched for an unknown route name', () => {
    document.title = 'Titulo previo';

    // El nombre no existe en la lista canónica: no debe romper la navegación.
    usePageMeta('UnknownRoute' as never);

    expect(document.title).toBe('Titulo previo');
  });
});
