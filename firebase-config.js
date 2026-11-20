
import { initializeApp } from
"https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

import { getAuth } from
"https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import { getFirestore } from
"https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMsCKvMaj7PMA9NhO6I0ApvIfk4ldwMGY",
    authDomain: "agenda-partners.firebaseapp.com",
    projectId: "agenda-partners",
    storageBucket: "agenda-partners.firebasestorage.app",
    messagingSenderId: "657404900292",
    appId: "1:657404900292:web:4ae1635aa8b87c2cc12a91"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

