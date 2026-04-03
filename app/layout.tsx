import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "$KELLY Token Gate",
  description: "Verify your $KELLY holdings to join the holders chat",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: "#0a0a0a",
          color: "#ffffff",
          minHeight: "100vh",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
