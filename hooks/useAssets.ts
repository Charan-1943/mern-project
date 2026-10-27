import { useCallback, useEffect, useMemo, useState } from "react";
import { initialAssets } from "../data/assets";
import type { Asset, AssetCategory } from "../types";

const DATABASE_NAME = "framevault";
const DATABASE_VERSION = 1;
const STORE_NAME = "assets";

function openAssetDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("category", "category");
        store.createIndex("name", "name");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the asset database."));
    request.onblocked = () => reject(new Error("The asset database is blocked by another open tab."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The asset database request failed."));
  });
}

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const database = await openAssetDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const storedAssets = await requestResult(transaction.objectStore(STORE_NAME).getAll() as IDBRequest<Asset[]>);
      setAssets(storedAssets.sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      database.close();
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const database = await openAssetDatabase();
        try {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const count = await requestResult(store.count());
          if (count === 0) {
            for (const asset of initialAssets) store.add(asset);
            await new Promise<void>((resolve, reject) => {
              transaction.oncomplete = () => resolve();
              transaction.onerror = () => reject(transaction.error ?? new Error("Could not initialize the asset library."));
              transaction.onabort = () => reject(transaction.error ?? new Error("Asset library initialization was cancelled."));
            });
          }
          const storedAssets = await requestResult(
            database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll() as IDBRequest<Asset[]>,
          );
          if (active) setAssets(storedAssets.sort((a, b) => a.name.localeCompare(b.name)));
        } finally {
          database.close();
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load the asset library.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const updateTags = useCallback(async (assetId: string, tags: string[]) => {
    const database = await openAssetDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const asset = await requestResult(store.get(assetId) as IDBRequest<Asset | undefined>);
      if (!asset) throw new Error("This asset no longer exists in the library.");
      asset.tags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
      await requestResult(store.put(asset));
      await refresh();
    } finally {
      database.close();
    }
  }, [refresh]);

  const addAsset = useCallback(async (
    name: string,
    category: AssetCategory,
    format: string,
    ratio: string,
    file?: File,
  ) => {
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error("Enter a name before adding an asset.");
    const asset: Asset = {
      id: crypto.randomUUID(),
      name: normalizedName,
      category,
      format: format.trim().toUpperCase() || "WEBM",
      ratio,
      duration: "00:05",
      tags: [],
      accent: "#9b9279",
      kind: "gradient",
      ...(file ? { file, fileName: file.name } : {}),
    };
    const database = await openAssetDatabase();
    try {
      await requestResult(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).add(asset));
      await refresh();
    } finally {
      database.close();
    }
    return asset;
  }, [refresh]);

  const value = useMemo(() => ({ assets, loading, error, updateTags, addAsset }), [assets, loading, error, updateTags, addAsset]);
  return value;
}
