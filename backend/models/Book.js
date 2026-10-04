const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true
    },

    author: {
        type: String,
        required: true
    },

    isbn: {
        type: String,
        required: true,
        unique: true
    },

    category: {
        type: String,
        required: true
    },

    rack: {
        type: String,
        required: true
    },

    shelf: {
        type: String,
        required: true
    },

    totalCopies: {
        type: Number,
        required: true
    },

    availableCopies: {
        type: Number,
        required: true
    },

    coverImage: {
        type: String,
        default: ""
    }

});

const Book = mongoose.model("Book", bookSchema);

module.exports = Book;