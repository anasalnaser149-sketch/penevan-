/* eslint-disable @typescript-eslint/no-require-imports */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

async function deleteTenantCollection(collectionName, tenantId) {
  const snapshot = await db.collection(collectionName).where("tenantId", "==", tenantId).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  if (snapshot.size >= 500) {
    await deleteTenantCollection(collectionName, tenantId);
  }
}

exports.resetTenantData = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const collections = [
    "stores",
    "store_balances",
    "store_pricing",
    "inventory_log",
    "sales_records",
    "payments",
    "activityLog",
  ];

  for (const collectionName of collections) {
    await deleteTenantCollection(collectionName, uid);
  }

  return { status: "ok" };
});

exports.undoLastAction = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const logSnap = await db
    .collection("activityLog")
    .where("tenantId", "==", uid)
    .where("voided", "==", false)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (logSnap.empty) {
    throw new functions.https.HttpsError("failed-precondition", "No actions to undo.");
  }

  const logDoc = logSnap.docs[0];
  const logData = logDoc.data();
  if (!logData.storeId || !logData.actionId) {
    throw new functions.https.HttpsError("failed-precondition", "Log entry incomplete.");
  }

  const balanceRef = db.collection("store_balances").doc(logData.storeId);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const balanceSnap = await tx.get(balanceRef);
    const balanceData = balanceSnap.exists
      ? balanceSnap.data()
      : { storeId: logData.storeId, tenantId: uid, currentBalance: 0, currentStock: {} };

    if (balanceData.tenantId && balanceData.tenantId !== uid) {
      throw new functions.https.HttpsError("permission-denied", "Forbidden.");
    }

    if (logData.actionType === "SALE") {
      const saleRef = db.collection("sales_records").doc(logData.actionId);
      const saleSnap = await tx.get(saleRef);
      if (!saleSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Sale record missing.");
      }
      const sale = saleSnap.data();
      if (sale.tenantId && sale.tenantId !== uid) {
        throw new functions.https.HttpsError("permission-denied", "Forbidden.");
      }

      const items = sale.items || logData.items || [];
      const updatedStock = { ...(balanceData.currentStock || {}) };
      items.forEach((item) => {
        const qty = item.quantitySold || 0;
        updatedStock[item.productId] = (updatedStock[item.productId] || 0) + qty;
      });
      const nextBalance = (balanceData.currentBalance || 0) - (sale.totalAmount || logData.amount || 0);

      tx.set(
        balanceRef,
        { currentBalance: nextBalance, currentStock: updatedStock, tenantId: uid },
        { merge: true },
      );
      tx.update(saleRef, { voided: true, voidedAt: serverTimestamp });
    } else if (logData.actionType === "PAYMENT") {
      const paymentRef = db.collection("payments").doc(logData.actionId);
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Payment record missing.");
      }
      const payment = paymentSnap.data();
      if (payment.tenantId && payment.tenantId !== uid) {
        throw new functions.https.HttpsError("permission-denied", "Forbidden.");
      }
      const amount = Math.abs(payment.amount || logData.amount || 0);
      const nextBalance = (balanceData.currentBalance || 0) + amount;
      tx.set(
        balanceRef,
        { currentBalance: nextBalance, tenantId: uid, currentStock: balanceData.currentStock || {} },
        { merge: true },
      );
      tx.update(paymentRef, { voided: true, voidedAt: serverTimestamp });
    } else {
      throw new functions.https.HttpsError("failed-precondition", "Unsupported action type.");
    }

    tx.update(logDoc.ref, { voided: true, voidedAt: serverTimestamp });
  });

  return { undone: logData.actionType, actionId: logData.actionId };
});
