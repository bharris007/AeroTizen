import { createRelay } from "../lib/app.js";
import { createBlobStore } from "../lib/store.js";

const handle = createRelay({ env: process.env, fetchImpl: (...args) => fetch(...args), store: createBlobStore() });

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
