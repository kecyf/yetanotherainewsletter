// /llms-full.txt: every issue as markdown, newest first, then the endpoint map. one fetch.
import type { APIRoute } from 'astro';
import { getKb, llmsFull } from '../lib/kb';

export const GET: APIRoute = () =>
  new Response(llmsFull(getKb()), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
