import { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult } from 'next';
import { ParsedUrlQuery } from 'querystring';
import { oauthClient } from './oauth-client';
import { serialize } from 'cookie';

export function withAuth(gssp?: GetServerSideProps) {
  return async (context: GetServerSidePropsContext): Promise<GetServerSidePropsResult<any>> => {
    const { req, res } = context;
    const accessToken = req.cookies.access_token;
    const expiresAt = req.cookies.expires_at;

    if (!accessToken || !expiresAt) {
      return {
        redirect: {
          destination: '/auth/login',
          permanent: false,
        },
      };
    }

    if (Date.now() >= parseInt(expiresAt) - 300000) {
      const refreshToken = req.cookies.refresh_token;
      if (refreshToken) {
        try {
          const tokens = await oauthClient.refreshAccessToken(refreshToken);
          
          res.setHeader('Set-Cookie', [
            serialize('access_token', tokens.access_token, { httpOnly: true, path: '/', secure: process.env.NODE_ENV === 'production' }),
            serialize('expires_at', (Date.now() + tokens.expires_in * 1000).toString(), { httpOnly: true, path: '/', secure: process.env.NODE_ENV === 'production' }),
          ]);

          // The new token is now in the headers, but not in the req.cookies for the current request.
          // We need to pass it to gssp if it needs it.
          if (gssp) {
              // We need to update the context for the wrapped gssp
              context.req.cookies.access_token = tokens.access_token;
          }

        } catch (error) {
          console.error("Failed to refresh token", error);
          // If refresh fails, clear cookies and redirect to login
          res.setHeader('Set-Cookie', [
            serialize('access_token', '', { httpOnly: true, path: '/', maxAge: -1 }),
            serialize('refresh_token', '', { httpOnly: true, path: '/', maxAge: -1 }),
            serialize('expires_at', '', { httpOnly: true, path: '/', maxAge: -1 }),
          ]);
          return {
            redirect: {
              destination: '/auth/login',
              permanent: false,
            },
          };
        }
      } else {
        // No refresh token, redirect to login
        return {
            redirect: {
              destination: '/auth/login',
              permanent: false,
            },
          };
      }
    }

    if (gssp) {
      return await gssp(context);
    }

    return { props: {} };
  };
}