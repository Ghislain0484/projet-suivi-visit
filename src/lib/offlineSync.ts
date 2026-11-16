import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface OfflineMutation {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload: any;
  createdAt: number;
  retryCount: number;
  description?: string;
}

const CACHE_PREFIX = 'gico_cache_';
const QUEUE_KEY = 'gico_offline_mutations_queue';
const LAST_SYNC_KEY = 'gico_last_sync_timestamp';

/**
 * Lit les données du cache local instantanément (0 ms)
 */
export function getOfflineCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Vérification de validité (TTL par défaut de 24 heures en mode secours)
    if (parsed && parsed.data !== undefined) {
      return parsed.data as T;
    }
    return null;
  } catch (err) {
    console.warn(`[Cache] Erreur de lecture sur ${key}:`, err);
    return null;
  }
}

/**
 * Enregistre les données dans le cache local
 */
export function setOfflineCache<T>(key: string, data: T): void {
  try {
    const item = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(item));
  } catch (err) {
    // Si localStorage est plein, purger les anciens caches
    try {
      cleanupOldCache();
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) {
      console.warn(`[Cache] Impossible d'écrire sur ${key}:`, e);
    }
  }
}

function cleanupOldCache() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX) && !k.includes('services') && !k.includes('tasks')) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

/**
 * Récupère les mutations en attente de synchronisation
 */
export function getOfflineQueue(): OfflineMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Enfile une action effectuée hors-ligne
 */
export function enqueueOfflineMutation(mutation: Omit<OfflineMutation, 'id' | 'createdAt' | 'retryCount'>): OfflineMutation {
  const item: OfflineMutation = {
    ...mutation,
    id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
    retryCount: 0,
  };

  const queue = getOfflineQueue();
  queue.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

  // Notifier les composants abonnés
  window.dispatchEvent(new CustomEvent('gico_offline_queue_changed', { detail: { count: queue.length } }));
  return item;
}

/**
 * Supprime une mutation terminée de la file
 */
export function removeOfflineMutation(id: string): void {
  const queue = getOfflineQueue().filter((m) => m.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('gico_offline_queue_changed', { detail: { count: queue.length } }));
}

/**
 * Synchronise toutes les modifications en attente avec Supabase
 */
export async function processOfflineSyncQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  console.log(`[AutoSync] Démarrage de la synchronisation de ${queue.length} action(s) hors connexion...`);

  for (const mut of queue) {
    try {
      let res: any;

      if (mut.action === 'insert') {
        // Enlever les propriétés d'identifiant local temporaire si nécessaire
        const payloadToInsert = { ...mut.payload };
        if (payloadToInsert._temp_id) delete payloadToInsert._temp_id;

        res = await (supabase.from(mut.table as any).insert(payloadToInsert) as any);
      } else if (mut.action === 'update') {
        const { id, ...dataToUpdate } = mut.payload;
        if (!id) throw new Error('ID requis pour update');
        res = await (supabase.from(mut.table as any).update(dataToUpdate).eq('id', id) as any);
      } else if (mut.action === 'delete') {
        const { id } = mut.payload;
        if (!id) throw new Error('ID requis pour delete');
        res = await (supabase.from(mut.table as any).delete().eq('id', id) as any);
      }

      if (res && res.error) {
        console.error(`[AutoSync] Erreur sur la table ${mut.table}:`, res.error);
        mut.retryCount++;
        if (mut.retryCount >= 5) {
          // Trop de tentatives, suppression pour ne pas bloquer le reste
          removeOfflineMutation(mut.id);
          failed++;
        }
      } else {
        removeOfflineMutation(mut.id);
        synced++;
      }
    } catch (err) {
      console.error(`[AutoSync] Échec d'envoi pour ${mut.id}:`, err);
      failed++;
    }
  }

  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  window.dispatchEvent(new CustomEvent('gico_sync_completed', { detail: { synced, failed } }));

  return { synced, failed };
}

/**
 * Hook React personnalisé pour surveiller l'état du réseau et la synchronisation
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(() => getOfflineQueue().length);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      try {
        const result = await processOfflineSyncQueue();
        if (result.synced > 0) {
          setLastSyncMessage(`Connexion rétablie : ${result.synced} modification(s) synchronisée(s) avec succès !`);
          setTimeout(() => setLastSyncMessage(null), 6000);
        }
      } finally {
        setIsSyncing(false);
        setPendingCount(getOfflineQueue().length);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastSyncMessage('Mode hors-connexion actif. Vos saisies seront conservées et synchronisées dès le retour du réseau.');
      setTimeout(() => setLastSyncMessage(null), 6000);
    };

    const handleQueueChange = () => {
      setPendingCount(getOfflineQueue().length);
    };

    const handleSyncDone = (e: any) => {
      setPendingCount(getOfflineQueue().length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('gico_offline_queue_changed', handleQueueChange);
    window.addEventListener('gico_sync_completed', handleSyncDone);

    // Si on est déjà en ligne et qu'il y a des éléments en file, les synchroniser
    if (navigator.onLine && pendingCount > 0) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('gico_offline_queue_changed', handleQueueChange);
      window.removeEventListener('gico_sync_completed', handleSyncDone);
    };
  }, []);

  const syncNow = async () => {
    if (!navigator.onLine) {
      alert("Impossible de synchroniser : vous êtes actuellement hors connexion.");
      return;
    }
    setIsSyncing(true);
    try {
      const result = await processOfflineSyncQueue();
      setPendingCount(getOfflineQueue().length);
      if (result.synced > 0) {
        setLastSyncMessage(`${result.synced} action(s) synchronisée(s) avec succès !`);
        setTimeout(() => setLastSyncMessage(null), 5000);
      } else {
        setLastSyncMessage('Tout est déjà à jour avec le serveur.');
        setTimeout(() => setLastSyncMessage(null), 3000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncMessage,
    syncNow,
  };
}
