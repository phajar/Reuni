// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCfZ9zV6DOuSZoFoFvkW8NCSaxNlmn8R8k",
    authDomain: "reuniakbar.firebaseapp.com",
    projectId: "reuniakbar",
    storageBucket: "reuniakbar.firebasestorage.app",
    messagingSenderId: "542951643652",
    appId: "1:542951643652:web:1b4b7dac6c676a5d6c3351"
};

// Initialize Firebase using compat mode
firebase.initializeApp(firebaseConfig);

// Make services available globally
window.auth = firebase.auth();
window.db = firebase.firestore();
try {
    window.db.settings({ experimentalForceLongPolling: true });
} catch (e) {
    console.warn("Firestore settings already configured:", e);
}

// --- CLIENT-SIDE VERSION-BASED CACHING SYNC SYSTEM PATCH ---
(function() {
    function getCollectionNameFromPath(path) {
        if (!path) return null;
        const parts = path.split('/');
        return parts[0];
    }

    window.triggerSyncUpdate = (collectionName) => {
        if (collectionName !== "alumni" && collectionName !== "finance") return;
        setTimeout(async () => {
            try {
                const updateData = {};
                updateData[`${collectionName}_version`] = Date.now().toString();
                await firebase.firestore().collection("settings").doc("sync_state").set(updateData, { merge: true });
                console.log(`[SYNC] Version updated for ${collectionName}`);
            } catch (e) {
                console.warn(`[SYNC] Safe warning: Failed to update version for ${collectionName} (This is normal if firestore.rules are not deployed yet):`, e);
            }
        }, 50);
    };

    // 1. Patch CollectionReference.prototype.add
    const originalAdd = firebase.firestore.CollectionReference.prototype.add;
    firebase.firestore.CollectionReference.prototype.add = async function(...args) {
        const res = await originalAdd.apply(this, args);
        if (this.id === "alumni" || this.id === "finance") {
            window.triggerSyncUpdate(this.id);
        }
        return res;
    };

    // 2. Patch DocumentReference.prototype.set
    const originalSet = firebase.firestore.DocumentReference.prototype.set;
    firebase.firestore.DocumentReference.prototype.set = async function(...args) {
        const res = await originalSet.apply(this, args);
        const colName = getCollectionNameFromPath(this.path);
        if (colName === "alumni" || colName === "finance") {
            window.triggerSyncUpdate(colName);
        }
        return res;
    };

    // 3. Patch DocumentReference.prototype.update
    const originalUpdate = firebase.firestore.DocumentReference.prototype.update;
    firebase.firestore.DocumentReference.prototype.update = async function(...args) {
        const res = await originalUpdate.apply(this, args);
        const colName = getCollectionNameFromPath(this.path);
        if (colName === "alumni" || colName === "finance") {
            window.triggerSyncUpdate(colName);
        }
        return res;
    };

    // 4. Patch DocumentReference.prototype.delete
    const originalDelete = firebase.firestore.DocumentReference.prototype.delete;
    firebase.firestore.DocumentReference.prototype.delete = async function(...args) {
        const res = await originalDelete.apply(this, args);
        const colName = getCollectionNameFromPath(this.path);
        if (colName === "alumni" || colName === "finance") {
            window.triggerSyncUpdate(colName);
        }
        return res;
    };

    // 5. Patch WriteBatch.prototype.set, update, delete, and commit
    const originalBatchSet = firebase.firestore.WriteBatch.prototype.set;
    const originalBatchUpdate = firebase.firestore.WriteBatch.prototype.update;
    const originalBatchDelete = firebase.firestore.WriteBatch.prototype.delete;
    const originalBatchCommit = firebase.firestore.WriteBatch.prototype.commit;

    firebase.firestore.WriteBatch.prototype.set = function(docRef, ...args) {
        const colName = getCollectionNameFromPath(docRef.path);
        if (colName === "alumni" || colName === "finance") {
            if (!this._modifiedCols) this._modifiedCols = new Set();
            this._modifiedCols.add(colName);
        }
        return originalBatchSet.apply(this, [docRef, ...args]);
    };

    firebase.firestore.WriteBatch.prototype.update = function(docRef, ...args) {
        const colName = getCollectionNameFromPath(docRef.path);
        if (colName === "alumni" || colName === "finance") {
            if (!this._modifiedCols) this._modifiedCols = new Set();
            this._modifiedCols.add(colName);
        }
        return originalBatchUpdate.apply(this, [docRef, ...args]);
    };

    firebase.firestore.WriteBatch.prototype.delete = function(docRef, ...args) {
        const colName = getCollectionNameFromPath(docRef.path);
        if (colName === "alumni" || colName === "finance") {
            if (!this._modifiedCols) this._modifiedCols = new Set();
            this._modifiedCols.add(colName);
        }
        return originalBatchDelete.apply(this, [docRef, ...args]);
    };

    firebase.firestore.WriteBatch.prototype.commit = async function() {
        const res = await originalBatchCommit.apply(this);
        if (this._modifiedCols) {
            for (const col of this._modifiedCols) {
                window.triggerSyncUpdate(col);
            }
        }
        return res;
    };
})();

window.storage = firebase.storage();

// Enable Firestore Offline Persistence
window.db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Firestore persistence failed-precondition: multiple tabs open');
        } else if (err.code == 'unimplemented') {
            console.warn('Firestore persistence unimplemented: browser not supported');
        } else {
            console.error('Firestore persistence error:', err);
        }
    });