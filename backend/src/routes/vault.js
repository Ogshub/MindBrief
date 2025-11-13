const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // Try service account JSON first (most secure)
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : null;

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin initialized with service account");
    }
    // Try using project ID and application default credentials
    else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
      console.log("✅ Firebase Admin initialized with project ID");
    }
    // Try using GOOGLE_APPLICATION_CREDENTIALS environment variable
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log(
        "✅ Firebase Admin initialized with application default credentials"
      );
    } else {
      console.warn(
        "⚠️  Firebase Admin not configured. Vault storage will use in-memory storage (not persistent)."
      );
      console.warn(
        "   To enable persistent storage, set FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID, or GOOGLE_APPLICATION_CREDENTIALS in your .env file"
      );
    }
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error.message);
    console.warn("   Falling back to in-memory storage");
  }
}

// In-memory storage fallback (for development)
const inMemoryVault = new Map();

// Get user's vault items
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Try Firebase first
    if (admin.apps.length > 0) {
      try {
        const db = admin.firestore();
        const vaultRef = db.collection("vaults").doc(userId);
        const doc = await vaultRef.get();

        if (doc.exists) {
          const data = doc.data();
          return res.json({
            success: true,
            items: data.items || [],
          });
        } else {
          return res.json({
            success: true,
            items: [],
          });
        }
      } catch (firebaseError) {
        console.error("Firebase error, using fallback:", firebaseError.message);
        // Fall through to in-memory storage
      }
    }

    // Fallback to in-memory storage
    const items = inMemoryVault.get(userId) || [];
    return res.json({
      success: true,
      items: items,
    });
  } catch (error) {
    console.error("Error getting vault items:", error);
    res.status(500).json({
      error: "Failed to retrieve vault items",
      message: error.message,
    });
  }
});

// Save item to vault
router.post("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { topic, summary, sources } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!topic || !summary) {
      return res.status(400).json({ error: "Topic and summary are required" });
    }

    const vaultItem = {
      id: Date.now().toString(),
      topic: topic,
      summary: summary,
      sources: sources || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Try Firebase first
    if (admin.apps.length > 0) {
      try {
        const db = admin.firestore();
        const vaultRef = db.collection("vaults").doc(userId);
        const doc = await vaultRef.get();

        const items = doc.exists ? doc.data().items || [] : [];
        items.push(vaultItem);

        await vaultRef.set({ items: items }, { merge: true });

        return res.json({
          success: true,
          item: vaultItem,
        });
      } catch (firebaseError) {
        console.error("Firebase error, using fallback:", firebaseError.message);
        // Fall through to in-memory storage
      }
    }

    // Fallback to in-memory storage
    const items = inMemoryVault.get(userId) || [];
    items.push(vaultItem);
    inMemoryVault.set(userId, items);

    return res.json({
      success: true,
      item: vaultItem,
    });
  } catch (error) {
    console.error("Error saving vault item:", error);
    res.status(500).json({
      error: "Failed to save vault item",
      message: error.message,
    });
  }
});

// Delete item from vault
router.delete("/:userId/:itemId", async (req, res) => {
  try {
    const { userId, itemId } = req.params;

    if (!userId || !itemId) {
      return res
        .status(400)
        .json({ error: "User ID and Item ID are required" });
    }

    // Try Firebase first
    if (admin.apps.length > 0) {
      try {
        const db = admin.firestore();
        const vaultRef = db.collection("vaults").doc(userId);
        const doc = await vaultRef.get();

        if (doc.exists) {
          const items = (doc.data().items || []).filter(
            (item) => item.id !== itemId
          );
          await vaultRef.set({ items: items }, { merge: true });

          return res.json({
            success: true,
            message: "Item deleted successfully",
          });
        }
      } catch (firebaseError) {
        console.error("Firebase error, using fallback:", firebaseError.message);
        // Fall through to in-memory storage
      }
    }

    // Fallback to in-memory storage
    const items = inMemoryVault.get(userId) || [];
    const filteredItems = items.filter((item) => item.id !== itemId);
    inMemoryVault.set(userId, filteredItems);

    return res.json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting vault item:", error);
    res.status(500).json({
      error: "Failed to delete vault item",
      message: error.message,
    });
  }
});

module.exports = router;
