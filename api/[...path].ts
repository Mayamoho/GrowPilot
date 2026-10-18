// The Vercel entry point: `@vercel/node` compiles this file into one Node.js Function and drives
// the exported http.Server itself, which is what lets the hosted URL serve /api/* and upgrade
// /live. It has to be a real source file, not something a build step generates — `vercel build`
// validates the `functions` patterns straight after cloning, before running any build command.
import server from '../server';

export default server;
