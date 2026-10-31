// Google Search Console ownership check. Served by a Function so the response is a plain 200 with exactly this body:
// for static .html files Pages answers with a redirect to the URL without .html, which the check does not accept.
const BODY = 'google-site-verification: googlee808fb02e2c3ca02.html';

export const onRequestGet: PagesFunction = () =>
  new Response(BODY, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } });
