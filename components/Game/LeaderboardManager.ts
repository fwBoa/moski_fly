import { db, auth } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    query,
    orderBy,
    limit,
    getDocs,
    where,
    serverTimestamp,
} from 'firebase/firestore';

export interface LeaderboardEntry {
    pseudo: string;
    score: number;
    createdAt: Date | null;
}

const COLLECTION = 'leaderboard';
const PSEUDO_KEY = 'moski_pseudo';
const BEST_SUBMITTED_KEY = 'moski_best_submitted';

// --- Auth ---

/** Sign in anonymously and return UID */
export async function initAuth(): Promise<string | null> {
    try {
        const result = await signInAnonymously(auth);
        return result.user.uid;
    } catch (error) {
        console.error('Error signing in anonymously:', error);
        return null;
    }
}

/** Get current UID (null if not signed in) */
export function getCurrentUid(): string | null {
    return auth.currentUser?.uid || null;
}

// --- Pseudo management (localStorage) ---

export function getPseudo(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(PSEUDO_KEY);
}

export function savePseudo(pseudo: string): void {
    localStorage.setItem(PSEUDO_KEY, pseudo.trim().slice(0, 15));
}

// --- Pseudo availability ---

/** Check if a pseudo is already taken in Firestore */
export async function checkPseudoAvailable(pseudo: string): Promise<boolean> {
    try {
        const pseudoKey = pseudo.trim().toLowerCase();
        const docRef = doc(db, COLLECTION, pseudoKey);
        const docSnap = await getDoc(docRef);
        return !docSnap.exists();
    } catch (error) {
        console.error('Error checking pseudo:', error);
        return false; // Fail closed — treat as taken if error
    }
}

// --- Leaderboard operations ---

/** Submit score to Firestore (only if better than previous best) */
export async function submitScore(pseudo: string, score: number): Promise<boolean> {
    try {
        const uid = getCurrentUid();
        if (!uid) return false;

        // Check if this score beats the player's previous best submission
        const bestSubmitted = parseInt(localStorage.getItem(BEST_SUBMITTED_KEY) || '0', 10);
        if (score <= bestSubmitted) return false;

        // Basic validation
        if (!pseudo || pseudo.length < 1 || pseudo.length > 15) return false;
        if (score < 0 || score > 200) return false;

        const pseudoKey = pseudo.trim().toLowerCase();
        await setDoc(doc(db, COLLECTION, pseudoKey), {
            pseudo: pseudo.trim(),
            score,
            uid,
            createdAt: serverTimestamp(),
        });

        localStorage.setItem(BEST_SUBMITTED_KEY, score.toString());
        return true;
    } catch (error) {
        console.error('Error submitting score:', error);
        return false;
    }
}

/** Get top 30 scores from Firestore */
export async function getTop30(): Promise<LeaderboardEntry[]> {
    try {
        const q = query(
            collection(db, COLLECTION),
            orderBy('score', 'desc'),
            limit(30)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                pseudo: data.pseudo,
                score: data.score,
                createdAt: data.createdAt?.toDate() || null,
            };
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
}

/** Get player rank (1-indexed, or null if not found) */
export async function getPlayerRank(pseudo: string): Promise<number | null> {
    try {
        const bestSubmitted = parseInt(localStorage.getItem(BEST_SUBMITTED_KEY) || '0', 10);
        if (bestSubmitted === 0) return null;

        const q = query(
            collection(db, COLLECTION),
            where('score', '>', bestSubmitted)
        );
        const snapshot = await getDocs(q);
        return snapshot.size + 1;
    } catch (error) {
        console.error('Error getting rank:', error);
        return null;
    }
}
