import type { NextApiRequest, NextApiResponse } from 'next';
import { oauthClient } from '@/lib/oauth-client';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token found' });
    }

    try {
        const tokens = await oauthClient.refreshAccessToken(refreshToken);
        res.setHeader('Set-Cookie', [
            serialize('access_token', tokens.access_token, { httpOnly: true, path: '/', secure: process.env.NODE_ENV === 'production' }),
            serialize('expires_at', (Date.now() + tokens.expires_in * 1000).toString(), { httpOnly: true, path: '/', secure: process.env.NODE_ENV === 'production' }),
        ]);
        res.status(200).json({ message: 'Token refreshed' });
    } catch (error) {
        console.error('Token refresh failed:', error);
        res.status(401).json({ error: 'Failed to refresh token' });
    }
}