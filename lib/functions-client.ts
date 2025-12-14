import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function resetTenantData() {
  try {
    const callable = httpsCallable(functions, "resetTenantData");
    await callable();
  } catch (error: any) {
    // Re-throw with better error handling
    if (error?.code === "unauthenticated") {
      throw new Error("You must be logged in to perform this action.");
    }
    throw error;
  }
}
