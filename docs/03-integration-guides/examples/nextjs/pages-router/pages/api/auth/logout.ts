import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Set-Cookie', [
    serialize('access_token', '', { httpOnly: true, path: '/', maxAge: -1 }),
    serialize('refresh_token', '', { httpOnly: true, path: '/', maxAge: -1 }),
    serialize('expires_at', '', { httpOnly: true, path: '/', maxAge: -1 }),
  ]);
  res.redirect('/');
}