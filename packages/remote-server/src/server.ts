import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import qrcode from 'qrcode-terminal';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = '0.0.0.0';

// Generate a random token for this session
const TOKEN = crypto.randomBytes(16).toString('hex');

const fastify = Fastify({ logger: true });

// Register plugins
await fastify.register(websocket);

// Serve static files from the client build directory (if it exists)
const clientDistPath = path.resolve(__dirname, '../../remote-client/dist');
if (fs.existsSync(clientDistPath)) {
  await fastify.register(fastifyStatic, {
    root: clientDistPath,
    prefix: '/',
  });
} else {
  // Fallback for dev mode where client might not be built
  fastify.get('/', async (request, reply) => {
    return { status: 'ok', message: 'Pi Remote Server Running. Client not found at ' + clientDistPath };
  });
}

// Store active connections and their associated pi processes
// In a real multi-user scenario, we might map tokens to sessions.
// For now, single session.
let piProcess: ReturnType<typeof spawn> | null = null;

// WebSocket endpoint
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const query = req.query as { token?: string };

    // Auth check
    if (query.token !== TOKEN) {
      connection.socket.close(1008, 'Invalid token');
      return;
    }

    console.log(chalk.green('Client connected!'));

    // Spawn pi if not already running
    // We run "pi" from the local monorepo packages if possible, or assume it's in path
    // For dev, we'll try to use the local tsx execution of coding-agent
    if (!piProcess) {
      console.log(chalk.blue('Spawning pi agent...'));

      // Determine how to run pi.
      // Option 1: 'pi' command if installed globally
      // Option 2: 'npx tsx packages/coding-agent/src/cli.ts' if in dev

      const repoRoot = path.resolve(__dirname, '../../..');
      const agentCliPath = path.join(repoRoot, 'packages/coding-agent/src/cli.ts');

      if (fs.existsSync(agentCliPath)) {
        // Dev mode: run from source
        piProcess = spawn('npx', ['tsx', agentCliPath, '--mode', 'rpc', '--no-session'], {
          cwd: repoRoot, // Run from repo root so it finds configs
          env: process.env,
          stdio: ['pipe', 'pipe', 'inherit'] // pipe stdin/stdout, inherit stderr for logs
        });
      } else {
        // Prod mode: assume 'pi' is in path
        piProcess = spawn('pi', ['--mode', 'rpc', '--no-session'], {
            env: process.env,
            stdio: ['pipe', 'pipe', 'inherit']
        });
      }

      piProcess.on('exit', (code) => {
        console.log(chalk.yellow(`Pi agent exited with code ${code}`));
        piProcess = null;
        connection.socket.close();
      });

      // Forward stdout (JSON lines) to WebSocket
      let buffer = '';
      piProcess.stdout?.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');

        // The last element is either an empty string (if data ended with \n)
        // or a partial line. We keep it in the buffer.
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (line.trim()) {
                connection.socket.send(line);
            }
        }
      });
    }

    // Forward WebSocket messages to pi stdin
    connection.socket.on('message', (message) => {
      if (piProcess && piProcess.stdin) {
        piProcess.stdin.write(message.toString() + '\n');
      }
    });

    connection.socket.on('close', () => {
      console.log(chalk.yellow('Client disconnected'));
      // We could kill the process here, or keep it running for a reconnect.
      // For now, let's keep it running to allow reconnects to same session context if we supported sessions.
      // But we passed --no-session, so maybe we should kill it?
      // Let's kill it to keep state clean for now.
      if (piProcess) {
         piProcess.kill();
         piProcess = null;
      }
    });
  });
});

// Start server
const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: HOST });
    console.log(chalk.cyan(`\nServer listening on ${address}`));
    console.log(chalk.cyan(`Access Token: ${chalk.bold(TOKEN)}`));

    // Print connection info
    const url = `http://${HOST}:${PORT}?token=${TOKEN}`;
    console.log(`\nOpen this URL on your phone (ensure you are on the same Tailnet):`);
    console.log(chalk.underline(url));

    // QR Code
    qrcode.generate(url, { small: true });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
