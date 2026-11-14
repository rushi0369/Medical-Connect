/**
 * Runs follow-up work once data is safely saved: notifications and live updates.
 * A failure here is logged but never undoes or fails the saved change.
 */
export async function afterCommit(...tasks) {
  for (const task of tasks) {
    try {
      await task();
    } catch (error) {
      console.error(`Follow-up task failed: ${error.message}`);
    }
  }
}
