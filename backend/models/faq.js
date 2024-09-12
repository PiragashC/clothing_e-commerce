const { Schema, model } = require("mongoose");

const faqSchema = new Schema(
    {
        fullName: {
            type: String,
            required: [true, "Full Name must be provided"]
        },
        email: {
            type: String,
            required: [true, "Email Id must be provided"]
        },
        subject: {
            type: String,
            required: [true, "Subject must be provided"]
        },
        message: {
            type: String,
            required: [true, "Message must be provided"]
        },
        answer: {
            type: String,
            default: ""
        },
    },
    { timestamps: true }
);

module .exports = model("FAQ", faqSchema);