const { Schema, model } = require("mongoose");
const User = require("./user");

const supportTicSchema = new Schema(
  {
    userId: {
        type: Schema.Types.ObjectId,
        ref: User,
        required: [true, "User Id must be provided"]
      },
    reportMsg: {
        type: String,
        required: [true, "Report message must be provided"]
      }, 
    date: {
        type: String,
        required: [true, "Review date must be provided"]
    },
    time: {
        type: String,
        required: [true, "Review time must be provided"]
    }
  },
  { timestamps: true }
);

module.exports = model("SupportTic", supportTicSchema);
