const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
const PORT = 3000;

const db = new sqlite3.Database("./auth.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: "change-this-to-a-long-random-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            maxAge: 1000 * 60 * 60
        }
    })
);

app.use(express.static("public"));

db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// SIGN UP
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({
            message: "Please fill in all fields."
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message: "Password must be at least 6 characters."
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 12);

        db.run(
            `INSERT INTO users (username, email, password)
             VALUES (?, ?, ?)`,
            [username, email, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes("UNIQUE")) {
                        return res.status(400).json({
                            message: "Username or email already exists."
                        });
                    }

                    return res.status(500).json({
                        message: "Registration failed."
                    });
                }

                res.json({
                    success: true,
                    message: "Account created successfully!"
                });
            }
        );
    } catch (error) {
        res.status(500).json({
            message: "Server error."
        });
    }
});

// LOGIN
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Please enter your email and password."
        });
    }

    db.get(
        `SELECT * FROM users WHERE email = ?`,
        [email],
        async (err, user) => {
            if (err) {
                return res.status(500).json({
                    message: "Server error."
                });
            }

            if (!user) {
                return res.status(401).json({
                    message: "Invalid email or password."
                });
            }

            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    message: "Invalid email or password."
                });
            }

            req.session.userId = user.id;
            req.session.username = user.username;

            res.json({
                success: true,
                message: "Login successful!"
            });
        }
    );
});

// CHECK AUTHENTICATION
app.get("/api/user", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            authenticated: false
        });
    }

    res.json({
        authenticated: true,
        username: req.session.username
    });
});

// LOGOUT
app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                message: "Logout failed."
            });
        }

        res.json({
            success: true,
            message: "Logged out successfully."
        });
    });
});

// PROTECTED DASHBOARD
app.get("/dashboard", (req, res) => {
    if (!req.session.userId) {
        return res.redirect("/");
    }

    res.sendFile(__dirname + "/public/dashboard.html");
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});