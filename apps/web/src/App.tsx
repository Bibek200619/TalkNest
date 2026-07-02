import { useEffect, useState } from "react";
import {
  ArrowRight,
  Clock3,
  FileText,
  Image,
  LogIn,
  MessageCircle,
  Moon,
  PanelLeft,
  RadioTower,
  ShieldCheck,
  Sun,
  Video,
} from "lucide-react";
import { TalkNestScene } from "./components/TalkNestScene";

const appUrl = import.meta.env.VITE_TALKNEST_APP_URL ?? "http://127.0.0.1:8081";

const features = [
  {
    icon: LogIn,
    title: "Handle-first accounts",
    body: "New users register with a unique handle and use it to open personal conversations.",
  },
  {
    icon: RadioTower,
    title: "Live private chat",
    body: "Socket.io broadcasts accepted messages to the shared lobby or the resolved one-to-one room.",
  },
  {
    icon: FileText,
    title: "File-ready messages",
    body: "Photos, videos, PDFs, docs, and presentations can be attached within server-enforced limits.",
  },
  {
    icon: PanelLeft,
    title: "Focused inbox UI",
    body: "A left app rail, chat list, and active conversation keep repeat chat workflows fast.",
  },
  {
    icon: ShieldCheck,
    title: "Guarded access",
    body: "JWT auth protects REST routes, Socket.io connections, and private conversation access.",
  },
  {
    icon: Clock3,
    title: "Stored history",
    body: "Messages and timestamps are written by the backend and restored when rooms reopen.",
  },
];

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("talknest.web.theme") === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("talknest.web.theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setTheme((current) => (current === "light" ? "dark" : "light"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  return (
    <>
      <header className="site-header">
        <a className="brand-link" href="#top" aria-label="TalkNest home">
          <MessageCircle aria-hidden="true" size={22} />
          <span>TalkNest</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#features">Features</a>
          <a href="#stack">Stack</a>
          <button
            aria-label="Toggle dark theme"
            className="theme-toggle"
            onClick={toggleTheme}
            type="button"
          >
            {theme === "dark" ? (
              <Sun aria-hidden="true" size={17} />
            ) : (
              <Moon aria-hidden="true" size={17} />
            )}
          </button>
          <a className="nav-cta" href={appUrl}>
            Open app
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <TalkNestScene />
          <div className="hero-copy">
            <p className="eyebrow">Private real-time chat</p>
            <h1>TalkNest</h1>
            <p className="lede">
              A handle-based chat product with a modern inbox, personal rooms,
              attachments, persisted sessions, and a dark interface.
            </p>
            <div className="hero-actions" aria-label="Project actions">
              <a className="primary-action" href={appUrl}>
                <span>Open TalkNest</span>
                <ArrowRight aria-hidden="true" size={19} />
              </a>
              <a className="secondary-action" href="#features">
                View features
              </a>
            </div>
          </div>

          <div className="hero-preview" aria-hidden="true">
            <div className="preview-rail">
              <span className="preview-avatar">T</span>
              <span className="preview-dot active" />
              <span className="preview-dot" />
              <span className="preview-dot" />
            </div>
            <div className="preview-list">
              <div className="preview-toolbar">
                <strong>Chats</strong>
                <span>+</span>
              </div>
              {["Maya", "Noah", "Ava"].map((name, index) => (
                <div className="preview-card" key={name}>
                  <span className={`preview-face face-${index}`} />
                  <div>
                    <strong>{name}</strong>
                    <small>@{name.toLowerCase()}</small>
                    <p>{index === 1 ? "Sent a file" : "Personal chat"}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="preview-chat">
              <div className="preview-chat-head">
                <span className="preview-face face-3" />
                <div>
                  <strong>Nika Jerrardo</strong>
                  <small>@nika</small>
                </div>
              </div>
              <div className="bubble blue">Can I send you the files?</div>
              <div className="bubble pale">
                <FileText aria-hidden="true" size={18} />
                Style.zip
              </div>
              <div className="bubble white">Hey! Okay, send out.</div>
              <div className="preview-composer">
                <Image aria-hidden="true" size={16} />
                <Video aria-hidden="true" size={16} />
                <span />
                <ArrowRight aria-hidden="true" size={16} />
              </div>
            </div>
          </div>
        </section>

        <section className="feature-band" id="features">
          <div className="section-heading">
            <p className="eyebrow">Product loop</p>
            <h2>Built around the way chats are actually opened and used</h2>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <feature.icon aria-hidden="true" size={24} />
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="split-band" id="stack">
          <div>
            <p className="eyebrow">Architecture</p>
            <h2>One product, three focused runtimes</h2>
          </div>
          <div className="stack-list">
            <div>
              <strong>Expo React Native</strong>
              <span>
                Registration, persisted sessions, sidebar inbox, dark theme,
                attachments, and Socket.io client.
              </span>
            </div>
            <div>
              <strong>Node.js backend</strong>
              <span>
                Express auth, JWT sessions, SQLite storage, Socket.io rooms,
                and attachment validation.
              </span>
            </div>
            <div>
              <strong>Vite landing page</strong>
              <span>
                Responsive entry point linked directly to the main app with a
                matching theme toggle.
              </span>
            </div>
          </div>
        </section>

        <section className="app-band" id="app">
          <div>
            <p className="eyebrow">Main app</p>
            <h2>Start from your own handle</h2>
            <p>
              Create an account, share your handle, then open personal chats
              from the sidebar without relying on preloaded accounts.
            </p>
            <div className="app-actions">
              <a className="primary-action inverse-action" href={appUrl}>
                <span>Go to app</span>
                <ArrowRight aria-hidden="true" size={19} />
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
