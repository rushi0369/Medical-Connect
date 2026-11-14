import mongoose from 'mongoose';

/**
 * Validator that checks a reference points at a real record, for example that an
 * order's rider is an existing user whose role is RIDER.
 */
export function refExists(modelName, filter = {}) {
  return {
    validator: async function validateReference(id) {
      if (!id) return true;
      const query = mongoose.model(modelName).exists({ _id: id, ...filter });
      const session = this.$session?.();
      if (session) query.session(session);
      return Boolean(await query);
    },
    message: (props) => `${props.path} does not refer to a valid ${modelName} record.`,
  };
}
