// Express routes
import express from 'express';
const app = express();

app.get('/express/users', (req, res) => {
  res.json({ framework: 'express' });
});

app.post('/express/users', authenticateExpress, (req, res) => {
  res.status(201).json({ created: true });
});

// Koa routes
import Koa from 'koa';
import Router from 'koa-router';

const koaApp = new Koa();
const router = new Router();

router.get('/koa/users', async (ctx) => {
  ctx.body = { framework: 'koa' };
});

router.post('/koa/users', authenticateKoa, async (ctx) => {
  ctx.status = 201;
  ctx.body = { created: true };
});

// Fastify routes  
import fastify from 'fastify';
const server = fastify();

server.get('/fastify/users', async (request, reply) => {
  return { framework: 'fastify' };
});

server.post('/fastify/users', {
  preHandler: authenticateFastify
}, async (request, reply) => {
  reply.code(201);
  return { created: true };
});

// Next.js API routes (file-based routing simulation)
export async function GET(request: Request) {
  return Response.json({ framework: 'nextjs' });
}

export async function POST(request: Request) {
  // Next.js API route handler
  return Response.json({ created: true }, { status: 201 });
}

// NestJS-style decorators (simulated)
class UsersController {
  @Get('/nestjs/users')
  findAll() {
    return { framework: 'nestjs' };
  }
  
  @Post('/nestjs/users')
  @UseGuards(AuthGuard)
  create() {
    return { created: true };
  }
}

// Middleware functions
function authenticateExpress(req: any, res: any, next: any) {
  // Express middleware
  next();
}

function authenticateKoa(ctx: any, next: any) {
  // Koa middleware  
  return next();
}

function authenticateFastify(request: any, reply: any, done: any) {
  // Fastify middleware
  done();
}

// Decorators (simulated)
function Get(path: string) {
  return function (target: any, propertyKey: string) {};
}

function Post(path: string) {
  return function (target: any, propertyKey: string) {};
}

function UseGuards(guard: any) {
  return function (target: any, propertyKey: string) {};
}

const AuthGuard = {};

export { app, koaApp, server, UsersController };