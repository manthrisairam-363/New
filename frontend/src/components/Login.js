// src/components/Login.js
import React, { useState } from “react”;
import { signInWithEmailAndPassword } from “firebase/auth”;
import { auth } from “../firebaseConfig”;
import “./Login.css”;

export default function Login() {
const [email, setEmail] = useState(””);
const [password, setPassword] = useState(””);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(””);
const [showPass, setShowPass] = useState(false);

const handleLogin = async (e) => {
e.preventDefault();
if (!email.trim() || !password.trim()) {
setError(“Please enter email and password.”);
return;
}
setLoading(true);
setError(””);
try {
await signInWithEmailAndPassword(auth, email.trim(), password);
} catch (err) {
if (err.code === “auth/invalid-credential” || err.code === “auth/wrong-password” || err.code === “auth/user-not-found”) {
setError(“Incorrect email or password.”);
} else if (err.code === “auth/too-many-requests”) {
setError(“Too many attempts. Please try again later.”);
} else {
setError(“Login failed. Please try again.”);
}
} finally {
setLoading(false);
}
};

return (
<div className="login-page">
<div className="login-bg-overlay" />
<div className="login-card">

```
    <div className="login-logo">
      <div className="login-icon">Rs.</div>
    </div>

    <h1 className="login-title">Chitt Tracker</h1>
    <p className="login-subtitle">Admin Access Only</p>

    <form className="login-form" onSubmit={handleLogin}>
      <div className="login-field">
        <label className="login-label">Email</label>
        <input
          className="login-input"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(""); }}
          autoComplete="email"
          disabled={loading}
        />
      </div>

      <div className="login-field">
        <label className="login-label">Password</label>
        <div className="login-input-wrap">
          <input
            className="login-input"
            type={showPass ? "text" : "password"}
            placeholder="Enter password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            autoComplete="current-password"
            disabled={loading}
          />
          <button
            type="button"
            className="login-eye"
            onClick={() => setShowPass(p => !p)}
            tabIndex={-1}
          >
            {showPass ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      <button className="login-btn" type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>

    <p className="login-footer">
      Need access? Contact:&nbsp;
      <a
        href="mailto:manthrisairam@gmail.com"
        style={{ color: "rgba(196,181,253,0.7)", textDecoration: "none", marginRight: 10 }}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ verticalAlign: "middle", marginRight: 3 }}>
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
        manthrisairam@gmail.com
      </a>
      <a
        href="https://wa.me/919533126221"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "rgba(196,181,253,0.7)", textDecoration: "none" }}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="#25D366" style={{ verticalAlign: "middle", marginRight: 3 }}>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L.057 23.998l6.304-1.453A11.956 11.956 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.502-5.179-1.381l-.371-.22-3.742.862.892-3.648-.242-.378A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>
        +91-9533126221
      </a>
    </p>
  </div>
</div>
```

);
}