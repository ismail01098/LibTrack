const mongoose = require("mongoose");

const borrowSchema = new mongoose.Schema({

    studentId: {
        type: String,
        required: true
    },

    bookId: {
        type: String,
        required: true
    },

    issueDate: {
        type: Date,
        default: Date.now
    },

    dueDate: {
        type: Date,
        required: true
    },

    returnDate: {
        type: Date,
        default: null
    },

    status: {
        type: String,
        default: "Borrowed"
    }

});

const Borrow = mongoose.model("Borrow", borrowSchema);

module.exports = Borrow;