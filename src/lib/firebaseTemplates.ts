import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface PieceTemplate {
  name: string;
  description: string;
  rotationMode?: 'relative' | 'absolute';
  wireDiameter?: number;
  cameraDirection?: { x: number; y: number; z: number };
  steps: any[];
}

const COLLECTION_NAME = 'templates';

// Helper to normalize template names for deduplication & matching (ignores case, extra spaces, accents, and Portuguese articles like "da", "do", "de")
export const normalizeTemplateKey = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/\b(da|do|de|das|dos)\b/g, '') // remove articles
    .replace(/[^a-z0-9]/g, ' ') // keep letters & numbers
    .replace(/\s+/g, ' ')
    .trim();
};

export async function saveTemplateToFirestore(template: PieceTemplate): Promise<void> {
  try {
    const docId = normalizeTemplateKey(template.name);
    if (!docId) return;
    const ref = doc(db, COLLECTION_NAME, docId);
    await setDoc(
      ref,
      {
        name: template.name,
        description: template.description || '',
        rotationMode: template.rotationMode || 'relative',
        wireDiameter: template.wireDiameter || 2.0,
        cameraDirection: template.cameraDirection || { x: -0.45, y: -0.35, z: 1.8 },
        steps: template.steps,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error('Erro ao salvar no Firestore:', e);
  }
}

export async function deleteTemplateFromFirestore(templateName: string): Promise<void> {
  try {
    const docId = normalizeTemplateKey(templateName);
    if (!docId) return;
    const ref = doc(db, COLLECTION_NAME, docId);
    await deleteDoc(ref);
  } catch (e) {
    console.error('Erro ao deletar do Firestore:', e);
  }
}

export function subscribeTemplatesFromFirestore(
  onUpdate: (templates: PieceTemplate[]) => void,
  defaultTemplates: PieceTemplate[]
): () => void {
  const colRef = collection(db, COLLECTION_NAME);

  // Seed default built-in templates if collection is empty
  getDocs(colRef)
    .then((snap) => {
      if (snap.empty) {
        defaultTemplates.forEach((tpl) => {
          saveTemplateToFirestore(tpl);
        });
      }
    })
    .catch((err) => {
      console.warn('Verificação inicial do Firestore:', err);
    });

  return onSnapshot(
    colRef,
    (snapshot) => {
      const firestoreList: PieceTemplate[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as PieceTemplate;
        if (data && data.name && Array.isArray(data.steps)) {
          firestoreList.push(data);
        }
      });
      if (firestoreList.length > 0) {
        onUpdate(firestoreList);
      }
    },
    (err) => {
      console.warn('Escuta em tempo real do Firestore:', err);
    }
  );
}
