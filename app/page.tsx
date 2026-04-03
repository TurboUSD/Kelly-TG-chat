export default function Home() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        textAlign: "center",
        background: "#0a0a0a",
      }}
    >
      <img
        src="/kelly-icon.jpg"
        alt="Kelly"
        style={{
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          objectFit: "cover",
          marginBottom: "1.5rem",
        }}
      />
      <h1 style={{ fontSize: "2.2rem", marginBottom: "0.75rem", color: "#ff6b8a" }}>
        $KELLY Token Gate
      </h1>
      <p style={{ color: "#999", fontSize: "1rem", maxWidth: "420px", lineHeight: "1.6" }}>
        Verify your $KELLY holdings to join the holders chat on Telegram.
      </p>
      <p style={{ color: "#555", marginTop: "2rem", fontSize: "0.85rem" }}>
        Send /start to the bot on Telegram to begin verification.
      </p>
    </div>
  );
}
