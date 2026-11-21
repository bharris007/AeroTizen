// Private storage. Production uses Vercel Blob; tests and local runs use memory.
export const createMemoryStore = () => {
  const items = new Map();
  return {
    items,
    async read(pathname) {
      return items.has(pathname) ? JSON.parse(items.get(pathname)) : null;
    },
    async write(pathname, value, { overwrite = false } = {}) {
      if (!overwrite && items.has(pathname)) {
        throw new Error("exists");
      }
      items.set(pathname, JSON.stringify(value));
    },
    async list(prefix) {
      return [...items.keys()].filter((key) => key.startsWith(prefix)).sort();
    },
    async remove(pathnames) {
      pathnames.forEach((pathname) => items.delete(pathname));
    },
  };
};

const BLOB_TTL_DAYS = 1;

// `expires` writes get the blob store's one-day TTL; account records do not expire.
export const createBlobStore = () => {
  const blob = import("@vercel/blob");
  return {
    async read(pathname) {
      const { get } = await blob;
      const result = await get(pathname, { access: "private", useCache: false });
      if (!result || !result.stream) {
        return null;
      }
      try {
        return JSON.parse(await new Response(result.stream).text());
      } catch {
        return null;
      }
    },
    async write(pathname, value, { expires = false, overwrite = false } = {}) {
      const { put } = await blob;
      await put(pathname, JSON.stringify(value), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: overwrite,
        contentType: "application/json",
        ...(expires ? { ttlDays: BLOB_TTL_DAYS } : {}),
      });
    },
    async list(prefix) {
      const { list } = await blob;
      const { blobs } = await list({ prefix, limit: 1000 });
      return blobs.map((item) => item.pathname).sort();
    },
    async remove(pathnames) {
      if (pathnames.length) {
        const { del } = await blob;
        await del(pathnames);
      }
    },
  };
};
