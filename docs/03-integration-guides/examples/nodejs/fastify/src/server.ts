import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import dotenv from 'dotenv';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';

dotenv.config();

const fastify = Fastify({ logger: true });

fastify.register(fastifyCookie);
fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET || 'a-very-strong-and-long-secret-for-session-in-dev',
  cookie: { secure: process.env.NODE_ENV === 'production' },
});

// Register plugins and routes
fastify.register(authPlugin);
fastify.register(authRoutes);

// Declare a protected route
fastify.get('/dashboard', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  // The request is authenticated if it reaches here
  // You can get user info from your API using the access token
  const accessToken = request.session.get('access_token');
  // const user = await fetchUser(accessToken);
  return { message: 'Welcome to the dashboard!', user: {name: 'John Doe'} };
});

fastify.get('/', async (request, reply) => {
    return { message: 'Hello! This is the public homepage.' };
});


const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();