const BLOCKED_OPERATIONS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];

/** Makes a collection permanent history: records can be added but never changed or removed. */
export function appendOnly(schema) {
  const refuse = function refuseChange() {
    throw new Error('This record is permanent history and cannot be changed or deleted.');
  };

  schema.pre(BLOCKED_OPERATIONS, { query: true, document: false }, refuse);
  schema.pre('deleteOne', { query: false, document: true }, refuse);
  schema.pre('updateOne', { query: false, document: true }, refuse);
  schema.pre('save', function refuseResave() {
    if (!this.isNew) refuse();
  });
}
