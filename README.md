# Google OAuth with Firebase Authentication (Frontend + Backend)

A clean, modular implementation of Google OAuth 2.0 using Firebase Authentication on the frontend and Firebase Admin SDK on a Node.js/Express backend.

---

## 📁 Project Structure

```text
sport-project/
├── frontend/                     # Client application (Vanilla JS + Firebase Web SDK)
│   ├── index.html                # UI with Google sign-in button & backend testers
│   ├── style.css                 # Clean, modern styles
│   ├── firebaseConfig.js         # Firebase Client SDK credentials & setup
│   ├── app.js                    # Auth state, login popup, API calling logic
│   └── package.json              # Local development server script
│
├── backend/                      # API server (Node.js + Express + Firebase Admin)
│   ├── server.js                 # Express routes (Public & Protected on port 5001)
│   ├── authMiddleware.js         # Token verification middleware (verifyIdToken)
│   ├── firebaseAdmin.js          # Firebase Admin SDK initialization
│   ├── serviceAccountKey.json    # Your Firebase private key
│   └── package.json              # Backend dependencies
│
└── README.md                     # Project documentation & guide
```

---

## 🚀 How to Run

### 1. Start Backend (Port 5001)
```bash
cd backend
npm run dev
```

### 2. Start Frontend (Port 3000)
```bash
cd frontend
npm start
# or: python3 -m http.server 3000
```
Open `http://localhost:3000` in your browser.
