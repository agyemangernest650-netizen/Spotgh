// assets/js/blog-post.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  const slug = new URLSearchParams(location.search).get('slug');
  const main = document.getElementById('pageMain');
  if (!slug) { location.href = '/pages/blog.html'; return; }

  main.innerHTML = `<div class="container" style="padding:2rem 1rem;max-width:720px"><div class="card skeleton" style="height:400px"></div></div>`;
  try {
    const { post, featured_businesses } = await API.get(`/blog/${slug}`);
    document.title = `${post.meta_title || post.title} | SpotGH`;
    const setMeta = (name, content) => {
      let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(name.startsWith('og:') ? 'property' : 'name', name); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('description', post.meta_description || post.excerpt || '');
    setMeta('og:title', post.title);
    setMeta('og:description', post.excerpt || '');
    if (post.cover_url) setMeta('og:image', post.cover_url);

    main.innerHTML = `
      <div class="container" style="padding:2rem 1rem 4rem;max-width:720px">
        <a href="/pages/blog.html" style="font-size:.85rem;color:var(--clr-text-2)"><i class="fa-solid fa-arrow-left"></i> Back to Blog</a>
        ${post.cover_url ? `<img src="${post.cover_url}" style="width:100%;border-radius:12px;margin:1rem 0;max-height:320px;object-fit:cover">` : ''}
        <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;margin-bottom:.25rem">${post.title}</h1>
        <p style="color:var(--clr-text-3);font-size:.85rem;margin-bottom:1.5rem">${formatDate(post.published_at)}</p>
        <div style="line-height:1.75;font-size:1rem;color:var(--clr-text)" id="blogBody"></div>
        ${featured_businesses?.length ? `
          <hr style="border:none;border-top:1px solid var(--clr-border);margin:2.5rem 0 1.5rem">
          <h3 style="font-weight:700;margin-bottom:1rem">Featured in this article</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem">
            ${featured_businesses.map(b => `
              <a href="/pages/business.html?slug=${b.slug}" class="card" style="padding:1rem;text-decoration:none;color:inherit;display:flex;align-items:center;gap:.75rem">
                ${b.logo_url ? `<img src="${b.logo_url}" style="width:44px;height:44px;border-radius:8px;object-fit:cover">` : ''}
                <div><strong style="font-size:.9rem">${b.name}</strong><div style="font-size:.75rem;color:var(--clr-text-2)">${b.city || ''}${b.avg_rating ? ` · ⭐ ${b.avg_rating}` : ''}</div></div>
              </a>`).join('')}
          </div>` : ''}
      </div>`;
    // content is stored as plain text/markdown-ish — render as paragraphs, never raw HTML injection from admin input beyond basic line breaks
    document.getElementById('blogBody').innerHTML = post.content.split('\n\n').map(p => `<p style="margin-bottom:1rem">${p.replace(/\n/g,'<br>')}</p>`).join('');
  } catch {
    main.innerHTML = `<div class="container" style="padding:3rem 1rem;text-align:center"><p style="color:var(--clr-danger)">Article not found.</p></div>`;
  }
});
