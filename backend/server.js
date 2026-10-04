const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Book = require("./models/Book");
const Student = require("./models/Student");
const Borrow = require("./models/Borrow");
const User = require("./models/User");

dotenv.config();

const app = express();

const PORT = 5000;

/* ==========================================
   DATABASE
   ========================================== */

connectDB();


/* ==========================================
   MIDDLEWARE
   ========================================== */

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));


/* ==========================================
   REQUEST LOGGER
   ========================================== */

app.use((req, res, next) => {

    console.log(
        `${req.method} ${req.originalUrl}`
    );

    next();

});


/* ==========================================
   JWT AUTHENTICATION
   ========================================== */

function protect(req, res, next) {

    try {

        const authHeader =
            req.headers.authorization;

        if (!authHeader) {

            return res.status(401).json({
                message: "Authentication required"
            });

        }

        const parts =
            authHeader.split(" ");

        if (
            parts.length !== 2 ||
            parts[0] !== "Bearer"
        ) {

            return res.status(401).json({
                message: "Invalid authorization format"
            });

        }

        const token = parts[1];

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Invalid or expired token"
        });

    }

}


/* ==========================================
   ADMIN AUTHORIZATION
   ========================================== */

function adminOnly(req, res, next) {

    if (
        !req.user ||
        req.user.role !== "admin"
    ) {

        return res.status(403).json({
            message: "Admin access required"
        });

    }

    next();

}


/* ==========================================
   UPLOAD DIRECTORY
   ========================================== */

const uploadsDirectory =
    path.join(
        __dirname,
        "uploads"
    );


if (!fs.existsSync(uploadsDirectory)) {

    fs.mkdirSync(
        uploadsDirectory,
        {
            recursive: true
        }
    );

}


/* ==========================================
   MULTER STORAGE
   ========================================== */

const storage =
    multer.diskStorage({

        destination: function (
            req,
            file,
            cb
        ) {

            cb(
                null,
                uploadsDirectory
            );

        },

        filename: function (
            req,
            file,
            cb
        ) {

            const extension =
                path.extname(
                    file.originalname
                );

            const filename =
                `${Date.now()}-${Math.round(
                    Math.random() * 1E9
                )}${extension}`;

            cb(
                null,
                filename
            );

        }

    });


const upload =
    multer({

        storage,

        limits: {
            fileSize: 5 * 1024 * 1024
        },

        fileFilter: function (
            req,
            file,
            cb
        ) {

            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp"
            ];

            if (
                allowedTypes.includes(
                    file.mimetype
                )
            ) {

                cb(null, true);

            } else {

                cb(
                    new Error(
                        "Only JPG, PNG and WEBP images are allowed."
                    )
                );

            }

        }

    });


/* ==========================================
   STATIC UPLOADS
   ========================================== */

app.use(
    "/uploads",
    express.static(
        uploadsDirectory
    )
);


/* ==========================================
   HELPER
   REMOVE UPLOADED FILE
   ========================================== */

function removeUploadedFile(
    coverImage
) {

    if (!coverImage) {
        return;
    }

    let filename =
        String(coverImage)
            .trim();

    if (!filename) {
        return;
    }

    filename =
        filename
            .replace(/^\/uploads\//, "")
            .replace(/^uploads\//, "");

    const filePath =
        path.join(
            uploadsDirectory,
            filename
        );

    if (
        fs.existsSync(filePath)
    ) {

        try {

            fs.unlinkSync(
                filePath
            );

        } catch (error) {

            console.error(
                "Unable to remove old cover:",
                error.message
            );

        }

    }

}


/* ==========================================
   NUMBER HELPER
   ========================================== */

function parseNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

}


/* ==========================================
   BOOK DATA FROM REQUEST
   ========================================== */

function getBookDataFromRequest(
    req
) {

    const body =
        req.body || {};

    return {

        title:
            String(
                body.title || ""
            ).trim(),

        author:
            String(
                body.author || ""
            ).trim(),

        isbn:
            String(
                body.isbn || ""
            ).trim(),

        category:
            String(
                body.category || ""
            ).trim(),

        rack:
            String(
                body.rack || ""
            ).trim(),

        shelf:
            String(
                body.shelf || ""
            ).trim(),

        totalCopies:
            parseNumber(
                body.totalCopies,
                0
            )

    };

}


/* ==========================================
   VALIDATE BOOK
   ========================================== */

function validateBookData(
    data
) {

    if (!data.title) {
        return "Book title is required";
    }

    if (!data.author) {
        return "Author is required";
    }

    if (!data.isbn) {
        return "ISBN is required";
    }

    if (!data.category) {
        return "Category is required";
    }

    if (
        !Number.isInteger(
            data.totalCopies
        ) ||
        data.totalCopies < 1
    ) {

        return "Total copies must be at least 1";

    }

    return null;

}


/* ==========================================
   HOME
   ========================================== */

app.get(
    "/",
    (req, res) => {

        res.send(
            "College Library Backend is Working! 📚"
        );

    }
);


/* ==========================================
   GET ALL BOOKS
   ========================================== */

app.get(
    "/books",
    async (req, res) => {

        try {

            const books =
                await Book.find();

            res.json(
                books
            );

        } catch (error) {

            res.status(500).json({
                message: error.message
            });

        }

    }
);


/* ==========================================
   SEARCH BOOKS
   ========================================== */

app.get(
    "/books/search",
    async (req, res) => {

        try {

            const query =
                String(
                    req.query.query || ""
                ).trim();

            if (!query) {

                return res.json([]);

            }

            const regex =
                new RegExp(
                    query,
                    "i"
                );

            const books =
                await Book.find({

                    $or: [

                        {
                            title: regex
                        },

                        {
                            author: regex
                        },

                        {
                            category: regex
                        },

                        {
                            isbn: regex
                        }

                    ]

                });

            res.json(
                books
            );

        } catch (error) {

            res.status(500).json({
                message: error.message
            });

        }

    }
);


/* ==========================================
   ADD BOOK
   ========================================== */

app.post(
    "/books",
    protect,
    adminOnly,
    upload.single("coverImage"),

    async (req, res) => {

        try {

            const data =
                getBookDataFromRequest(
                    req
                );

            const validationError =
                validateBookData(
                    data
                );

            if (validationError) {

                if (req.file) {

                    removeUploadedFile(
                        req.file.filename
                    );

                }

                return res.status(400).json({
                    message:
                        validationError
                });

            }


            const existingBook =
                await Book.findOne({
                    isbn: data.isbn
                });


            if (existingBook) {

                if (req.file) {

                    removeUploadedFile(
                        req.file.filename
                    );

                }

                return res.status(400).json({
                    message:
                        "A book with this ISBN already exists"
                });

            }


            const book =
                await Book.create({

                    title:
                        data.title,

                    author:
                        data.author,

                    isbn:
                        data.isbn,

                    category:
                        data.category,

                    rack:
                        data.rack,

                    shelf:
                        data.shelf,

                    totalCopies:
                        data.totalCopies,

                    availableCopies:
                        data.totalCopies,

                    coverImage:
                        req.file
                            ? `/uploads/${req.file.filename}`
                            : ""

                });


            res.status(201).json({

                message:
                    "Book added successfully",

                book

            });

        } catch (error) {

            if (req.file) {

                removeUploadedFile(
                    req.file.filename
                );

            }

            res.status(500).json({
                message:
                    error.message
            });

        }

    }
);


/* ==========================================
   UPDATE BOOK
   ========================================== */

app.put(
    "/books/:isbn",
    protect,
    adminOnly,
    upload.single("coverImage"),

    async (req, res) => {

        try {

            const oldIsbn =
                req.params.isbn;


            const book =
                await Book.findOne({
                    isbn: oldIsbn
                });


            if (!book) {

                if (req.file) {

                    removeUploadedFile(
                        req.file.filename
                    );

                }

                return res.status(404).json({
                    message:
                        "Book not found"
                });

            }


            const data =
                getBookDataFromRequest(
                    req
                );


            const validationError =
                validateBookData(
                    data
                );


            if (validationError) {

                if (req.file) {

                    removeUploadedFile(
                        req.file.filename
                    );

                }

                return res.status(400).json({
                    message:
                        validationError
                });

            }


            const activeBorrowedCopies =
                Math.max(
                    0,
                    Number(book.totalCopies || 0) -
                    Number(book.availableCopies || 0)
                );


            if (
                data.totalCopies <
                activeBorrowedCopies
            ) {

                if (req.file) {

                    removeUploadedFile(
                        req.file.filename
                    );

                }

                return res.status(400).json({

                    message:
                        `Total copies cannot be less than ${activeBorrowedCopies}, because ${activeBorrowedCopies} copy/copies are currently borrowed.`

                });

            }


            if (
                data.isbn !== oldIsbn
            ) {

                const isbnExists =
                    await Book.findOne({
                        isbn:
                            data.isbn,
                        _id: {
                            $ne:
                                book._id
                        }
                    });


                if (isbnExists) {

                    if (req.file) {

                        removeUploadedFile(
                            req.file.filename
                        );

                    }

                    return res.status(400).json({
                        message:
                            "Another book already uses this ISBN"
                    });

                }


                if (
                    activeBorrowedCopies > 0
                ) {

                    if (req.file) {

                        removeUploadedFile(
                            req.file.filename
                        );

                    }

                    return res.status(400).json({

                        message:
                            "ISBN cannot be changed while this book has active borrowed copies."

                    });

                }

            }


            const oldCover =
                book.coverImage;


            book.title =
                data.title;

            book.author =
                data.author;

            book.isbn =
                data.isbn;

            book.category =
                data.category;

            book.rack =
                data.rack;

            book.shelf =
                data.shelf;

            book.totalCopies =
                data.totalCopies;


            book.availableCopies =
                data.totalCopies -
                activeBorrowedCopies;


            if (req.file) {

                book.coverImage =
                    `/uploads/${req.file.filename}`;

            }


            await book.save();


            if (
                req.file &&
                oldCover
            ) {

                removeUploadedFile(
                    oldCover
                );

            }


            res.json({

                message:
                    "Book updated successfully",

                book

            });

        } catch (error) {

            if (req.file) {

                removeUploadedFile(
                    req.file.filename
                );

            }

            res.status(500).json({
                message:
                    error.message
            });

        }

    }
);


/* ==========================================
   DELETE BOOK
   ========================================== */

app.delete(
    "/books/:isbn",
    protect,
    adminOnly,

    async (req, res) => {

        try {

            const book =
                await Book.findOne({
                    isbn:
                        req.params.isbn
                });


            if (!book) {

                return res.status(404).json({
                    message:
                        "Book not found"
                });

            }


            const activeBorrow =
                await Borrow.findOne({

                    bookId:
                        book.isbn,

                    status:
                        "Borrowed"

                });


            if (activeBorrow) {

                return res.status(400).json({

                    message:
                        "This book cannot be deleted because it is currently borrowed."

                });

            }


            const oldCover =
                book.coverImage;


            await Book.deleteOne({
                _id:
                    book._id
            });


            if (oldCover) {

                removeUploadedFile(
                    oldCover
                );

            }


            res.json({

                message:
                    "Book deleted successfully"

            });

        } catch (error) {

            res.status(500).json({
                message:
                    error.message
            });

        }

    }
);


/* ==========================================
   ADD STUDENT
   ========================================== */

app.post(
    "/students",

    async (req, res) => {

        try {

            const {
                studentId,
                name,
                email,
                course
            } = req.body;


            if (
                !studentId ||
                !name ||
                !email ||
                !course
            ) {

                return res.status(400).json({

                    message:
                        "Student ID, name, email and course are required"

                });

            }


            const existingStudent =
                await Student.findOne({

                    $or: [

                        {
                            studentId:
                                String(
                                    studentId
                                ).trim()
                        },

                        {
                            email:
                                String(
                                    email
                                ).trim()
                                    .toLowerCase()
                        }

                    ]

                });


            if (existingStudent) {

                return res.status(400).json({

                    message:
                        "Student ID or email already exists"

                });

            }


            const student =
                await Student.create({

                    studentId:
                        String(
                            studentId
                        ).trim(),

                    name:
                        String(
                            name
                        ).trim(),

                    email:
                        String(
                            email
                        ).trim()
                            .toLowerCase(),

                    course:
                        String(
                            course
                        ).trim()

                });


            res.status(201).json({

                message:
                    "Student added successfully",

                student

            });

        } catch (error) {

            res.status(500).json({
                message:
                    error.message
            });

        }

    }
);


/* ==========================================
   GET STUDENTS
   ========================================== */

app.get(
    "/students",
    protect,

    async (req, res) => {

        try {

            const students =
                await Student.find();

            res.json(
                students
            );

        } catch (error) {

            res.status(500).json({
                message:
                    error.message
            });

        }

    }
);


/* ==========================================
   BORROW BOOK
   ========================================== */

app.post(
    "/borrow",

    async (req, res) => {

        try {

            const {
                studentId,
                bookId,
                dueDate
            } = req.body;


            const student =
                await Student.findOne({
                    studentId
                });


            if (!student) {

                return res.status(404).json({

                    message:
                        "Student not found"

                });

            }


            const book =
                await Book.findOne({
                    isbn:
                        bookId
                });


            if (!book) {

                return res.status(404).json({

                    message:
                        "Book not found"

                });

            }


            if (
                book.availableCopies <= 0
            ) {

                return res.status(400).json({

                    message:
                        "Book is currently unavailable"

                });

            }


            const borrow =
                await Borrow.create({

                    studentId,

                    bookId,

                    dueDate

                });


            book.availableCopies -= 1;

            await book.save();


            res.status(201).json({

                message:
                    "Book issued successfully",

                borrow

            });

        } catch (error) {

            res.status(500).json({

                message:
                    error.message

            });

        }

    }
);


/* ==========================================
   RETURN BOOK
   ========================================== */

app.put(
    "/borrow/return/:id",

    async (req, res) => {

        try {

            const borrow =
                await Borrow.findById(
                    req.params.id
                );


            if (!borrow) {

                return res.status(404).json({

                    message:
                        "Borrow record not found"

                });

            }


            if (
                borrow.status ===
                "Returned"
            ) {

                return res.status(400).json({

                    message:
                        "Book has already been returned"

                });

            }


            const book =
                await Book.findOne({

                    isbn:
                        borrow.bookId

                });


            if (!book) {

                return res.status(404).json({

                    message:
                        "Book not found"

                });

            }


            book.availableCopies += 1;

            await book.save();


            borrow.returnDate =
                new Date();

            borrow.status =
                "Returned";


            await borrow.save();


            res.json({

                message:
                    "Book returned successfully",

                borrow

            });

        } catch (error) {

            res.status(500).json({

                message:
                    error.message

            });

        }

    }
);


/* ==========================================
   GET ALL BORROW RECORDS
   ========================================== */

app.get(
    "/borrow",

    async (req, res) => {

        try {

            const borrows =
                await Borrow.find();

            res.json(
                borrows
            );

        } catch (error) {

            res.status(500).json({

                message:
                    error.message

            });

        }

    }
);


/* ==========================================
   GET CURRENT STUDENT BORROWS
   ========================================== */

app.get(
    "/borrow/student/:studentId",

    async (req, res) => {

        try {

            const borrows =
                await Borrow.find({

                    studentId:
                        req.params.studentId,

                    status:
                        "Borrowed"

                });


            res.json(
                borrows
            );

        } catch (error) {

            res.status(500).json({

                message:
                    error.message

            });

        }

    }
);


/* ==========================================
   GET OVERDUE BORROWS
   ========================================== */

app.get(
    "/borrow/overdue",

    async (req, res) => {

        try {

            const borrows =
                await Borrow.find({

                    status:
                        "Borrowed"

                });


            const today =
                new Date();


            const overdueBooks =
                borrows.filter(
                    borrow =>
                        new Date(
                            borrow.dueDate
                        ) < today
                );


            res.json(
                overdueBooks
            );

        } catch (error) {

            res.status(500).json({

                message:
                    error.message

            });

        }

    }
);


/* ==========================================
   UPLOAD COVER
   ========================================== */

app.post(
    "/upload-cover",

    protect,
    adminOnly,

    upload.single("cover"),

    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({

                    message:
                        "No image uploaded"

                });

            }


            res.json({

                message:
                    "Cover uploaded successfully",

                filename:
                    req.file.filename,

                path:
                    `/uploads/${req.file.filename}`

            });

        } catch (error) {

            if (req.file) {

                removeUploadedFile(
                    req.file.filename
                );

            }

            res.status(500).json({

                message:
                    error.message

            });

        }

    }
);


/* ==========================================
   REGISTER STUDENT
   ========================================== */

app.post(
    "/register",

    async (req, res) => {

        try {

            const {
                name,
                studentId,
                course,
                email,
                username,
                password
            } = req.body;


            /* ==============================
               VALIDATION
               ============================== */

            if (
                !name ||
                !studentId ||
                !course ||
                !email ||
                !username ||
                !password
            ) {

                return res.status(400).json({

                    message:
                        "All registration fields are required"

                });

            }


            const cleanName =
                String(name)
                    .trim();


            const cleanStudentId =
                String(studentId)
                    .trim();


            const cleanCourse =
                String(course)
                    .trim();


            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();


            const cleanUsername =
                String(username)
                    .trim();


            /* ==============================
               CHECK USERNAME
               ============================== */

            const existingUsername =
                await User.findOne({

                    username:
                        cleanUsername

                });


            if (existingUsername) {

                return res.status(400).json({

                    message:
                        "Username already exists"

                });

            }


            /* ==============================
               CHECK USER EMAIL
               ============================== */

            const existingEmail =
                await User.findOne({

                    email:
                        cleanEmail

                });


            if (existingEmail) {

                return res.status(400).json({

                    message:
                        "Email already exists"

                });

            }


            /* ==============================
               CHECK STUDENT ID
               ============================== */

            const existingStudentId =
                await Student.findOne({

                    studentId:
                        cleanStudentId

                });


            if (existingStudentId) {

                return res.status(400).json({

                    message:
                        "Student ID already exists"

                });

            }


            /* ==============================
               CHECK STUDENT EMAIL
               ============================== */

            const existingStudentEmail =
                await Student.findOne({

                    email:
                        cleanEmail

                });


            if (existingStudentEmail) {

                return res.status(400).json({

                    message:
                        "A student with this email already exists"

                });

            }


            /* ==============================
               HASH PASSWORD
               ============================== */

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );


            /* ==============================
               CREATE USER
               ============================== */

            const user =
                await User.create({

                    username:
                        cleanUsername,

                    email:
                        cleanEmail,

                    password:
                        hashedPassword,

                    role:
                        "student"

                });


            /* ==============================
               CREATE LINKED STUDENT
               ============================== */

            let student;

            try {

                student =
                    await Student.create({

                        studentId:
                            cleanStudentId,

                        name:
                            cleanName,

                        email:
                            cleanEmail,

                        course:
                            cleanCourse

                    });

            } catch (studentError) {

                /*
                   If Student creation fails,
                   remove the User we just created
                   so we don't leave an incomplete
                   account behind.
                */

                await User.deleteOne({

                    _id:
                        user._id

                });

                throw studentError;

            }


            /* ==============================
               SUCCESS
               ============================== */

            res.status(201).json({

                message:
                    "Registration successful",

                user: {

                    id:
                        user._id,

                    username:
                        user.username,

                    email:
                        user.email,

                    role:
                        user.role

                },

                student: {

                    id:
                        student._id,

                    studentId:
                        student.studentId,

                    name:
                        student.name,

                    email:
                        student.email,

                    course:
                        student.course

                }

            });

        } catch (error) {

            console.error(
                "Registration error:",
                error
            );


            /*
               Handle MongoDB duplicate
               key errors cleanly.
            */

            if (
                error.code === 11000
            ) {

                const duplicateField =
                    Object.keys(
                        error.keyPattern || {}
                    )[0];


                let message =
                    "A record with this information already exists";


                if (
                    duplicateField ===
                    "username"
                ) {

                    message =
                        "Username already exists";

                } else if (
                    duplicateField ===
                    "email"
                ) {

                    message =
                        "Email already exists";

                } else if (
                    duplicateField ===
                    "studentId"
                ) {

                    message =
                        "Student ID already exists";

                }


                return res.status(400).json({

                    message

                });

            }


            res.status(500).json({

                message:
                    error.message

            });

        }

    }
);


/* ==========================================
   LOGIN
   ========================================== */

app.post(
    "/login",

    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body;


            if (
                !username ||
                !password
            ) {

                return res.status(400).json({

                    message:
                        "Username and password are required"

                });

            }


            const user =
                await User.findOne({

                    username:
                        String(
                            username
                        ).trim()

                });


            if (!user) {

                return res.status(404).json({

                    message:
                        "User not found"

                });

            }


            const passwordMatch =
                await bcrypt.compare(

                    password,

                    user.password

                );


            if (!passwordMatch) {

                return res.status(401).json({

                    message:
                        "Invalid password"

                });

            }


            /* ==============================
               FIND LINKED STUDENT
               ============================== */

            let linkedStudent =
                null;


            if (
                user.role ===
                "student"
            ) {

                linkedStudent =
                    await Student.findOne({

                        email:
                            user.email

                    });

            }


            /* ==============================
               JWT
               ============================== */

            const token =
                jwt.sign(

                    {

                        id:
                            user._id,

                        role:
                            user.role

                    },

                    process.env.JWT_SECRET,

                    {

                        expiresIn:
                            "1d"

                    }

                );


            /* ==============================
               LOGIN RESPONSE
               ============================== */

            res.json({

                message:
                    "Login successful",

                token,

                user: {

                    id:
                        user._id,

                    username:
                        user.username,

                    email:
                        user.email,

                    role:
                        user.role,

                    studentId:
                        linkedStudent
                            ? linkedStudent.studentId
                            : null,

                    name:
                        linkedStudent
                            ? linkedStudent.name
                            : user.username,

                    course:
                        linkedStudent
                            ? linkedStudent.course
                            : null

                }

            });

        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            res.status(500).json({

                message:
                    error.message

            });

        }

    }
);


/* ==========================================
   CREATE ADMIN
   ========================================== */

app.post(
    "/create-admin",

    async (req, res) => {

        try {

            const {
                username,
                email,
                password
            } = req.body;


            const existingUser =
                await User.findOne({

                    $or: [

                        {
                            username
                        },

                        {
                            email
                        }

                    ]

                });


            if (existingUser) {

                return res.status(400).json({

                    message:
                        "Username or email already exists"

                });

            }


            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );


            const admin =
                await User.create({

                    username,

                    email,

                    password:
                        hashedPassword,

                    role:
                        "admin"

                });


            res.status(201).json({

                message:
                    "Admin created successfully",

                admin: {

                    id:
                        admin._id,

                    username:
                        admin.username,

                    email:
                        admin.email,

                    role:
                        admin.role

                }

            });

        } catch (error) {

            res.status(500).json({

                message:
                    error.message

            });

        }

    }
);


/* ==========================================
   ADMIN TEST
   ========================================== */

app.get(
    "/admin-test",

    protect,
    adminOnly,

    (req, res) => {

        res.json({

            message:
                "Admin authentication successful",

            user:
                req.user

        });

    }
);


/* ==========================================
   404
   ========================================== */

app.use(
    (req, res) => {

        res.status(404).json({

            message:
                "Route not found"

        });

    }
);


/* ==========================================
   ERROR HANDLER
   ========================================== */

app.use(
    (error, req, res, next) => {

        console.error(
            "Server error:",
            error
        );


        res.status(500).json({

            message:
                error.message ||
                "Internal server error"

        });

    }
);


/* ==========================================
   START SERVER
   ========================================== */

app.listen(
    PORT,

    () => {

        console.log(
            "College Library Backend"
        );

        console.log(
            `Server running at http://localhost:${PORT}`
        );

        console.log(
            "Book management routes:"
        );

        console.log(
            "POST   /books"
        );

        console.log(
            "PUT    /books/:isbn"
        );

        console.log(
            "DELETE /books/:isbn"
        );

        console.log(
            "GET    /books"
        );

    }
);