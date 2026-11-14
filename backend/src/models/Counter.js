import mongoose, { Schema } from 'mongoose';

// Hands out readable running numbers, such as rider IDs and order numbers.
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model('Counter', counterSchema);

/** Returns the next number for a sequence. Safe when two requests arrive together. */
export async function nextSequence(name, session) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session },
  );
  return counter.seq;
}
